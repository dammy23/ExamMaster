# ExamMaster Exam Settings Enforcement (Phase 4 part 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make four exam-creation settings actually work during exam-taking — three (`randomizeOptions`, `negativeMarking`, `allowReview`) currently have zero effect despite being fully exposed and configurable in `ExamForm.tsx`, and a fourth (`showResultsImmediately`) is enforced inconsistently between the Dashboard, the full Results page, and the submit-confirmation toast.

**Architecture:** Backend-first (model → `startAttempt` → `submitAttempt` → `getStudentAttempts`), since three of the four fixes are pure server-side logic with no client dependency. The fourth (`allowReview`) is client-only, since `exam.allowReview` is already available in both exam-taking pages via their existing `getExamById` call — no new API surface needed. Each task is independently verifiable and testable.

**Tech Stack:** Node.js/Express (plain JavaScript, no TypeScript) on the server; React + TypeScript (Vite) on the client. No test framework exists in this repo.

## Global Constraints

- No automated test framework exists in this repo. Backend (`.js`) changes are verified with `node --check <file>` (syntax-only) per task, then functionally verified end-to-end in the final manual-verification task. Client (`.tsx`) changes are verified with `npx tsc --noEmit -p tsconfig.app.json` (never bare `tsc --noEmit`).
- Any new `npm install` in a fresh worktree needs `PUPPETEER_SKIP_DOWNLOAD=true` set first.
- `server/.env` is gitignored and does not exist in a fresh worktree — create it before starting the dev server, with `DATABASE_URL=mongodb://localhost:27017/exammaster-dev`, a freshly generated `JWT_SECRET`, and `PORT=3000`.
- Use `http://127.0.0.1:5173` in Playwright, never `localhost`.
- **`negativeMarkingValue` is a fraction of each question's own marks** (e.g., `0.25` on a 4-mark question deducts 1 mark) — confirmed decision, not a flat per-answer penalty.
- **`allowReview: false` means forward-only navigation**: once `currentQuestionIndex` moves past a question, that question (and everything before the current position) becomes unreachable — confirmed decision. Forward jumps remain unrestricted in both modes.
- This sub-phase is scoped to functional correctness only — do not strip debug logging or touch visual/color styling in any file this plan modifies. Those are reserved for the later Phase 4 UI-cleanup sub-phases (Dashboard+Results, Exam Instructions, Exam Attempt).
- Do not touch `server/models/Exam.js` — all four settings already exist on the schema; only `server/models/ExamAttempt.js` needs a new field.

---

### Task 1: `ExamAttempt.js` — add `optionOrders` field

**Files:**
- Modify: `server/models/ExamAttempt.js:48-51`

**Interfaces:**
- Produces: `optionOrders` — a Mongoose `Map` field on `ExamAttempt` documents, keyed by question ID (string) with an array of option strings as the value. Task 2 populates and reads this field.

- [ ] **Step 1: Add the field**

Replace:

```js
  selectedQuestions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  tabSwitches: {
```

with:

```js
  selectedQuestions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  optionOrders: {
    type: Map,
    of: [String],
    default: new Map()
  },
  tabSwitches: {
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server/models/ExamAttempt.js` (from the repo root)
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add server/models/ExamAttempt.js
git commit -m "Add optionOrders field to ExamAttempt for persisting shuffled MCQ options"
```

---

### Task 2: `examAttemptService.js` — implement Randomize Options

**Files:**
- Modify: `server/services/examAttemptService.js` (`startAttempt` method — both the resume-existing-attempt branch and the fresh-start branch)

**Interfaces:**
- Consumes: `optionOrders` field from Task 1.
- Produces: no change to `startAttempt`'s return shape — `questions[].options` now contains the persisted shuffled order (or the original order, unchanged) rather than always the original order.

- [ ] **Step 1: Use stored option order when resuming an existing attempt**

Replace:

```js
        const questions = questionsToReturn.map(question => ({
          _id: question._id,
          type: question.type,
          question: question.question,
          options: question.options || [],
          marks: question.marks
        }));
```

with:

```js
        const questions = questionsToReturn.map(question => {
          const storedOrder = activeAttempt.optionOrders?.get(question._id.toString());
          return {
            _id: question._id,
            type: question.type,
            question: question.question,
            options: storedOrder || question.options || [],
            marks: question.marks
          };
        });
