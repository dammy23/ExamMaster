# Exam Proctoring Suite — Part 2: Screen Recording + Live Screenshots — Design

**Status:** Approved
**Date:** 2026-07-27
**Scope:** `server/models/Exam.js`, `server/models/ExamAttempt.js`, `server/utils/screenRecordingHandler.js` (new), `server/routes/examAttemptRoutes.js`, `server/services/examAttemptService.js`, `server/sockets/connectionHandlers.js`, `client/src/components/admin/ExamForm.tsx`, `client/src/components/ScreenRecorder.tsx` (new), `client/src/pages/student/ExamAttempt.tsx`, `client/src/pages/admin/StudentVideoReview.tsx`, `client/src/pages/admin/LiveMonitoring.tsx`, `client/src/api/examAttempts.ts`

## Context

This is Part 2 of the exam proctoring suite (see [[exammaster-exam-proctoring-progress]]). Part 1 (real-time infrastructure + live admin monitoring dashboard) is merged to `main`. Part 2 covers the "sharing and recording of VDU screen" half of the original request — Part 3 (browser-based cheat-detection heuristics) is separate, later work.

Codebase research (re-verified fresh for this design, not assumed from Part 1) confirmed the existing webcam-recording pattern this part extends:
- `client/src/components/VideoRecorder.tsx`: a self-contained, auto-starting, floating draggable widget. Requests `getUserMedia`, records via `MediaRecorder` in 1-second chunks, concatenates all chunks into one `Blob` on stop, uploads that single blob once (no periodic/chunked network upload). No manual stop control exists in the UI today (the button is commented out) — recording only ends via component unmount (navigating away / exam submission).
- `server/utils/videoHandler.js`: multer disk storage under `server/uploads/videos/`, 500MB file-size cap, filename pattern `{timestamp}_{randomHash}_{sanitizedName}`, plus a signed-URL scheme (SHA-256 hash of `filename_examId_studentId_timestamp`, 24h TTL) for gated streaming playback.
- `Exam.js`'s `videoRecording: Boolean` toggle, surfaced in `ExamForm.tsx` as a "Use Video Security" switch, seeded into each new `ExamAttempt`'s `videoRecording` sub-schema by `ExamAttemptService.startAttempt`.
- `StudentVideoReview.tsx`'s three existing tabs (Video Recording, Security Log, Activity Timeline), and its `renderVideoPlayer` helper (whose spinner-overlay positioning bug was fixed earlier this session).

