# ExamMaster Phase 4 (part 1): Exam Settings Enforcement

## Context

First sub-phase of Phase 4 (Student Experience), the final phase of the ExamMaster UI overhaul. Design System (Phase 1), Auth (Phase 2), and the entire Admin Suite (Phase 3) are merged to `main`. During Phase 4 scoping, the user asked specifically that the exam-taking flow be audited to confirm every setting configurable at exam-creation time (`client/src/components/admin/ExamForm.tsx`'s "Exam Settings" card) actually has an effect during the exam. That audit found three settings that are completely non-functional and one that's inconsistently enforced. This sub-phase implements the missing behavior before the three UI-cleanup sub-phases (Dashboard+Results → Exam Instructions → Exam Attempt) proceed, so that phase doesn't polish the visual presentation of settings that don't work.

This document covers `server/models/Exam.js` (read-only reference — no changes), `server/models/ExamAttempt.js`, `server/services/examAttemptService.js`, `client/src/pages/student/ExamAttempt.tsx`, and `client/src/pages/student/MobileExamAttempt.tsx`.

## Current State (found during exploration)

Cross-referencing every toggle in `ExamForm.tsx`'s "Exam Settings" card against the backend and both exam-taking pages:

| Setting | Admin-facing description | Actual behavior found |
|---|---|---|
| `randomizeQuestions` | "Shuffle question order for each student" | **Works.** `examAttemptService.js`'s `startAttempt` shuffles `selectedQuestions` and persists the order via `attempt.selectedQuestions` (an ordered array of question IDs), reused verbatim when an in-progress attempt is resumed. |
| `questionsPerExam` (`useRandomQuestions`) | Random subset of questions per attempt | **Works.** Same `startAttempt` method, same persistence. |
| `maxAttempts` / `unlimitedAttempts` | Retake limits | **Works.** `maxAttempts > 0` is checked against `completedAttempts.length`; `maxAttempts === 0` means unlimited. |
| `videoRecording` | Records student video/audio | **Works** (built in Phase 3d). |
| `mobileEnabled` | Allows mobile devices | **Works** (`ExamInstructions.tsx` gates mobile access and the fullscreen system-check requirement on this flag). |
| `randomizeOptions` | "Shuffle answer options in MCQs" | **Never implemented.** `startAttempt` sends `options: question.options \|\| []` verbatim, in the exact order stored on the question document, every time — no shuffling logic exists anywhere in the codebase outside the schema field and seed data. |
| `negativeMarking` / `negativeMarkingValue` | "Deduct marks for incorrect answers" | **Never implemented.** `submitAttempt`'s scoring loop only ever does `totalScore += question.marks` for correct multiple-choice/true-false answers — there is no subtraction path. The field is read nowhere in scoring. |
| `allowReview` | "Students can review answers before submission" | **Never implemented.** Not read anywhere server-side, and not even included in `startAttempt`'s response shape historically — though since both attempt pages independently call `getExamById` to fetch exam metadata, `exam.allowReview` is already available client-side without any new API exposure. |
| `showResultsImmediately` | "Display results right after submission" | **Inconsistently enforced.** `submitAttempt` uses it correctly to gate sending a results email, and `getStudentRecentResults` (the Dashboard's "Recent Results" widget) already filters `attempt.examId.showResultsImmediately === true`. But `getStudentAttempts` (used by `/student/results`, the full results page) applies no such filter — it returns every completed attempt regardless — and `ExamAttempt.tsx`'s `handleManualSubmit` toast (`Your score: ${result.score}/${exam.totalMarks} (${result.percentage}%)`) always reveals the score/percentage regardless of this flag. `MobileExamAttempt.tsx`'s submit toasts (`handleSubmit`/`handleAutoSubmit`) never included the score in the first place, so they're already safe. |

**Persistence pattern already established for "must stay stable across a page-refresh resume":** `ExamAttempt.js`'s `selectedQuestions` field stores the question order chosen at attempt creation; `startAttempt`'s resume branch (when an `in-progress` attempt already exists) rebuilds the `questions` response from this stored order rather than recomputing a fresh shuffle, with a fallback to unordered `exam.questions` for old attempts created before this field existed. Randomize Options needs the identical treatment — computing a fresh per-fetch shuffle would show a student a different option order after every page refresh, which is confusing even though it can't affect scoring correctness (answers are matched by value, not position).

**Scoring answer-presence check:** `submitAttempt`'s loop only scores a question when `attempt.answers.get(questionId)` is truthy — an empty string (from "Clear Response") or `undefined` (never answered) both skip scoring entirely. This means "only penalize incorrect *answered* questions, never blank ones" (the decided negative-marking behavior) is already the natural behavior of the existing guard — no new blank-detection logic is needed.

## Decisions

### 1. Randomize Options

Add a new field to `ExamAttempt.js`, mirroring `selectedQuestions`'s pattern but as a `Map` (matching the existing `answers` field's `Map` shape on the same schema) rather than an ordered array, since it needs to store an option order *per question*:

```js
optionOrders: {
  type: Map,
  of: [String],
  default: new Map()
}
```

In `startAttempt`'s fresh-start branch, immediately after `selectedQuestions` is persisted, compute and persist a shuffled option order for every `multiple-choice` question when `exam.randomizeOptions` is true:

```js
if (exam.randomizeOptions) {
  const optionOrders = new Map();
  selectedQuestions.forEach(question => {
    if (question.type === 'multiple-choice' && question.options && question.options.length > 0) {
      optionOrders.set(question._id.toString(), [...question.options].sort(() => Math.random() - 0.5));
    }
  });
  savedAttempt.optionOrders = optionOrders;
}
```

Both the fresh-start `questions` map and the resume-branch `questions` map read from `attempt.optionOrders.get(question._id.toString())` first, falling back to `question.options || []` (covering both `randomizeOptions === false` and old attempts predating this field) — the exact same fallback shape `selectedQuestions` already uses for backward compatibility.

No scoring changes needed: `submitAttempt` matches `correctAnswers.includes(studentAnswer)` by value, so option order has zero effect on correctness.

### 2. Negative Marking

In `submitAttempt`'s scoring loop, for `multiple-choice`/`true-false` questions, track correctness in a variable instead of scoring inline, then branch:

```js
if (isCorrect) {
  totalScore += question.marks;
} else if (exam.negativeMarking) {
  totalScore -= exam.negativeMarkingValue * question.marks;
}
```

Per the confirmed decision, `negativeMarkingValue` is a **fraction of that question's own marks** (e.g., `0.25` on a 4-mark question deducts 1 mark), not a flat per-question penalty — matching the schema's `max: 1` constraint (a flat deduction capped at 1 mark regardless of question value wouldn't need that ceiling) and the UI's `0.25` default. This only applies to multiple-choice/true-false — theory/short-answer questions go through separate AI grading (`AIGradingService`) that already produces granular partial credit, not a binary correct/incorrect signal, so flat negative marking doesn't apply there.

After the theory-grading AI scores are added to `totalScore` (so the floor applies to the final combined total, not just the MCQ portion), clamp the result:

```js
totalScore = Math.max(0, totalScore);
```

This prevents a heavily-penalized attempt from producing a negative score or a negative percentage, which would otherwise flow into the percentage calculation, pass/fail badges, and results displays in confusing ways.

### 3. Allow Review (forward-only navigation)

No backend changes — `exam.allowReview` is already fetched client-side via each page's existing `getExamById` call. Both `ExamAttempt.tsx` and `MobileExamAttempt.tsx` get the identical treatment, gated on `exam.allowReview`:

- **Previous button**: `disabled={currentQuestionIndex === 0 || !exam.allowReview}` — once review is disallowed, Previous is unconditionally disabled regardless of position, since by definition it only ever tries to move backward.
- **Question-navigation palette** (the grid of question-number buttons): the `onClick` handler becomes a no-op for any `index < currentQuestionIndex` when `exam.allowReview` is false — `onClick={() => { if (exam.allowReview || index >= currentQuestionIndex) setCurrentQuestionIndex(index) }}`. Forward jumps (to an index ahead of the current position) remain freely allowed in both modes; only backward jumps are blocked.
- **"Clear Response"** needs no code change — it only ever operates on `currentQuestion`, and since backward navigation is blocked, a student can never return to a passed question to invoke Clear Response on it. The restriction falls out naturally from the navigation change.

This design deliberately avoids tracking a separate "furthest reached" high-water mark: `currentQuestionIndex` itself is the single monotonically-non-decreasing boundary once review is off. A student who jumps ahead from Q1 straight to Q10 immediately loses access to Q2–Q9 as well as Q1 — all now count as "behind the current position," even the ones never actually viewed. That's a deliberate simplification: the alternative (only locking questions actually visited, via a separate high-water-mark state) avoids that particular oddity but introduces its own — a skipped-but-never-seen question becoming permanently unreachable for a different reason. Given the setting is described as "review answers before submission," treating "behind the current position" as the boundary is a simple, defensible reading of "no review" and matches how the confirmed decision was phrased ("no jumping backward in the question palette").

### 4. Show Results Immediately consistency

**Backend** — `getStudentAttempts` gets the same filter `getStudentRecentResults` already applies, scoped to only affect completed attempts (in-progress attempts have no score to hide and shouldn't be filtered):

```js
static async getStudentAttempts(studentId) {
  try {
    const attempts = await ExamAttempt.find({ studentId })
      .populate('examId', 'title subject totalMarks showResultsImmediately')
      .sort({ createdAt: -1 });

    const visibleAttempts = attempts.filter(attempt =>
      attempt.status !== 'completed' || (attempt.examId && attempt.examId.showResultsImmediately === true)
    );

    return visibleAttempts;
  } catch (error) {
    console.error('ExamAttemptService: Error getting student attempts:', error.message);
    throw error;
  }
}
```

**Client** — `ExamAttempt.tsx`'s `handleManualSubmit` toast is the only leak (confirmed `MobileExamAttempt.tsx`'s submit toasts never included a score). It becomes:

```tsx
toast({
  title: "Exam Submitted",
  description: exam.showResultsImmediately
    ? `Your score: ${result.score}/${exam.totalMarks} (${result.percentage}%)`
    : "Your exam has been submitted successfully.",
})
```

## Testing Approach

No automated test framework exists in this repo; this phase doesn't introduce one. Verification is manual: `npx tsc --noEmit -p tsconfig.app.json` for the frontend (regression check against the current baseline), then a live Playwright + direct-database walkthrough:

- Create (or use MongoDB MCP to directly configure) a test exam with `randomizeOptions: true`, attempt it twice as different sessions, and confirm MCQ option order differs between attempts but is stable across a page refresh mid-attempt.
- Configure an exam with `negativeMarking: true` and a known `negativeMarkingValue`, submit a mix of correct/incorrect/blank answers, and confirm the resulting score matches the expected fraction-based deduction and never goes negative.
- Configure an exam with `allowReview: false`, confirm Previous is disabled and the palette blocks backward jumps in both `ExamAttempt.tsx` and `MobileExamAttempt.tsx`, while forward jumps still work.
- Configure an exam with `showResultsImmediately: false`, submit it, and confirm the submit toast shows no score, the exam doesn't appear in Dashboard "Recent Results" (already-working precedent) or in `/student/results`.

## Risks

- **Scoring logic changes are inherently high-stakes** — this touches the function that computes real student scores. The `Math.max(0, totalScore)` floor and fraction-based negative marking should be double-checked against the exact confirmed decisions before merging, and verified with hand-calculated expected scores during testing, not just "does it run without erroring."
- **`optionOrders` as a `Map` field mirrors `answers`'s existing shape** on the same schema, so no new Mongoose patterns are introduced, but it's still a schema change to a model already holding live attempt data — additive only (a new optional field with a safe empty-`Map` default), so existing documents are unaffected.
- **Testing `randomizeOptions` persistence across a resume requires actually refreshing mid-attempt** in the Playwright walkthrough, not just checking the initial load — the bug this design specifically avoids (reshuffling on every fetch) would only be caught by that refresh step.
