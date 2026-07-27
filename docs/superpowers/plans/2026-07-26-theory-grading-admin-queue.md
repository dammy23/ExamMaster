# Theory Grading — Part 2: Admin Grading Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a way to see and act on exam attempts stuck in `pending-review` — a global grading queue listing every such attempt across the exams they own, plus a per-attempt page to either retry AI grading or enter manual scores/feedback per theory question.

**Architecture:** Two new client pages (`GradingQueue.tsx` list, `GradeAttempt.tsx` detail/form) backed by three new backend endpoints and one fixed existing endpoint, all in the existing `server/services/examAttemptService.js` / `server/routes/examAttemptRoutes.js` files. No schema changes — Part 1 already added everything this part writes to (`ExamAttempt.status: 'pending-review'`, `ExamAttempt.manualGradingResults`).

**Tech Stack:** Express + Mongoose (backend), React + TypeScript + shadcn/ui + React Router (client). No automated test framework exists in this repo.

## Global Constraints

- Backend verification: `node --check <file>` (no test framework exists).
- Client verification: `npx tsc --noEmit -p tsconfig.app.json` from `client/`, compared against the current baseline of **101** pre-existing errors — task changes must not increase this count.
- Follow existing conventions exactly: admin-only guard is `if (req.user.role !== 'admin') return res.status(403)...`; ObjectId validation is `mongoose.Types.ObjectId.isValid(id)`; list/detail pages use `LoadingState`/`EmptyState`/`StatusBadge` from `@/components/ui/*`; error responses are `{ success: false, error: message }`.
- `noUnusedLocals` and `noUnusedParameters` are both `true` in `tsconfig.app.json` — every import must be used, exactly.
- Page components that consume populated (non-`ExamAttempt`-shaped) API responses define their own local interface for that shape, matching the established pattern in `client/src/pages/admin/StudentVideoReview.tsx` (its local `ExamAttemptReview` interface) — do not force the shared `ExamAttempt` type to cover every populate variant.
- Two test exams already exist in the dev DB specifically for this part's manual verification: `Theory Grading Manual Test Exam` (manual mode, one `pending-review` attempt) and `AI Grading Failure Test Exam` (AI mode, one `pending-review` attempt from a genuine AI-grading failure — no `AIPlatform` is configured in this dev DB).

---

### Task 1: Service layer — read side (queue list, count, grading detail)

**Files:**
- Modify: `server/services/examAttemptService.js:853-882` (rewrite `getPendingGradingCount`, add two new methods after it)

**Interfaces:**
- Consumes: `Exam` and `ExamAttempt` models already required at the top of this file (`server/services/examAttemptService.js:1-2`); `mongoose.Types.ObjectId.isValid`.
- Produces: `ExamAttemptService.getPendingGradingCount(adminId): Promise<number>`, `ExamAttemptService.getPendingGradingAttempts(adminId): Promise<ExamAttempt[]>` (each with `studentId` populated `name email`, `examId` populated `title gradingMethod`), `ExamAttemptService.getAttemptForGrading(attemptId, adminId): Promise<ExamAttempt>` (with `studentId` populated `name email`, `examId` populated `title subject totalMarks gradingMethod createdBy` plus nested `examId.questions` fully populated). These are consumed by Task 3's routes.

- [ ] **Step 1: Replace `getPendingGradingCount` and add the two new list/detail methods**

Replace:

```js
  static async getPendingGradingCount() {
    try {
      console.log('ExamAttemptService: Counting attempts pending manual grading...');

      const attempts = await ExamAttempt.find({
        status: 'completed',
        'aiGradingResults.gradedAt': { $exists: false }
      }).populate({
        path: 'examId',
        populate: {
          path: 'questions'
        }
      });

      let count = 0;
      for (const attempt of attempts) {
        if (!attempt.examId || !attempt.examId.questions) continue;
        const hasUngradedTheory = attempt.examId.questions.some(
          (q) => q.type === 'theory' && attempt.answers.get(q._id.toString())
        );
        if (hasUngradedTheory) count++;
      }

      console.log(`ExamAttemptService: ${count} attempts pending manual grading`);
      return count;
    } catch (error) {
      console.error('ExamAttemptService: Error counting pending grading:', error.message);
      throw error;
    }
  }
```

with:

