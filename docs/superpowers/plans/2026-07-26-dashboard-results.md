# Phase 4 Part 2: Dashboard + Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three real bugs in `StudentResults.tsx` (hardcoded exam name, hardcoded total marks, missing back-navigation) and flatten both `StudentDashboard.tsx` and `StudentResults.tsx` from their gradient-heavy visual language onto the flat navy/slate/teal design system used everywhere else in the app.

**Architecture:** Frontend-only — no backend changes. The exam-name/marks bug is fixable purely on the client because Phase 4 part 1 already changed `getStudentAttempts` to populate `examId` with `title`/`totalMarks`; the data just isn't being read yet. Work proceeds file-by-file: a type fix first (so later tasks type-check cleanly), then `StudentResults.tsx` bug fixes, then `StudentResults.tsx` visual flattening, then `StudentDashboard.tsx` visual flattening, then manual verification.

**Tech Stack:** React + TypeScript (Vite) on the client. No test framework exists in this repo.

## Global Constraints

- No automated test framework exists in this repo. Every client task is verified with `npx tsc --noEmit -p tsconfig.app.json` (never bare `tsc --noEmit`), run from `client/`. The current baseline is **107 errors** (unchanged since Phase 4 part 1) — every task in this plan must produce that same count, since this plan makes no dead-code fixes.
- Any new `npm install` in a fresh worktree needs `PUPPETEER_SKIP_DOWNLOAD=true` set first.
- `server/.env` is gitignored and does not exist in a fresh worktree — create it before starting the dev server, with `DATABASE_URL=mongodb://localhost:27017/exammaster-dev`, a freshly generated `JWT_SECRET`, and `PORT=3000`.
- Use `http://127.0.0.1:5173` in Playwright, never `localhost`.
- Scope is limited to `client/src/pages/student/StudentDashboard.tsx`, `client/src/pages/student/StudentResults.tsx`, and `client/src/api/examAttempts.ts`. Do not touch `App.tsx` routing — student pages deliberately stay outside the shared admin `<Layout />` sidebar.
- Reuse the existing 4 status tokens (`status-success`/`status-info`/`status-warning`/`status-danger`) directly via `bg-status-*`/`text-status-*-foreground` classNames on `Badge`. Do not extend `StatusBadge`'s `Status` union — its fixed label set (`STATUS_LABELS`) doesn't cover grade letters ("A+", "B"...) or custom performance labels ("Excellent", "Good"...), so this plan applies the token classes directly instead.
- Flat-card convention to copy exactly (from `AdminDashboard.tsx`): `<Card>` with no background className, `<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">`, `<CardTitle className="text-sm font-medium text-muted-foreground">`, an icon at `h-4 w-4 text-muted-foreground` (or a status-token color only when the metric is itself a status signal), and `<CardContent>` containing `<div className="text-2xl font-semibold">` for the value plus an optional `<p className="text-xs text-muted-foreground">` subtitle.

---

### Task 1: `examAttempts.ts` — fix the `ExamAttempt.examId` type

**Files:**
- Modify: `client/src/api/examAttempts.ts:1-13`

**Interfaces:**
- Produces: `ExamAttempt.examId` typed as `string | { _id: string; title: string; subject?: string; totalMarks: number; showResultsImmediately?: boolean }`. Task 2 consumes this to read the real exam title/marks.

- [ ] **Step 1: Widen the `examId` field type**

Replace:

```ts
export interface ExamAttempt {
  _id: string;
  examId: string;
  studentId: string;
```

with:

```ts
export interface ExamAttempt {
  _id: string;
  examId: string | {
    _id: string;
    title: string;
    subject?: string;
    totalMarks: number;
    showResultsImmediately?: boolean;
  };
  studentId: string;
```

(Kept as a union rather than always-populated, since other endpoints returning `ExamAttempt` — e.g. `startExamAttempt`, `saveExamAnswer` — never populate this field. Only `GET /api/exam-attempts/student`, backing `getStudentExamAttempts`, populates it.)

