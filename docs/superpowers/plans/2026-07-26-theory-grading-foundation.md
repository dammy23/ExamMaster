# Theory Question Grading — Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-exam `gradingMethod` ('ai' | 'manual') setting and the data model + submission-flow logic needed to support it, including fixing a real bug where AI-grading failures during submit silently and permanently lose the theory-question score.

**Architecture:** Schema changes first (Exam + ExamAttempt models), then the backend submission-flow logic that consumes them, then the client-side exam-creation setting, then the client-side attempt-submission handling. Each task is independently verifiable and builds on the previous one.

**Tech Stack:** Node.js/Express (plain JavaScript) on the server; React + TypeScript (Vite) on the client. No test framework exists in this repo.

## Global Constraints

- No automated test framework exists in this repo. Backend (`.js`) changes are verified with `node --check <file>` (syntax-only). Client (`.tsx`/`.ts`) changes are verified with `npx tsc --noEmit -p tsconfig.app.json` (never bare `tsc --noEmit`), run from `client/`. The current baseline is **101 errors** — this plan introduces no dead code, so the count must stay at 101 throughout.
- Any new `npm install` in a fresh worktree needs `PUPPETEER_SKIP_DOWNLOAD=true` set first.
- `server/.env` is gitignored and does not exist in a fresh worktree — create it before starting the dev server, with `DATABASE_URL=mongodb://localhost:27017/exammaster-dev`, a freshly generated `JWT_SECRET`, and `PORT=3000`.
- Use `http://127.0.0.1:5173` in Playwright, never `localhost`.
- Seeded student accounts (`student1@example.com`, `student2@example.com`, `student3@example.com`) all use password `password123`.
- Scope is limited to: `server/models/Exam.js`, `server/models/ExamAttempt.js`, `server/services/examAttemptService.js`, `client/src/api/exams.ts`, `client/src/api/examAttempts.ts`, `client/src/components/admin/ExamForm.tsx`, `client/src/pages/admin/EditExam.tsx`, `client/src/pages/student/ExamAttempt.tsx`. Do not touch `MobileExamAttempt.tsx` (its submit toast never shows a score today, so it needs no change), `aiGradingService.js`, or the dead `/grade-theory/:attemptId` route/method — those are Phase 2's concern.
- Do not fix the separate `'short-answer'` phantom-type bug (deferred, out of scope per explicit user decision).
- `'ai'` and `'manual'` are the only two `gradingMethod` values — no hybrid mode (confirmed decision).

---

### Task 1: Schema changes — `Exam.js` and `ExamAttempt.js`

**Files:**
- Modify: `server/models/Exam.js`
- Modify: `server/models/ExamAttempt.js`

**Interfaces:**
- Produces: `Exam.gradingMethod: 'ai' | 'manual'` (default `'ai'`). `ExamAttempt.status` gains `'pending-review'` as a valid value. `ExamAttempt.manualGradingResults` — same shape as the existing `aiGradingResults` but with `gradedBy: ObjectId ref User` instead of `aiPlatform`. Task 2 consumes `gradingMethod` and the new `status` value; Task 2 does not yet write to `manualGradingResults` (that's Phase 2 — this task only adds the field so the schema is ready).

- [ ] **Step 1: Add `gradingMethod` to the Exam schema**

Replace:

```js
  mobileEnabled: {
    type: Boolean,
    default: false
  },
  createdBy: {
```

with:

```js
  mobileEnabled: {
    type: Boolean,
    default: false
  },
  gradingMethod: {
    type: String,
    enum: ['ai', 'manual'],
    default: 'ai'
  },
  createdBy: {
```

- [ ] **Step 2: Verify backend syntax**

Run (from repo root): `node --check server/models/Exam.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Add `'pending-review'` to the ExamAttempt status enum**

Replace:

```js
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'submitted'],
    default: 'in-progress'
  },
```

with:

```js
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'submitted', 'pending-review'],
    default: 'in-progress'
  },
