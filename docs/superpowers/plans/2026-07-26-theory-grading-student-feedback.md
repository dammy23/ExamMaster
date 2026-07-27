# Theory Grading — Part 3: Student-Facing Feedback Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let students see their theory-question score/feedback once an attempt is graded, and see that a submitted attempt is awaiting grading rather than have it silently vanish from their results list.

**Architecture:** Widen `StudentResults.tsx`'s existing list to also render `pending-review` attempts as a non-interactive row (no backend change needed — `getStudentAttempts` already returns them). Add one new backend method + route + client page for a read-only per-attempt detail view (`/student/results/:attemptId`), mirroring Part 2's admin `GradeAttempt.tsx` pattern but with no editing controls.

**Tech Stack:** Express + Mongoose (backend), React + TypeScript + shadcn/ui + React Router (client). No automated test framework exists in this repo.

## Global Constraints

- Backend verification: `node --check <file>` (no test framework exists).
- Client verification: `npx tsc --noEmit -p tsconfig.app.json` from `client/`, compared against the current baseline of **101** pre-existing errors — task changes must not increase this count.
- Follow existing conventions exactly: student-only route guard is `if (req.user.role === 'admin') return res.status(403)...` (inverse of the admin guard); ObjectId validation is `mongoose.Types.ObjectId.isValid(id)`; error responses are `{ success: false, error: message }`.
- `noUnusedLocals` and `noUnusedParameters` are both `true` in `tsconfig.app.json` — every import must be used, exactly.
- Page components that consume populated (non-`ExamAttempt`-shaped) API responses define their own local interface for that shape, matching the established pattern from Part 2's `GradeAttempt.tsx` (its local `GradingAttemptDetail`/`GradingQuestion` interfaces) — do not force the shared `ExamAttempt` type to cover every populate variant.
- Two attempts already exist in the dev DB for this part's manual verification (left over from Part 2): `Theory Grading Manual Test Exam`'s attempt (student `student2@example.com`) is now `status: 'completed'` with a real `manualGradingResults` entry (score 8/10, feedback recorded); `AI Grading Failure Test Exam`'s attempt (student `student1@example.com`) is still `status: 'pending-review'`.

---

### Task 1: Backend — `getAttemptDetailForStudent`

**Files:**
- Modify: `server/services/examAttemptService.js:424-444` (insert new method immediately after `getStudentAttempts`)

**Interfaces:**
- Consumes: `ExamAttempt`, `mongoose` (already required at the top of this file).
- Produces: `ExamAttemptService.getAttemptDetailForStudent(attemptId, studentId): Promise<ExamAttempt>` (populated `examId` with `title subject totalMarks showResultsImmediately` plus nested `examId.questions`), consumed by Task 2's route.

- [ ] **Step 1: Add the method after `getStudentAttempts`**

Replace:

```js
      console.log(`ExamAttemptService: Found ${visibleAttempts.length} visible attempts for student`);
      return visibleAttempts;
    } catch (error) {
      console.error('ExamAttemptService: Error getting student attempts:', error.message);
      throw error;
    }
  }

  // Log activity (like tab switches)
```

with:

```js
      console.log(`ExamAttemptService: Found ${visibleAttempts.length} visible attempts for student`);
      return visibleAttempts;
    } catch (error) {
      console.error('ExamAttemptService: Error getting student attempts:', error.message);
      throw error;
    }
  }

  // Get full detail (including theory question feedback) for a single completed attempt, student-owned
  static async getAttemptDetailForStudent(attemptId, studentId) {
    try {
      console.log('ExamAttemptService: Getting attempt detail for student:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId).populate({
        path: 'examId',
        select: 'title subject totalMarks showResultsImmediately',
        populate: {
          path: 'questions'
        }
      });

      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      if (attempt.studentId.toString() !== studentId.toString()) {
        throw new Error('You are not authorized to view this exam attempt');
      }

      if (attempt.status !== 'completed') {
        throw new Error('This exam attempt has not been fully graded yet');
      }

      if (!attempt.examId || !attempt.examId.showResultsImmediately) {
        throw new Error('Results for this exam are not available');
      }

      console.log('ExamAttemptService: Attempt detail retrieved for student');
      return attempt;
    } catch (error) {
      console.error('ExamAttemptService: Error getting attempt detail for student:', error.message);
      throw error;
    }
  }

  // Log activity (like tab switches)
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server/services/examAttemptService.js`
Expected: no output (exits 0)

- [ ] **Step 3: Commit**

```bash
git add server/services/examAttemptService.js
git commit -m "feat: add getAttemptDetailForStudent service method"
```

---

### Task 2: Route