- [ ] **Step 2: Verify with tsc**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json`
Expected: 107 errors, unchanged from baseline (`.examId` has no other client-side callers today — confirmed via a repo-wide grep — so widening this type introduces no new errors).

- [ ] **Step 3: Commit**

```bash
git add client/src/api/examAttempts.ts
git commit -m "Fix ExamAttempt.examId type to match the populated shape from getStudentAttempts"
```

---

### Task 2: `StudentResults.tsx` — fix hardcoded exam name/marks, add Back to Dashboard nav

**Files:**
- Modify: `client/src/pages/student/StudentResults.tsx`

**Interfaces:**
- Consumes: the widened `ExamAttempt.examId` type from Task 1.
- No signature changes — `StudentResults` remains a no-props page component.

- [ ] **Step 1: Add the imports this task needs**

Replace:

```tsx
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Trophy,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  Award,
  BookOpen
} from "lucide-react"
import { getStudentExamAttempts, type ExamAttempt } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"
```

with:

```tsx
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Trophy,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  Award,
  BookOpen,
  ArrowLeft
} from "lucide-react"
import { getStudentExamAttempts, type ExamAttempt } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"
```

- [ ] **Step 2: Add the "Back to Dashboard" header**

Replace:

```tsx
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Results</h1>
        <p className="text-muted-foreground">
          View your exam performance and progress
        </p>
      </div>
```

with:

```tsx
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/student">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Results</h1>
        <p className="text-muted-foreground">
          View your exam performance and progress
        </p>
      </div>
```

(Identical pattern to `ExamInstructions.tsx`'s existing "Back to Dashboard" header.)

- [ ] **Step 3: Use the real exam title and total marks in the results table**

Replace:

```tsx
                <TableBody>
                  {completedAttempts.map((attempt) => (
                    <TableRow key={attempt._id}>
                      <TableCell className="font-medium">
                        Mathematics Final Exam {/* This would come from exam data */}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(attempt.endTime!).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{attempt.score}</span>
                        <span className="text-muted-foreground">/100</span>
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
                  ))}
                </TableBody>
```

with:

```tsx
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
```

- [ ] **Step 4: Verify with tsc**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 107 errors, unchanged.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/student/StudentResults.tsx
git commit -m "Fix hardcoded exam name/marks in StudentResults, add Back to Dashboard nav"
```

---

### Task 3: `StudentResults.tsx` — flatten to admin design system

**Files:**
- Modify: `client/src/pages/student/StudentResults.tsx`

**Interfaces:**
- No signature changes.

- [ ] **Step 1: Add `LoadingState`/`EmptyState` imports**

Replace:

```tsx
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
```

with:

```tsx
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
```

- [ ] **Step 2: Strip debug logging**

Replace:

```tsx
  const fetchResults = async () => {
    try {
      console.log('Fetching student results...')
      const response = await getStudentExamAttempts()
      setAttempts((response as any).attempts)
    } catch (error) {
      console.error('Error fetching results:', error)
      toast({
        title: "Error",
        description: "Failed to load results",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
```

with:

```tsx
  const fetchResults = async () => {
    try {
      const response = await getStudentExamAttempts()
      setAttempts((response as any).attempts)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load results",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
```

- [ ] **Step 3: Remap grade/performance badge colors onto status tokens**

Replace:

```tsx
  const getGradeBadge = (percentage: number) => {
    if (percentage >= 90) return <Badge className="bg-green-600">A+</Badge>
    if (percentage >= 80) return <Badge className="bg-green-500">A</Badge>
    if (percentage >= 70) return <Badge className="bg-blue-500">B</Badge>
    if (percentage >= 60) return <Badge className="bg-yellow-500">C</Badge>
    if (percentage >= 50) return <Badge className="bg-orange-500">D</Badge>
    return <Badge variant="destructive">F</Badge>
  }

  const getPerformanceBadge = (percentage: number) => {
    if (percentage >= 85) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Excellent</Badge>
    if (percentage >= 70) return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Good</Badge>
    if (percentage >= 60) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Average</Badge>
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Needs Improvement</Badge>
  }
```

with:

