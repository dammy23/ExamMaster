# ExamMaster UI Overhaul — Phase 3c: Question Bank

## Context

Third of five sub-phases within Phase 3 (Admin suite), itself the third phase of the ExamMaster UI overhaul (design system/shell → auth → **admin** → student). Design System (Phase 1), Auth (Phase 2), Admin Dashboard (Phase 3a), and Exam Management (Phase 3b) are merged to `main`. Agreed sub-phase order: Dashboard → Exam Management → **Question Bank** → Student Management → Reports/AI Chat/Settings. This document covers `client/src/pages/admin/QuestionManagement.tsx` and `client/src/pages/admin/Subjects.tsx` (plus its already-shared `client/src/components/SubjectForm.tsx`).

## Current State (found during exploration)

- `QuestionManagement.tsx` (1167 lines) defines two separate inline form components, `CreateQuestionForm` and `EditQuestionForm`, rendering the same fields (question text via `RichTextEditor`, type selector, difficulty, marks, type-specific answer inputs, explanation) with duplicated JSX.
- **Validation asymmetry (real bug):** `CreateQuestionForm` has a `validateForm` function enforcing question length ≥10 chars (stripped of HTML), marks ≥1, 4–6 filled options with at least one correct answer for MCQ, and a required answer for true/false and theory. `EditQuestionForm` has **no validation function at all** — it submits `updatedQuestion` directly from raw `FormData` and component state with no checks, so editing can produce a question state (e.g. an MCQ with 2 options, or 0 marks) that would be rejected outright if created fresh. Backend validation (`server/models/Question.js`'s `pre('save')` hook) still enforces MCQ/true-false/theory invariants server-side, but the UI gives no inline feedback on edit the way it does on create.
- `getDifficultyBadge`/`getTypeBadge` are each defined **twice** in `QuestionManagement.tsx` — once at module scope for the list view, once again inside the separate `QuestionDetailsView` function — both with hardcoded `bg-green-100`/`bg-yellow-100`/`bg-red-100` style Tailwind classes.
- `Subjects.tsx`'s Active/Inactive badge hardcodes `bg-green-100 text-green-800` for the active case via an inline conditional className, with no equivalent styling for inactive (falls back to plain `variant="secondary"`).
- Both files use a hand-rolled `animate-spin` spinner instead of `LoadingState`, and plain-text empty/no-results paragraphs instead of `EmptyState`.
- Debug `console.log`/`console.error` calls remain: 7 in `QuestionManagement.tsx`, 3 in `Subjects.tsx`, 2 in `SubjectForm.tsx`.
- `Subjects.tsx` already delegates both create and edit to one shared `SubjectForm.tsx` component — no duplication problem there, and its validation is symmetric (the same checks run for both modes). Only the debug-log cleanup applies to it.
- Backend's `Question` schema (`server/models/Question.js:4-8`) enums `type` to exactly `['multiple-choice', 'true-false', 'theory']` — confirms the `'short-answer'` case referenced in `ExamQuestions.tsx`'s badge helper (Phase 3b, unrelated file) is unreachable dead code, not a missing type this phase needs to add support for.

## Decisions

### 1. Extract a shared `QuestionForm` component

New file `client/src/components/admin/QuestionForm.tsx`, consumed by both the "Create Question" and "Edit Question" `Dialog`s in `QuestionManagement.tsx`, eliminating the duplicated form JSX and — as a direct consequence of there being only one `validateForm` function shared by both modes — closing the validation asymmetry.

**Props:**
```ts
interface QuestionFormProps {
  mode: 'create' | 'edit'
  initialValues?: {
    type: Question['type']
    question: string
    options: string[]        // always 6 slots, padded with ''
    correctAnswers: string[]
    difficulty: Question['difficulty']
    marks: number
    explanation: string
  }
  onSubmit: (data: QuestionPayload) => Promise<void>
  submitting: boolean
}
```
`QuestionPayload` is the same shape currently built by both `handleSubmit`s (`type`, `question`, `difficulty`, `marks`, `explanation`, `options` (MCQ only), `correctAnswers`). `QuestionForm` owns: the `questionType`/`options`/`correctAnswers`/`questionText`/`explanationText` state, the single `validateForm` function (identical rules to today's create-only version), and the submit button (`Create Question` / `Update Question` label by mode). Both dialogs in `QuestionManagement.tsx` shrink to: render `<QuestionForm mode="..." initialValues={...} onSubmit={...} submitting={...} />` inside the existing `DialogContent`; the parent's `onSubmit` handler does the actual `createQuestion`/`updateQuestion` API call, toast, and dialog-close/refetch.

Dialogs stay dialogs (no page-navigation change) — a question's field count is small enough that a modal remains appropriate, unlike the exam form which spans 5 distinct sections.

### 2. Visual/UX consistency

- Replace `Subjects.tsx`'s hardcoded active-badge className with `<StatusBadge status={subject.isActive ? 'active' : 'archived'} />` — `archived`'s existing muted/dimmed style directly conveys "not available for use," the same semantic reuse already applied to exam statuses in Phase 3b. No change to the `Status` union needed — both values already exist.
- Dedupe `getDifficultyBadge`/`getTypeBadge` in `QuestionManagement.tsx` to one copy of each (module-scope functions), called from both the list view and `QuestionDetailsView` — no visual change, just removing the duplicate definitions. These stay as local categorical badges, not `StatusBadge` — difficulty and question type are not lifecycle states.
- Replace custom spinners with `<LoadingState label="..." />` in both files.
- Replace plain-text empty/no-results messages with `<EmptyState title="..." description="..." />`: `QuestionManagement` (true-empty with an "Add Question" action vs. filtered-empty), `Subjects` (true-empty with an "Add Subject" action vs. filtered-empty).
- Strip all debug `console.log`/`console.error` calls from `QuestionManagement.tsx`, `Subjects.tsx`, and `SubjectForm.tsx` — user-facing errors stay solely as toasts, consistent with every prior phase's cleanup.

## Testing Approach

No automated test framework exists in this repo; this phase doesn't introduce one. Verification is manual: `tsc --noEmit -p tsconfig.app.json` for type safety, then a live Playwright walkthrough covering: create a question of each type (MCQ, true/false, theory) via the new shared form, edit one and confirm the same validation errors that block create now also block edit (e.g. clearing the question text or dropping MCQ options below 4), bulk-upload template downloads still work, subject create/edit/delete with the new `StatusBadge`, and dark mode.

## Risks

- **`QuestionForm` extraction must keep the submitted payload shape identical** to both current handlers' output, since `ExamService`/`QuestionService` validation (mirrored client-side in `validateForm`) depends on exact field shapes — verified by comparing the new shared submit logic against both original inline handlers, not just visual testing.
- **Blast radius:** this is the first time `EditQuestionForm`'s behavior actually changes (gains validation it never had) rather than just being re-skinned — worth flagging since a user accustomed to the old permissive edit behavior will now see validation errors on edits that previously sailed through silently. This is the intended fix, not a regression.