**Files:**
- Modify: `server/routes/examAttemptRoutes.js:493-522` (insert new route immediately after `/student/recent-results`)

**Interfaces:**
- Consumes: `ExamAttemptService.getAttemptDetailForStudent` from Task 1; `requireUser` middleware (existing).
- Produces: `GET /api/exam-attempts/student/attempt/:attemptId` → `{ success, attempt }`. Consumed by Task 3's client API function.

- [ ] **Step 1: Add the route**

Replace:

```js
    console.error(`Error getting recent results for student ${req.user.email}:`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get recent activity for admin dashboard  
```

with:

```js
    console.error(`Error getting recent results for student ${req.user.email}:`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get full detail (including theory question feedback) for a single completed attempt
router.get('/student/attempt/:attemptId', requireUser, async (req, res) => {
  try {
    const { attemptId } = req.params;
    console.log(`Getting attempt detail for student: attempt=${attemptId} by user: ${req.user.email}`);

    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only students can access their own attempt detail'
      });
    }

    const attempt = await ExamAttemptService.getAttemptDetailForStudent(attemptId, req.user._id);

    return res.status(200).json({
      success: true,
      attempt: attempt
    });
  } catch (error) {
    console.error(`Error getting attempt detail for student ${req.user.email}:`, error.message);

    if (error.message === 'Exam attempt not found' || error.message === 'Invalid attempt ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized') || error.message.includes('not available') ||
        error.message.includes('not been fully graded')) {
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

// Get recent activity for admin dashboard  
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server/routes/examAttemptRoutes.js`
Expected: no output (exits 0)

- [ ] **Step 3: Commit**

```bash
git add server/routes/examAttemptRoutes.js
git commit -m "feat: add student attempt-detail route"
```

---

### Task 3: Client API function

**Files:**
- Modify: `client/src/api/examAttempts.ts` (append after `submitManualGrades`, end of file)

**Interfaces:**
- Consumes: the new route from Task 2.
- Produces: `getAttemptDetail(attemptId: string): Promise<any>`, consumed by Task 5's page.

- [ ] **Step 1: Add the function at the end of the file**

Append after the existing `submitManualGrades` export (end of file):

```ts

// Description: Get full detail (including theory question feedback) for a single completed attempt
// Endpoint: GET /api/exam-attempts/student/attempt/:attemptId
// Request: {}
// Response: { success: boolean, attempt: ExamAttempt }
export const getAttemptDetail = async (attemptId: string) => {
  try {
    const response = await api.get(`/api/exam-attempts/student/attempt/${attemptId}`);
    return response.data;
  } catch (error: any) {
    console.error('Get attempt detail error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
```

- [ ] **Step 2: Verify**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `101` (unchanged baseline)

- [ ] **Step 3: Commit**

```bash
git add client/src/api/examAttempts.ts
git commit -m "feat: add getAttemptDetail client API function"
```

---

### Task 4: `StudentResults.tsx` — show pending-review rows and a Details link

**Files:**
- Modify: `client/src/pages/student/StudentResults.tsx`

