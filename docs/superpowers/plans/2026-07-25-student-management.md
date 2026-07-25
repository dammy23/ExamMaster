# Student Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `StudentManagement.tsx` up to the established `StatusBadge`/`LoadingState`/`EmptyState` conventions, replace the non-functional "Remove Student"/"View Performance" menu items with a real Deactivate/Reactivate action, make the fully-built but completely unreachable `StudentVideoReview.tsx` page reachable, and close Phase 3a's deferred "reviewed" tracking concept end-to-end (backend field → service → route → UI → Dashboard tile).

**Architecture:** Backend additions land first and are curl-verified in isolation, then the client API wrapper, then each frontend file in dependency order (routing before the entry point that links to it, before the page rewrite that becomes testable once reachable), ending with the Dashboard tile that depends on everything else existing.

**Tech Stack:** Express + Mongoose (backend), React + TypeScript (frontend), existing `StatusBadge`/`LoadingState`/`EmptyState` from Phase 1.

## Global Constraints

- No frontend or backend test framework exists in this repo; this plan does not introduce one. Every task's verification is manual: `curl` for the backend, `npx tsc --noEmit -p tsconfig.app.json` from `client/` (never bare `npx tsc --noEmit`), and a real browser for anything UI-visible.
- **This is the first backend change since Phase 3a** (Phases 3b/3c were frontend-only) — purely additive: a new sub-schema field, a new service method pair, two new routes, following the exact `requireUser` + inline `role !== 'admin'` → 403 pattern already used throughout `examAttemptRoutes.js`.
- **Pending-video-review definition** (single source of truth, referenced by both the count aggregate and the per-row badge): `videoRecording.enabled === true`, `videoRecording.recordingStatus === 'completed'`, `videoRecording.reviewed` is not `true`.
- **Deactivate/Reactivate replaces the dead "Remove Student"** — calls the pre-existing `updateStudent(id, { status })`, no backend change. **"View Performance" is deleted outright**, no replacement.
- `StatusBadge`'s existing `pending-review` value (already amber/`status-warning`) is reused for the video-review badge — no changes to `client/src/components/ui/status-badge.tsx` needed.
- Every debug `console.log`/`console.error` call is removed from every touched file; user-facing errors surface solely via `toast(...)`.
- All commands below assume `client/` or `server/` as the working directory as stated per command.

---

### Task 1: Backend — `reviewed` field, service methods, routes

**Files:**
- Modify: `server/models/ExamAttempt.js`
- Modify: `server/services/examAttemptService.js`
- Modify: `server/routes/examAttemptRoutes.js`

**Interfaces:**
- Produces: `ExamAttempt.videoRecording.reviewed: boolean` (default `false`) and `.reviewedAt: Date`; `ExamAttemptService.markVideoReviewed(attemptId, adminId): Promise<ExamAttempt>`; `ExamAttemptService.getPendingVideoReviewsCount(): Promise<number>`; `POST /api/exam-attempts/mark-reviewed/:attemptId` → `{ success: true, attempt }`; `GET /api/exam-attempts/admin/pending-video-reviews-count` → `{ success: true, count }`. Task 2's client functions call these two routes.

- [ ] **Step 1: Add the schema fields**

In `server/models/ExamAttempt.js`, inside the existing `videoRecording` sub-schema, add two fields directly after `fileSize`:

```js
    fileSize: {
      type: Number, // in bytes
      min: 0
    },
    reviewed: {
      type: Boolean,
      default: false
    },
    reviewedAt: {
      type: Date
    }
```

- [ ] **Step 2: Add the service methods**

In `server/services/examAttemptService.js`, add these two methods (place them near `getAttemptForReview`, whose ownership-check logic `markVideoReviewed` mirrors, and near `getPendingGradingCount`, whose aggregate shape `getPendingVideoReviewsCount` mirrors):