```tsx
  const getGradeBadge = (percentage: number) => {
    if (percentage >= 90) return <Badge className="bg-status-success text-status-success-foreground">A+</Badge>
    if (percentage >= 80) return <Badge className="bg-status-success text-status-success-foreground">A</Badge>
    if (percentage >= 70) return <Badge className="bg-status-info text-status-info-foreground">B</Badge>
    if (percentage >= 60) return <Badge className="bg-status-warning text-status-warning-foreground">C</Badge>
    if (percentage >= 50) return <Badge className="bg-status-warning text-status-warning-foreground">D</Badge>
    return <Badge className="bg-status-danger text-status-danger-foreground">F</Badge>
  }

  const getPerformanceBadge = (percentage: number) => {
    if (percentage >= 85) return <Badge className="bg-status-success text-status-success-foreground">Excellent</Badge>
    if (percentage >= 70) return <Badge className="bg-status-info text-status-info-foreground">Good</Badge>
    if (percentage >= 60) return <Badge className="bg-status-warning text-status-warning-foreground">Average</Badge>
    return <Badge className="bg-status-danger text-status-danger-foreground">Needs Improvement</Badge>
  }
```

- [ ] **Step 4: Replace the ad-hoc loading spinner with `LoadingState`**

Replace:

```tsx
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
```

with:

```tsx
  if (loading) {
    return <LoadingState label="Loading results..." />
  }
```

- [ ] **Step 5: Flatten the 4 gradient summary cards**

Replace:

```tsx
      {/* Performance Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exams Completed</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{completedAttempts.length}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Total attempts
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {averageScore.toFixed(1)}%
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">
              Overall performance
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Score</CardTitle>
            <Trophy className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {bestScore.toFixed(1)}%
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Highest achievement
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Spent</CardTitle>
            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {Math.floor(totalTimeSpent / 60)}h
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              Total exam time
            </p>
          </CardContent>
        </Card>
      </div>
```

with:

```tsx
      {/* Performance Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Exams Completed</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{completedAttempts.length}</div>
            <p className="text-xs text-muted-foreground">
              Total attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {averageScore.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall performance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {bestScore.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Highest achievement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Time Spent</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {Math.floor(totalTimeSpent / 60)}h
            </div>
            <p className="text-xs text-muted-foreground">
              Total exam time
            </p>
          </CardContent>
        </Card>
      </div>
```

- [ ] **Step 6: Replace the ad-hoc "No Results Yet" block with `EmptyState`**

Replace:

```tsx
          ) : (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Results Yet</h3>
              <p className="text-muted-foreground">
                Complete your first exam to see results here.
              </p>
            </div>
          )}
```

with:

```tsx
          ) : (
            <EmptyState
              icon={Trophy}
              title="No Results Yet"
              description="Complete your first exam to see results here."
            />
          )}
```

- [ ] **Step 7: Verify with tsc**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 107 errors, unchanged.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/student/StudentResults.tsx
git commit -m "Flatten StudentResults to admin design system, adopt LoadingState/EmptyState"
```

---

### Task 4: `StudentDashboard.tsx` — flatten to admin design system

**Files:**
- Modify: `client/src/pages/student/StudentDashboard.tsx`

**Interfaces:**
- No signature changes.

- [ ] **Step 1: Add `LoadingState`/`EmptyState` imports**

Replace:

```tsx
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Clock,
  BookOpen,
  Trophy,
  Play,
  Calendar,
  Award,
  LogOut,
  User
} from "lucide-react"
import { Link } from "react-router-dom"
import { getAvailableExamsForStudent } from "@/api/exams"
import { getStudentRecentResults } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"
```

with:

```tsx
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Clock,
  BookOpen,
  Trophy,
  Play,
  Calendar,
  Award,
  LogOut,
  User
} from "lucide-react"
import { Link } from "react-router-dom"
import { getAvailableExamsForStudent } from "@/api/exams"
import { getStudentRecentResults } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"
```

- [ ] **Step 2: Strip debug logging**

Replace:

```tsx
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        console.log('Fetching student dashboard data...')

        // Fetch available exams and recent results in parallel
        const [availableExamsResponse, recentResultsResponse] = await Promise.all([
          getAvailableExamsForStudent(),
          getStudentRecentResults()
        ])

        const availableExamsData = (availableExamsResponse as any).exams || []
        const recentResultsData = (recentResultsResponse as any).recentResults || []

        console.log('Student Dashboard - Available exams received:', availableExamsData)
        console.log('Student Dashboard - Recent results received:', recentResultsData)

        setStats({
          availableExams: availableExamsData.length,
          completedExams: recentResultsData.length
        })

        setAvailableExams(availableExamsData)
        setRecentResults(recentResultsData)
      } catch (error) {
        console.error('Error fetching student dashboard data:', error)
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [toast])
```

with:

```tsx
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch available exams and recent results in parallel
        const [availableExamsResponse, recentResultsResponse] = await Promise.all([
          getAvailableExamsForStudent(),
          getStudentRecentResults()
        ])

        const availableExamsData = (availableExamsResponse as any).exams || []
        const recentResultsData = (recentResultsResponse as any).recentResults || []

        setStats({
          availableExams: availableExamsData.length,
          completedExams: recentResultsData.length
        })

        setAvailableExams(availableExamsData)
        setRecentResults(recentResultsData)
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [toast])
```

(This removes all 4 debug statements — 3 `console.log` plus the `console.error` in the catch block — matching the established repo-wide convention of surfacing errors only via the `toast`, e.g. `Reports.tsx`'s catch blocks.)

- [ ] **Step 3: Replace the gradient loading screen with `LoadingState`**

Replace:

```tsx
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background to-secondary/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
```

with:

```tsx
  if (loading) {
    return <LoadingState label="Loading dashboard..." className="min-h-screen" />
  }
