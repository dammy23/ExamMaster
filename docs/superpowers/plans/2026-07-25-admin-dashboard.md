# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `AdminDashboard.tsx`'s fabricated data (fake trend captions, fake System Status metrics) with real data only, redesign the stat tiles per the dataviz skill's guidance, and add two new genuinely-data-backed cards (Recent Exams, Active Subjects) plus a real Pending Grading count.

**Architecture:** One new backend aggregate (`getPendingGradingCount`) and its route are built and curl-verified first, then a thin client API wrapper, then the page itself is rewritten as a single cohesive unit (a dashboard's sections are interdependent — half-migrating it would leave an inconsistent page).

**Tech Stack:** Express + Mongoose (backend), React + TypeScript (frontend), existing `StatusBadge`/`LoadingState`/`EmptyState` from Phase 1.

## Global Constraints

- No frontend or backend test framework exists in this repo and this plan does not introduce one. Every task's verification is manual: `curl` for the backend, a real browser for the frontend.
- Pending-grading definition: attempt `status === 'completed'`, `aiGradingResults.gradedAt` not set, and the exam has at least one `type: 'theory'` question the student answered (present in `attempt.answers`).
- The new route follows the exact pattern of the adjacent `/admin/recent-activity` route: `requireUser` middleware + an inline `if (req.user.role !== 'admin') return res.status(403)...` check — not a `requireAdmin` middleware (this codebase doesn't use one here).
- Stat tiles are uniform (label in `text-muted-foreground`, value in large semibold proportional-figure text, icon in `text-muted-foreground`) except Active Exams, which uses `text-primary` for its icon and value because "active" is a real status. Pending Grading uses the `status-warning` token (`bg-status-warning`/`text-status-warning-foreground`, from Phase 1's `tailwind.config.js`).
- `Exam.status` (`draft | active | completed | archived`) maps 1:1 onto `StatusBadge`'s `Status` type — pass it straight through, no translation needed.
- All commands below assume `server/` or `client/` as the working directory as stated per command.

---

### Task 1: Backend — `getPendingGradingCount()` + route

**Files:**
- Modify: `server/services/examAttemptService.js`
- Modify: `server/routes/examAttemptRoutes.js`

**Interfaces:**
- Produces: `ExamAttemptService.getPendingGradingCount(): Promise<number>`, and `GET /api/exam-attempts/admin/pending-grading-count` → `{ success: true, count: number }`. Task 2's client function calls this route.

- [ ] **Step 1: Add the service method**

In `server/services/examAttemptService.js`, add this method (place it near `gradeTheoryQuestionsForAttempt`, whose logic it mirrors, aggregated across all attempts instead of one):

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

- [ ] **Step 2: Add the route**

In `server/routes/examAttemptRoutes.js`, add this route directly after the `/admin/recent-activity` route's closing `});`:

```js

router.get('/admin/pending-grading-count', requireUser, async (req, res) => {
  try {
    console.log(`Getting pending grading count for admin: ${req.user.email}`);

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view pending grading count'
      });
    }

    const count = await ExamAttemptService.getPendingGradingCount();

    return res.status(200).json({
      success: true,
      count: count
    });
  } catch (error) {
    console.error(`Error getting pending grading count for admin ${req.user.email}:`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

- [ ] **Step 3: Verify with the running backend**

Restart the backend if it's already running (this is a plain `node server.js` process, no hot-reload): stop it and run `cd server && node server.js`.

Log in as admin and grab a token:
```bash
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@yahoo.com","password":"admin123"}'
```
Copy the `accessToken` from the response, then:
```bash
curl -s http://localhost:3000/api/exam-attempts/admin/pending-grading-count -H "Authorization: Bearer <paste-token-here>"
```
Expected: `{"success":true,"count":<some number, likely 0 in a fresh dev DB>}`

Confirm the 403 path too, by calling it with a student token (log in as `student1@example.com` / `student123` to get one):
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/exam-attempts/admin/pending-grading-count -H "Authorization: Bearer <paste-student-token-here>"
```
Expected: `403`

- [ ] **Step 4: Commit**

```bash
git add server/services/examAttemptService.js server/routes/examAttemptRoutes.js
git commit -m "feat: add pending-grading-count aggregate and route"
```

---

### Task 2: Frontend — `getPendingGradingCount()` API function

**Files:**
- Modify: `client/src/api/examAttempts.ts`

**Interfaces:**
- Consumes: `GET /api/exam-attempts/admin/pending-grading-count` (Task 1).
- Produces: `getPendingGradingCount(): Promise<{ success: boolean, count: number }>` from `@/api/examAttempts`. Task 3 (`AdminDashboard.tsx`) calls this.

- [ ] **Step 1: Add the function**

In `client/src/api/examAttempts.ts`, add this directly after `getAdminRecentActivity`:

```ts

// Description: Get the count of exam attempts pending manual grading
// Endpoint: GET /api/exam-attempts/admin/pending-grading-count
// Request: {}
// Response: { success: boolean, count: number }
export const getPendingGradingCount = async () => {
  try {
    const response = await api.get('/api/exam-attempts/admin/pending-grading-count');
    return response.data;
  } catch (error: any) {
    console.error('Get pending grading count error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
```

- [ ] **Step 2: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep examAttempts` — expect no output (no errors in this file). Note: bare `npx tsc --noEmit` without `-p tsconfig.app.json` is a silent no-op on this project's solution-style `tsconfig.json` — always use the `-p` form.

- [ ] **Step 3: Verify by temporary call**

In `client/src/main.tsx`, temporarily add after the existing imports:
```ts
import { getPendingGradingCount } from './api/examAttempts'
```
and inside nothing needs calling yet since it requires an authenticated request — instead, verify this function end-to-end as part of Task 3's real usage in the dashboard (skip a standalone temporary call here; this function is a thin, obviously-correct wrapper matching `getAdminRecentActivity`'s exact shape).

- [ ] **Step 4: Commit**

```bash
git add client/src/api/examAttempts.ts
git commit -m "feat: add getPendingGradingCount API function"
```

---

### Task 3: Frontend — rewrite `AdminDashboard.tsx`

**Files:**
- Modify: `client/src/pages/admin/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `getPendingGradingCount` (Task 2); `getExams` (pre-existing, returns `{ success, exams: Exam[] }` where `Exam` has `title`, `subject.name`, `status: 'draft'|'active'|'completed'|'archived'`, `createdAt`); `getStudents` (pre-existing); `getAdminRecentActivity` (pre-existing); `getActiveSubjects` (pre-existing, returns `{ success, subjects: Partial<Subject>[] }` where `Subject` has `name`, `code`); `LoadingState` from `@/components/ui/loading-state`; `EmptyState` from `@/components/ui/empty-state`; `StatusBadge` from `@/components/ui/status-badge`.
- Produces: `<AdminDashboard />` — same export/usage, no route changes needed.

- [ ] **Step 1: Replace the file contents**

```tsx

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Users,
  FileText,
  Clock,
  TrendingUp,
  Plus,
  BarChart3,
  AlertCircle,
  ClipboardCheck,
  ClipboardList,
  Bookmark
} from "lucide-react"
import { Link } from "react-router-dom"
import { getExams, type Exam } from "@/api/exams"
import { getStudents } from "@/api/students"
import { getAdminRecentActivity, getPendingGradingCount } from "@/api/examAttempts"
import { getActiveSubjects, type Subject } from "@/api/subjects"
import { useToast } from "@/hooks/useToast"

interface DashboardStats {
  totalExams: number
  activeExams: number
  totalStudents: number
  recentSubmissions: number
  pendingGrading: number
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalExams: 0,
    activeExams: 0,
    totalStudents: 0,
    recentSubmissions: 0,
    pendingGrading: 0
  })
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [recentExams, setRecentExams] = useState<Exam[]>([])
  const [activeSubjects, setActiveSubjects] = useState<Partial<Subject>[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [examsResponse, studentsResponse, recentActivityResponse, pendingGradingResponse, activeSubjectsResponse] = await Promise.all([
          getExams(),
          getStudents(),
          getAdminRecentActivity(),
          getPendingGradingCount(),
          getActiveSubjects()
        ])

        const exams = (examsResponse as any).exams as Exam[]
        const students = (studentsResponse as any).students
        const recentActivityData = (recentActivityResponse as any).recentActivity
        const pendingGrading = (pendingGradingResponse as any).count
        const subjects = (activeSubjectsResponse as any).subjects as Partial<Subject>[]

        const recentSubmissions = recentActivityData?.filter((activity: any) =>
          activity.action === 'Completed' || activity.action === 'Submitted'
        ).length || 0

        setStats({
          totalExams: exams.length,
          activeExams: exams.filter((exam) => exam.status === 'active').length,
          totalStudents: students.length,
          recentSubmissions: recentSubmissions,
          pendingGrading: pendingGrading
        })

        setRecentActivities(recentActivityData || [])
        setRecentExams(
          [...exams]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
        )
        setActiveSubjects(subjects || [])
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

  if (loading) {
    return <LoadingState label="Loading dashboard..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your exams today.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/exams/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Exam
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Exams</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.totalExams}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Exams</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">{stats.activeExams}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.totalStudents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Submissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.recentSubmissions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Grading</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-status-warning-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-status-warning-foreground">{stats.pendingGrading}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest student exam activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivities.length > 0 ? (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity._id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{activity.student}</p>
                      <p className="text-xs text-muted-foreground">{activity.exam}</p>
                      {activity.percentage !== null && (
                        <p className="text-xs text-muted-foreground">Score: {activity.percentage}%</p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant={activity.action === 'Completed' ? 'default' : activity.action === 'Started' ? 'secondary' : 'outline'}>
                        {activity.action}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No recent activity" description="Student exam activity will appear here as it happens." />
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/admin/exams/create">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Plus className="h-4 w-4" />
                Create New Exam
              </Button>
            </Link>
            <Link to="/admin/questions">
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileText className="h-4 w-4" />
                Manage Questions
              </Button>
            </Link>
            <Link to="/admin/students">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Users className="h-4 w-4" />
                View Students
              </Button>
            </Link>
            <Link to="/admin/reports">
              <Button variant="outline" className="w-full justify-start gap-2">
                <BarChart3 className="h-4 w-4" />
                Generate Reports
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Exams */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Recent Exams
            </CardTitle>
            <CardDescription>
              The 5 most recently created exams
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentExams.length > 0 ? (
              <div className="space-y-3">
                {recentExams.map((exam) => (
                  <Link
                    key={exam._id}
                    to={`/admin/exams/${exam._id}/details`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">{exam.subject?.name}</p>
                    </div>
                    <StatusBadge status={exam.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No exams yet" description="Create your first exam to see it listed here." />
            )}
          </CardContent>
        </Card>

        {/* Active Subjects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bookmark className="h-5 w-5" />
              Active Subjects ({activeSubjects.length})
            </CardTitle>
            <CardDescription>
              Subjects currently available for exams
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeSubjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeSubjects.map((subject) => (
                  <Badge key={subject._id} variant="secondary">
                    {subject.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <EmptyState title="No active subjects" description="Activate a subject to see it listed here." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

This drops: all four hardcoded gradient color classes, all fake trend captions, the entire fake "System Status" card, the custom loading spinner (now `LoadingState`), the plain "No recent activities" paragraph (now `EmptyState`), and the `console.log('Fetching dashboard data...')` debug statement.

- [ ] **Step 2: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep AdminDashboard` — expect no output.

- [ ] **Step 3: Full end-to-end verification**

Run both dev servers if not already running (`cd server && node server.js`, `cd client && npm run dev`). In a browser, log in as admin (`admin@yahoo.com` / `admin123`) and land on `/admin`:

1. Confirm all 5 stat tiles render: Total Exams, Active Exams (teal icon+value), Total Students, Recent Submissions, Pending Grading (amber icon+value) — no gradient backgrounds, no fake "+X" captions anywhere.
2. Confirm there is no "System Status" card anywhere on the page.
3. Confirm Recent Activity shows either real activity rows or the `EmptyState` ("No recent activity") — not a bare paragraph.
4. Confirm Recent Exams shows up to 5 exams with correct title/subject/`StatusBadge` matching each exam's real status, each linking to its details page. If there are zero exams in the dev DB, confirm the `EmptyState` ("No exams yet") renders instead.
5. Confirm Active Subjects shows the real subject list with the correct count in the header, or its `EmptyState` if none are active.
6. Toggle dark mode — confirm every new element (stat tiles, both new cards, both `EmptyState`s) stays legible and consistent with the rest of the app.
7. Throttle/observe the initial load — confirm `LoadingState` ("Loading dashboard...") renders briefly instead of the old ad hoc spinner.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/AdminDashboard.tsx
git commit -m "refactor: rebuild AdminDashboard with real data only and new widgets"
```

---

## Plan Self-Review Notes

- **Spec coverage:** backend aggregate + route (Task 1), client API function (Task 2), full dashboard rewrite covering fake-data removal, stat tile redesign, `LoadingState`/`EmptyState` dogfooding, Recent Exams, and Active Subjects (Task 3). Every spec section maps to a task.
- **Placeholder scan:** none — every step has literal code or an exact command.
- **Type consistency:** `getPendingGradingCount()` (Task 2) returns `{ success, count }`, matching its exact usage in Task 3 (`pendingGradingResponse.count`). `Exam`'s `status` field flows straight into `<StatusBadge status={exam.status} />` with no translation, matching the spec's claim that the two unions are identical.