```js
  static async markVideoReviewed(attemptId, adminId) {
    try {
      console.log('ExamAttemptService: Marking video review complete for attempt:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId).populate('examId', 'createdBy');
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      if (attempt.examId.createdBy.toString() !== adminId.toString()) {
        throw new Error('You are not authorized to review this exam attempt');
      }

      attempt.videoRecording.reviewed = true;
      attempt.videoRecording.reviewedAt = new Date();
      await attempt.save();

      console.log('ExamAttemptService: Video review marked complete');
      return attempt;
    } catch (error) {
      console.error('ExamAttemptService: Error marking video review complete:', error.message);
      throw error;
    }
  }

  static async getPendingVideoReviewsCount() {
    try {
      console.log('ExamAttemptService: Counting attempts pending video review...');
      const count = await ExamAttempt.countDocuments({
        'videoRecording.enabled': true,
        'videoRecording.recordingStatus': 'completed',
        'videoRecording.reviewed': { $ne: true }
      });
      console.log(`ExamAttemptService: ${count} attempts pending video review`);
      return count;
    } catch (error) {
      console.error('ExamAttemptService: Error counting pending video reviews:', error.message);
      throw error;
    }
  }
```

- [ ] **Step 3: Add the routes**

In `server/routes/examAttemptRoutes.js`, add this route directly after the existing `/admin/attempt/:attemptId` route's closing `});`:

```js

router.post('/mark-reviewed/:attemptId', requireUser, async (req, res) => {
  try {
    const { attemptId } = req.params;
    console.log(`Marking video review complete for attempt: ${attemptId} by user: ${req.user.email}`);

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can mark video reviews as complete'
      });
    }

    const attempt = await ExamAttemptService.markVideoReviewed(attemptId, req.user._id);

    console.log(`Video review marked complete for attempt: ${attemptId}`);
    return res.status(200).json({
      success: true,
      attempt: attempt
    });
  } catch (error) {
    console.error(`Error marking video review complete for attempt ${req.params.attemptId}:`, error.message);

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
```

And add this route directly after the existing `/admin/pending-grading-count` route's closing `});`:

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
```

- [ ] **Step 4: Verify with the running backend**

Restart the backend (`cd server && node server.js`). Log in as admin and grab a token:
```bash
curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@yahoo.com","password":"admin123"}'
```
Copy `accessToken`, then:
```bash
curl -s http://localhost:3000/api/exam-attempts/admin/pending-video-reviews-count -H "Authorization: Bearer <paste-token-here>"
```
Expected: `{"success":true,"count":<some number, likely 0 in a fresh dev DB>}`

Confirm the 403 path with a student token (`student1@example.com` / `student123`):
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/exam-attempts/admin/pending-video-reviews-count -H "Authorization: Bearer <paste-student-token-here>"
```
Expected: `403`

- [ ] **Step 5: Commit**

```bash
git add server/models/ExamAttempt.js server/services/examAttemptService.js server/routes/examAttemptRoutes.js
git commit -m "feat: add video-review tracking (reviewed field, service methods, routes)"
```

---

### Task 2: Frontend — client API functions

**Files:**
- Modify: `client/src/api/examAttempts.ts`

**Interfaces:**
- Consumes: `POST /api/exam-attempts/mark-reviewed/:attemptId`, `GET /api/exam-attempts/admin/pending-video-reviews-count` (Task 1).
- Produces: `markAttemptReviewed(attemptId): Promise<{ success: boolean, attempt: ExamAttempt }>`, `getPendingVideoReviewsCount(): Promise<{ success: boolean, count: number }>` from `@/api/examAttempts`. Tasks 6 and 7 call these.

- [ ] **Step 1: Add `reviewed`/`reviewedAt` to the `ExamAttempt` interface**

In `client/src/api/examAttempts.ts`, in the existing `videoRecording` field of the `ExamAttempt` interface, add two fields directly after `fileSize`:

```ts
  videoRecording: {
    enabled: boolean;
    videoUrl?: string;
    recordingStartTime?: string;
    recordingEndTime?: string;
    recordingStatus: 'not_started' | 'recording' | 'completed' | 'failed';
    fileSize?: number;
    reviewed?: boolean;
    reviewedAt?: string;
  };
```

- [ ] **Step 2: Add the two functions**

Add directly after `getPendingGradingCount`:

```ts

// Description: Mark an exam attempt's video recording as reviewed
// Endpoint: POST /api/exam-attempts/mark-reviewed/:attemptId
// Request: {}
// Response: { success: boolean, attempt: ExamAttempt }
export const markAttemptReviewed = async (attemptId: string) => {
  try {
    const response = await api.post(`/api/exam-attempts/mark-reviewed/${attemptId}`);
    return response.data;
  } catch (error: any) {
    console.error('Mark attempt reviewed error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get the count of exam attempts pending video review
// Endpoint: GET /api/exam-attempts/admin/pending-video-reviews-count
// Request: {}
// Response: { success: boolean, count: number }
export const getPendingVideoReviewsCount = async () => {
  try {
    const response = await api.get('/api/exam-attempts/admin/pending-video-reviews-count');
    return response.data;
  } catch (error: any) {
    console.error('Get pending video reviews count error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
```