```

- [ ] **Step 4: Flatten the page background and header**

Replace:

```tsx
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-background to-secondary/20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ExamMaster</h1>
              <p className="text-sm text-muted-foreground">Student Portal</p>
            </div>
          </div>
```

with:

```tsx
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ExamMaster</h1>
              <p className="text-sm text-muted-foreground">Student Portal</p>
            </div>
          </div>
```

- [ ] **Step 5: Flatten the 2 gradient stat cards**

Replace:

```tsx
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Exams</CardTitle>
                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.availableExams}</div>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Ready to attempt now
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed Exams</CardTitle>
                <Trophy className="h-4 w-4 text-green-600 dark:text-green-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-700 dark:text-green-300">{stats.completedExams}</div>
                <p className="text-xs text-green-600 dark:text-green-400">
                  With results available
                </p>
              </CardContent>
            </Card>
          </div>
```

with:

```tsx
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 max-w-4xl mx-auto">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Available Exams</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.availableExams}</div>
                <p className="text-xs text-muted-foreground">
                  Ready to attempt now
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed Exams</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.completedExams}</div>
                <p className="text-xs text-muted-foreground">
                  With results available
                </p>
              </CardContent>
            </Card>
          </div>
```

- [ ] **Step 6: Flatten the "Available" badge and "Start Exam" button, and use `EmptyState`**

Replace:

```tsx
                        <div className="text-right space-y-2">
                          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200">
                            Available
                          </Badge>
                          <div>
                            <Link to={`/student/exam/${exam._id}/instructions`}>
                              <Button size="sm" className="gap-1 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700">
                                <Play className="h-3 w-3" />
                                Start Exam
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">No exams available at this time</p>
                      <p className="text-xs text-muted-foreground mt-1">Check back later for new exams</p>
                    </div>
                  )}
```

with:

```tsx
                        <div className="text-right space-y-2">
                          <Badge className="bg-status-success text-status-success-foreground">
                            Available
                          </Badge>
                          <div>
                            <Link to={`/student/exam/${exam._id}/instructions`}>
                              <Button size="sm" className="gap-1">
                                <Play className="h-3 w-3" />
                                Start Exam
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={Calendar}
                      title="No exams available at this time"
                      description="Check back later for new exams"
                    />
                  )}
```

- [ ] **Step 7: Remap the Recent Results badge colors, and use `EmptyState`**

Replace:

```tsx
                        <div className="text-right space-y-1">
                          <div className="text-lg font-bold">{result.percentage}%</div>
                          <Badge
                            variant={
                              result.percentage >= 80 ? 'default' :
                              result.percentage >= 60 ? 'secondary' :
                              'destructive'
                            }
                            className={
                              result.percentage >= 80 ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                              result.percentage >= 60 ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                              'bg-red-100 text-red-700 hover:bg-red-200'
                            }
                          >
                            {result.percentage >= 80 ? 'Excellent' :
                             result.percentage >= 60 ? 'Good' :
                             'Needs Improvement'}
                          </Badge>
                          <p className="text-xs text-muted-foreground">Score: {result.score}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-sm text-muted-foreground">No exam results available yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Complete some exams to see your results here</p>
                    </div>
                  )}