A key technical fact shaping this design: a single `getDisplayMedia()` call returns one `MediaStream` that can simultaneously feed a `MediaRecorder` (full-session recording, for after-the-fact review) *and* periodic canvas snapshots (for the admin's live view) — one permission grant, two consumers. That's why Part 1's original scoping bundled "screen recording" and "periodic live-view screenshots" into one part rather than splitting them further.

## Decisions

**A new, independent "Screen Recording" toggle** — not bundled into the existing "Use Video Security" switch. An admin can enable webcam, screen, both, or neither per exam, matching how the existing toggles (video vs. mobile-allowed) are already independent rather than coupled.

**Screen recording mirrors the webcam pattern as closely as possible** — same component shape (`ScreenRecorder.tsx` alongside `VideoRecorder.tsx`, not replacing it), same record-fully-then-upload-once lifecycle, same signed-URL streaming scheme. The only substantive difference: a separate, higher multer file-size cap (1.5GB vs. 500MB) since screen content is typically larger/longer than webcam clips, and a separate storage directory (`server/uploads/screen-recordings/`) to keep the two capture types distinguishable on disk.

**When both webcam and screen recording are enabled, two independent floating widgets run side by side** — `ScreenRecorder.tsx` reuses `VideoRecorder.tsx`'s exact auto-start/floating/status-badge pattern rather than inventing a combined setup flow. Browsers require separate permission prompts for `getUserMedia` vs. `getDisplayMedia` regardless, so there's no real UI unification available at the browser level anyway; reusing a proven pattern twice is simpler than building a new combined-flow paradigm for two widgets that already work well independently.

**Live screenshots refresh every 10 seconds, are purely ephemeral (never persisted), and render as a thumbnail directly in the Live Monitoring table.** 10s balances "catches most proctoring concerns" against bandwidth/load, given Part 1's tab-switch/activity logging already covers fast in-and-out behavior within that window. No persistence because the full screen recording (above) already covers after-the-fact review — storing hundreds of interim JPEGs per attempt would be pure storage cost with no matching benefit. Thumbnail-in-table (not a separate detail view) lets the admin glance across every student's screen at once from the existing Live Monitoring page, with click-to-enlarge via the codebase's existing `Dialog` component (already used in `SettingsPage.tsx`, `DatabaseSeeding.tsx`, `StudentManagement.tsx`, `Subjects.tsx`).

**Screen recording is desktop-only, matching today's status quo.** `getDisplayMedia` has weak/inconsistent support on mobile browsers (notably iOS Safari), and `MobileExamAttempt.tsx` already has zero webcam recording or security-monitoring code — this part doesn't change that boundary. The mobile-proctoring gap stays open as a distinct future initiative if ever needed.

## Changes

### 1. Data model

- `server/models/Exam.js`: new field `screenRecording: { type: Boolean, default: false }`, alongside the existing `videoRecording` field.
- `server/models/ExamAttempt.js`: new `screenRecording` sub-schema, identical in shape to the existing `videoRecording` one — `enabled`, `videoUrl`, `recordingStartTime`, `recordingEndTime`, `recordingStatus` (enum `not_started`/`recording`/`completed`/`failed`), `fileSize`, `reviewed`, `reviewedAt`.
- `ExamAttemptService.startAttempt` seeds `screenRecording.enabled`/`recordingStatus` from `exam.screenRecording`, the same way it already seeds `videoRecording`.

### 2. Screen recording capture, upload, and playback

- New `client/src/components/ScreenRecorder.tsx`: near-identical to `VideoRecorder.tsx` (auto-start on mount, floating draggable/minimizable card, `MediaRecorder` 1s-chunked recording, blob-on-stop, auto-upload-on-stop), but calls `navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 10 } } })` instead of `getUserMedia` (screen content doesn't need 30fps; a lower ideal frame rate keeps file size down), and posts to the new screen-recording routes instead of the video ones.
- `client/src/pages/student/ExamAttempt.tsx`: renders `<ScreenRecorder attemptId={attemptId} />` conditionally on a new `screenRecordingEnabled` state (mirroring `videoRecordingEnabled`), independent of and alongside the existing `<VideoRecorder>` conditional render.
- New `server/utils/screenRecordingHandler.js`: mirrors `videoHandler.js`'s `multer.diskStorage` (destination `server/uploads/screen-recordings/`, same filename pattern), file filter (same video mimetypes), signed-URL generation/validation (same SHA-256 scheme), and file-info/delete helpers — with `limits.fileSize` raised to `1.5 * 1024 * 1024 * 1024` (1.5GB).
- New routes in `server/routes/examAttemptRoutes.js`, mirroring the existing `/video/*` ones: `POST /screen/start`, `POST /screen/upload` (multer via the new handler), `GET /screen/:examId/:studentId/:filename` (token-gated streaming, same validation as the video route).
- New `client/src/api/examAttempts.ts` functions: `startScreenRecording(attemptId)`, `uploadScreenRecording(attemptId, blob)` — mirroring `startVideoRecording`/`uploadVideoRecording` exactly.
- `client/src/pages/admin/StudentVideoReview.tsx` gains a fourth tab, "Screen Recording", reusing the existing `renderVideoPlayer` helper (now correctly `relative`-positioned) pointed at `selectedAttempt.screenRecording.videoUrl` when present, following the same enabled/videoUrl/recordingStatus conditional structure the existing "Video Recording" tab already uses.

### 3. Live screenshots

- `ScreenRecorder.tsx` also runs a second, independent `setInterval` (10s) once recording is active: draws the current frame from the screen-share `MediaStream` (via an offscreen `<video>` + `<canvas>` pair, `canvas.drawImage(videoEl, ...)`, `canvas.toDataURL('image/jpeg', 0.5)`) and emits `socket.emit('screenshot:capture', { attemptId, imageDataUrl })` over the existing Part 1 socket connection (`getSocket()`).
- New handler in `server/sockets/connectionHandlers.js`: `socket.on('screenshot:capture', async ({ attemptId, imageDataUrl }) => {...})` — looks up the attempt's owning admin via `ExamAttempt.findById(attemptId).populate('examId', 'createdBy')` (same resolution shape Part 1's `logActivity` emission already uses), then relays via the existing `socketManager.emitToAdmin(adminId, 'screenshot:pushed', { attemptId, imageDataUrl, timestamp: new Date() })`. This is the first *client-initiated* socket message in the app (Part 1 only had server-initiated emissions triggered from REST handlers) — the handler registration itself is new, but it reuses `emitToAdmin` and the admin-room model exactly as-is.
- Screenshots are **not** written to any model field or disk location — purely transient, relayed and discarded.
- `client/src/pages/admin/LiveMonitoring.tsx`: `LiveAttempt` (client-side type) gains an optional `latestScreenshot?: string` field, updated in place by a new `screenshot:pushed` listener (alongside the existing `attempt:started`/`attempt:activity`/`attempt:ended` ones). A new "Screen" column renders a small `<img>` thumbnail (or a placeholder icon when absent), wrapped in a `Dialog` trigger so clicking it opens the same image larger.

## Testing

No automated test framework exists in this repo. Verification: `node --check` for backend files, `npx tsc --noEmit -p tsconfig.app.json` for client files (current baseline — check at execution time, since it may have shifted since Part 1). Manual walkthrough: enable "Screen Recording" on a test exam (alone, then alongside "Use Video Security" to confirm both floating widgets run independently without interfering with each other); start an attempt as a student, grant screen-share permission, confirm the admin's Live Monitoring page shows a live-updating thumbnail every ~10s for that attempt with no page refresh; submit the attempt and confirm the screen recording appears correctly in `StudentVideoReview.tsx`'s new "Screen Recording" tab, playable via the existing (now correctly-scoped) video player. Confirm a screen recording well under 1.5GB uploads successfully, and confirm the multer limit is actually enforced (a request the client shouldn't produce in practice, but the server-side cap should still reject an oversized file, matching the existing webcam route's behavior). Confirm `MobileExamAttempt.tsx` is untouched and unaffected.
