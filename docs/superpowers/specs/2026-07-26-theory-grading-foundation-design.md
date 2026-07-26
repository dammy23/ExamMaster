# Theory Question Grading — Phase 1: Foundation — Design

**Status:** Approved
**Date:** 2026-07-26
**Scope:** `server/models/Exam.js`, `server/models/ExamAttempt.js`, `server/services/examAttemptService.js`, `client/src/components/admin/ExamForm.tsx`, `client/src/api/exams.ts`, `client/src/api/examAttempts.ts`, `client/src/pages/student/ExamAttempt.tsx`, `client/src/pages/student/MobileExamAttempt.tsx`

## Context

This is a new feature request: "full implementation of theory questions and its grading, with the option to use AI to grade or human." It is not part of the just-completed ExamMaster UI overhaul.

Exploration found: theory questions and AI grading already exist and work end-to-end (`aiGradingService.js` calls the configured LLM platform automatically on exam submit, storing results in `ExamAttempt.aiGradingResults`). But there is **no human grading path anywhere** — no schema fields, no route, no admin UI — and **no exam-level setting** to choose a grading mode at all. The one endpoint that sounds like manual grading (`POST /grade-theory/:attemptId`) actually just re-runs the same AI grader, and it's dead code, unreachable from any UI. AI-grading failures during submit are also silent and unrecoverable today — the attempt completes with its theory portion simply un-scored.

This feature is too large for one plan, so it's split into 3 sub-phases, brainstormed and built separately:
1. **Foundation** (this spec) — the exam setting, data model, and submission-flow logic.
2. **Admin grading queue** — a page to list attempts awaiting human review and let an admin score theory answers (also the recovery path for AI-grading failures).
3. **Student-facing feedback** — a per-question results drill-down so students can see AI/human feedback, which currently exists in the database but is never displayed anywhere.

A separate, pre-existing bug was found during exploration (`'short-answer'` is referenced throughout the codebase — CSV upload docs, AI-chat question generation, exam scoring — but was never added to the actual `Question` schema enum, so it silently fails validation). This is explicitly **out of scope** for this feature; it's a known issue to fix separately.

## Design decisions

**Grading mode — per-exam, strict (confirmed with user).** One `gradingMethod` field on `Exam`, either `'ai'` or `'manual'`. Whichever is chosen governs every theory answer in that exam — no hybrid/override mode, no per-attempt choice.

**Pending state — a new `'pending-review'` attempt status (confirmed with user).** Rather than staying `'completed'` with an incomplete score, an attempt whose theory questions aren't yet scored gets a distinct status. This status covers **two cases with one mechanism**: a manual-mode exam (always needs a human), and an AI-mode exam whose automatic grading call threw an error (previously silently lost — now visibly needs attention). Unifying both cases onto one status means Phase 2's admin grading queue is the single recovery path for both, rather than two different concepts needing separate UI.

**`manualGradingResults` — a new field parallel to `aiGradingResults`, not a unified structure.** Since grading mode is strict per-exam, an attempt is only ever graded one way — there's nothing to reconcile between an AI result and a human result for the same attempt. Adding a parallel field is lower-risk than restructuring the existing (working, tested) `aiGradingResults` field.

## Changes

### 1. `server/models/Exam.js`

Add:
```js
gradingMethod: {
  type: String,
  enum: ['ai', 'manual'],
  default: 'ai'
}
```
Default `'ai'` means every existing exam keeps today's behavior with zero data migration needed.

### 2. `server/models/ExamAttempt.js`

- Add `'pending-review'` to the `status` enum (currently `['in-progress', 'completed', 'submitted']`).
- Add a new field, structurally identical to `aiGradingResults` but with `gradedBy` (an admin `ObjectId ref User`) in place of `aiPlatform`:
```js
manualGradingResults: {
  totalScore: { type: Number, min: 0 },
  totalMaxScore: { type: Number, min: 0 },
  results: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
    score: { type: Number, min: 0 },
    maxScore: { type: Number, min: 0 },
    feedback: { type: String, trim: true },
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gradedAt: { type: Date, default: Date.now }
  }],
  gradedAt: { type: Date }
}
```

### 3. `server/services/examAttemptService.js` — `submitAttempt` branching

Current behavior (all exams): compute MCQ/true-false score, call `AIGradingService.gradeMultipleTheoryQuestions` for any answered theory questions, add the AI score, mark `status: 'completed'`.