```

with:

```tsx
                        <div className="text-right space-y-1">
                          <div className="text-lg font-bold">{result.percentage}%</div>
                          <Badge
                            className={
                              result.percentage >= 80 ? 'bg-status-success text-status-success-foreground' :
                              result.percentage >= 60 ? 'bg-status-info text-status-info-foreground' :
                              'bg-status-danger text-status-danger-foreground'
                            }
                          >
                            {result.percentage >= 80 ? 'Excellent' :
                             result.percentage >= 60 ? 'Good' :
                             'Needs Improvement'}
                          </Badge>
                          <p className="text-xs text-muted-foreground">Score: {result.score}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={Trophy}
                      title="No exam results available yet"
                      description="Complete some exams to see your results here"
                    />
                  )}
```

- [ ] **Step 8: Flatten the Quick Tips card**

Replace:

```tsx
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-800">📚 Quick Tips for Success</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start space-x-2">
                  <Clock className="h-4 w-4 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-purple-800">Manage Your Time</p>
                    <p className="text-purple-600">Keep an eye on the timer and pace yourself</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <BookOpen className="h-4 w-4 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-purple-800">Read Carefully</p>
                    <p className="text-purple-600">Take time to understand each question</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <Award className="h-4 w-4 text-purple-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-purple-800">Stay Focused</p>
                    <p className="text-purple-600">Minimize distractions during exams</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
```

with:

```tsx
          <Card>
            <CardHeader>
              <CardTitle>📚 Quick Tips for Success</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Manage Your Time</p>
                    <p className="text-muted-foreground">Keep an eye on the timer and pace yourself</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Read Carefully</p>
                    <p className="text-muted-foreground">Take time to understand each question</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <Award className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Stay Focused</p>
                    <p className="text-muted-foreground">Minimize distractions during exams</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
```

- [ ] **Step 9: Verify with tsc**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 107 errors, unchanged.

- [ ] **Step 10: Commit**

```bash
git add client/src/pages/student/StudentDashboard.tsx
git commit -m "Flatten StudentDashboard to admin design system, adopt LoadingState/EmptyState"
```

---

### Task 5: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Final tsc regression check**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 107 errors, unchanged from the pre-existing baseline.

- [ ] **Step 2: Start the app**

From the worktree root: create `server/.env` per Global Constraints if not already present, start `node server.js` in `server/` and `npm run dev` in `client/`.

- [ ] **Step 3: Verify StudentResults bug fixes and nav chrome**

Log in as `student1@example.com` via Playwright, navigate to `/student/results`. Confirm:
- The exam name column shows the real exam title (e.g. from the leftover Exam Settings Enforcement test exam, `6a65d6cab4b1fab75ed140a7`), not "Mathematics Final Exam".
- The score fraction shows the exam's real `totalMarks`, not `/100`.
- The "Back to Dashboard" button is present at the top and navigates to `/student` when clicked.

- [ ] **Step 4: Verify StudentResults visual flattening**

Confirm the 4 summary cards, grade badges, and performance badges use flat `Card`s and the status-token colors (no gradients, no ad-hoc green/blue/purple/orange/yellow/red classes remain). Check both light and dark mode. If a student account with zero completed attempts is available, verify the `EmptyState` "No Results Yet" renders correctly; otherwise note this as unverified and why (matching the transparency precedent from prior phases rather than fabricating a account/data).

- [ ] **Step 5: Verify StudentDashboard visual flattening**

Navigate to `/student`. Confirm the header, stat cards, "Start Exam" button, Recent Results badges, and Quick Tips card are all flat (no gradients, no ad-hoc colors). Confirm the "Available" badge and Recent Results percentage badges use status tokens. Check both light and dark mode. Verify the empty states for "No exams available" and "No exam results available yet" if reachable; otherwise note as unverified and why.

- [ ] **Step 6: Report results**

Summarize the tsc comparison and the live-verification outcome for both pages, calling out anything that couldn't be fully verified (e.g. no zero-attempt student account existed) and why.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-dashboard-results.md`.