```

- [ ] **Step 4: Add the `manualGradingResults` field, parallel to `aiGradingResults`**

Replace:

```js
      gradedAt: {
        type: Date,
        default: Date.now
      }
    }],
    gradedAt: {
      type: Date
    }
  }
}, {
  timestamps: true,
  versionKey: false
});
```

with:

```js
      gradedAt: {
        type: Date,
        default: Date.now
      }
    }],
    gradedAt: {
      type: Date
    }
  },
  manualGradingResults: {
    totalScore: {
      type: Number,
      min: 0
    },
    totalMaxScore: {
      type: Number,
      min: 0
    },
    results: [{
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
      },
      score: {
        type: Number,
        min: 0
      },
      maxScore: {
        type: Number,
        min: 0
      },
      feedback: {
        type: String,
        trim: true
      },
      gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      gradedAt: {
        type: Date,
        default: Date.now
      }
    }],
    gradedAt: {
      type: Date
    }
  }
}, {
  timestamps: true,
  versionKey: false
});
```

- [ ] **Step 5: Verify backend syntax**

Run: `node --check server/models/ExamAttempt.js`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add server/models/Exam.js server/models/ExamAttempt.js
git commit -m "Add gradingMethod to Exam and pending-review status + manualGradingResults to ExamAttempt"
```

---

### Task 2: Backend — `submitAttempt` branching logic + attempt-limit fix

**Files:**
- Modify: `server/services/examAttemptService.js`

**Interfaces:**
- Consumes: `Exam.gradingMethod` and `ExamAttempt.status`'s `'pending-review'` value from Task 1.
- Produces: `submitAttempt`'s return object gains a `status` field (`'completed' | 'pending-review'`). Task 3/4's client code will read `result.status === 'pending-review'`.

- [ ] **Step 1: Count `pending-review` attempts toward the attempt limit**

Replace:

```js
      // Check attempt limits (skip if unlimited attempts - maxAttempts === 0)
      const completedAttempts = existingAttempts.filter(attempt => 
        attempt.status === 'completed' || attempt.status === 'submitted'
      );
```

with:

```js
      // Check attempt limits (skip if unlimited attempts - maxAttempts === 0)
      // 'pending-review' counts too — that attempt already used up a slot while awaiting grading
      const completedAttempts = existingAttempts.filter(attempt => 
        attempt.status === 'completed' || attempt.status === 'submitted' || attempt.status === 'pending-review'
      );
```

- [ ] **Step 2: Track whether theory questions were answered, and only AI-grade when the exam uses AI grading**

Replace:

```js
      // Calculate score based on actual questions
      let totalScore = 0;
      let theoryQuestions = [];
      const exam = await Exam.findById(attempt.examId).populate('questions');

      if (exam && exam.questions) {
        for (const question of exam.questions) {
          const studentAnswer = attempt.answers.get(question._id.toString());
          if (studentAnswer) {
            // Simple scoring logic - can be enhanced later for partial marks
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
              // Collect theory questions for AI grading
              theoryQuestions.push({
                questionId: question._id.toString(),
                question: question.question,
                studentAnswer: studentAnswer,
                sampleAnswer: question.correctAnswers[0] || '',
                maxMarks: question.marks
              });
              console.log(`Theory question ${question._id} will be graded by AI`);
            }
          }
        }
      }

      // Grade theory questions using AI if any exist
      let aiGradingResults = null;
      if (theoryQuestions.length > 0) {
        console.log(`ExamAttemptService: Starting AI grading for ${theoryQuestions.length} theory questions`);
        try {
          aiGradingResults = await AIGradingService.gradeMultipleTheoryQuestions(theoryQuestions);
          if (aiGradingResults.success) {
            totalScore += aiGradingResults.totalScore;
            console.log(`ExamAttemptService: AI grading completed, added ${aiGradingResults.totalScore} marks from theory questions`);
          }
        } catch (error) {
          console.error('ExamAttemptService: AI grading failed:', error.message);
          // Continue without AI scores - they can be graded manually later
        }
      }
```

with:

```js
      // Calculate score based on actual questions
      let totalScore = 0;
      let theoryQuestions = [];
      let hasAnsweredTheoryQuestions = false;
      const exam = await Exam.findById(attempt.examId).populate('questions');

      if (exam && exam.questions) {
        for (const question of exam.questions) {
          const studentAnswer = attempt.answers.get(question._id.toString());
          if (studentAnswer) {
            // Simple scoring logic - can be enhanced later for partial marks
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
              // Collect theory questions — graded by AI below (if this exam uses AI grading) or left for an admin to grade by hand
              hasAnsweredTheoryQuestions = true;
              theoryQuestions.push({
                questionId: question._id.toString(),
                question: question.question,
                studentAnswer: studentAnswer,
                sampleAnswer: question.correctAnswers[0] || '',
                maxMarks: question.marks
              });
            }
          }
        }
      }

      // Grade theory questions using AI, unless this exam is configured for human grading
      let aiGradingResults = null;
      let aiGradingFailed = false;
      if (exam && exam.gradingMethod === 'ai' && theoryQuestions.length > 0) {
        console.log(`ExamAttemptService: Starting AI grading for ${theoryQuestions.length} theory questions`);
        try {
          aiGradingResults = await AIGradingService.gradeMultipleTheoryQuestions(theoryQuestions);
          if (aiGradingResults.success) {
            totalScore += aiGradingResults.totalScore;
            console.log(`ExamAttemptService: AI grading completed, added ${aiGradingResults.totalScore} marks from theory questions`);
          }
        } catch (error) {
          console.error('ExamAttemptService: AI grading failed:', error.message);
          // The attempt goes to pending-review below so an admin can retry AI grading or grade by hand — the score is no longer silently lost
          aiGradingFailed = true;
        }
      }
```

