# ExamMaster UI Overhaul — Phase 3a: Admin Dashboard

## Context

First of five sub-phases within Phase 3 (Admin suite), itself the third phase of the ExamMaster UI overhaul (design system/shell → auth → **admin** → student). Design System (Phase 1) and Auth (Phase 2) are merged to `main`. Agreed sub-phase order: **Dashboard → Exam Management → Question Bank → Student Management → Reports/AI Chat/Settings.** This document covers Dashboard only.

## Current State (found during exploration)

`client/src/pages/admin/AdminDashboard.tsx`:
- Four stat cards (Total Exams, Active Exams, Total Students, Recent Submissions) use hardcoded `bg-gradient-to-br from-{color}-50 ...` classes (blue/green/purple/orange) — bypass design tokens, and are exactly the pattern flagged in Phase 1's hardcoded-color audit.
- Each stat card's sub-caption ("+2 from last month", "+5 new this week") is a **hardcoded literal string**, not computed from any data.
- The "System Status" card (Server Performance 98%, Database Health 95%, Active Connections 87%) is **entirely fabricated** — no monitoring/APM system exists anywhere in this codebase to back these numbers; they are literal constants that never change.
- The main stat numbers themselves, and the "Recent Activity" feed, **are** real — backed by `getExams()`, `getStudents()`, `getAdminRecentActivity()`.
- Loading state uses a custom spinner instead of Phase 1's `LoadingState`; "No recent activities available" is a plain paragraph instead of `EmptyState` — neither shared component has a real consumer yet outside `Sidebar.tsx`.
- A `console.log('Fetching dashboard data...')` debug statement remains (same pattern already cleaned from `Sidebar.tsx`/`AuthContext.tsx` in prior phases).

## Decisions

- **Remove the fake System Status card entirely.** Real monitoring is out of scope for a dashboard reskin.
- **Remove the fake trend captions.** Show real numbers only, no fabricated comparisons.
- **Stat tiles, per the dataviz skill's guidance**: these four (soon five) numbers are not a categorical series being compared in one chart — they don't need distinct hues. Uniform flat tiles: label in `text-muted-foreground`, value in large semibold text (proportional figures, not `tabular-nums` — this is a standalone stat value, not a table column), icon in `text-muted-foreground` by default. **Exception:** Active Exams' icon and value use `text-primary` (teal) because "active" is a genuine status (matches `StatusBadge`'s existing `active` → teal mapping), not decoration.
- **Dogfood `LoadingState` and `EmptyState`** in this file — their first real usage outside `Sidebar.tsx`.
- **Add a 5th stat tile: Pending Grading**, using the reserved `status-warning` (amber) token — a genuinely actionable backlog number, not a neutral count.
- **Add two new cards**: Recent Exams and Active Subjects (see below).
- **Defer "pending video reviews"** to the Student Management sub-phase, which owns `StudentVideoReview.tsx` — no "reviewed" concept exists anywhere in the system yet; inventing one here would reach into that sub-phase's territory.
- Remove the `console.log` debug statement while the file is already being rewritten.

## New Backend: Pending Grading Count

**Definition** (mirrors the existing per-attempt logic in `ExamAttemptService.gradeTheoryQuestionsForAttempt`, aggregated across all exams): an attempt counts as pending grading if its `status` is `'completed'`, its `aiGradingResults.gradedAt` is not set, and its exam has at least one `type: 'theory'` question that the student actually answered (present in `attempt.answers`).

**New method** `ExamAttemptService.getPendingGradingCount()` in `server/services/examAttemptService.js`:
```js
static async getPendingGradingCount() {
  const attempts = await ExamAttempt.find({
    status: 'completed',
    'aiGradingResults.gradedAt': { $exists: false }
  }).populate({ path: 'examId', populate: { path: 'questions' } });

  let count = 0;
  for (const attempt of attempts) {
    if (!attempt.examId || !attempt.examId.questions) continue;
    const hasUngradedTheory = attempt.examId.questions.some(
      (q) => q.type === 'theory' && attempt.answers.get(q._id.toString())
    );
    if (hasUngradedTheory) count++;
  }
  return count;
}
```

**New route** `GET /api/exam-attempts/admin/pending-grading-count` in `server/routes/examAttemptRoutes.js`, following the exact `requireUser` + inline `req.user.role !== 'admin'` → 403 pattern already used by the adjacent `/admin/recent-activity` route (not `requireAdmin` middleware — this codebase doesn't use that pattern here, it checks role inline).

**New client function** `getPendingGradingCount()` in `client/src/api/examAttempts.ts`, following the exact shape of `getAdminRecentActivity()` (plain `api.get`, throw on error).

## New Dashboard Sections

- **Recent Exams** card: last 5 exams sorted by `createdAt` descending, from the already-fetched `getExams()` response (no new backend call). Each row: `title`, `subject.name`, `StatusBadge` (Exam's `status` union — `draft | active | completed | archived` — is identical to `StatusBadge`'s `Status` type for those four values, zero changes needed there), linking to `/admin/exams/:id/details`.
- **Active Subjects** card: list of subject names from the existing `getActiveSubjects()` endpoint, with the count shown in the card header (e.g. "Active Subjects (6)").
- Layout: stat tiles row (now 5 tiles) → existing `[Recent Activity | Quick Actions]` row (unchanged structure, dogfooding `LoadingState`/`EmptyState`) → new `[Recent Exams | Active Subjects]` row.

## Testing Approach

Same as prior phases: no automated test framework exists in this repo and this phase doesn't introduce one. Verification is manual and live: run both dev servers, log in as admin, and confirm every number/list on the dashboard reflects real database state — cross-check the Pending Grading count against actual data (e.g. by seeding or identifying at least one completed attempt with an ungraded theory answer, or confirming it correctly shows 0 when none exist).

## Risks

- **`getPendingGradingCount()` performance**: fetches all completed attempts with populated exam+questions, no pagination — consistent with this codebase's existing scale assumptions elsewhere (e.g. `UserService.getAllUsers()` has the same unpaginated shape), not a new anti-pattern introduced here, but worth knowing if the real dataset ever grows large.
- **Blast radius**: `AdminDashboard.tsx` is the first real page (not shell) to consume `LoadingState`/`EmptyState`/`StatusBadge` — if any of those three components have a latent issue, this is where it surfaces first.