```

- [ ] **Step 2: Shuffle and persist option order on a fresh attempt start**

Replace:

```js
      // Store the selected question IDs in their randomized order
      savedAttempt.selectedQuestions = selectedQuestions.map(q => q._id);
      await savedAttempt.save();
      
      const questions = selectedQuestions.map(question => ({
        _id: question._id,
        type: question.type,
        question: question.question,
        options: question.options || [],
        marks: question.marks
      }));
```

with:

```js
      // Store the selected question IDs in their randomized order
      savedAttempt.selectedQuestions = selectedQuestions.map(q => q._id);

      // If randomizeOptions is enabled, shuffle and persist MCQ option order per question
      // (persisted, not recomputed per-fetch, so a page refresh mid-attempt doesn't reorder options)
      if (exam.randomizeOptions) {
        const optionOrders = new Map();
        selectedQuestions.forEach(question => {
          if (question.type === 'multiple-choice' && question.options && question.options.length > 0) {
            optionOrders.set(question._id.toString(), [...question.options].sort(() => Math.random() - 0.5));
          }
        });
        savedAttempt.optionOrders = optionOrders;
      }

      await savedAttempt.save();
      
      const questions = selectedQuestions.map(question => {
        const storedOrder = savedAttempt.optionOrders?.get(question._id.toString());
        return {
          _id: question._id,
          type: question.type,
          question: question.question,
          options: storedOrder || question.options || [],
          marks: question.marks
        };
      });
```

- [ ] **Step 3: Verify syntax**

Run: `node --check server/services/examAttemptService.js`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add server/services/examAttemptService.js
git commit -m "Implement randomizeOptions: shuffle and persist MCQ option order per attempt"
```

---

### Task 3: `examAttemptService.js` — implement Negative Marking