- [ ] **Step 3: Set `pending-review` status when grading isn't finished, and gate the results email on it**

Replace:

```js
      // Negative marking can drive the score below 0 — floor it after all scoring (including AI-graded theory marks) is applied
      totalScore = Math.max(0, totalScore);

      const percentage = exam ? (totalScore / exam.totalMarks) * 100 : 0;

      // Update attempt with scores and AI grading results
      attempt.endTime = endTime;
      attempt.timeSpent = timeSpentMinutes;
      attempt.score = totalScore;
      attempt.percentage = Math.round(percentage * 100) / 100; // Round to 2 decimal places
      attempt.status = 'completed';

      // Store AI grading results in attempt metadata if available
      if (aiGradingResults && aiGradingResults.success) {
        attempt.aiGradingResults = {
          totalScore: aiGradingResults.totalScore,
          totalMaxScore: aiGradingResults.totalMaxScore,
          results: aiGradingResults.results,
          gradedAt: aiGradingResults.gradedAt
        };
      }

      await attempt.save();

      console.log('ExamAttemptService: Exam attempt submitted successfully with total score:', totalScore);

      // Send email results if "Show Results Immediately" is enabled
      if (exam && exam.showResultsImmediately) {
        console.log('ExamAttemptService: Sending email results as showResultsImmediately is enabled');
        try {
          // Get student details
          const student = await User.findById(studentId);
          if (student && student.email) {
            const passed = totalScore >= exam.passingMarks;

            await emailService.sendExamResults(
              student.email,
              student.name || student.email,
              exam.title,
              totalScore,
              attempt.percentage,
              exam.totalMarks,
              exam.passingMarks,
              passed
            );

            console.log(`ExamAttemptService: Email sent successfully to ${student.email}`);
          } else {
            console.log('ExamAttemptService: Student email not found, skipping email notification');
          }
        } catch (emailError) {
          console.error('ExamAttemptService: Error sending email results:', emailError.message);
          // Don't fail the exam submission if email fails
        }
      }

      return {
        success: true,
        score: totalScore,
        percentage: attempt.percentage,
        aiGradingCompleted: aiGradingResults ? aiGradingResults.success : false,
        theoryQuestionsCount: theoryQuestions.length,
        emailSent: exam && exam.showResultsImmediately
      };
```

with:

```js
      // Negative marking can drive the score below 0 — floor it after all scoring (including AI-graded theory marks) is applied
      totalScore = Math.max(0, totalScore);

      const percentage = exam ? (totalScore / exam.totalMarks) * 100 : 0;

      // This attempt needs a human before it's final: either the exam is manual-grading and has answered
      // theory questions, or it's AI-grading and the AI grading call above failed
      const needsReview = hasAnsweredTheoryQuestions && (
        (exam && exam.gradingMethod === 'manual') || aiGradingFailed
      );

      // Update attempt with scores and AI grading results
      attempt.endTime = endTime;
      attempt.timeSpent = timeSpentMinutes;
      attempt.score = totalScore;
      attempt.percentage = Math.round(percentage * 100) / 100; // Round to 2 decimal places
      attempt.status = needsReview ? 'pending-review' : 'completed';

      // Store AI grading results in attempt metadata if available
      if (aiGradingResults && aiGradingResults.success) {
        attempt.aiGradingResults = {
          totalScore: aiGradingResults.totalScore,
          totalMaxScore: aiGradingResults.totalMaxScore,
          results: aiGradingResults.results,
          gradedAt: aiGradingResults.gradedAt
        };
      }

      await attempt.save();

      console.log('ExamAttemptService: Exam attempt submitted successfully with total score:', totalScore);

      // Send email results if "Show Results Immediately" is enabled — only once the score is actually final
      if (exam && exam.showResultsImmediately && !needsReview) {
        console.log('ExamAttemptService: Sending email results as showResultsImmediately is enabled');
        try {
          // Get student details
          const student = await User.findById(studentId);
          if (student && student.email) {
            const passed = totalScore >= exam.passingMarks;

            await emailService.sendExamResults(
              student.email,
              student.name || student.email,
              exam.title,
              totalScore,
              attempt.percentage,
              exam.totalMarks,
              exam.passingMarks,
              passed
            );

            console.log(`ExamAttemptService: Email sent successfully to ${student.email}`);
          } else {
            console.log('ExamAttemptService: Student email not found, skipping email notification');
          }
        } catch (emailError) {
          console.error('ExamAttemptService: Error sending email results:', emailError.message);
          // Don't fail the exam submission if email fails
        }
      }

      return {
        success: true,
        score: totalScore,
        percentage: attempt.percentage,
        status: attempt.status,
        aiGradingCompleted: aiGradingResults ? aiGradingResults.success : false,
        theoryQuestionsCount: theoryQuestions.length,
        emailSent: exam && exam.showResultsImmediately && !needsReview
      };
```

