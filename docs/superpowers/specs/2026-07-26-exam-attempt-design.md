# Phase 4 Part 4: Exam Attempt (Desktop+Mobile) — Design

**Status:** Approved
**Date:** 2026-07-26
**Scope:** `server/services/examAttemptService.js` (one small addition), `client/src/api/examAttempts.ts` (type addition), `client/src/pages/student/ExamAttempt.tsx`, `client/src/pages/student/MobileExamAttempt.tsx`

## Context

Phase 4 part 3 (Exam Instructions) merged to `main`. This is Phase 4 part 4 of 4 — the final sub-phase of the entire ExamMaster UI overhaul roadmap (Exam Settings Enforcement → Dashboard+Results → Exam Instructions → **Exam Attempt Desktop+Mobile**).

This sub-phase is scoped to visual/logging cleanup only. It explicitly does not touch:
- The security/integrity monitoring logic in `ExamAttempt.tsx` — fullscreen enforcement, tab-switch detection, focus-loss tracking, right-click/keyboard-shortcut blocking, print-screen detection. All state updates, toast warnings, and server-side `logExamActivity` calls stay byte-for-byte identical.
- The Allow-Review/navigation logic in both files, already modified by Phase 4 part 1 (Exam Settings Enforcement).
- Video recording itself (the `VideoRecorder` component's internals).

## Findings from exploration

`ExamAttempt.tsx` (750 lines) is large because of its extensive exam-integrity monitoring effect (fullscreen, tab-switch, keyboard blocking, etc.) — about 10 of its roughly 20 debug `console.log`/`console.error`/`console.warn` calls sit inside that exact effect. `MobileExamAttempt.tsx` (505 lines) has no equivalent monitoring effect at all — just a timer, auto-save, and a `beforeunload` guard.

A direct `tsc` run surfaced 5 existing errors across these two files, beyond simple unused-import lint noise:

```
ExamAttempt.tsx(3,29): 'CardDescription' is declared but its value is never read.
ExamAttempt.tsx(7,1): 'Checkbox' is declared but its value is never read.
MobileExamAttempt.tsx(7,1): 'Checkbox' is declared but its value is never read.
MobileExamAttempt.tsx(35,3): 'logExamActivity' is declared but its value is never read.
MobileExamAttempt.tsx(336,38): Property 'difficulty' does not exist on type 'ExamQuestion'.
```

The last one is a genuine bug, not a type-annotation gap: `MobileExamAttempt.tsx` renders `currentQuestion.difficulty` in a badge, but `Question.js`'s schema field (`'easy' | 'medium' | 'hard'`, required) is never included in the question objects `examAttemptService.js`'s `startAttempt` method returns to the client. The badge has always rendered empty/undefined.

`MobileExamAttempt.tsx` also still has a page-wide `bg-gradient-to-b from-primary/5|10 to-background` — the app's last remaining background gradient, softer than the rainbow gradients removed from `StudentDashboard.tsx`/`StudentResults.tsx` in Phase 4 part 2 but still inconsistent with the now fully-flat app.

## Design decisions

**Difficulty badge — fix the data, don't remove the UI (confirmed with user).** Add `difficulty: question.difficulty` to both branches of `startAttempt`'s question mapping in `examAttemptService.js` (resume and fresh-start), mirroring how `type`/`question`/`options`/`marks` are already passed through. Add `difficulty: 'easy' | 'medium' | 'hard'` to the `ExamQuestion` interface in `client/src/api/examAttempts.ts`. No JSX changes needed in `MobileExamAttempt.tsx` — it already renders `currentQuestion.difficulty`; it just starts receiving real data.

**Debug logging — strip everywhere, including inside the security-monitoring effect (confirmed with user).** Removing `console.log`/`console.error`/`console.warn` calls has zero effect on monitoring behavior — the `setSecurityWarnings` state updates, destructive-variant toast warnings, and `logExamActivity` server calls in every handler (`handleVisibilityChange`, `handleFocusLoss`, `handleFullscreenChange`, `handleContextMenu`, `handleKeyDown`, `handleKeyUp`) are all untouched. This matches the zero-risk treatment console-log removal has received in every prior phase of this overhaul, including security-adjacent files.

**Mobile background gradient — flatten to `bg-background` (confirmed with user).** Full consistency with the rest of the app, which — including the desktop `ExamAttempt.tsx` — already uses a plain `bg-background` with no gradient, however subtle.

## Changes

### `server/services/examAttemptService.js`
Add `difficulty: question.difficulty` to the returned question object in both the resume branch (~line 97-102) and the fresh-start branch (~line 188-193) of `startAttempt`.

### `client/src/api/examAttempts.ts`
Add `difficulty: 'easy' | 'medium' | 'hard';` to the `ExamQuestion` interface.

### `client/src/pages/student/ExamAttempt.tsx`
- Remove the dead `CardDescription` and `Checkbox` imports.
- Strip all debug logging (~20 statements) across both `useEffect`s (the auth-token/postMessage handling effect and the security-monitoring effect) and every handler (`initializeExam`, `handleAnswerChange`, `handleAutoSubmit`, `handleManualSubmit`, the `VideoRecorder`'s `onRecordingComplete` callback).
- Replace the loading spinner, "Exam not found," and "Questions not found" ad-hoc blocks with `LoadingState`/`EmptyState`.
- Remap `getTimeColor()`'s `text-red-600`/`text-orange-600`/`text-green-600` to `status-danger`/`status-warning`/`status-success` foreground tokens.
- Remap the question-navigation palette's answered (`bg-green-100 border-green-300`, `text-green-600` check icon) and flagged (`bg-yellow-100 border-yellow-300`, `text-yellow-600` flag icon) ad-hoc colors, plus the Flag button's active-state `bg-yellow-100`, onto `status-success`/`status-warning` tokens.

### `client/src/pages/student/MobileExamAttempt.tsx`
- Remove the dead `Checkbox` and `logExamActivity` imports.
- Strip the 4 `console.error` calls (all in generic catch blocks — `toast` already surfaces the failure to the user).
- Flatten `bg-gradient-to-b from-primary/10 to-background` (loading screen) and `bg-gradient-to-b from-primary/5 to-background` (main view) to plain `bg-background`.
- Replace the loading spinner and "No Questions Available" block with `LoadingState`/`EmptyState`.
- Remap the navigation grid's answered-state color (`bg-green-100 text-green-800 border-2 border-green-300`) and its legend swatch, plus the submit-confirmation dialog's Answered (`text-green-600`)/Unanswered (`text-red-600`) counts, the `AlertTriangle` icon color, and the unanswered-warning text (`text-yellow-600`), onto status tokens.

## Testing

No automated test framework exists in this repo. Verification: `npx tsc --noEmit -p tsconfig.app.json` for a regression check (current baseline 106; expected to drop to roughly 101 as the 5 confirmed dead-import/type errors above are fixed — the plan will confirm the exact count after each task), then a manual Playwright walkthrough of both the desktop and mobile exam-taking flows in light and dark mode. Verification must explicitly confirm the security-monitoring features still fire identically post-cleanup (fullscreen still activates on attempt start, a tab switch still increments the counter and shows the destructive-variant warning toast) — proving only logging, not behavior, changed.