```js
  static async getPendingGradingCount(adminId) {
    try {
      console.log('ExamAttemptService: Counting attempts pending grading for admin:', adminId);

      const adminExams = await Exam.find({ createdBy: adminId }).select('_id');
      const examIds = adminExams.map(exam => exam._id);

      if (examIds.length === 0) {
        return 0;
      }

      const count = await ExamAttempt.countDocuments({
        status: 'pending-review',
        examId: { $in: examIds }
      });

      console.log(`ExamAttemptService: ${count} attempts pending grading`);
      return count;
    } catch (error) {
      console.error('ExamAttemptService: Error counting pending grading:', error.message);
      throw error;
    }
  }

  // Get all attempts pending grading, across every exam this admin owns
  static async getPendingGradingAttempts(adminId) {
    try {
      console.log('ExamAttemptService: Getting attempts pending grading for admin:', adminId);

      const adminExams = await Exam.find({ createdBy: adminId }).select('_id');
      const examIds = adminExams.map(exam => exam._id);

      if (examIds.length === 0) {
        return [];
      }

      const attempts = await ExamAttempt.find({
        status: 'pending-review',
        examId: { $in: examIds }
      })
        .populate('studentId', 'name email')
        .populate('examId', 'title gradingMethod')
        .sort({ endTime: -1 });

      console.log(`ExamAttemptService: Found ${attempts.length} attempts pending grading`);
      return attempts;
    } catch (error) {
      console.error('ExamAttemptService: Error getting attempts pending grading:', error.message);
      throw error;
    }
  }

  // Get a single attempt with full exam/question detail for the grading form
  static async getAttemptForGrading(attemptId, adminId) {
    try {
      console.log('ExamAttemptService: Getting attempt for grading:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId)
        .populate('studentId', 'name email')
        .populate({
          path: 'examId',
          select: 'title subject totalMarks gradingMethod createdBy',
          populate: {
            path: 'questions'
          }
        });

      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      if (!attempt.examId || attempt.examId.createdBy.toString() !== adminId.toString()) {
        throw new Error('You are not authorized to grade this exam attempt');
      }

      console.log('ExamAttemptService: Attempt retrieved for grading');
      return attempt;
    } catch (error) {
      console.error('ExamAttemptService: Error getting attempt for grading:', error.message);
      throw error;
    }
  }
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server/services/examAttemptService.js` (from `server/` or with the full relative path from repo root)
Expected: no output (exits 0)

- [ ] **Step 3: Commit**

```bash
git add server/services/examAttemptService.js
git commit -m "feat: add admin grading queue read methods, rewrite pending-grading count"
```

---

### Task 2: Service layer — write side (fix AI retry, add manual grade submission)

**Files:**
- Modify: `server/services/examAttemptService.js:736-830` (`gradeTheoryQuestionsForAttempt`)
- Modify: `server/services/examAttemptService.js` (add `submitManualGrades` after `gradeTheoryQuestionsForAttempt`)

**Interfaces:**
- Consumes: `AIGradingService.gradeMultipleTheoryQuestions` (existing, unchanged — see Part 1 notes: it resolves `{success: true, results: [{questionId, score, maxScore, feedback, error?, gradedAt}], totalScore, totalMaxScore, gradedAt}` and never rejects for the common no-AI-platform-configured case, instead marking individual `results[i].error = true`).
- Produces: `ExamAttemptService.gradeTheoryQuestionsForAttempt(attemptId, adminId)` now requires `status === 'pending-review'` (was `'completed'`), enforces exam ownership, and returns `{ success, aiGradingResults, totalScore, updatedPercentage, status, theoryQuestionsGraded }` (added `status` to the return shape). `ExamAttemptService.submitManualGrades(attemptId, adminId, grades)` where `grades: Array<{questionId: string, score: number, feedback: string}>`, returns `{ success, totalScore, updatedPercentage, status }`. Both consumed by Task 3's routes.

- [ ] **Step 1: Fix `gradeTheoryQuestionsForAttempt`'s status check, add ownership check, and record status after retry**