- [ ] **Step 4: Verify backend syntax**

Run: `node --check server/services/examAttemptService.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add server/services/examAttemptService.js
git commit -m "Branch submitAttempt on gradingMethod: skip AI grading for manual exams, mark pending-review on manual grading or AI failure"
```

---

### Task 3: Client — exam-creation Grading Method setting

**Files:**
- Modify: `client/src/api/exams.ts`
- Modify: `client/src/components/admin/ExamForm.tsx`
- Modify: `client/src/pages/admin/EditExam.tsx`

**Interfaces:**
- Consumes: `Exam.gradingMethod` from Task 1 (mirrored on the client).
- Produces: `ExamFormData.gradingMethod: 'ai' | 'manual'`, submitted as part of `ExamPayload` to the existing `createExam`/`updateExam` API calls (both already spread the whole payload through, so no further wiring is needed there).

- [ ] **Step 1: Add `gradingMethod` to the `Exam` TypeScript interface**

Replace:

```ts
  maxAttempts: number; // 0 means unlimited
  videoRecording: boolean;
  mobileEnabled: boolean;
  assignedStudents: string[];
```

with:

```ts
  maxAttempts: number; // 0 means unlimited
  videoRecording: boolean;
  mobileEnabled: boolean;
  gradingMethod: 'ai' | 'manual';
  assignedStudents: string[];
```

- [ ] **Step 2: Add `gradingMethod` to `ExamFormData` and the create-mode default**

Replace:

```tsx
  videoRecording: boolean
  mobileEnabled: boolean
  assignedGroups: string[]
}
```

with:

```tsx
  videoRecording: boolean
  mobileEnabled: boolean
  gradingMethod: 'ai' | 'manual'
  assignedGroups: string[]
}
```

Replace:

```tsx
  videoRecording: false,
  mobileEnabled: false,
  assignedGroups: []
}
```

with:

```tsx
  videoRecording: false,
  mobileEnabled: false,
  gradingMethod: 'ai',
  assignedGroups: []
}
```

- [ ] **Step 3: Add the Grading Method `Select` to the Exam Settings card**

Replace:

```tsx
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Mobile Devices</Label>
                  <p className="text-sm text-muted-foreground">
                    Students can take this exam on mobile devices
                  </p>
                </div>
                <Switch
                  checked={watch("mobileEnabled")}
                  onCheckedChange={(checked) => setValue("mobileEnabled", checked)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
```

with:

```tsx
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Mobile Devices</Label>
                  <p className="text-sm text-muted-foreground">
                    Students can take this exam on mobile devices
                  </p>
                </div>
                <Switch
                  checked={watch("mobileEnabled")}
                  onCheckedChange={(checked) => setValue("mobileEnabled", checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gradingMethod">Grading Method</Label>
                <Select
                  value={watch("gradingMethod")}
                  onValueChange={(value) => setValue("gradingMethod", value as 'ai' | 'manual')}
                >
                  <SelectTrigger id="gradingMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">AI Auto-Grade</SelectItem>
                    <SelectItem value="manual">Human Manual Grade</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How theory questions are scored after submission
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
```

- [ ] **Step 4: Pre-populate `gradingMethod` when editing an existing exam**

Replace:

```tsx
        videoRecording: exam.videoRecording || false,
        mobileEnabled: exam.mobileEnabled || false,
        assignedGroups: exam.assignedGroups || []
      })
```

with:

```tsx
        videoRecording: exam.videoRecording || false,
        mobileEnabled: exam.mobileEnabled || false,
        gradingMethod: exam.gradingMethod || 'ai',
        assignedGroups: exam.assignedGroups || []
      })
```