- [ ] **Step 3: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep examAttempts` — expect no output.

- [ ] **Step 4: Commit**

```bash
git add client/src/api/examAttempts.ts
git commit -m "feat: add markAttemptReviewed and getPendingVideoReviewsCount API functions"
```

---

### Task 3: `StudentManagement.tsx` — consistency, Deactivate/Reactivate, remove View Performance

**Files:**
- Modify: `client/src/pages/admin/StudentManagement.tsx`

**Interfaces:**
- Consumes: `StatusBadge`, `LoadingState`, `EmptyState`; pre-existing `updateStudent` from `@/api/students`.
- Produces: `<StudentManagement />` — same export/usage, no route changes needed.

- [ ] **Step 1: Replace the file contents**

```tsx
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/ui/status-badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Users,
  MoreHorizontal,
  Edit,
  UserPlus,
  UserX,
  UserCheck,
  GraduationCap,
  Upload,
  Download
} from "lucide-react"
import { getStudents, getStudentGroups, createStudentGroup, createStudent, updateStudent, bulkUploadStudents, type Student, type StudentGroup } from "@/api/students"
import { useToast } from "@/hooks/useToast"

export function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([])
  const [groups, setGroups] = useState<StudentGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterGroup, setFilterGroup] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false)
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false)
  const [showEditStudentDialog, setShowEditStudentDialog] = useState(false)
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [studentsResponse, groupsResponse] = await Promise.all([
        getStudents(),
        getStudentGroups()
      ])

      setStudents((studentsResponse as any).students)
      setGroups((groupsResponse as any).groups)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load student data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadStudentTemplate = () => {
    try {
      const csvHeaders = [
        'name',
        'email',
        'password',
        'studentId',
        'group'
      ]

      const csvContent = [
        csvHeaders.join(','),
        'John Doe,john.doe@example.com,password123,STU001,2025/2026',
        'Jane Smith,jane.smith@example.com,password456,STU002,2025/2026',
        'Bob Johnson,bob.johnson@example.com,password789,STU003,2024/2025'
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', 'students_template.csv')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Success",
        description: "CSV template downloaded successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download CSV template",
        variant: "destructive"
      })
    }
  }

  const getPerformanceBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-600">Excellent</Badge>
    if (score >= 80) return <Badge className="bg-blue-500">Good</Badge>
    if (score >= 70) return <Badge className="bg-yellow-500">Average</Badge>
    return <Badge className="bg-red-500">Needs Improvement</Badge>
  }

  const handleEditStudent = (student: Student) => {
    setSelectedStudent(student)
    setShowEditStudentDialog(true)
  }

  const handleEditStudentSubmit = async (formData: {
    name: string;
    email: string;
    studentId: string;
    group: string;
    status: 'active' | 'inactive';
  }) => {
    if (!selectedStudent) return

    try {
      await updateStudent(selectedStudent._id, formData)

      setShowEditStudentDialog(false)
      setSelectedStudent(null)
      fetchData()

      toast({
        title: "Success",
        description: "Student updated successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update student",
        variant: "destructive"
      })
    }
  }

  const handleToggleStudentStatus = async (student: Student) => {
    const nextStatus = student.status === 'active' ? 'inactive' : 'active'
    try {
      await updateStudent(student._id, { status: nextStatus })
      setStudents(students.map(s => s._id === student._id ? { ...s, status: nextStatus } : s))
      toast({
        title: "Success",
        description: `Student ${nextStatus === 'active' ? 'reactivated' : 'deactivated'} successfully`
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update student status",
        variant: "destructive"
      })
    }
  }

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (student.studentId && student.studentId.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesGroup = filterGroup === "all" || student.group === filterGroup
    const matchesStatus = filterStatus === "all" || student.status === filterStatus

    return matchesSearch && matchesGroup && matchesStatus
  })

  if (loading) {
    return <LoadingState label="Loading students..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Management</h1>
          <p className="text-muted-foreground">
            Manage students and organize them into groups
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => handleDownloadStudentTemplate()}
          >
            <Download className="h-4 w-4" />
            Download Template
          </Button>
          <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Bulk Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Upload Students</DialogTitle>
                <DialogDescription>
                  Upload a CSV file with student information
                </DialogDescription>
              </DialogHeader>
              <BulkUploadForm
                onSuccess={() => {
                  setShowBulkUploadDialog(false)
                  fetchData()
                }}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Users className="h-4 w-4" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Student Group</DialogTitle>
                <DialogDescription>
                  Create a new group to organize students
                </DialogDescription>
              </DialogHeader>
              <CreateGroupForm
                onSuccess={() => {
                  setShowCreateGroupDialog(false)
                  fetchData()
                }}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={showAddStudentDialog} onOpenChange={setShowAddStudentDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
                <DialogDescription>
                  Create a new student account
                </DialogDescription>
              </DialogHeader>
              <AddStudentForm
                groups={groups}
                onSuccess={() => {
                  setShowAddStudentDialog(false)
                  fetchData()
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Groups Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {groups.map((group) => (
          <Card key={group._id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {group.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold mb-1">
                {group.studentCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Students enrolled
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            All Students
          </CardTitle>
          <CardDescription>
            Manage student accounts and track their performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group._id} value={group.name}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredStudents.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Exams Taken</TableHead>
                    <TableHead>Average Score</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{student.name}</div>
                          <div className="text-sm text-muted-foreground">{student.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{student.studentId || 'N/A'}</TableCell>
                      <TableCell>{student.group || 'Not assigned'}</TableCell>
                      <TableCell><StatusBadge status={student.status === 'active' ? 'active' : 'archived'} /></TableCell>
                      <TableCell>{(student as any).totalExamsAttempted || 0}</TableCell>
                      <TableCell>
                        {(student as any).averageScore ? `${((student as any).averageScore).toFixed(1)}%` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {(student as any).averageScore ? getPerformanceBadge((student as any).averageScore) :
                         <Badge variant="secondary">No data</Badge>}
                      </TableCell>
                      <TableCell>
                        {student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleEditStudent(student)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Student
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleStudentStatus(student)}>
                              {student.status === 'active' ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Reactivate
                                </>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              title={searchTerm || filterGroup !== "all" || filterStatus !== "all" ? "No students found" : "No students enrolled yet"}
              description={searchTerm || filterGroup !== "all" || filterStatus !== "all" ? "No students match your filters." : "Add your first student to get started."}
              action={!searchTerm && filterGroup === "all" && filterStatus === "all" ? { label: "Add Student", onClick: () => setShowAddStudentDialog(true) } : undefined}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Student Dialog */}
      <Dialog open={showEditStudentDialog} onOpenChange={setShowEditStudentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student information
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <EditStudentForm
              student={selectedStudent}
              groups={groups}
              onSuccess={handleEditStudentSubmit}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EditStudentForm({
  student,
  groups,
  onSuccess
}: {
  student: Student;
  groups: StudentGroup[];
  onSuccess: (data: {
    name: string;
    email: string;
    studentId: string;
    group: string;
    status: 'active' | 'inactive';
  }) => void;
}) {
  const [loading, setLoading] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(student.group || 'none')
  const [selectedStatus, setSelectedStatus] = useState(student.status)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const studentId = formData.get('studentId') as string
    const group = selectedGroup === 'none' ? '' : selectedGroup
    const status = selectedStatus

    if (!name || !email) {
      toast({
        title: "Error",
        description: "Name and email are required",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      await onSuccess({
        name,
        email,
        studentId,
        group,
        status
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update student",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-name">Full Name *</Label>
        <Input
          id="edit-name"
          name="name"
          defaultValue={student.name}
          placeholder="Enter full name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-email">Email *</Label>
        <Input
          id="edit-email"
          name="email"
          type="email"
          defaultValue={student.email}
          placeholder="Enter email address"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-studentId">Student ID</Label>
        <Input
          id="edit-studentId"
          name="studentId"
          defaultValue={student.studentId || ''}
          placeholder="Enter student ID"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-group">Group</Label>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger>
            <SelectValue placeholder="Select group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Group</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group._id} value={group.name}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-status">Status</Label>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            "Update Student"
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

function CreateGroupForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const groupData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string
    }

    try {
      await createStudentGroup(groupData)
      toast({
        title: "Success",
        description: "Student group created successfully"
      })
      onSuccess()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create student group",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Group Name *</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g., Computer Science A"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          placeholder="Brief description of the group"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            "Create Group"
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

function AddStudentForm({ groups, onSuccess }: { groups: StudentGroup[]; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string>("none")
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const studentData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      studentId: formData.get('studentId') as string || undefined,
      group: selectedGroup === "none" ? undefined : selectedGroup || undefined
    }

    try {
      await createStudent(studentData)
      toast({
        title: "Success",
        description: "Student created successfully"
      })
      onSuccess()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create student",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            name="name"
            placeholder="e.g., John Doe"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="john.doe@example.com"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Enter a secure password"
          required
          minLength={6}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="studentId">Student ID</Label>
        <Input
          id="studentId"
          name="studentId"
          placeholder="e.g., STU001"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="group">Group</Label>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger>
            <SelectValue placeholder="Select a group (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No group</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group._id} value={group.name}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            "Create Student"
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

function BulkUploadForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Error",
          description: "Please select a CSV file",
          variant: "destructive"
        })
        return
      }
      setFile(selectedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const result = await bulkUploadStudents(file)

      toast({
        title: "Success",
        description: `Imported ${result.imported} students successfully${result.errors && result.errors.length > 0 ? ` with ${result.errors.length} errors` : ''}`
      })

      onSuccess()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload students",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">CSV File *</Label>
        <Input
          id="file"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          required
        />
        <p className="text-sm text-muted-foreground">
          Upload a CSV file with columns: name, email, password, studentId, group
        </p>
      </div>

      {file && (
        <div className="p-2 bg-muted rounded">
          <p className="text-sm">Selected file: {file.name}</p>
          <p className="text-xs text-muted-foreground">Size: {Math.round(file.size / 1024)} KB</p>
        </div>
      )}

      <DialogFooter>
        <Button type="submit" disabled={loading || !file}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            "Upload Students"
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep StudentManagement` — expect no output.

- [ ] **Step 3: Manual verification**

Go to `/admin/students`. Confirm: Groups Overview cards are flat (no blue gradient), `StatusBadge` shows Active/Archived per student, the row menu shows Edit Student + Deactivate (or Reactivate for an inactive student, or already-inactive test data) with no "View Performance"/"Remove Student" anywhere, clicking Deactivate/Reactivate flips the badge in place with a toast, empty/filtered-empty states render via `EmptyState`, `LoadingState` shows on initial load.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/StudentManagement.tsx
git commit -m "refactor: StudentManagement adopts StatusBadge/LoadingState/EmptyState, Deactivate replaces Remove Student"
```

---

### Task 4: Routing — register `StudentVideoReview`

**Files:**
- Modify: `client/src/App.tsx`

**Interfaces:**
- Consumes: `StudentVideoReview` from `./pages/admin/StudentVideoReview` (pre-existing component, already reads `examId` and optional `attemptId` via `useParams`).
- Produces: routes `admin/exams/:examId/video-review` and `admin/exams/:examId/video-review/:attemptId`, both rendering `<StudentVideoReview />`. Task 5's new "Video Review" link navigates to the first of these.

- [ ] **Step 1: Add the import**

In `client/src/App.tsx`, add directly after the existing `ExamQuestions` import:

```tsx
import { StudentVideoReview } from "./pages/admin/StudentVideoReview"
```

- [ ] **Step 2: Add the routes**

Directly after the existing `admin/exams/:examId/questions` route, add:

```tsx
            <Route path="admin/exams/:examId/video-review" element={<StudentVideoReview />} />
            <Route path="admin/exams/:examId/video-review/:attemptId" element={<StudentVideoReview />} />
```

- [ ] **Step 3: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep App.tsx` — expect no output.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat: register StudentVideoReview routes"
```

---

### Task 5: `ExamManagement.tsx` — add "Video Review" entry point

**Files:**
- Modify: `client/src/pages/admin/ExamManagement.tsx`

**Interfaces:**
- Consumes: the routes registered in Task 4.
- Produces: a reachable "Video Review" action in the row dropdown.

- [ ] **Step 1: Add the `Video` icon import**

In the existing `lucide-react` import block, add `Video` to the list (alongside `Eye`, `Users`, `Clock`, etc.).

- [ ] **Step 2: Add the dropdown item**

Directly after the existing "Questions" `Link`/`DropdownMenuItem` pair (and before the `<DropdownMenuSeparator />` that precedes the status actions), add:

```tsx
                            <Link to={`/admin/exams/${exam._id}/video-review`}>
                              <DropdownMenuItem>
                                <Video className="mr-2 h-4 w-4" />
                                Video Review
                              </DropdownMenuItem>
                            </Link>
```

- [ ] **Step 3: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep ExamManagement` — expect no output.

- [ ] **Step 4: Manual verification**

Go to `/admin/exams`, open a row's menu, confirm "Video Review" appears between "Questions" and the status actions, and clicking it navigates to the (still default-styled, until Task 6) `StudentVideoReview` page without a 404 or blank screen.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/ExamManagement.tsx
git commit -m "feat: add Video Review entry point to ExamManagement row menu"
```

---

### Task 6: `StudentVideoReview.tsx` — consistency + Mark as Reviewed

**Files:**
- Modify: `client/src/pages/admin/StudentVideoReview.tsx`

**Interfaces:**
- Consumes: `markAttemptReviewed`, `getPendingVideoReviewsCount` is NOT used here (only in Task 7) — this file only needs `markAttemptReviewed` (Task 2); `StatusBadge`, `LoadingState`, `EmptyState`.
- Produces: `<StudentVideoReview />` — same export/usage, no route changes needed (already registered in Task 4).

- [ ] **Step 1: Add the new imports**

Add directly after the existing imports:

```tsx
import { StatusBadge } from "@/components/ui/status-badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { markAttemptReviewed } from "@/api/examAttempts"
```

- [ ] **Step 2: Extend the local `ExamAttemptReview` interface**

Change the `videoRecording` field from:
```ts
  videoRecording?: {
    enabled: boolean
    videoUrl?: string
    recordingStartTime?: string
    recordingEndTime?: string
    recordingStatus: string
    fileSize?: number
  }
```
to:
```ts
  videoRecording?: {
    enabled: boolean
    videoUrl?: string
    recordingStartTime?: string
    recordingEndTime?: string
    recordingStatus: string
    fileSize?: number
    reviewed?: boolean
    reviewedAt?: string
  }
```

- [ ] **Step 3: Add reviewed-state helpers and the mark-reviewed handler**

Inside the `StudentVideoReview` component, add a new state variable directly after `videoLoading`:

```tsx
  const [markingReviewed, setMarkingReviewed] = useState(false)
```

Add a helper function and handler directly after `getVideoStatusBadge`:

```tsx
  const isPendingReview = (attempt: ExamAttemptReview) =>
    !!attempt.videoRecording?.enabled &&
    attempt.videoRecording.recordingStatus === 'completed' &&
    !attempt.videoRecording.reviewed

  const handleMarkReviewed = async () => {
    if (!selectedAttempt) return
    setMarkingReviewed(true)
    try {
      const response = await markAttemptReviewed(selectedAttempt._id)
      const updatedVideoRecording = response.attempt.videoRecording

      setSelectedAttempt({
        ...selectedAttempt,
        videoRecording: updatedVideoRecording
      })
      setAttempts(attempts.map(a =>
        a._id === selectedAttempt._id
          ? { ...a, videoRecording: updatedVideoRecording }
          : a
      ))

      toast({
        title: "Success",
        description: "Marked as reviewed"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to mark as reviewed",
        variant: "destructive"
      })
    } finally {
      setMarkingReviewed(false)
    }
  }
```

- [ ] **Step 4: Remove debug logging**

Delete every `console.log`/`console.error` call in `fetchExamAndAttempts` and `fetchSpecificAttempt` (keep the `toast` calls in their `catch` blocks — only the console statements go).

- [ ] **Step 5: Replace the loading and not-found states**

Replace:
```tsx
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold mb-2">Exam not found</h2>
        <Button onClick={() => navigate('/admin/exams')}>
          Return to Exams
        </Button>
      </div>
    )
  }
```
with:
```tsx
  if (loading) {
    return <LoadingState label="Loading video review..." />
  }

  if (!exam) {
    return (
      <EmptyState
        title="Exam not found"
        description="The exam you're looking for doesn't exist or you don't have access to it."
        action={{ label: "Return to Exams", onClick: () => navigate('/admin/exams') }}
      />
    )
  }
```

- [ ] **Step 6: Add the Mark as Reviewed UI to the Video Recording tab**

Replace the `CardHeader` inside the `TabsContent value="video"` block:
```tsx
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      Video Recording
                    </div>
                    {selectedAttempt.videoRecording?.enabled && (
                      getVideoStatusBadge(selectedAttempt.videoRecording.recordingStatus)
                    )}
                  </CardTitle>
                </CardHeader>
```
with:
```tsx
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      Video Recording
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedAttempt.videoRecording?.enabled && (
                        getVideoStatusBadge(selectedAttempt.videoRecording.recordingStatus)
                      )}
                      {selectedAttempt.videoRecording?.enabled && selectedAttempt.videoRecording.recordingStatus === 'completed' && (
                        selectedAttempt.videoRecording.reviewed ? (
                          <Badge className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Reviewed
                            {selectedAttempt.videoRecording.reviewedAt && ` ${formatDateTime(selectedAttempt.videoRecording.reviewedAt)}`}
                          </Badge>
                        ) : (
                          <Button size="sm" onClick={handleMarkReviewed} disabled={markingReviewed}>
                            {markingReviewed ? "Marking..." : "Mark as Reviewed"}
                          </Button>
                        )
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
```

- [ ] **Step 7: Add the pending-review badge to the attempts list**

In the attempts list row (inside the `attempts.map((attempt) => ...)` block), directly after:
```tsx
                        {attempt.videoRecording?.enabled && (
                          getVideoStatusBadge(attempt.videoRecording.recordingStatus)
                        )}
```
add:
```tsx
                        {isPendingReview(attempt) && <StatusBadge status="pending-review" />}
```

- [ ] **Step 8: Replace the "no attempts" empty state**

Replace:
```tsx
            {attempts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No exam attempts found</p>
                <p className="text-sm">Students haven't started this exam yet</p>
              </div>
            ) : (
```
with:
```tsx
            {attempts.length === 0 ? (
              <EmptyState title="No exam attempts found" description="Students haven't started this exam yet." />
            ) : (
```

- [ ] **Step 9: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep StudentVideoReview` — expect no output.

- [ ] **Step 10: Manual verification**

Navigate to `/admin/exams/:examId/video-review` for an exam with attempts. Confirm `LoadingState`/`EmptyState` render correctly, any eligible-but-unreviewed attempt shows the amber `pending-review` badge in the list, opening an attempt with a completed video recording shows a "Mark as Reviewed" button, clicking it replaces the button with a "Reviewed" badge (with timestamp) and clears the list badge without a page reload.

- [ ] **Step 11: Commit**

```bash
git add client/src/pages/admin/StudentVideoReview.tsx
git commit -m "refactor: StudentVideoReview adopts LoadingState/EmptyState, adds Mark as Reviewed"
```

---

### Task 7: `AdminDashboard.tsx` — 6th stat tile

**Files:**
- Modify: `client/src/pages/admin/AdminDashboard.tsx`

**Interfaces:**
- Consumes: `getPendingVideoReviewsCount` (Task 2).
- Produces: `<AdminDashboard />` — same export/usage, no route changes needed.

- [ ] **Step 1: Add the import**

Add `Video` to the existing `lucide-react` import list, and add `getPendingVideoReviewsCount` to the existing `@/api/examAttempts` import:

```tsx
import { getAdminRecentActivity, getPendingGradingCount, getPendingVideoReviewsCount } from "@/api/examAttempts"
```

- [ ] **Step 2: Extend `DashboardStats`**

```ts
interface DashboardStats {
  totalExams: number
  activeExams: number
  totalStudents: number
  recentSubmissions: number
  pendingGrading: number
  pendingVideoReviews: number
}
```

- [ ] **Step 3: Extend the initial state**

```tsx
  const [stats, setStats] = useState<DashboardStats>({
    totalExams: 0,
    activeExams: 0,
    totalStudents: 0,
    recentSubmissions: 0,
    pendingGrading: 0,
    pendingVideoReviews: 0
  })
```

- [ ] **Step 4: Extend the fetch**

Replace:
```tsx
        const [examsResponse, studentsResponse, recentActivityResponse, pendingGradingResponse, activeSubjectsResponse] = await Promise.all([
          getExams(),
          getStudents(),
          getAdminRecentActivity(),
          getPendingGradingCount(),
          getActiveSubjects()
        ])
```
with:
```tsx
        const [examsResponse, studentsResponse, recentActivityResponse, pendingGradingResponse, pendingVideoReviewsResponse, activeSubjectsResponse] = await Promise.all([
          getExams(),
          getStudents(),
          getAdminRecentActivity(),
          getPendingGradingCount(),
          getPendingVideoReviewsCount(),
          getActiveSubjects()
        ])
```

Replace:
```tsx
        const pendingGrading = (pendingGradingResponse as any).count
```
with:
```tsx
        const pendingGrading = (pendingGradingResponse as any).count
        const pendingVideoReviews = (pendingVideoReviewsResponse as any).count
```

Replace:
```tsx
        setStats({
          totalExams: exams.length,
          activeExams: exams.filter((exam) => exam.status === 'active').length,
          totalStudents: students.length,
          recentSubmissions: recentSubmissions,
          pendingGrading: pendingGrading
        })
```
with:
```tsx
        setStats({
          totalExams: exams.length,
          activeExams: exams.filter((exam) => exam.status === 'active').length,
          totalStudents: students.length,
          recentSubmissions: recentSubmissions,
          pendingGrading: pendingGrading,
          pendingVideoReviews: pendingVideoReviews
        })
```

- [ ] **Step 5: Update the grid and add the 6th tile**

Replace:
```tsx
      {/* Stat Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
```
with:
```tsx
      {/* Stat Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
```

Add directly after the existing "Pending Grading" `Card` (before the closing `</div>` of the stat-tiles grid):

```tsx

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Video Reviews</CardTitle>
            <Video className="h-4 w-4 text-status-warning-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-status-warning-foreground">{stats.pendingVideoReviews}</div>
          </CardContent>
        </Card>
```

- [ ] **Step 6: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep AdminDashboard` — expect no output.

- [ ] **Step 7: Manual verification**

Go to `/admin`. Confirm all 6 stat tiles render (3×2 at typical laptop width, single row at wide-monitor width), "Pending Video Reviews" uses the same amber styling as "Pending Grading", and the count matches whatever real data exists (0 if none).

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/admin/AdminDashboard.tsx
git commit -m "feat: add Pending Video Reviews stat tile to AdminDashboard"
```

---

### Task 8: Full end-to-end verification

No code changes — this task exercises the whole cluster together after all 7 tasks are merged, live in the browser (`http://127.0.0.1:5173`, never `localhost`).

- [ ] **Step 1: Student lifecycle**

Log in as admin, go to `/admin/students`. Add a student, deactivate them from the row menu (confirm the badge flips to Archived and a toast appears), reactivate them (confirm it flips back). Confirm "View Performance" and "Remove Student" no longer appear anywhere.

- [ ] **Step 2: Video review reachability and reviewed tracking**

If the dev database has no exam attempt with `videoRecording.enabled: true` and `recordingStatus: 'completed'`, seed one directly via MongoDB (update an existing completed attempt's `videoRecording` fields) so this step is meaningful. From `/admin/exams`, open a row's menu, click "Video Review", confirm it lands on the attempts list (not a 404). Confirm an eligible attempt shows the amber "Pending Review" badge. Open it, click "Mark as Reviewed", confirm the button becomes a "Reviewed" badge with a timestamp, go back to the list and confirm the amber badge is gone.

- [ ] **Step 3: Dashboard tile**

Go to `/admin`. Confirm the "Pending Video Reviews" tile reflects the real count (it should have decremented by one after Step 2's mark-as-reviewed action, if it was counted before).

- [ ] **Step 4: Dark mode**

Toggle dark mode and re-check `/admin/students`, `/admin/exams/:examId/video-review` (both list and detail view), and `/admin` — confirm every `StatusBadge`, `LoadingState`, `EmptyState`, and the new stat tile stay legible and consistent with the rest of the app.

---

## Plan Self-Review Notes

- **Spec coverage:** visual/UX consistency for both files (Tasks 3, 6), Deactivate/Reactivate + View Performance removal (Task 3), video-review routing + entry point (Tasks 4, 5), full reviewed-tracking stack — schema, service, routes, client API, UI badge/button, Dashboard tile (Tasks 1, 2, 6, 7). Every spec section maps to a task.
- **Placeholder scan:** none — every step has literal code or an exact command.
- **Type consistency:** `markAttemptReviewed`'s response shape (`{ success, attempt }`, Task 2) matches exactly how Task 6 destructures `response.attempt.videoRecording`. `getPendingVideoReviewsCount`'s `{ success, count }` (Task 2) matches Task 7's `(pendingVideoReviewsResponse as any).count`. The `pending-review` value passed to `StatusBadge` in Task 6 is already a member of the pre-existing `Status` union — no `StatusBadge` changes needed anywhere in this plan.
