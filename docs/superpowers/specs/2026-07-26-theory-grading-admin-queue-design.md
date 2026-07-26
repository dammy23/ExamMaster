# Theory Question Grading — Part 2: Admin Grading Queue — Design

**Status:** Approved
**Date:** 2026-07-26
**Scope:** `server/services/examAttemptService.js`, `server/routes/examAttemptRoutes.js`, `client/src/api/examAttempts.ts`, `client/src/pages/admin/GradingQueue.tsx` (new), `client/src/pages/admin/GradeAttempt.tsx` (new), `client/src/pages/admin/AdminDashboard.tsx`, `client/src/App.tsx`, `client/src/components/Layout.tsx`

## Context

Part 1 (Foundation) merged to `main`: `Exam.gradingMethod` ('ai'|'manual'), `ExamAttempt.status` gained `'pending-review'`, and `ExamAttempt.manualGradingResults` was added (parallel to `aiGradingResults`, with `gradedBy: ObjectId ref User` instead of `aiPlatform`). There is currently no way for an admin to actually see or act on a `pending-review` attempt — this part builds that.

Exploration for this part surfaced two things that need fixing regardless of new UI:
- `getPendingGradingCount` still queries the pre-Part-1 logic (`status: 'completed'` + `aiGradingResults.gradedAt` doesn't exist) and no longer reflects reality.
- The existing `gradeTheoryQuestionsForAttempt` service method (backing the dead `POST /grade-theory/:attemptId` route) explicitly rejects anything except `status === 'completed'` — the opposite of what's needed now, since attempts requiring attention are `pending-review`.

No new schema fields are needed; Part 1 already added everything this part writes to.

## Design decisions

**Global cross-exam queue, not per-exam (confirmed with user).** One page lists every `pending-review` attempt across all exams the admin owns, reached via a new sidebar "Grading" nav item and by finally making `AdminDashboard.tsx`'s dead "Pending Grading" stat tile a `Link`. This differs from the video-review feature's per-exam pattern (reached from `ExamManagement`'s row menu) because grading is a cross-cutting daily task, not something tied to reviewing one specific exam.

**Two separate pages, not one dual-mode component.** `GradingQueue.tsx` (list only) and `GradeAttempt.tsx` (detail/grading form) are separate files with one clear responsibility each, unlike `StudentVideoReview.tsx`'s single component handling both list and detail via an optional route param. The grading detail view has enough of its own state (per-question score/feedback inputs, retry action) to warrant its own file.

**Retry AI Grading re-grades the whole attempt, not per-question.** Matches the existing `gradeTheoryQuestionsForAttempt`'s existing behavior (it already re-grades every theory question in the attempt as a batch). Building per-question retry would add real complexity for a case (partial AI success within one attempt) that's a minor optimization, not a functional requirement — YAGNI for this phase.

**Manual grading is all-or-nothing per attempt, not partial-save.** The admin fills in a score/feedback for every theory question and submits once; there's no "save progress and come back later" intermediate state. Keeps this phase's scope to a single working submit action rather than a multi-step draft workflow.

**The grading form pre-fills AI scores where available, blank where not, and both are equally editable.** Rather than locking successfully-AI-graded questions as read-only and only exposing failed ones for input, every question in the form is an editable score+feedback pair. This is simpler than tracking a per-question locked/unlocked state, and still lets the admin quickly confirm AI-graded questions by leaving the pre-filled value as-is.

**Score recombination reuses the existing formula.** `gradeTheoryQuestionsForAttempt` already computes `currentNonTheoryScore = attempt.score - (attempt.aiGradingResults?.totalScore || 0)` before adding the new theory total. This generalizes correctly to the manual-grading case too: for a manual-mode exam, `aiGradingResults` was never set at all (Part 1 skips AI entirely), so `attempt.score` is already the pure auto-graded portion and nothing is subtracted; for an AI-mode exam with partial/total failure, `aiGradingResults.totalScore` (0 for full failure, partial sum otherwise) is subtracted before the admin's new manual total is added. The same formula, reused as-is, handles both cases without a new stored subtotal field.

## Changes

### 1. `server/services/examAttemptService.js`

- **Rewrite `getPendingGradingCount`**: query `ExamAttempt.find({ status: 'pending-review' })`, populate `examId` (filtered to exams the requesting admin created), and return the count. Drop the old `aiGradingResults.gradedAt`-based logic entirely.
- **New `getPendingGradingAttempts(adminId)`**: same query as above but returns the full list — `_id`, `studentId` (populated `name`/`email`), `examId` (populated `title`/`gradingMethod`), `endTime`/`createdAt` for display. No pagination, matching every other admin list page (`ExamManagement`, `StudentManagement`) in this app.
- **New `getAttemptForGrading(attemptId, adminId)`**: like the existing `getAttemptForReview`, but also populates `examId.questions` (full question docs — `question`, `correctAnswers`, `marks`, `type`) so the grading form can render each theory question's text, sample answer, max marks, the student's actual answer (from `attempt.answers`), and any existing `aiGradingResults`/`manualGradingResults` entry for that question. Verifies `examId.createdBy === adminId`, same as `getAttemptForReview`.
- **Fix `gradeTheoryQuestionsForAttempt`'s status check**: replace `if (attempt.status !== 'completed')` with `if (attempt.status !== 'pending-review')` (message updated to match). After re-grading, check `aiGradingResults.results.some(r => r.error)` (the same check Part 1 added to `submitAttempt`): if any question still has an error, leave `status` as `'pending-review'`; if none do, set `status: 'completed'`.
- **New `submitManualGrades(attemptId, adminId, grades)`**: `grades` is `[{questionId, score, feedback}]`, one entry per theory question in the attempt. Validates each `score` is between 0 and that question's `marks`. Computes `currentNonTheoryScore = attempt.score - (attempt.aiGradingResults?.totalScore || 0)`, sums the submitted grades into a new theory total, sets `attempt.score`/`attempt.percentage` from the recombined total, writes `attempt.manualGradingResults = { totalScore, totalMaxScore, results: grades.map(g => ({...g, gradedBy: adminId, gradedAt: new Date()})), gradedAt: new Date() }`, and sets `status: 'completed'`. Does not modify or clear `aiGradingResults` — it's preserved as a historical record of what AI attempted.

### 2. `server/routes/examAttemptRoutes.js`

- `GET /admin/pending-grading` → `getPendingGradingAttempts` (admin-only, mirrors the existing admin-only guard pattern on every other `/admin/*` route in this file).
- `GET /admin/grading/:attemptId` → `getAttemptForGrading` (admin-only).
- `POST /manual-grade/:attemptId` → `submitManualGrades`, request body `{ grades: [{questionId, score, feedback}] }` (admin-only).
- `POST /grade-theory/:attemptId` (existing route) — no route-level change, since the fix is entirely inside `gradeTheoryQuestionsForAttempt`.

### 3. Client — `client/src/api/examAttempts.ts`

- Add `manualGradingResults?: {...}` to the `ExamAttempt` interface, mirroring `aiGradingResults`'s shape with `gradedBy?: string` in place of `aiPlatform?: string`.
- New API functions: `getPendingGradingAttempts()`, `getAttemptForGrading(attemptId)`, `submitManualGrades(attemptId, grades)` — following this file's existing pattern (thin `api.get`/`api.post` wrappers with a doc-comment header).
- `gradeTheoryQuestions(attemptId)` (the existing dead export) stays as-is; it now gets a real caller in `GradeAttempt.tsx`.

### 4. Client — `GradingQueue.tsx` (new)

A `Card` + `Table` list page, following the established `LoadingState`/`EmptyState` and `StatusBadge`/status-token conventions from every other admin page in this app. Columns: Student, Exam, Grading Method (badge), Submitted date. Each row links to `/admin/grading/:attemptId`. Empty state: "No attempts pending grading."

### 5. Client — `GradeAttempt.tsx` (new)

Shows exam/student header info, then one card per theory question: question text, the student's answer, an editable score input (pre-filled from `aiGradingResults`/`manualGradingResults` if present) and feedback textarea, and — if that question's AI result has `error: true` — a visible note showing the AI failure reason. A "Retry AI Grading" button (only rendered when `exam.gradingMethod === 'ai'`) calls the existing `gradeTheoryQuestions` API function. A "Save Grades" button submits all questions' scores/feedback via `submitManualGrades` and navigates back to the queue.

### 6. Client — navigation wiring

- `client/src/App.tsx`: add routes for `/admin/grading` (`GradingQueue`) and `/admin/grading/:attemptId` (`GradeAttempt`), inside the existing `<Layout />`-wrapped route group (same as every other admin page).
- `client/src/components/Layout.tsx`: add a "Grading" sidebar nav item, positioned like `Reports`/`Settings`.
- `client/src/pages/admin/AdminDashboard.tsx`: wrap the "Pending Grading" stat `Card` in a `Link` to `/admin/grading` (matching how other interactive dashboard elements already navigate).

## Testing

No automated test framework exists in this repo. Verification: `node --check` for backend files, `npx tsc --noEmit -p tsconfig.app.json` for client files (current baseline 101), then a manual Playwright walkthrough covering: the queue listing both leftover test attempts from Part 1 (`Theory Grading Manual Test Exam` and `AI Grading Failure Test Exam`, both `pending-review`), manually grading the manual-mode attempt (confirm it becomes `completed` with the right recombined score), and retrying AI grading on the AI-mode-failure attempt (still no `AIPlatform` configured in this dev DB, so confirm it correctly stays `pending-review` after a retry that fails again — and if time allows, configuring a working AI platform to confirm a successful retry flips it to `completed`).
