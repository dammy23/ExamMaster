# Phase 4 Part 2: Dashboard + Results — Design

**Status:** Approved
**Date:** 2026-07-26
**Scope:** `client/src/pages/student/StudentDashboard.tsx`, `client/src/pages/student/StudentResults.tsx`, `client/src/api/examAttempts.ts` (type fix only)

## Context

Phase 4 part 1 (Exam Settings Enforcement) merged to `main`. This is Phase 4 part 2 of 4 in the Student Experience phase (Exam Settings Enforcement → **Dashboard+Results** → Exam Instructions → Exam Attempt Desktop+Mobile).

Both files are routed in `App.tsx` outside the shared admin `<Layout />` sidebar shell — explicitly commented "Fullscreen routes without layout/sidebar." That architecture is intentional and stays unchanged; this sub-phase does not touch `App.tsx` routing.

`StudentDashboard.tsx` and `StudentResults.tsx` currently use a gradient-heavy visual language (blue/purple gradients on cards, header, and buttons) that predates and diverges from the flat navy/slate/teal design system established across Phases 1-3 admin pages.

## Bugs found

1. `StudentResults.tsx` hardcodes the literal string `"Mathematics Final Exam"` as every table row's exam name, with a code comment `{/* This would come from exam data */}` acknowledging it was a placeholder.
2. `StudentResults.tsx` hardcodes `/100` next to the score instead of using the exam's real `totalMarks`.
3. `StudentResults.tsx` has zero navigation chrome — no way to get back to `/student` (the dashboard) from this page.

Bugs 1 and 2 are now fixable as a pure frontend change: Phase 4 part 1's backend change to `getStudentAttempts` (in `server/services/examAttemptService.js`) already populates `examId` with `title subject totalMarks showResultsImmediately` for every attempt returned by `GET /api/exam-attempts/student`. The data reaches the client already; `StudentResults.tsx` just isn't using it. No backend changes are needed in this sub-phase.

The `ExamAttempt` TypeScript interface in `client/src/api/examAttempts.ts` still types `examId` as a plain `string`, which no longer matches the real populated response shape and needs correcting.

## Design decisions

**Visual language — flatten to match the admin design system.** Replace all gradient cards, the gradient header logo box, and gradient buttons with the same flat `Card` + colored-icon-and-value-text pattern established in `AdminDashboard.tsx` and reused throughout Phases 3a-3e. This makes the whole app one consistent visual language instead of two.

**Navigation chrome fix — reuse the existing `ExamInstructions.tsx` pattern, not a sidebar.** `ExamInstructions.tsx` (also a fullscreen student route) already solves exactly this problem with a lightweight "Back to Dashboard" ghost button + `ArrowLeft` icon at the top of the page. `StudentResults.tsx` gets the identical treatment. Pulling student pages into the shared admin `<Layout />` sidebar was considered and rejected — it would require new role-aware sidebar content for two pages and isn't needed to fix either known bug.

**Grade/performance badge colors — remap onto the existing 4-value status token system.** Both files use ad-hoc Tailwind colors (green-600, blue-500, yellow-500, orange-500, red, plus separate light-mode-only green-100/blue-100/yellow-100/red-100 variants) for percentage-based badges. `StudentResults.tsx` has two independently-thresholded functions; `StudentDashboard.tsx` has a third, separate 3-tier badge. Each keeps its own existing percentage thresholds — only the *color* mapping changes, onto the four existing tokens:

`StudentResults.tsx` — `getGradeBadge` (letter grades):

| Threshold | Grade | Token |
|---|---|---|
| ≥80% | A+, A | `status-success` |
| 70-79% | B | `status-info` |
| 50-69% | C, D | `status-warning` |
| <50% | F | `status-danger` |

`StudentResults.tsx` — `getPerformanceBadge`:

| Threshold | Label | Token |
|---|---|---|
| ≥85% | Excellent | `status-success` |
| 70-84% | Good | `status-info` |
| 60-69% | Average | `status-warning` |
| <60% | Needs Improvement | `status-danger` |

`StudentDashboard.tsx` — Recent Results percentage badge (its own 3-tier thresholds, distinct from both functions above — no "Average"/warning tier exists in this one):

| Threshold | Label | Token |
|---|---|---|
| ≥80% | Excellent | `status-success` |
| 60-79% | Good | `status-info` |
| <60% | Needs Improvement | `status-danger` |

## Changes

### `StudentResults.tsx`
- Add a "Back to Dashboard" header (identical pattern to `ExamInstructions.tsx`: `Link to="/student"` wrapping a `Button variant="ghost" size="sm"` with `ArrowLeft` icon).
- Replace the hardcoded exam name with `attempt.examId.title`, guarded with optional chaining and a `"Untitled Exam"` fallback for TypeScript null-safety (in practice `getStudentAttempts` always populates `examId`, so this is a type-safety guard, not an expected runtime case).
- Replace hardcoded `/100` with `attempt.examId.totalMarks`.
- Flatten the 4 gradient summary cards (Exams Completed / Average Score / Best Score / Time Spent) to plain `Card` + colored icon/value text.
- Remap `getGradeBadge`/`getPerformanceBadge` colors onto status tokens per the table above.
- Replace the ad-hoc loading spinner with `LoadingState`.
- Replace the ad-hoc "No Results Yet" block with `EmptyState`.
- Strip the `console.log('Fetching student results...')` and `console.error('Error fetching results:', error)` debug statements (the `toast` error surface to the user stays).

### `StudentDashboard.tsx`
- Flatten the gradient page background, the gradient logo box in the header, and the 2 gradient stat cards (Available Exams / Completed Exams) to plain `Card`s + colored icon/value text.
- Flatten the gradient "Start Exam" button and the gradient "Quick Tips" card.
- Remap the Recent Results percentage-tier badge colors onto status tokens per the table above.
- Replace the ad-hoc loading spinner with `LoadingState`.
- Replace the two ad-hoc empty blocks ("No exams available at this time", "No exam results available yet") with `EmptyState`.
- Strip the 3 `console.log` debug statements in `fetchDashboardData`.

### `client/src/api/examAttempts.ts`
- Update the `ExamAttempt` interface: change `examId: string` to reflect the populated shape returned by `GET /api/exam-attempts/student` — `examId: { _id: string; title: string; subject?: string; totalMarks: number; showResultsImmediately: boolean } | string` (kept as a union since other endpoints returning `ExamAttempt` — e.g. `startExamAttempt`, `saveExamAnswer` — do not populate this field).

## Testing

No automated test framework exists in this repo (consistent with every prior phase). Verification: `npx tsc --noEmit -p tsconfig.app.json` for a regression check against the current baseline (107 errors), then manual Playwright walkthrough covering light/dark mode, the populated and empty states of both pages, the corrected exam name/marks in the Results table, and the new Back to Dashboard button.
