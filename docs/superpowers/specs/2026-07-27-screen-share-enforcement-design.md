# Screen Share Enforcement — Design

**Status:** Approved
**Date:** 2026-07-27
**Scope:** `client/src/lib/screenShareGate.ts` (new), `client/src/components/ScreenRecorder.tsx`, `client/src/pages/student/ExamAttempt.tsx`, `server/models/ExamAttempt.js`, `server/services/examAttemptService.js`, `server/routes/examAttemptRoutes.js`, `server/sockets/activityClassifier.js`, `client/src/api/examAttempts.ts`, `client/src/pages/admin/StudentVideoReview.tsx`

## Context

The exam proctoring suite's screen-recording feature (built in the earlier Part 2 of that initiative, merged to `main`) has a real gap: user report — "The way screen sharing works is wrong. Student should only be allowed to take exam only if they have share their entire screen. Also the screen sharing needs to be recorded and stored."

Investigation confirmed the exact problems:
- `ScreenRecorder.tsx`'s `getDisplayMedia({video: {frameRate: {ideal: 10}}})` call has no `displaySurface` constraint, so the browser's native picker lets the student choose "Entire Screen," "Window," or a single "Tab" freely — there's no restriction to entire-screen, and no post-grant validation of what was actually shared.
- There's no enforcement at all. `ScreenRecorder` is rendered alongside exam content (`{screenRecordingEnabled && <ScreenRecorder attemptId={attemptId} />}`) in `ExamAttempt.tsx`. If the student denies the permission prompt or ignores the resulting error card, the exam continues fully interactive regardless.
- Recording, upload, and storage already work correctly (Part 2: `MediaRecorder` → blob → `uploadScreenRecording` → stored server-side, 1.5GB cap, signed-URL playback) — this part of the original report is already satisfied by existing code and isn't being rebuilt, just extended to handle multiple segments (see below).

A real architectural constraint shapes this design: the exam opens in a brand-new browser window via `window.open()` from `ExamInstructions.tsx`, and a granted `MediaStream` cannot be transferred between browser windows. The gate must therefore live inside the exam window itself (`ExamAttempt.tsx`), not on the Instructions page.

A second constraint discovered during design: `MediaRecorder` cannot resume on a new stream once the original stream's tracks end. If a student stops sharing mid-exam and re-shares, that is mechanically a new recording, not a continuation — this data model accounts for multiple segments per attempt from the start.

## Decisions

**The gate blocks the exam, not just the recording.** `initializeExam()` currently fires `getExamById` and `startExamAttempt` together via `Promise.all`, starting the attempt (and the clock) immediately on mount regardless of screen-share status. This splits: fetch the exam first, and if `exam.screenRecording` is true, block on a full-screen "must share entire screen" UI before `startExamAttempt` is ever called. The timer does not start until a validated entire-screen share is confirmed — no exam time is wasted sorting out permissions, and the student never sees exam content without the requirement already met.

**"Entire screen" is enforced, not just hinted.** `getDisplayMedia` is called with `displaySurface: 'monitor'` as a hint, but browsers don't universally treat that as a hard restriction on what the picker offers. After a grant, the returned track's actual `getSettings().displaySurface` is checked. Anything other than `'monitor'` (Window or Tab) is rejected: the stream is immediately stopped, an explanatory error shown, and the student can retry. No exam content is reachable without a confirmed `'monitor'` share.