**Files:**
- Modify: `server/services/examAttemptService.js` (`submitAttempt` method's scoring loop and final score calculation)

**Interfaces:**
- No signature changes — `submitAttempt(attemptId, studentId)` keeps the same return shape.

- [ ] **Step 1: Deduct marks for incorrect multiple-choice/true-false answers when negative marking is enabled**

Replace:

```js
            if (question.type === 'multiple-choice' || question.type === 'true-false') {
              const correctAnswers = question.correctAnswers || [];
              if (Array.isArray(studentAnswer)) {
                // Multiple selection - check if arrays match
                const isCorrect = correctAnswers.length === studentAnswer.length &&
                  correctAnswers.every(ans => studentAnswer.includes(ans));
                if (isCorrect) totalScore += question.marks;
              } else {
                // Single selection
                if (correctAnswers.includes(studentAnswer)) {
                  totalScore += question.marks;
                }
              }
            } else if (question.type === 'theory' || question.type === 'short-answer') {
```

with:

```js
            if (question.type === 'multiple-choice' || question.type === 'true-false') {
              const correctAnswers = question.correctAnswers || [];
              let isCorrect;
              if (Array.isArray(studentAnswer)) {
                // Multiple selection - check if arrays match
                isCorrect = correctAnswers.length === studentAnswer.length &&
                  correctAnswers.every(ans => studentAnswer.includes(ans));
              } else {
                // Single selection
                isCorrect = correctAnswers.includes(studentAnswer);
              }
              if (isCorrect) {
                totalScore += question.marks;
              } else if (exam.negativeMarking) {
                // negativeMarkingValue is a fraction of this question's own marks
                totalScore -= exam.negativeMarkingValue * question.marks;
              }
            } else if (question.type === 'theory' || question.type === 'short-answer') {
```

- [ ] **Step 2: Floor the final score at 0**

Replace:

```js
      const percentage = exam ? (totalScore / exam.totalMarks) * 100 : 0;
```

with:

```js
      // Negative marking can drive the score below 0 — floor it after all scoring (including AI-graded theory marks) is applied
      totalScore = Math.max(0, totalScore);

      const percentage = exam ? (totalScore / exam.totalMarks) * 100 : 0;
```

- [ ] **Step 3: Verify syntax**

Run: `node --check server/services/examAttemptService.js`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add server/services/examAttemptService.js
git commit -m "Implement negativeMarking: deduct a fraction of marks for wrong MCQ/true-false answers"
```

---

### Task 4: `examAttemptService.js` — Show Results Immediately consistency (backend)

**Files:**
- Modify: `server/services/examAttemptService.js` (`getStudentAttempts` method)

**Interfaces:**
- No signature changes — `getStudentAttempts(studentId)` still returns an array of attempts, now filtered.

- [ ] **Step 1: Filter out completed attempts whose exam has Show Results Immediately disabled**

Replace:

```js
  static async getStudentAttempts(studentId) {
    try {
      console.log('ExamAttemptService: Getting exam attempts for student:', studentId);

      const attempts = await ExamAttempt.find({ studentId })
        .populate('examId', 'title subject totalMarks')
        .sort({ createdAt: -1 });

      console.log(`ExamAttemptService: Found ${attempts.length} attempts for student`);
      return attempts;
    } catch (error) {
      console.error('ExamAttemptService: Error getting student attempts:', error.message);
      throw error;
    }
  }
```

with:

```js
  static async getStudentAttempts(studentId) {
    try {
      console.log('ExamAttemptService: Getting exam attempts for student:', studentId);

      const attempts = await ExamAttempt.find({ studentId })
        .populate('examId', 'title subject totalMarks showResultsImmediately')
        .sort({ createdAt: -1 });

      // Hide scores for completed attempts where the exam has Show Results Immediately disabled
      // (in-progress attempts have no score yet, so they're never filtered)
      const visibleAttempts = attempts.filter(attempt =>
        attempt.status !== 'completed' || (attempt.examId && attempt.examId.showResultsImmediately === true)
      );

      console.log(`ExamAttemptService: Found ${visibleAttempts.length} visible attempts for student`);
      return visibleAttempts;
    } catch (error) {
      console.error('ExamAttemptService: Error getting student attempts:', error.message);
      throw error;
    }
  }
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server/services/examAttemptService.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add server/services/examAttemptService.js
git commit -m "Filter getStudentAttempts by showResultsImmediately, matching getStudentRecentResults"
```

---

### Task 5: `ExamAttempt.tsx` — Allow Review (forward-only) and Show Results Immediately toast

**Files:**
- Modify: `client/src/pages/student/ExamAttempt.tsx`

**Interfaces:**
- No signature changes to `ExamAttempt` — internal navigation and toast behavior only.

- [ ] **Step 1: Disable Previous when review is disallowed**

Replace:

```tsx
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
```

with:

```tsx
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0 || !exam.allowReview}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
```

- [ ] **Step 2: Block backward jumps in the question-navigation palette**

Replace:

```tsx
                  return (
                    <Button
                      key={question._id}
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      className={`relative h-8 w-8 p-0 ${
                        isAnswered ? "bg-green-100 border-green-300" : ""
                      } ${isFlagged ? "bg-yellow-100 border-yellow-300" : ""}`}
                      onClick={() => setCurrentQuestionIndex(index)}
                    >
```

with:

```tsx
                  return (
                    <Button
                      key={question._id}
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      className={`relative h-8 w-8 p-0 ${
                        isAnswered ? "bg-green-100 border-green-300" : ""
                      } ${isFlagged ? "bg-yellow-100 border-yellow-300" : ""}`}
                      onClick={() => {
                        if (exam.allowReview || index >= currentQuestionIndex) {
                          setCurrentQuestionIndex(index)
                        }
                      }}
                    >
```

- [ ] **Step 3: Suppress the score in the submit toast when Show Results Immediately is off**

Replace:

```tsx
      toast({
        title: "Exam Submitted",
        description: `Your score: ${result.score}/${exam.totalMarks} (${result.percentage}%)`,
      })
```

with:

```tsx
      toast({
        title: "Exam Submitted",
        description: exam.showResultsImmediately
          ? `Your score: ${result.score}/${exam.totalMarks} (${result.percentage}%)`
          : "Your exam has been submitted successfully.",
      })
```

- [ ] **Step 4: Verify with tsc**

Run: `npx tsc --noEmit -p tsconfig.app.json` (from `client/`)
Expected: same error count as the pre-existing baseline (this file already has zero baseline errors related to these lines — confirm the total count is unchanged from before this task).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/student/ExamAttempt.tsx
git commit -m "Enforce allowReview forward-lock and showResultsImmediately in ExamAttempt"
```

---

### Task 6: `MobileExamAttempt.tsx` — Allow Review (forward-only)

**Files:**
- Modify: `client/src/pages/student/MobileExamAttempt.tsx`

**Interfaces:**
- No signature changes.

- [ ] **Step 1: Disable Previous when review is disallowed**

Replace:

```tsx
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))
            }
            disabled={currentQuestionIndex === 0}
            className="flex-1"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Previous
          </Button>
```

with:

```tsx
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))
            }
            disabled={currentQuestionIndex === 0 || !exam?.allowReview}
            className="flex-1"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Previous
          </Button>
```

(Uses `exam?.allowReview` — optional chaining — matching this file's existing convention of `exam?.title` in the header, since unlike `ExamAttempt.tsx` this file has no explicit `if (!exam) return` guard before the point where this button renders.)

- [ ] **Step 2: Block backward jumps in the navigation grid**

Replace:

```tsx
              {questions.map((q, idx) => (
                <button
                  key={q._id}
                  onClick={() => {
                    setCurrentQuestionIndex(idx);
                    setShowNavigation(false);
                  }}
                  className={`
```

with:

```tsx
              {questions.map((q, idx) => (
                <button
                  key={q._id}
                  onClick={() => {
                    if (exam?.allowReview || idx >= currentQuestionIndex) {
                      setCurrentQuestionIndex(idx);
                      setShowNavigation(false);
                    }
                  }}
                  className={`
```

- [ ] **Step 3: Verify with tsc**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: same error count as after Task 5.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/student/MobileExamAttempt.tsx
git commit -m "Enforce allowReview forward-lock in MobileExamAttempt"
```

---

### Task 7: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Final tsc regression check**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: error count unchanged from the pre-existing baseline (this plan makes no dead-code fixes, so the count should be identical, not lower — confirm no new errors were introduced by Tasks 5-6).

- [ ] **Step 2: Start the app and log in as admin, then create test exams**

From the worktree root: create `server/.env` per Global Constraints if not already present, start `node server.js` in `server/` and `npm run dev` in `client/`. Log in as admin via Playwright. Using Create Exam (or direct MongoDB MCP edits to an existing test exam), set up at least one exam with `randomizeOptions: true`, `negativeMarking: true` with a known `negativeMarkingValue`, `allowReview: false`, and `showResultsImmediately: false`, assigned to a student group the test student belongs to, with at least 2-3 multiple-choice questions.

- [ ] **Step 3: Verify Randomize Options persists across a refresh**

Log in as the student, start the exam, note the MCQ option order on Question 1, refresh the page (resuming the in-progress attempt), and confirm the option order for Question 1 is unchanged after the refresh. Optionally start a second, separate attempt (if `maxAttempts` allows) to confirm option order differs between independent attempts.

- [ ] **Step 4: Verify Negative Marking**

Answer at least one question correctly and one incorrectly, submit, and hand-calculate the expected score (`sum of correct marks - negativeMarkingValue × sum of incorrect question marks`, floored at 0) against the actual recorded score (check via MongoDB MCP on the `examattempts` collection, or an admin-side report if reachable).

- [ ] **Step 5: Verify Allow Review forward-lock**

During the attempt, move from Question 1 to Question 2 via Next, then confirm: the Previous button is disabled, and clicking Question 1 in the navigation palette does nothing (stays on Question 2). Confirm jumping forward (e.g., to Question 3 or later) still works. Repeat the same check on `/student/exam/:id/mobile` if a mobile-enabled test exam is available.

- [ ] **Step 6: Verify Show Results Immediately**

Submit the exam and confirm the toast reads "Your exam has been submitted successfully." with no score shown. Confirm the completed attempt does not appear in the student Dashboard's "Recent Results" widget nor in `/student/results`.

- [ ] **Step 7: Report results**

Summarize the tsc comparison and the live-verification outcome for all four settings, noting any settings that couldn't be fully verified (e.g., if creating a fresh test exam with all four flags proved impractical) and why.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-exam-settings-enforcement.md`.