New behavior:
- **`exam.gradingMethod === 'manual'`**: skip the AI grading call entirely. If the attempt has at least one answered theory question, set `status: 'pending-review'` and leave the theory portion at 0 (pending). If there are no theory questions to grade, `status: 'completed'` as today.
- **`exam.gradingMethod === 'ai'`, grading succeeds**: unchanged — `status: 'completed'`, `aiGradingResults` populated.
- **`exam.gradingMethod === 'ai'`, grading throws**: instead of silently completing with a missing score, set `status: 'pending-review'` too (previously: silently `'completed'` with the theory portion permanently lost).

**Attempt-limit counting fix**: the existing `completedAttempts` filter used for `maxAttempts` enforcement (`attempt.status === 'completed' || attempt.status === 'submitted'`) must also count `'pending-review'` — otherwise a student could start unlimited new attempts while a previous one awaits grading. Add `|| attempt.status === 'pending-review'` to that filter.

**Submit response shape**: add a field indicating the pending state so the client knows not to display a score. `submitAttempt`'s return value gains `status: attempt.status` (the caller currently receives `{ success, score, percentage, aiGradingCompleted, theoryQuestionsCount }`; add `status` alongside these). When `status === 'pending-review'`, `score`/`percentage` reflect only the auto-graded portion and must not be shown to the student as final.

### 4. Client — `client/src/components/admin/ExamForm.tsx`

Add one row to the "Exam Settings" card, following the existing Label+description pattern but using a `Select` (not a `Switch`, since this is a mutually-exclusive choice, not a boolean toggle):
```tsx
<div className="space-y-2">
  <Label>Grading Method</Label>
  <p className="text-sm text-muted-foreground">
    How theory questions are graded
  </p>
  <Select value={watch('gradingMethod')} onValueChange={(value) => setValue('gradingMethod', value)}>
    <SelectTrigger>
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="ai">AI Auto-Grade</SelectItem>
      <SelectItem value="manual">Human Manual Grade</SelectItem>
    </SelectContent>
  </Select>
</div>
```
Default value `'ai'` when creating a new exam, matching the schema default.

### 5. Client — `client/src/api/exams.ts` and `client/src/api/examAttempts.ts`

- Add `gradingMethod: 'ai' | 'manual';` to the `Exam` interface.
- Add `status?: string;` (or reuse the existing status union if `submitExamAttempt`'s response type already has one) to `submitExamAttempt`'s response type, reflecting the new field from step 3.

### 6. Client — `ExamAttempt.tsx` and `MobileExamAttempt.tsx` submit-toast logic

Both files currently gate the score display purely on `exam.showResultsImmediately`. Add a check for the new pending state so a `pending-review` result never shows a score regardless of that setting — this prevents showing a misleading partial/incomplete score.

`ExamAttempt.tsx`'s `handleManualSubmit`, replace:
```tsx
toast({
  title: "Exam Submitted",
  description: exam.showResultsImmediately
    ? `Your score: ${result.score}/${exam.totalMarks} (${result.percentage}%)`
    : "Your exam has been submitted successfully.",
})
```
with:
```tsx
toast({
  title: "Exam Submitted",
  description: result.status === 'pending-review'
    ? "Your exam has been submitted and is awaiting grading."
    : exam.showResultsImmediately
      ? `Your score: ${result.score}/${exam.totalMarks} (${result.percentage}%)`
      : "Your exam has been submitted successfully.",
})
```
`MobileExamAttempt.tsx`'s `handleSubmit` currently never shows a score in its toast at all (`"Your exam has been submitted successfully!"` unconditionally) — no change needed there, though the same `result.status === 'pending-review'` check could optionally give a more specific message; deferred as non-essential since the existing message is already generically correct.

`handleAutoSubmit` in both files (time-expiry auto-submit) already shows only a generic "automatically submitted" message with no score — no change needed.

## Explicitly out of scope for this phase

- No admin UI to actually grade a `pending-review` attempt yet (Phase 2).
- No change to `StudentResults.tsx`/`StudentDashboard.tsx`'s attempt-list filtering — both currently filter to `status === 'completed'` strictly, so `pending-review` attempts simply won't appear as a result row yet (not an error, just invisible until Phase 3 adds explicit handling).
- No per-question feedback display anywhere (Phase 3).
- The `'short-answer'` phantom-type bug (separate, deferred).

## Testing

No automated test framework exists in this repo. Verification: `node --check` for backend files, `npx tsc --noEmit -p tsconfig.app.json` for client files, then a manual Playwright walkthrough covering: creating an exam with each `gradingMethod`, submitting a manual-mode exam with a theory answer (confirm `pending-review` status and the "awaiting grading" toast), submitting an AI-mode exam normally (confirm unchanged `completed` behavior), and — if simulable — an AI-mode exam where grading fails (confirm it now becomes `pending-review` instead of silently losing the score).