- [ ] **Step 5: Verify with tsc**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json`
Expected: 101 errors, unchanged.

- [ ] **Step 6: Commit**

```bash
git add client/src/api/exams.ts client/src/components/admin/ExamForm.tsx client/src/pages/admin/EditExam.tsx
git commit -m "Add Grading Method setting to exam creation/edit form"
```

---

### Task 4: Client — attempt submission handles `pending-review`

**Files:**
- Modify: `client/src/api/examAttempts.ts`
- Modify: `client/src/pages/student/ExamAttempt.tsx`

**Interfaces:**
- Consumes: `submitAttempt`'s `status` field from Task 2.
- No signature changes to `ExamAttempt` (the page component).

- [ ] **Step 1: Add `'pending-review'` to the `ExamAttempt.status` type and update the submit doc comment**

Replace:

```ts
  status: 'in-progress' | 'completed' | 'submitted';
```

with:

```ts
  status: 'in-progress' | 'completed' | 'submitted' | 'pending-review';
```

Replace:

```ts
// Description: Submit exam attempt
// Endpoint: POST /api/exam-attempts/submit
// Request: { attemptId: string }
// Response: { success: boolean, score: number, percentage: number, aiGradingCompleted: boolean, theoryQuestionsCount: number }
```

with:

```ts
// Description: Submit exam attempt
// Endpoint: POST /api/exam-attempts/submit
// Request: { attemptId: string }
// Response: { success: boolean, score: number, percentage: number, status: string, aiGradingCompleted: boolean, theoryQuestionsCount: number }
```

- [ ] **Step 2: Suppress the score in the submit toast when the attempt is pending review**

Replace:

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

(`MobileExamAttempt.tsx`'s submit toast already shows only a generic "submitted successfully" message with no score in any case, so it needs no change.)

- [ ] **Step 3: Verify with tsc**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 101 errors, unchanged.

- [ ] **Step 4: Commit**

```bash
git add client/src/api/examAttempts.ts client/src/pages/student/ExamAttempt.tsx
git commit -m "Show an 'awaiting grading' message instead of a score when an attempt is pending-review"
```

---

### Task 5: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Final tsc and backend syntax checks**

Run: `npx tsc --noEmit -p tsconfig.app.json` — expected 101 errors, unchanged.
Run: `node --check server/models/Exam.js && node --check server/models/ExamAttempt.js && node --check server/services/examAttemptService.js` — expected no output, exit code 0 for all three.

- [ ] **Step 2: Start the app and create a manual-grading exam through the actual UI**

Create `server/.env` per Global Constraints if not already present, start `node server.js` in `server/` and `npm run dev` in `client/`. Log in as admin via Playwright, create a new exam via `/admin/exams/create`, and confirm the new "Grading Method" dropdown appears in Exam Settings with "AI Auto-Grade" as the default. Set it to "Human Manual Grade", assign at least one theory question, publish the exam, and assign it to a group the test student belongs to (or use direct MongoDB edits if the UI can't cleanly express the needed state, consistent with prior sub-phases in this project).

- [ ] **Step 3: Verify manual-mode submission produces `pending-review`**

Log in as a student, start the manual-grading exam, answer the theory question, and submit. Confirm: the toast reads "Your exam has been submitted and is awaiting grading." with no score shown; querying the attempt via MongoDB MCP shows `status: 'pending-review'` and no `aiGradingResults`.

- [ ] **Step 4: Verify the attempt-limit fix**

With the same manual-grading exam configured with `maxAttempts: 1`, confirm that trying to start a second attempt while the first is `pending-review` is correctly blocked with the "exceeded maximum attempts" error (same error path as a normal completed attempt).

- [ ] **Step 5: Verify AI-mode exams are unaffected (regression check)**

Using an existing AI-mode exam (e.g. the leftover Exam Settings Enforcement test exam, `6a65d6cab4b1fab75ed140a7`, or edit its `gradingMethod` to confirm the edit form pre-populates "AI Auto-Grade" correctly), submit an attempt with an answered theory question and confirm behavior is unchanged from before this plan: `status: 'completed'`, `aiGradingResults` populated, and the submit toast shows a score exactly as it did previously.

- [ ] **Step 6: Report results**

Summarize the tsc/`node --check` results and the live-verification outcome for all four scenarios (manual-mode pending-review, attempt-limit counting, AI-mode regression, and the edit-form pre-population), noting anything that couldn't be verified and why.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-theory-grading-foundation.md`.