This method backs `POST /grade-theory/:attemptId`, which is about to get a real caller for the first time (the "Retry AI Grading" button in `GradeAttempt.tsx`) — it previously rejected anything except `'completed'` attempts (the opposite of what's needed: attempts needing attention are `pending-review`), and never checked that the requesting admin actually owns the exam (every sibling admin method in this file — `getExamAttempts`, `getAttemptForReview`, `getAttemptForGrading` — does this check; leaving it out here now that the endpoint is reachable would be inconsistent).

Replace:

```js
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      // Validate that attempt is completed
      if (attempt.status !== 'completed') {
        throw new Error('Can only grade theory questions for completed exam attempts');
      }
```

with:

```js
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      if (!attempt.examId || attempt.examId.createdBy.toString() !== adminId.toString()) {
        throw new Error('You are not authorized to grade this exam attempt');
      }

      // Validate that attempt is awaiting grading
      if (attempt.status !== 'pending-review') {
        throw new Error('Can only grade theory questions for attempts pending review');
      }
```

Then replace:

```js
      // Update the attempt with new AI grading results
      attempt.score = newTotalScore;
      attempt.percentage = Math.round(newPercentage * 100) / 100;
      attempt.aiGradingResults = {
        totalScore: aiGradingResults.totalScore,
        totalMaxScore: aiGradingResults.totalMaxScore,
        results: aiGradingResults.results,
        gradedAt: aiGradingResults.gradedAt
      };

      await attempt.save();

      console.log(`ExamAttemptService: Theory questions graded successfully. New total score: ${newTotalScore}`);

      return {
        success: true,
        aiGradingResults: aiGradingResults,
        totalScore: newTotalScore,
        updatedPercentage: attempt.percentage,
        theoryQuestionsGraded: theoryQuestions.length
      };
```

with:

```js
      // Update the attempt with new AI grading results
      attempt.score = newTotalScore;
      attempt.percentage = Math.round(newPercentage * 100) / 100;
      attempt.aiGradingResults = {
        totalScore: aiGradingResults.totalScore,
        totalMaxScore: aiGradingResults.totalMaxScore,
        results: aiGradingResults.results,
        gradedAt: aiGradingResults.gradedAt
      };

      // If every question graded cleanly this time, the attempt is done; otherwise it stays pending-review
      const stillHasErrors = aiGradingResults.results.some(result => result.error);
      attempt.status = stillHasErrors ? 'pending-review' : 'completed';

      await attempt.save();

      console.log(`ExamAttemptService: Theory questions graded successfully. New total score: ${newTotalScore}`);

      return {
        success: true,
        aiGradingResults: aiGradingResults,
        totalScore: newTotalScore,
        updatedPercentage: attempt.percentage,
        status: attempt.status,
        theoryQuestionsGraded: theoryQuestions.length
      };
```

- [ ] **Step 2: Add `submitManualGrades` after `gradeTheoryQuestionsForAttempt`**

Insert immediately after the closing `}` of `gradeTheoryQuestionsForAttempt` (the one directly before the `// Helper method to format time ago` comment at `server/services/examAttemptService.js:832`):

```js

  // Submit manual grades for all theory questions in a pending-review attempt
  static async submitManualGrades(attemptId, adminId, grades) {
    try {
      console.log('ExamAttemptService: Submitting manual grades for attempt:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      if (!Array.isArray(grades) || grades.length === 0) {
        throw new Error('At least one grade is required');
      }

      const attempt = await ExamAttempt.findById(attemptId).populate({
        path: 'examId',
        populate: {
          path: 'questions'
        }
      });

      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      if (!attempt.examId || attempt.examId.createdBy.toString() !== adminId.toString()) {
        throw new Error('You are not authorized to grade this exam attempt');
      }

      if (attempt.status !== 'pending-review') {
        throw new Error('Can only submit manual grades for attempts pending review');
      }

      const questionsById = new Map(
        (attempt.examId.questions || []).map(question => [question._id.toString(), question])
      );

      const results = [];
      let totalScore = 0;
      let totalMaxScore = 0;

      for (const grade of grades) {
        const question = questionsById.get(grade.questionId);
        if (!question || question.type !== 'theory') {
          throw new Error(`Question ${grade.questionId} is not a theory question in this exam`);
        }

        const score = Number(grade.score);
        if (Number.isNaN(score) || score < 0 || score > question.marks) {
          throw new Error(`Score for question ${grade.questionId} must be between 0 and ${question.marks}`);
        }

        results.push({
          questionId: question._id,
          score: score,
          maxScore: question.marks,
          feedback: grade.feedback || '',
          gradedBy: adminId,
          gradedAt: new Date()
        });

        totalScore += score;
        totalMaxScore += question.marks;
      }

      // Recombine with the non-theory portion already scored at submission time
      let currentNonTheoryScore = attempt.score || 0;
      if (attempt.aiGradingResults && attempt.aiGradingResults.totalScore) {
        currentNonTheoryScore -= attempt.aiGradingResults.totalScore;
      }

      const newTotalScore = currentNonTheoryScore + totalScore;
      const newPercentage = attempt.examId.totalMarks ? (newTotalScore / attempt.examId.totalMarks) * 100 : 0;

      attempt.score = newTotalScore;
      attempt.percentage = Math.round(newPercentage * 100) / 100;
      attempt.manualGradingResults = {
        totalScore: totalScore,
        totalMaxScore: totalMaxScore,
        results: results,
        gradedAt: new Date()
      };
      attempt.status = 'completed';

      await attempt.save();

      console.log(`ExamAttemptService: Manual grades submitted successfully. New total score: ${newTotalScore}`);

      return {
        success: true,
        totalScore: newTotalScore,
        updatedPercentage: attempt.percentage,
        status: attempt.status
      };
    } catch (error) {
      console.error('ExamAttemptService: Error submitting manual grades:', error.message);
      throw error;
    }
  }
```

- [ ] **Step 3: Verify syntax**

Run: `node --check server/services/examAttemptService.js`
Expected: no output (exits 0)

- [ ] **Step 4: Commit**

```bash
git add server/services/examAttemptService.js
git commit -m "fix: gradeTheoryQuestionsForAttempt status check and ownership; add submitManualGrades"
```

---

### Task 3: Routes

**Files:**
- Modify: `server/routes/examAttemptRoutes.js:553-578` (`/admin/pending-grading-count` — pass `req.user._id`)
- Modify: `server/routes/examAttemptRoutes.js:605-606` (insert 3 new routes between `/admin/pending-video-reviews-count` and `/grade-theory/:attemptId`)

**Interfaces:**
- Consumes: `ExamAttemptService.getPendingGradingCount`, `getPendingGradingAttempts`, `getAttemptForGrading`, `submitManualGrades` from Tasks 1–2; `requireUser` middleware (existing, `server/routes/middleware/auth.js`).
- Produces: `GET /api/exam-attempts/admin/pending-grading` → `{ success, attempts }`; `GET /api/exam-attempts/admin/grading/:attemptId` → `{ success, attempt }`; `POST /api/exam-attempts/manual-grade/:attemptId` with body `{ grades }` → `{ success, totalScore, updatedPercentage, status }`. Consumed by Task 4's client API functions.

- [ ] **Step 1: Pass `req.user._id` to `getPendingGradingCount`**

Replace:

```js
    const count = await ExamAttemptService.getPendingGradingCount();
```

with:

```js
    const count = await ExamAttemptService.getPendingGradingCount(req.user._id);
```

(This occurs once in the file, inside the `/admin/pending-grading-count` route handler.)

- [ ] **Step 2: Add the 3 new routes**

Replace:

```js
router.get('/admin/pending-video-reviews-count', requireUser, async (req, res) => {
  try {
    console.log(`Getting pending video reviews count for admin: ${req.user.email}`);

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view pending video reviews count'
      });
    }

    const count = await ExamAttemptService.getPendingVideoReviewsCount();

    return res.status(200).json({
      success: true,
      count: count
    });
  } catch (error) {
    console.error(`Error getting pending video reviews count for admin ${req.user.email}:`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Grade theory questions for a specific exam attempt using AI
```

with:

```js
router.get('/admin/pending-video-reviews-count', requireUser, async (req, res) => {
  try {
    console.log(`Getting pending video reviews count for admin: ${req.user.email}`);

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view pending video reviews count'
      });
    }

    const count = await ExamAttemptService.getPendingVideoReviewsCount();

    return res.status(200).json({
      success: true,
      count: count
    });
  } catch (error) {
    console.error(`Error getting pending video reviews count for admin ${req.user.email}:`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all attempts pending grading, across every exam this admin owns
router.get('/admin/pending-grading', requireUser, async (req, res) => {
  try {
    console.log(`Getting attempts pending grading for admin: ${req.user.email}`);

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view attempts pending grading'
      });
    }

    const attempts = await ExamAttemptService.getPendingGradingAttempts(req.user._id);

    return res.status(200).json({
      success: true,
      attempts: attempts
    });
  } catch (error) {
    console.error(`Error getting attempts pending grading for admin ${req.user.email}:`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get a single attempt with full question detail for the grading form
router.get('/admin/grading/:attemptId', requireUser, async (req, res) => {
  try {
    const { attemptId } = req.params;
    console.log(`Getting attempt for grading: attempt=${attemptId} by user: ${req.user.email}`);

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can grade exam attempts'
      });
    }

    const attempt = await ExamAttemptService.getAttemptForGrading(attemptId, req.user._id);

    return res.status(200).json({
      success: true,
      attempt: attempt
    });
  } catch (error) {
    console.error(`Error getting attempt for grading ${req.params.attemptId}:`, error.message);

    if (error.message === 'Exam attempt not found' || error.message === 'Invalid attempt ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Submit manual grades for all theory questions in a pending-review attempt
router.post('/manual-grade/:attemptId', requireUser, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { grades } = req.body;
    console.log(`Submitting manual grades for attempt: ${attemptId} by user: ${req.user.email}`);

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can submit manual grades'
      });
    }

    if (!Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Grades are required'
      });
    }

    const result = await ExamAttemptService.submitManualGrades(attemptId, req.user._id, grades);

    console.log(`Manual grades submitted for attempt: ${attemptId}`);
    return res.status(200).json(result);
  } catch (error) {
    console.error(`Error submitting manual grades for attempt ${req.params.attemptId}:`, error.message);

    if (error.message === 'Exam attempt not found' || error.message === 'Invalid attempt ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('must be between') || error.message.includes('not a theory question') ||
        error.message.includes('pending review') || error.message.includes('is required')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Grade theory questions for a specific exam attempt using AI
```

- [ ] **Step 3: Verify syntax**

Run: `node --check server/routes/examAttemptRoutes.js`
Expected: no output (exits 0)

- [ ] **Step 4: Commit**

```bash
git add server/routes/examAttemptRoutes.js
git commit -m "feat: add admin grading queue routes, fix pending-grading-count admin scoping"
```

---

### Task 4: Client API layer

**Files:**
- Modify: `client/src/api/examAttempts.ts` (add `manualGradingResults` to `ExamAttempt`, add 3 new API functions at end of file)

**Interfaces:**
- Consumes: the 3 new backend routes from Task 3.
- Produces: `getPendingGradingAttempts(): Promise<any>`, `getAttemptForGrading(attemptId: string): Promise<any>`, `submitManualGrades(attemptId: string, grades: Array<{questionId: string, score: number, feedback: string}>): Promise<any>` — all following this file's existing thin-wrapper pattern (`api.get`/`api.post`, catch re-throws `error?.response?.data?.error || error.message`). Consumed by Tasks 5–6's pages.

- [ ] **Step 1: Add `manualGradingResults` to the `ExamAttempt` interface**

Replace:

```ts
  aiGradingResults?: {
    totalScore: number;
    totalMaxScore: number;
    results: Array<{
      questionId: string;
      score: number;
      maxScore: number;
      feedback: string;
      aiPlatform?: string;
      error?: boolean;
      gradedAt: string;
    }>;
    gradedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

with:

```ts
  aiGradingResults?: {
    totalScore: number;
    totalMaxScore: number;
    results: Array<{
      questionId: string;
      score: number;
      maxScore: number;
      feedback: string;
      aiPlatform?: string;
      error?: boolean;
      gradedAt: string;
    }>;
    gradedAt: string;
  };
  manualGradingResults?: {
    totalScore: number;
    totalMaxScore: number;
    results: Array<{
      questionId: string;
      score: number;
      maxScore: number;
      feedback: string;
      gradedBy?: string;
      gradedAt: string;
    }>;
    gradedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 2: Add the 3 new API functions at the end of the file**

Append after the existing `gradeTheoryQuestions` export (end of file):

```ts

// Description: Get all exam attempts pending grading, across every exam this admin owns
// Endpoint: GET /api/exam-attempts/admin/pending-grading
// Request: {}
// Response: { success: boolean, attempts: ExamAttempt[] }
export const getPendingGradingAttempts = async () => {
  try {
    const response = await api.get('/api/exam-attempts/admin/pending-grading');
    return response.data;
  } catch (error: any) {
    console.error('Get pending grading attempts error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get a single exam attempt with full question detail for grading
// Endpoint: GET /api/exam-attempts/admin/grading/:attemptId
// Request: {}
// Response: { success: boolean, attempt: ExamAttempt }
export const getAttemptForGrading = async (attemptId: string) => {
  try {
    const response = await api.get(`/api/exam-attempts/admin/grading/${attemptId}`);
    return response.data;
  } catch (error: any) {
    console.error('Get attempt for grading error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Submit manual grades for all theory questions in a pending-review attempt
// Endpoint: POST /api/exam-attempts/manual-grade/:attemptId
// Request: { grades: Array<{ questionId: string, score: number, feedback: string }> }
// Response: { success: boolean, totalScore: number, updatedPercentage: number, status: string }
export const submitManualGrades = async (
  attemptId: string,
  grades: Array<{ questionId: string; score: number; feedback: string }>
) => {
  try {
    const response = await api.post(`/api/exam-attempts/manual-grade/${attemptId}`, { grades });
    return response.data;
  } catch (error: any) {
    console.error('Submit manual grades error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
```

- [ ] **Step 3: Verify**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `101` (unchanged baseline)

- [ ] **Step 4: Commit**

```bash
git add client/src/api/examAttempts.ts
git commit -m "feat: add client API functions for admin grading queue"
```

---

### Task 5: `GradingQueue.tsx` (new list page)

**Files:**
- Create: `client/src/pages/admin/GradingQueue.tsx`

**Interfaces:**
- Consumes: `getPendingGradingAttempts` from Task 4 (`@/api/examAttempts`); `Card`/`CardContent`/`CardDescription`/`CardHeader`/`CardTitle` (`@/components/ui/card`), `Badge` (`@/components/ui/badge`), `LoadingState` (`@/components/ui/loading-state`), `EmptyState` (`@/components/ui/empty-state`), `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow` (`@/components/ui/table`), `useToast` (`@/hooks/useToast`) — all existing, following the exact convention in `client/src/pages/admin/ExamManagement.tsx`.
- Produces: `export function GradingQueue()`, a default list page rendered at route `/admin/grading` (wired in Task 7). Each row navigates to `/admin/grading/:attemptId` (Task 6's page).

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ClipboardCheck } from "lucide-react"
import { getPendingGradingAttempts } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"

interface PendingGradingAttempt {
  _id: string
  studentId: {
    _id: string
    name: string
    email: string
  }
  examId: {
    _id: string
    title: string
    gradingMethod: 'ai' | 'manual'
  }
  endTime?: string
  createdAt: string
}

export function GradingQueue() {
  const navigate = useNavigate()
  const [attempts, setAttempts] = useState<PendingGradingAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const response = await getPendingGradingAttempts()
        setAttempts((response as any).attempts)
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load attempts pending grading",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAttempts()
  }, [toast])

  if (loading) {
    return <LoadingState label="Loading grading queue..." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Grading Queue</h1>
        <p className="text-muted-foreground">
          Exam attempts awaiting a grade
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Pending Grading ({attempts.length})
          </CardTitle>
          <CardDescription>
            Attempts with theory questions that need a score
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Grading Method</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((attempt) => (
                    <TableRow
                      key={attempt._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/grading/${attempt._id}`)}
                    >
                      <TableCell>
                        <div className="font-medium">{attempt.studentId.name}</div>
                        <div className="text-sm text-muted-foreground">{attempt.studentId.email}</div>
                      </TableCell>
                      <TableCell>{attempt.examId.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {attempt.examId.gradingMethod === 'ai' ? 'AI' : 'Manual'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(attempt.endTime || attempt.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No attempts pending grading" description="Attempts that need a grade will appear here." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `101` (unchanged baseline)

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/GradingQueue.tsx
git commit -m "feat: add GradingQueue admin page"
```

---

### Task 6: `GradeAttempt.tsx` (new detail/grading form page)

**Files:**
- Create: `client/src/pages/admin/GradeAttempt.tsx`

**Interfaces:**
- Consumes: `getAttemptForGrading`, `gradeTheoryQuestions`, `submitManualGrades` from Task 4 (`@/api/examAttempts`); `Card`/`CardContent`/`CardDescription`/`CardHeader`/`CardTitle` (`@/components/ui/card`), `Button` (`@/components/ui/button`), `Input` (`@/components/ui/input`), `Textarea` (`@/components/ui/textarea`), `Label` (`@/components/ui/label`), `LoadingState`/`EmptyState`, `useToast` — following the back-button-header convention in `client/src/pages/admin/ExamDetails.tsx`.
- Produces: `export function GradeAttempt()`, rendered at route `/admin/grading/:attemptId` (wired in Task 7). On successful save, navigates back to `/admin/grading`.

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react"
import { getAttemptForGrading, gradeTheoryQuestions, submitManualGrades } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"

interface GradingQuestion {
  _id: string
  type: string
  question: string
  correctAnswers?: string[]
  marks: number
}

interface GradingAttemptDetail {
  _id: string
  studentId: {
    _id: string
    name: string
    email: string
  }
  examId: {
    _id: string
    title: string
    totalMarks: number
    gradingMethod: 'ai' | 'manual'
    questions: GradingQuestion[]
  }
  answers: { [questionId: string]: string | string[] }
  status: string
  aiGradingResults?: {
    results: Array<{
      questionId: string
      score: number
      maxScore: number
      feedback: string
      error?: boolean
    }>
  }
  manualGradingResults?: {
    results: Array<{
      questionId: string
      score: number
      maxScore: number
      feedback: string
    }>
  }
}

interface GradeInput {
  score: string
  feedback: string
}

export function GradeAttempt() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [attempt, setAttempt] = useState<GradingAttemptDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [grades, setGrades] = useState<Record<string, GradeInput>>({})

  useEffect(() => {
    if (attemptId) {
      fetchAttempt()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId])

  const fetchAttempt = async () => {
    try {
      const response = await getAttemptForGrading(attemptId!)
      const loadedAttempt = (response as any).attempt as GradingAttemptDetail
      setAttempt(loadedAttempt)

      const theoryQuestions = loadedAttempt.examId.questions.filter(q => q.type === 'theory')
      const initialGrades: Record<string, GradeInput> = {}
      for (const question of theoryQuestions) {
        const existing =
          loadedAttempt.manualGradingResults?.results.find(r => r.questionId === question._id) ||
          loadedAttempt.aiGradingResults?.results.find(r => r.questionId === question._id && !r.error)
        initialGrades[question._id] = {
          score: existing ? String(existing.score) : '',
          feedback: existing?.feedback || ''
        }
      }
      setGrades(initialGrades)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load attempt",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const updateGrade = (questionId: string, field: 'score' | 'feedback', value: string) => {
    setGrades(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], [field]: value }
    }))
  }

  const handleRetryAiGrading = async () => {
    setRetrying(true)
    try {
      await gradeTheoryQuestions(attemptId!)
      toast({
        title: "Success",
        description: "AI grading retried"
      })
      await fetchAttempt()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to retry AI grading",
        variant: "destructive"
      })
    } finally {
      setRetrying(false)
    }
  }

  const handleSaveGrades = async () => {
    if (!attempt) return

    const theoryQuestions = attempt.examId.questions.filter(q => q.type === 'theory')

    for (const question of theoryQuestions) {
      const score = Number(grades[question._id]?.score)
      if (Number.isNaN(score) || score < 0 || score > question.marks) {
        toast({
          title: "Invalid score",
          description: `Score for "${question.question}" must be between 0 and ${question.marks}`,
          variant: "destructive"
        })
        return
      }
    }

    const gradesPayload = theoryQuestions.map(question => ({
      questionId: question._id,
      score: Number(grades[question._id]?.score || 0),
      feedback: grades[question._id]?.feedback || ''
    }))

    setSubmitting(true)
    try {
      await submitManualGrades(attemptId!, gradesPayload)
      toast({
        title: "Success",
        description: "Grades submitted"
      })
      navigate("/admin/grading")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit grades",
        variant: "destructive"
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingState label="Loading attempt..." />
  }

  if (!attempt) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Attempt not found"
        description="This attempt doesn't exist or you don't have access to it."
        action={{ label: "Back to Queue", onClick: () => navigate("/admin/grading") }}
      />
    )
  }

  const theoryQuestions = attempt.examId.questions.filter(q => q.type === 'theory')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/grading")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{attempt.examId.title}</h1>
          <p className="text-muted-foreground">
            {attempt.studentId.name} ({attempt.studentId.email})
          </p>
        </div>
      </div>

      {attempt.examId.gradingMethod === 'ai' && (
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleRetryAiGrading}
          disabled={retrying}
        >
          <RefreshCw className="h-4 w-4" />
          {retrying ? "Retrying..." : "Retry AI Grading"}
        </Button>
      )}

      {theoryQuestions.length === 0 ? (
        <EmptyState title="No theory questions" description="This attempt has no theory questions to grade." />
      ) : (
        <div className="space-y-4">
          {theoryQuestions.map((question, index) => {
            const studentAnswer = attempt.answers[question._id]
            const aiError = attempt.aiGradingResults?.results.find(r => r.questionId === question._id && r.error)

            return (
              <Card key={question._id}>
                <CardHeader>
                  <CardTitle className="text-base">Question {index + 1}</CardTitle>
                  <CardDescription>{question.question}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">Student's Answer</Label>
                    <p className="mt-1 rounded-md border p-3 text-sm whitespace-pre-wrap">
                      {Array.isArray(studentAnswer) ? studentAnswer.join(', ') : studentAnswer || 'No answer provided'}
                    </p>
                  </div>

                  {question.correctAnswers && question.correctAnswers[0] && (
                    <div>
                      <Label className="text-muted-foreground">Sample Answer</Label>
                      <p className="mt-1 rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                        {question.correctAnswers[0]}
                      </p>
                    </div>
                  )}

                  {aiError && (
                    <div className="flex items-center gap-2 rounded-md border border-status-danger p-3 text-sm text-status-danger-foreground">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {aiError.feedback}
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                    <div>
                      <Label htmlFor={`score-${question._id}`}>Score (of {question.marks})</Label>
                      <Input
                        id={`score-${question._id}`}
                        type="number"
                        min={0}
                        max={question.marks}
                        value={grades[question._id]?.score ?? ''}
                        onChange={(e) => updateGrade(question._id, 'score', e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`feedback-${question._id}`}>Feedback</Label>
                      <Textarea
                        id={`feedback-${question._id}`}
                        value={grades[question._id]?.feedback ?? ''}
                        onChange={(e) => updateGrade(question._id, 'feedback', e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <div className="flex justify-end">
            <Button onClick={handleSaveGrades} disabled={submitting}>
              {submitting ? "Saving..." : "Save Grades"}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `101` (unchanged baseline)

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/admin/GradeAttempt.tsx
git commit -m "feat: add GradeAttempt admin page"
```

---

### Task 7: Navigation wiring

**Files:**
- Modify: `client/src/lib/nav-config.ts` (add "Grading" nav item — **not** `Layout.tsx`; nav items are data-driven from this file, confirmed by reading `client/src/components/Sidebar.tsx` and `client/src/components/Layout.tsx`, which contain no nav item list at all)
- Modify: `client/src/App.tsx` (add 2 routes)
- Modify: `client/src/pages/admin/AdminDashboard.tsx` (wrap "Pending Grading" tile in a `Link`)

**Interfaces:**
- Consumes: `GradingQueue` and `GradeAttempt` from Tasks 5–6.
- Produces: reachable pages at `/admin/grading` and `/admin/grading/:attemptId`, a sidebar entry, and a clickable dashboard tile.

- [ ] **Step 1: Add the "Grading" nav item to `nav-config.ts`**

Replace:

```ts
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  BookOpen,
  ClipboardList,
  TrendingUp,
  Bookmark,
  MessageSquare,
} from "lucide-react"
```

with:

```ts
import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  BookOpen,
  ClipboardList,
  ClipboardCheck,
  TrendingUp,
  Bookmark,
  MessageSquare,
} from "lucide-react"
```

Then replace:

```ts
  { title: "Students", href: "/admin/students", icon: Users },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
```

with:

```ts
  { title: "Students", href: "/admin/students", icon: Users },
  { title: "Grading", href: "/admin/grading", icon: ClipboardCheck },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
```

- [ ] **Step 2: Add routes in `App.tsx`**

Replace:

```tsx
import { StudentVideoReview } from "./pages/admin/StudentVideoReview"
```

with:

```tsx
import { StudentVideoReview } from "./pages/admin/StudentVideoReview"
import { GradingQueue } from "./pages/admin/GradingQueue"
import { GradeAttempt } from "./pages/admin/GradeAttempt"
```

Then replace:

```tsx
            <Route path="admin/students" element={<StudentManagement />} />
            <Route path="admin/reports" element={<Reports />} />
```

with:

```tsx
            <Route path="admin/students" element={<StudentManagement />} />
            <Route path="admin/grading" element={<GradingQueue />} />
            <Route path="admin/grading/:attemptId" element={<GradeAttempt />} />
            <Route path="admin/reports" element={<Reports />} />
```

- [ ] **Step 3: Make the "Pending Grading" dashboard tile clickable**

Replace:

```tsx
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Grading</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-status-warning-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-status-warning-foreground">{stats.pendingGrading}</div>
          </CardContent>
        </Card>
```

with:

```tsx
        <Link to="/admin/grading">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Grading</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-status-warning-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold text-status-warning-foreground">{stats.pendingGrading}</div>
            </CardContent>
          </Card>
        </Link>
```

(`Link` and `ClipboardCheck` are already imported in `AdminDashboard.tsx` — no import changes needed here.)

- [ ] **Step 4: Verify**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `101` (unchanged baseline)

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/nav-config.ts client/src/App.tsx client/src/pages/admin/AdminDashboard.tsx
git commit -m "feat: wire up grading queue navigation (sidebar, routes, dashboard tile)"
```

---

### Task 8: Manual verification (Playwright + MongoDB)

No automated test framework exists in this repo — this task is a manual walkthrough using the two attempts already seeded in the dev DB for this purpose.

**Files:** none (verification only)

- [ ] **Step 1: Start both servers if not already running**

Backend (`server/`): `npm run dev` (or however it's currently run in this session)
Client (`client/`): `npm run dev` — confirm it serves at `http://127.0.0.1:5173`

- [ ] **Step 2: Log in as admin and check the dashboard tile**

Navigate to `http://127.0.0.1:5173/login`, log in as `admin@yahoo.com` / `password123`. On `/admin`, confirm the "Pending Grading" tile shows a count of at least 2 (the two seeded test attempts) and that clicking it navigates to `/admin/grading`.

- [ ] **Step 3: Check the sidebar nav item**

Confirm a "Grading" entry appears in the sidebar between "Students" and "Reports", and that it also navigates to `/admin/grading`.

- [ ] **Step 4: Verify the queue lists both seeded attempts**

On `/admin/grading`, confirm both `Theory Grading Manual Test Exam` (Grading Method badge: "Manual") and `AI Grading Failure Test Exam` (Grading Method badge: "AI") appear as rows, each with the correct student name/email and a submitted date.

- [ ] **Step 5: Manually grade the manual-mode attempt**

Click the `Theory Grading Manual Test Exam` row. Confirm the theory question(s), the student's answer, and empty score/feedback inputs (no AI results to pre-fill, since this exam is manual-mode) are shown, and that no "Retry AI Grading" button is rendered. Enter a valid score and feedback, click "Save Grades". Confirm it navigates back to `/admin/grading` and that exam's row is no longer in the list (it's now `completed`).

- [ ] **Step 6: Verify the recombined score, via MongoDB**

Query the `examattempts` collection for that attempt (`mcp__plugin_mongodb_mongodb__find`). Confirm `status: 'completed'`, `manualGradingResults.results` contains the entered score/feedback with `gradedBy` set to the admin's user ID, and `score`/`percentage` reflect the entered theory score combined with any non-theory score from the original submission.

- [ ] **Step 7: Retry AI grading on the AI-mode-failure attempt**

Click the `AI Grading Failure Test Exam` row. Confirm the per-question AI failure note is visible (reflecting the "Grading failed: ..." feedback recorded when no `AIPlatform` was configured at submission time), and that a "Retry AI Grading" button is rendered (since this exam is AI-mode). Click it.

- [ ] **Step 8: Confirm the retry behavior matches the (still unconfigured) AI platform state**

Since no `AIPlatform` is configured in this dev DB, expect the retry to still fail per-question and the attempt to remain `status: 'pending-review'` — confirm via a toast and that the row is still present in `/admin/grading` after navigating back. If time allows and an `AIPlatform` document is configured in the dev DB during this verification, retry again and confirm a successful grade now flips the attempt to `completed` and removes it from the queue.

- [ ] **Step 9: Report results**

Summarize pass/fail for each step above before moving to `finishing-a-development-branch`.
