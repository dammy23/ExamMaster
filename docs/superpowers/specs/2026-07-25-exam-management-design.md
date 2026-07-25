# ExamMaster UI Overhaul — Phase 3b: Exam Management

## Context

Second of five sub-phases within Phase 3 (Admin suite), itself the third phase of the ExamMaster UI overhaul (design system/shell → auth → **admin** → student). Design System (Phase 1), Auth (Phase 2), and Admin Dashboard (Phase 3a) are merged to `main`. Agreed sub-phase order: Dashboard → **Exam Management** → Question Bank → Student Management → Reports/AI Chat/Settings. This document covers the exam CRUD + question-assignment cluster: `ExamManagement.tsx`, `CreateExam.tsx`, `EditExam.tsx`, `ExamDetails.tsx`, `ExamQuestions.tsx`.

## Current State (found during exploration)

- `CreateExam.tsx` (673 lines) and `EditExam.tsx` (687 lines) render an almost-identical form — Basic Information, Timing & Scoring, Student Groups Assignment, Exam Settings — with the same field set, the same validation rules, and the same JSX structure copy-pasted between them. They have already drifted slightly (e.g. `EditExam`'s "Unlimited Attempts" toggle doesn't proactively reset `maxAttempts` the way `CreateExam`'s does, even though both still submit the correct value) — a direct consequence of the duplication.
- `ExamManagement.tsx` and `ExamDetails.tsx` each define their own local `getStatusBadge(status)` function with hardcoded `bg-green-100 text-green-800 dark:bg-green-900...` style Tailwind classes — the exact pattern Phase 1's hardcoded-color audit flagged elsewhere, and functionally identical to what `StatusBadge` (from Phase 1) already provides for the `draft | active | completed | archived` union.
- All five files use a hand-rolled `animate-spin rounded-full h-8 w-8 border-b-2 border-primary` spinner div for their loading state, instead of `LoadingState`.
- Plain-text empty/not-found states instead of `EmptyState`: "No exams created yet" / "No exams found matching your search" (`ExamManagement`), "No questions available" / "No questions found matching your filters" (`ExamQuestions`), and a hand-rolled "Exam not found" block with an icon, heading, description, and a "Back to Exams" button (`ExamDetails`).
- Debug `console.log`/`console.error` calls remain in all five files (e.g. `'Fetching exams...'`, `'Creating exam with data:'`, `'Updating exam questions:'`) — same category of cleanup already done in `AdminDashboard.tsx` during Phase 3a.
- **Functional gap:** every exam is created with `status: 'draft'` (hardcoded in `CreateExam.tsx`'s `onSubmit`) and nothing in the admin UI ever changes it. The backend's generic `PUT /api/exams/:id` already accepts and persists any `status` value in the body (`ExamService.update` spreads `examData` straight into `findByIdAndUpdate`, and the Mongoose schema enum-validates it) — so the capability exists end-to-end except for a UI trigger. In practice this means an admin has no way to publish, complete, or archive an exam without editing the database directly.
- `ExamQuestions.tsx`'s `getDifficultyBadge`/`getTypeBadge` are genuine categorical badges (easy/medium/hard, MCQ/T-F/short-answer) — out of scope here; they belong to the Question Bank sub-phase along with the rest of question management.

## Decisions

### 1. Extract a shared `ExamForm` component

New file `client/src/components/admin/ExamForm.tsx`, consumed by both `CreateExam.tsx` and `EditExam.tsx`, eliminating the ~600 lines of duplicated form markup between them.

**Props:**
```ts
interface ExamFormProps {
  mode: 'create' | 'edit'
  initialValues?: Partial<ExamFormData>  // only passed in edit mode, once the exam has loaded
  onSubmit: (data: ExamFormData) => Promise<void>
  submitting: boolean
}
```
`ExamFormData` is the existing interface already duplicated identically in both files today (title, description, subject, duration, startDate, endDate, totalMarks, passingMarks, instructions, allowReview, showResultsImmediately, randomizeQuestions, randomizeOptions, negativeMarking, negativeMarkingValue, unlimitedAttempts, maxAttempts, questionsPerExam, useRandomQuestions, videoRecording, mobileEnabled, assignedGroups) — moves into `ExamForm.tsx` as the single source of truth, imported by both pages.

`ExamForm` owns: the `react-hook-form` instance, fetching `getStudentGroups()`/`getActiveSubjects()`, the `RichTextEditor` description/instructions state, the student-group picker grid, all the settings switches, and the submit/cancel buttons row. It calls `onSubmit(data)` with the raw form data; the numeric coercion (`Number(data.duration)`, `maxAttempts: unlimitedAttempts ? 0 : ...`, etc.) and the `create`-vs-`update` API call stay in the two page components, since that's the one piece that's genuinely different between them.

`CreateExam.tsx` shrinks to: render header → `<ExamForm mode="create" onSubmit={handleCreate} submitting={loading} />` → on success, `createExam(...)` + navigate. It keeps the payload-size check (`estimatePayloadSize`) since that's a create-specific concern (large embedded images in a brand-new exam).

`EditExam.tsx` shrinks to: fetch the exam (`getExamById`), `LoadingState` while fetching → render header → `<ExamForm mode="edit" initialValues={...} onSubmit={handleUpdate} submitting={loading} />` → on success, `updateExam(...)` + navigate.

### 2. Exam status lifecycle

Guided, contextual actions — not a free-form status dropdown — calling the existing `updateExam(id, { status })` (no backend changes needed):

| Current status | Available actions |
|---|---|
| `draft` | **Publish** → `active`; **Archive** → `archived` |
| `active` | **Mark Completed** → `completed`; **Archive** → `archived` |
| `completed` | **Archive** → `archived` |
| `archived` | **Restore to Draft** → `draft` |

No confirmation dialog on any of these (every transition is reversible via another action in the table) — `Delete Exam` keeps its existing `AlertDialog` confirmation, unchanged. Each action shows a success/error toast, matching every other mutation in this cluster.

**Placement:**
- `ExamManagement.tsx`'s row dropdown menu: insert the status action(s) for that row's current status between "Questions" and the separator that precedes "Delete Exam".
- `ExamDetails.tsx`: the existing "Status" stat card becomes the action surface — it keeps the `StatusBadge` display but adds the relevant action button(s) for the exam's current status directly below it (a `DropdownMenu` when there are two actions available, a single `Button` when there's only one).

A small helper in a new file `client/src/lib/examStatus.ts` (shared by both `ExamManagement.tsx` and `ExamDetails.tsx`, so neither page imports from the other) maps `status → available actions`, so the transition table above exists in exactly one place:
```ts
interface StatusAction {
  label: string
  nextStatus: Exam['status']
}
function getAvailableStatusActions(current: Exam['status']): StatusAction[]
```

### 3. Visual/UX consistency (all 5 files)

- Replace both `getStatusBadge()` functions with `<StatusBadge status={exam.status} />` — direct pass-through, no translation, same as `AdminDashboard.tsx`'s Recent Exams card already does.
- Replace every custom spinner with `<LoadingState label="..." />` (a page-appropriate label per file, e.g. "Loading exams...", "Loading exam...", "Loading questions...").
- Replace plain-text empty/not-found states with `<EmptyState title="..." description="..." />`:
  - `ExamManagement`: `EmptyState` for both the true-empty and no-search-results cases, keeping the existing "Create Your First Exam" action (via `EmptyState`'s `action` prop) only in the true-empty case.
  - `ExamQuestions`: `EmptyState` for both the true-empty and no-filter-results cases.
  - `ExamDetails`: `EmptyState` for the "exam not found" case, with `action: { label: "Back to Exams", onClick: () => navigate("/admin/exams") }` replacing the current manual button.
- Strip all debug `console.log`/`console.error` calls from all five files, consistent with the `AdminDashboard.tsx` cleanup in Phase 3a — user-facing errors stay solely as toasts.
- `getDifficultyBadge`/`getTypeBadge` in `ExamQuestions.tsx` are untouched (out of scope, belongs to Question Bank).

## Testing Approach

No automated test framework exists in this repo; this phase doesn't introduce one. Verification is manual: `tsc --noEmit -p tsconfig.app.json` for type safety across all changed/new files, then a live Playwright walkthrough covering: create an exam via the new shared form, edit it, assign questions, and exercise the full status lifecycle (Publish → Mark Completed → Archive → Restore to Draft) from both `ExamManagement`'s row menu and `ExamDetails`' action surface, plus dark mode and the empty/not-found states.

## Risks

- **`ExamForm` extraction is the largest single refactor in this phase** — both pages must produce byte-identical submitted payloads to their pre-refactor selves (verified by comparing the `onSubmit` handlers' output, not just visual inspection) since `ExamService.update`/`ExamService.create` validation (passing marks ≤ total marks, end date > start date) depends on exact field shapes.
- **Authorization on status changes**: `ExamService.update` only allows the exam's original creator to update it (`exam.createdBy.toString() !== userId.toString()` → 403) — same restriction that already applies to Edit today, not a new constraint introduced here, but worth noting since a status action failing with "not authorized" would look like a new bug if this weren't already true of Edit.