**Interfaces:**
- Consumes: nothing new (uses existing `getStudentExamAttempts`); links to `/student/results/:attemptId` (Task 5's page, wired in Task 6).
- Produces: no new exports — same `StudentResults` component, extended.

- [ ] **Step 1: Import `StatusBadge`**

Replace:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
```

with:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { Button } from "@/components/ui/button"
```

- [ ] **Step 2: Add a `visibleAttempts` variable alongside the existing `completedAttempts`**

Replace:

```tsx
  const completedAttempts = attempts.filter(attempt => attempt.status === 'completed')
  const averageScore = completedAttempts.length > 0
```

with:

```tsx
  const completedAttempts = attempts.filter(attempt => attempt.status === 'completed')
  const visibleAttempts = attempts.filter(attempt => attempt.status === 'completed' || attempt.status === 'pending-review')
  const averageScore = completedAttempts.length > 0
```

(`completedAttempts` still drives every stat tile and the Performance Overview card below — those must stay based on finalized results only. `visibleAttempts` is only used in the table in Step 3.)

- [ ] **Step 3: Switch the results table to `visibleAttempts`, add a Details column, and branch each row on status**

Replace:

```tsx
          {completedAttempts.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Time Taken</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedAttempts.map((attempt) => {
                    const examTitle = typeof attempt.examId === 'object' ? attempt.examId.title : 'Untitled Exam'
                    const examTotalMarks = typeof attempt.examId === 'object' ? attempt.examId.totalMarks : 100
                    return (
                      <TableRow key={attempt._id}>
                        <TableCell className="font-medium">
                          {examTitle}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(attempt.endTime!).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{attempt.score}</span>
                          <span className="text-muted-foreground">/{examTotalMarks}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{attempt.percentage?.toFixed(1)}%</span>
                        </TableCell>
                        <TableCell>
                          {getGradeBadge(attempt.percentage || 0)}
                        </TableCell>
                        <TableCell>
                          {getPerformanceBadge(attempt.percentage || 0)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.floor(attempt.timeSpent / 60)}m {attempt.timeSpent % 60}s
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Trophy}
              title="No Results Yet"
              description="Complete your first exam to see results here."
            />
          )}
```

with:

```tsx
          {visibleAttempts.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Time Taken</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleAttempts.map((attempt) => {
                    const examTitle = typeof attempt.examId === 'object' ? attempt.examId.title : 'Untitled Exam'
                    const examTotalMarks = typeof attempt.examId === 'object' ? attempt.examId.totalMarks : 100
                    const isPending = attempt.status === 'pending-review'
                    return (
                      <TableRow key={attempt._id}>
                        <TableCell className="font-medium">
                          {examTitle}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(attempt.endTime!).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isPending ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <>
                              <span className="font-medium">{attempt.score}</span>
                              <span className="text-muted-foreground">/{examTotalMarks}</span>
                            </>
                          )}
                        </TableCell>
                        <TableCell>
                          {isPending ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className="font-medium">{attempt.percentage?.toFixed(1)}%</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isPending ? (
                            <StatusBadge status="pending-review" />
                          ) : (
                            getGradeBadge(attempt.percentage || 0)
                          )}
                        </TableCell>
                        <TableCell>
                          {isPending ? (
                            <StatusBadge status="pending-review" />
                          ) : (
                            getPerformanceBadge(attempt.percentage || 0)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.floor(attempt.timeSpent / 60)}m {attempt.timeSpent % 60}s
                          </div>
                        </TableCell>
                        <TableCell>
                          {!isPending && (
                            <Link to={`/student/results/${attempt._id}`}>
                              <Button variant="outline" size="sm">
                                View Details
                              </Button>
                            </Link>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Trophy}
              title="No Results Yet"
              description="Complete your first exam to see results here."
            />
          )}
```

- [ ] **Step 4: Verify**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `101` (unchanged baseline)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/student/StudentResults.tsx
git commit -m "feat: show pending-review attempts and add Details link in My Results"
```

---

### Task 5: `AttemptResult.tsx` (new read-only detail page)

**Files:**
- Create: `client/src/pages/student/AttemptResult.tsx`

**Interfaces:**
- Consumes: `getAttemptDetail` from Task 3 (`@/api/examAttempts`); `Card`/`CardContent`/`CardDescription`/`CardHeader`/`CardTitle` (`@/components/ui/card`), `Button` (`@/components/ui/button`), `LoadingState`/`EmptyState`, `useToast` — following the read-only mirror of Part 2's `client/src/pages/admin/GradeAttempt.tsx` (no score inputs, no feedback textareas, no Retry button).
- Produces: `export function AttemptResult()`, rendered at route `/student/results/:attemptId` (wired in Task 6).

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { ArrowLeft, Calendar, AlertTriangle } from "lucide-react"
import { getAttemptDetail } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"

interface ResultQuestion {
  _id: string
  type: string
  question: string
  marks: number
}

interface AttemptResultDetail {
  _id: string
  examId: {
    _id: string
    title: string
    totalMarks: number
    questions: ResultQuestion[]
  }
  answers: { [questionId: string]: string | string[] }
  score?: number
  percentage?: number
  endTime?: string
  aiGradingResults?: {
    results: Array<{
      questionId: string
      score: number
      maxScore: number
      feedback: string
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

export function AttemptResult() {
  const { attemptId } = useParams<{ attemptId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [attempt, setAttempt] = useState<AttemptResultDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAttempt = async () => {
      try {
        const response = await getAttemptDetail(attemptId!)
        setAttempt((response as any).attempt as AttemptResultDetail)
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load result",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    if (attemptId) {
      fetchAttempt()
    }
  }, [attemptId, toast])

  if (loading) {
    return <LoadingState label="Loading result..." />
  }

  if (!attempt) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Result not found"
        description="This result doesn't exist or isn't available yet."
        action={{ label: "Back to Results", onClick: () => navigate("/student/results") }}
      />
    )
  }

  const theoryQuestions = attempt.examId.questions.filter(q => q.type === 'theory')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/student/results">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{attempt.examId.title}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {attempt.endTime ? new Date(attempt.endTime).toLocaleDateString() : 'N/A'}
            <span>&middot;</span>
            <span className="font-medium">{attempt.score}/{attempt.examId.totalMarks}</span>
            <span>({attempt.percentage?.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {theoryQuestions.length === 0 ? (
        <EmptyState title="No theory questions" description="This exam had no theory questions." />
      ) : (
        <div className="space-y-4">
          {theoryQuestions.map((question, index) => {
            const studentAnswer = attempt.answers[question._id]
            const result =
              attempt.manualGradingResults?.results.find(r => r.questionId === question._id) ||
              attempt.aiGradingResults?.results.find(r => r.questionId === question._id)

            return (
              <Card key={question._id}>
                <CardHeader>
                  <CardTitle className="text-base">Question {index + 1}</CardTitle>
                  <CardDescription>{question.question}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Your Answer</p>
                    <p className="mt-1 rounded-md border p-3 text-sm whitespace-pre-wrap">
                      {Array.isArray(studentAnswer) ? studentAnswer.join(', ') : studentAnswer || 'No answer provided'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">Score:</p>
                    <p className="text-sm font-medium">
                      {result ? `${result.score} / ${result.maxScore}` : `— / ${question.marks}`}
                    </p>
                  </div>

                  {result?.feedback && (
                    <div>
                      <p className="text-sm text-muted-foreground">Feedback</p>
                      <p className="mt-1 rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap">
                        {result.feedback}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
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
git add client/src/pages/student/AttemptResult.tsx
git commit -m "feat: add AttemptResult student page"
```

---

### Task 6: Route wiring

**Files:**
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `AttemptResult` from Task 5.
- Produces: reachable page at `/student/results/:attemptId`.

- [ ] **Step 1: Import `AttemptResult` and add its route**

Replace:

```tsx
import { StudentResults } from "./pages/student/StudentResults"
```

with:

```tsx
import { StudentResults } from "./pages/student/StudentResults"
import { AttemptResult } from "./pages/student/AttemptResult"
```

Then replace:

```tsx
          <Route path="/student/results" element={
            <ProtectedRoute>
              <StudentResults />
            </ProtectedRoute>
          } />
          <Route path="/" element={<ProtectedRoute> <Layout /> </ProtectedRoute>}>
```

with:

```tsx
          <Route path="/student/results" element={
            <ProtectedRoute>
              <StudentResults />
            </ProtectedRoute>
          } />
          <Route path="/student/results/:attemptId" element={
            <ProtectedRoute>
              <AttemptResult />
            </ProtectedRoute>
          } />
          <Route path="/" element={<ProtectedRoute> <Layout /> </ProtectedRoute>}>
```

- [ ] **Step 2: Verify**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `101` (unchanged baseline)

- [ ] **Step 3: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: wire up /student/results/:attemptId route"
```

---

### Task 7: Manual verification (Playwright + MongoDB)

No automated test framework exists in this repo — this task is a manual walkthrough using the two attempts already present in the dev DB from Part 2's verification.

**Files:** none (verification only)

- [ ] **Step 1: Start both servers**

Backend (`server/`): `npm run dev`
Client (`client/`): `npm run dev` — confirm it serves at `http://127.0.0.1:5173`

- [ ] **Step 2: Log in as `student2@example.com` and check the completed attempt**

Navigate to `http://127.0.0.1:5173/login`, log in as `student2@example.com` / `password123`. On `/student/results`, confirm the `Theory Grading Manual Test Exam` row shows the recombined score (8/10, 80%), a real grade/performance badge, and a "View Details" button. Click it.

- [ ] **Step 3: Verify the detail page**

On `/student/results/<attemptId>`, confirm the header shows the exam title, submission date, and 8/10 (80%), and that the single theory question card shows the student's original answer, "8 / 10" as the score, and the exact feedback text entered during Part 2's verification ("Good explanation, mostly accurate. Minor deduction for not mentioning spacetime curvature explicitly.").

- [ ] **Step 4: Log in as `student1@example.com` and check the pending-review row**

Log out, log in as `student1@example.com` / `password123`. On `/student/results`, confirm the `AI Grading Failure Test Exam` row now appears (previously invisible) with a "Pending Review" badge in the Grade and Performance columns, `—` for Score and Percentage, a real Time Taken value, and no "View Details" button.

- [ ] **Step 5: Confirm the stat tiles and Performance Overview are unaffected**

Confirm "Exams Completed", "Average Score", "Best Score" and the Performance Overview progress bars did not change for either student compared to before this feature (they should still be computed only from `completed` attempts, ignoring the newly-visible pending-review row).

- [ ] **Step 6: Report results**

Summarize pass/fail for each step above before moving to `finishing-a-development-branch`.
