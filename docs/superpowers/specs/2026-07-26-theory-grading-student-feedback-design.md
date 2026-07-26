# Theory Question Grading — Part 3: Student-Facing Feedback Display — Design

**Status:** Approved
**Date:** 2026-07-26
**Scope:** `server/services/examAttemptService.js`, `server/routes/examAttemptRoutes.js`, `client/src/api/examAttempts.ts`, `client/src/pages/student/StudentResults.tsx`, `client/src/pages/student/AttemptResult.tsx` (new), `client/src/App.tsx`

## Context

Parts 1 (Foundation) and 2 (Admin Grading Queue) are merged to `main`. Once an admin (or a successful AI grade) finalizes an attempt, its theory-question score and feedback live in `attempt.aiGradingResults` or `attempt.manualGradingResults` — but nothing on the student side surfaces this. `StudentResults.tsx` shows one summary row per completed attempt (score/percentage/grade) with no way to see per-question feedback, and there is no per-attempt detail page anywhere in the student experience today. Attempts with `status: 'pending-review'` are also currently invisible on the Results page — the client filters to `status === 'completed'` only, even though the backend's `getStudentAttempts` already returns pending-review attempts (they're simply dropped one layer up).

## Design decisions

**Widen the existing list, don't rebuild it.** `getStudentAttempts` already returns `pending-review` attempts (its filter only excludes *completed* attempts hidden by `showResultsImmediately: false` — a `pending-review` attempt is `status !== 'completed'`, so it already passes through). No backend change is needed for this part; only `StudentResults.tsx`'s client-side filter and rendering change.

**A new read-only detail page, not inline expansion or a modal (confirmed with user).** Each completed attempt's row gains a "View Details" link to `/student/results/:attemptId`, a dedicated page mirroring Part 2's admin `GradeAttempt.tsx` — same header-then-per-question-card layout — but read-only: no score inputs, no feedback textareas, no Retry AI Grading button. This matches the precedent Part 2 already established (`GradingQueue.tsx`/`GradeAttempt.tsx` as separate list/detail files) rather than cramming detail state into the existing summary table.

**Theory questions only — MCQ/true-false review stays out of scope.** The existing "Allow Review" exam setting already governs whether a student can navigate backward through questions *during* an attempt; this feature is strictly about surfacing the grader's theory-question score/feedback after the fact, which currently has zero visibility anywhere. Showing right/wrong MCQ answers post-completion is a different, already-addressed concern and isn't part of this design.

**Pending-review attempts render as a distinct, non-interactive row (confirmed with user).** They show a `StatusBadge status="pending-review"` ("Pending Review") in place of the grade/performance badges, dashes for the not-yet-final score/percentage cells, and no "View Details" link — there's nothing final to show yet, but the student can now at least see their submission was received and is awaiting grading, rather than it silently vanishing from the list.

**The detail endpoint re-enforces the same `showResultsImmediately` gate the list already applies.** Defense in depth: even though the UI never renders a "View Details" link for an attempt that shouldn't be visible, the new `getAttemptDetailForStudent` service method independently validates `attempt.examId.showResultsImmediately === true` (plus ownership and `status === 'completed'`) before returning data, so directly hitting the URL can't leak a result early.

## Changes

### 1. `server/services/examAttemptService.js`

- **New `getAttemptDetailForStudent(attemptId, studentId)`**: validates `mongoose.Types.ObjectId.isValid(attemptId)`, loads the attempt populating `examId` (`title subject totalMarks showResultsImmediately`) with nested `examId.questions` fully populated (mirrors Part 2's `getAttemptForGrading`). Throws "Exam attempt not found" if missing, "You are not authorized to view this exam attempt" if `attempt.studentId.toString() !== studentId.toString()`, "This exam attempt has not been fully graded yet" if `attempt.status !== 'completed'`, and "Results for this exam are not available" if `!attempt.examId.showResultsImmediately`. Returns the populated attempt.

### 2. `server/routes/examAttemptRoutes.js`

- `GET /student/attempt/:attemptId` (new, `requireUser`, no admin-only guard — any authenticated student can hit it, ownership is enforced inside the service method) → `getAttemptDetailForStudent(attemptId, req.user._id)`.

### 3. Client — `client/src/api/examAttempts.ts`

- New API function: `getAttemptDetail(attemptId)` — thin `api.get('/api/exam-attempts/student/attempt/:attemptId')` wrapper, following this file's existing pattern.

### 4. Client — `StudentResults.tsx`

- Keep the existing `completedAttempts` variable (line 70, `attempts.filter(attempt => attempt.status === 'completed')`) unchanged — it still drives every stat tile and the Performance Overview card, which must stay based on finalized results only. Add a second variable, `visibleAttempts = attempts.filter(attempt => attempt.status === 'completed' || attempt.status === 'pending-review')`, used only for the results table below. The table switches from mapping `completedAttempts` to mapping `visibleAttempts`.
- Add a new final column, "Details", to the results table (after "Time Taken"). For `completed` rows it holds a "View Details" `Link` to `/student/results/${attempt._id}`; for `pending-review` rows it's empty (no link — there's nothing to view yet).
- Branch every other cell on `attempt.status` too: `pending-review` rows show a `StatusBadge status="pending-review"` (label "Pending Review") in place of both the Grade and Performance badges, and `—` in the Score and Percentage cells (neither is final — for a manual-mode exam `attempt.score` at this point is only the non-theory portion; for an AI-mode exam under retry it may be a stale partial value). Time Taken (`attempt.timeSpent`) is already fixed at submission regardless of grading status, so it renders normally for both statuses. `completed` rows keep today's Score/Percentage/Grade/Performance rendering unchanged.

### 5. Client — `AttemptResult.tsx` (new)

- Route `/student/results/:attemptId`. Fetches via `getAttemptDetail`. Shows a back button to `/student/results`, header (exam title, submitted date, score/percentage), then one card per theory question (`examId.questions.filter(q => q.type === 'theory')`): question text, the student's own answer (from `attempt.answers`), and the grader's score/feedback for that question (looked up from `manualGradingResults.results` first, then `aiGradingResults.results`, matching by `questionId` — an attempt is only ever graded one way, so exactly one of these has real entries). If there are no theory questions, render an `EmptyState` ("This exam had no theory questions").

### 6. Client — `App.tsx`

- Add a route for `/student/results/:attemptId` → `AttemptResult`, inside the existing student fullscreen route group (alongside `/student/results`).

## Testing

No automated test framework exists in this repo. Verification: `node --check` for backend files, `npx tsc --noEmit -p tsconfig.app.json` for client files (current baseline 101), then a manual Playwright walkthrough: confirm the already-graded manual-mode attempt (from Part 2's verification, now `completed` with a real `manualGradingResults` entry) shows correctly on `/student/results` with a working "View Details" link, and that its detail page renders the theory question, the student's original answer, and the admin-entered score/feedback exactly as recorded. Also confirm the still-`pending-review` AI-mode attempt renders as a non-interactive "Pending Review" row.