**Gate logic is a reusable utility (`screenShareGate.ts`), separate from recording (`ScreenRecorder.tsx`).** The gate has to run *before* an `attemptId` exists (since starting the attempt is what's being gated), but `ScreenRecorder`'s existing job — record a stream and upload it via attempt-scoped API calls — needs a real `attemptId`. Splitting these lets the same gate utility be reused both for the initial check and for re-acquiring a stream after a mid-exam loss, while `ScreenRecorder` narrows to "given a stream and an attemptId, record and upload it."

**Mid-exam share loss blocks with a re-share overlay; the timer keeps running.** If the student stops sharing (native "Stop sharing" control) or the stream otherwise ends, `ExamAttempt.tsx` re-shows the same blocking UI over the (still-mounted, state-preserved) exam content. This is stricter than the existing fullscreen-exit handling (which only logs + toasts + silently retries) because the user explicitly wants hard enforcement here. The clock is not paused — consistent with how fullscreen-exit already behaves — and the loss is logged as a `severity: 'high'` violation (`screen_share_lost`) via the existing Part 3 classifier pipeline. There is no retry cap and no auto-submit-on-repeated-failure: the student is blocked until they comply or exam time runs out, avoiding an arbitrary threshold that could unfairly lock someone out.

**Multiple recording segments are stored as a list, not overwritten.** Since a mid-exam stop-and-reshare mechanically produces a new recording rather than a continuation of the old one, `screenRecording.videoUrl` (a single field) becomes `screenRecording.segments` (an array of `{videoUrl, fileSize, startTime, endTime}`). Nothing is silently discarded, and a pattern of frequent stop/re-share is itself a visible signal to the admin reviewing the attempt.

**Out of scope:** `VideoRecorder.tsx` (webcam) has an analogous lack-of-enforcement gap, but the user only asked about screen sharing — it is not touched by this change. `MobileExamAttempt.tsx` has zero screen/video recording code today and stays that way, consistent with every prior part of the exam-proctoring initiative.

## Changes

### 1. Screen-share gate utility

- New `client/src/lib/screenShareGate.ts`: exports `requestEntireScreenShare(): Promise<MediaStream>`. Calls `navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor', frameRate: { ideal: 10 } } })`, then checks `stream.getVideoTracks()[0].getSettings().displaySurface`. If it isn't `'monitor'`, stops the stream's tracks and throws a `WrongSurfaceError` (a distinguishable error class/name) so calling code can show the right message ("You must share your Entire Screen, not a window or tab") versus a plain denial (`NotAllowedError`, unchanged browser error). On success, returns the validated `MediaStream`.

### 2. `ExamAttempt.tsx` restructuring

- `initializeExam()` splits into two phases. Phase 1 (on mount): fetch the exam via `getExamById(id)` only. If `examData.screenRecording` is true, render a full-screen blocking UI (a new small presentational piece, reusing the visual treatment of `ScreenRecorder.tsx`'s existing setup/error cards but centered full-viewport since no exam content exists yet) and call `requestEntireScreenShare()`. On success, store the returned `MediaStream` in state and proceed to Phase 2. On `WrongSurfaceError` or denial, show the appropriate retry UI (do not proceed). If `screenRecording` is false, skip straight to Phase 2.
- Phase 2: call `startExamAttempt(id)`, exactly as today, to obtain `attemptId` and render the real exam. `screenRecordingEnabled` state (already present) continues to gate whether `<ScreenRecorder>` renders at all.
- `<ScreenRecorder attemptId={attemptId} stream={screenShareStream} onStreamLost={handleStreamLost} />` — `ScreenRecorder` now receives its stream via props instead of requesting its own.
- `handleStreamLost`: sets a `screenShareBlocked` flag, logs `screen_share_lost` via the existing `logExamActivity(attemptId, 'screen_share_lost')`, and renders the same blocking UI *over* the still-mounted exam content (a `fixed inset-0 z-50` overlay, matching the z-index convention `ScreenRecorder`'s own floating widget already uses). The overlay calls `requestEntireScreenShare()` again on retry; on success, it clears `screenShareBlocked`, hands the new stream to `ScreenRecorder` (which starts a new segment), and exam content becomes interactive again — the timer never stopped.

### 3. `ScreenRecorder.tsx` narrowing

- Props change from `{ attemptId }` to `{ attemptId, stream, onStreamLost }`. All of its own `getDisplayMedia`/`requestPermissions` logic is removed — it no longer requests permission itself.
- On receiving a `stream` prop (and having a real `attemptId`), it calls `startScreenRecording(attemptId)` (unchanged — idempotent, safe to call again on each new segment) and starts a new `MediaRecorder` on that stream, exactly as today.
- The existing `ended` listener on the stream's video track now calls `onStreamLost()` (in addition to the existing `stopRecording()` → finalize → auto-upload behavior, which is preserved — the current segment still finalizes and uploads normally when sharing stops).
- The floating draggable widget UI (recording indicator, status badge) is unchanged — it's still what's shown while actively recording. The setup/error card states move to the new blocking-overlay component in `ExamAttempt.tsx` (or are extracted into a small shared presentational component to avoid duplicating that markup — implementation detail for the plan to settle, not a behavioral difference).

### 4. Data model and upload endpoint

- `server/models/ExamAttempt.js`: `screenRecording`'s `videoUrl`, `fileSize`, `recordingStartTime`, `recordingEndTime` fields are replaced with `segments: [{ videoUrl: String, fileSize: Number, startTime: Date, endTime: Date }]`. `enabled`, `recordingStatus`, `reviewed`, `reviewedAt` are unchanged (attempt-level, not per-segment).
- `server/services/examAttemptService.js`: `startScreenRecording` is unchanged in behavior (sets `recordingStatus: 'recording'`, callable again per segment). `updateScreenRecording` changes from setting flat fields to pushing a new entry onto `screenRecording.segments`.
- `client/src/api/examAttempts.ts`'s `uploadScreenRecording(attemptId, blob)` gains a `startedAt` timestamp (captured client-side when that segment's `MediaRecorder` started) sent alongside the blob, so the server can record an accurate `startTime` for the segment (`endTime` is stamped as upload-received time).
- `POST /api/exam-attempts/screen/upload` (`server/routes/examAttemptRoutes.js`): passes the new `startedAt` field through to `updateScreenRecording`; otherwise unchanged (same multer handler, same 1.5GB cap, same storage directory).

### 5. Severity classification

- `server/sockets/activityClassifier.js`: `screen_share_lost` added to `HIGH_SEVERITY_ACTIVITIES`, alongside `fullscreen_exit` and the other hard violations.

### 6. Admin review

- `client/src/pages/admin/StudentVideoReview.tsx`: the "Screen Recording" tab, which currently plays one video via `renderVideoPlayer` pointed at `screenRecording.videoUrl`, becomes a list. Each entry in `screenRecording.segments` gets its own labeled player (e.g., "Segment 1 · 10:03:12–10:17:40"), reusing the existing `renderVideoPlayer` helper per segment. No new "mark as reviewed" mechanism per segment — `reviewed`/`reviewedAt` stay attempt-level, matching the existing convention from Part 2.

## Testing

No automated test framework exists in this repo (consistent with every prior part of this initiative). This environment's `getDisplayMedia` fake-grant is slow (~26s per grant) and can be awkward with near-simultaneous concurrent requests — verification budgets real time per grant rather than assuming instant resolution.

- **Gate blocks correctly:** confirm `startExamAttempt` is not called (no network request, no attempt document created) until a valid `'monitor'` share is granted. Confirm a Window/Tab share is rejected with the specific wrong-surface message and the stream is actually stopped (not silently left open). Confirm a denied prompt shows the retry UI, not exam content.
- **Segment storage:** drive a full gate → start → mid-exam stream-`ended` → re-share → second segment cycle, and confirm via direct DB/API inspection that `screenRecording.segments` contains two entries with sane `startTime`/`endTime` values and two distinct uploaded files exist server-side.
- **Severity + live monitoring:** confirm `screen_share_lost` reaches the admin's Live Monitoring "Recent Alerts" panel with a `High` badge, using the same direct-HTTP-driven verification approach established in the cheat-detection work (drive activity logging via curl with a real JWT while watching one browser tab as the admin, avoiding the same-origin `localStorage`-sharing pitfall documented during that work).
- **Admin review:** confirm `StudentVideoReview.tsx`'s Screen Recording tab renders multiple labeled segment players when `segments` has more than one entry, and confirm the existing single-segment case (most attempts) still renders and plays correctly.
- Confirm `VideoRecorder.tsx` and `MobileExamAttempt.tsx` are unaffected — no diff against `main` for either file.
