# Exam Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deduplicate `CreateExam.tsx`/`EditExam.tsx` into a shared `ExamForm` component, add a guided exam status lifecycle (Publish/Mark Completed/Archive/Restore to Draft) across `ExamManagement.tsx` and `ExamDetails.tsx`, and bring all 5 exam-cluster pages up to the `StatusBadge`/`LoadingState`/`EmptyState` conventions established in Phase 1 and the Admin Dashboard.

**Architecture:** Two new shared files first (a pure status-transition helper, then the shared form component), then each of the 5 existing pages is rewritten to consume them and adopt the shared UI-state components, in dependency order so every task is independently compilable and testable.

**Tech Stack:** React + TypeScript + `react-hook-form` (frontend only — no backend changes anywhere in this plan). Existing `StatusBadge`/`LoadingState`/`EmptyState` from Phase 1.

## Global Constraints

- No frontend or backend test framework exists in this repo and this plan does not introduce one. Every task's verification is manual: `npx tsc --noEmit -p tsconfig.app.json` from `client/` (never bare `npx tsc --noEmit` — that's a silent no-op against this project's solution-style root `tsconfig.json`), plus a real browser for anything UI-visible.
- **No backend changes anywhere in this plan.** `PUT /api/exams/:id` already accepts and persists any `status` value in its body — `ExamService.update` (`server/services/examService.js:164-169`) spreads `examData` straight into `Exam.findByIdAndUpdate(...)` with `runValidators: true` (Mongoose enum-validates `status` against `draft | active | completed | archived`), and returns the updated exam with `subject` and `createdBy` populated (`.populate('subject', 'name code description')`). Status changes are a pure frontend addition calling the existing `updateExam(id, { status })` client function.
- **Status transition table** (single source of truth — must match exactly everywhere it's referenced):
  - `draft` → `Publish` (→ `active`), `Archive` (→ `archived`)
  - `active` → `Mark Completed` (→ `completed`), `Archive` (→ `archived`)
  - `completed` → `Archive` (→ `archived`)
  - `archived` → `Restore to Draft` (→ `draft`)
- `ExamForm`'s submitted payload must stay byte-identical in shape to each page's pre-refactor `onSubmit` body — this is checked by comparing the coerced-payload code directly against the original two files, not just by clicking through the UI.
- Every debug `console.log`/`console.error` call in all 5 touched files is removed; user-facing errors surface solely via `toast(...)`, matching the cleanup already done in `AdminDashboard.tsx` during Phase 3a.
- All commands below assume `client/` as the working directory unless stated otherwise.

---

### Task 1: Status transition helper

**Files:**
- Create: `client/src/lib/examStatus.ts`

**Interfaces:**
- Produces: `ExamStatusAction { label: string; nextStatus: Exam['status'] }` and `getAvailableStatusActions(current: Exam['status']): ExamStatusAction[]`. Tasks 5 and 6 (`ExamManagement.tsx`, `ExamDetails.tsx`) both import this.

- [ ] **Step 1: Create the file**

```ts
import type { Exam } from "@/api/exams"

export interface ExamStatusAction {
  label: string
  nextStatus: Exam['status']
}

const STATUS_ACTIONS: Record<Exam['status'], ExamStatusAction[]> = {
  draft: [
    { label: 'Publish', nextStatus: 'active' },
    { label: 'Archive', nextStatus: 'archived' }
  ],
  active: [
    { label: 'Mark Completed', nextStatus: 'completed' },
    { label: 'Archive', nextStatus: 'archived' }
  ],
  completed: [
    { label: 'Archive', nextStatus: 'archived' }
  ],
  archived: [
    { label: 'Restore to Draft', nextStatus: 'draft' }
  ]
}

export function getAvailableStatusActions(current: Exam['status']): ExamStatusAction[] {
  return STATUS_ACTIONS[current] || []
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep examStatus` — expect no output.

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/examStatus.ts
git commit -m "feat: add exam status transition helper"
```

---

### Task 2: Shared `ExamForm` component

**Files:**
- Create: `client/src/components/admin/ExamForm.tsx`

**Interfaces:**
- Consumes: `getStudentGroups()` from `@/api/students` (returns `{ success, groups: StudentGroup[] }`); `getActiveSubjects()` from `@/api/subjects` (returns `{ success, subjects: Subject[] }`); `useToast()` from `@/hooks/useToast`.
- Produces: `ExamForm` component, `ExamFormData` interface, `ExamPayload` interface (`ExamFormData` with `questionsPerExam: number | null` instead of `number | undefined`). Tasks 3 and 4 (`CreateExam.tsx`, `EditExam.tsx`) both import all three.

- [ ] **Step 1: Create the file**

```tsx
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Save, Clock, Settings, Users } from "lucide-react"
import { getStudentGroups, type StudentGroup } from "@/api/students"
import { getActiveSubjects, type Subject } from "@/api/subjects"
import { useToast } from "@/hooks/useToast"

export interface ExamFormData {
  title: string
  description: string
  subject: string
  duration: number
  startDate: string
  endDate: string
  totalMarks: number
  passingMarks: number
  instructions: string
  allowReview: boolean
  showResultsImmediately: boolean
  randomizeQuestions: boolean
  randomizeOptions: boolean
  negativeMarking: boolean
  negativeMarkingValue: number
  unlimitedAttempts: boolean
  maxAttempts: number
  questionsPerExam?: number
  useRandomQuestions: boolean
  videoRecording: boolean
  mobileEnabled: boolean
  assignedGroups: string[]
}

export interface ExamPayload extends Omit<ExamFormData, 'questionsPerExam'> {
  questionsPerExam: number | null
}

const CREATE_DEFAULT_VALUES: Partial<ExamFormData> = {
  allowReview: true,
  showResultsImmediately: false,
  randomizeQuestions: true,
  randomizeOptions: true,
  negativeMarking: false,
  negativeMarkingValue: 0.25,
  unlimitedAttempts: false,
  maxAttempts: 1,
  useRandomQuestions: false,
  questionsPerExam: undefined,
  videoRecording: false,
  mobileEnabled: false,
  assignedGroups: []
}

interface ExamFormProps {
  mode: 'create' | 'edit'
  initialValues?: Partial<ExamFormData>
  onSubmit: (payload: ExamPayload) => Promise<void>
  submitting: boolean
}

export function ExamForm({ mode, initialValues, onSubmit, submitting }: ExamFormProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>(initialValues?.assignedGroups || [])
  const [description, setDescription] = useState(initialValues?.description || '')
  const [instructions, setInstructions] = useState(initialValues?.instructions || '')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ExamFormData>({
    defaultValues: mode === 'create' ? CREATE_DEFAULT_VALUES : (initialValues || {})
  })

  useEffect(() => {
    const fetchStudentGroups = async () => {
      try {
        const response = await getStudentGroups()
        setStudentGroups(response.groups)
      } catch (error: any) {
        toast({
          title: "Warning",
          description: "Failed to load student groups",
          variant: "destructive"
        })
      }
    }

    const fetchSubjects = async () => {
      try {
        const response = await getActiveSubjects() as any
        setSubjects(response.subjects)
      } catch (error: any) {
        toast({
          title: "Warning",
          description: "Failed to load subjects",
          variant: "destructive"
        })
      }
    }

    fetchStudentGroups()
    fetchSubjects()
  }, [])

  const negativeMarking = watch("negativeMarking")
  const unlimitedAttempts = watch("unlimitedAttempts")
  const useRandomQuestions = watch("useRandomQuestions")

  const handleFormSubmit = async (data: ExamFormData) => {
    const payload: ExamPayload = {
      ...data,
      description,
      instructions,
      duration: Number(data.duration),
      totalMarks: Number(data.totalMarks),
      passingMarks: Number(data.passingMarks),
      negativeMarkingValue: Number(data.negativeMarkingValue),
      maxAttempts: data.unlimitedAttempts ? 0 : Number(data.maxAttempts),
      questionsPerExam: data.useRandomQuestions && data.questionsPerExam ? Number(data.questionsPerExam) : null,
      assignedGroups: selectedGroups
    }
    await onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              {mode === 'create' ? 'Enter the fundamental details of your exam' : 'Update the fundamental details of your exam'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Exam Title *</Label>
              <Input
                id="title"
                {...register("title", { required: "Title is required" })}
                placeholder="e.g., Mathematics Final Exam"
              />
              {errors.title && (
                <p className="text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Brief description of the exam content and objectives"
                height="120px"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Select value={watch("subject")} onValueChange={(value) => setValue("subject", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((subject) => (
                    <SelectItem key={subject._id} value={subject._id}>
                      {subject.name} ({subject.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subjects.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No active subjects found. Please create subjects first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions for Students</Label>
              <RichTextEditor
                value={instructions}
                onChange={setInstructions}
                placeholder="Enter detailed instructions for students taking this exam"
                height="150px"
              />
            </div>
          </CardContent>
        </Card>

        {/* Timing & Scoring */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Timing & Scoring
            </CardTitle>
            <CardDescription>
              Configure exam duration and marking scheme
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes) *</Label>
              <Input
                id="duration"
                type="number"
                {...register("duration", {
                  required: "Duration is required",
                  min: { value: 1, message: "Duration must be at least 1 minute" }
                })}
                placeholder="120"
              />
              {errors.duration && (
                <p className="text-sm text-red-600">{errors.duration.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date & Time *</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  {...register("startDate", { required: "Start date is required" })}
                />
                {errors.startDate && (
                  <p className="text-sm text-red-600">{errors.startDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">End Date & Time *</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  {...register("endDate", { required: "End date is required" })}
                />
                {errors.endDate && (
                  <p className="text-sm text-red-600">{errors.endDate.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalMarks">Total Marks *</Label>
                <Input
                  id="totalMarks"
                  type="number"
                  {...register("totalMarks", {
                    required: "Total marks is required",
                    min: { value: 1, message: "Must be at least 1" }
                  })}
                  placeholder="100"
                />
                {errors.totalMarks && (
                  <p className="text-sm text-red-600">{errors.totalMarks.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="passingMarks">Passing Marks *</Label>
                <Input
                  id="passingMarks"
                  type="number"
                  {...register("passingMarks", {
                    required: "Passing marks is required",
                    min: { value: 1, message: "Must be at least 1" }
                  })}
                  placeholder="40"
                />
                {errors.passingMarks && (
                  <p className="text-sm text-red-600">{errors.passingMarks.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Groups */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Student Groups Assignment
          </CardTitle>
          <CardDescription>
            Select student groups that will have access to this exam
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assigned Groups</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {studentGroups.map((group) => (
                  <div
                    key={group._id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedGroups.includes(group._id)
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => {
                      if (selectedGroups.includes(group._id)) {
                        setSelectedGroups(selectedGroups.filter(id => id !== group._id))
                      } else {
                        setSelectedGroups([...selectedGroups, group._id])
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{group.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {group.studentCount} students
                        </div>
                      </div>
                      <div
                        className={`w-4 h-4 border rounded ${
                          selectedGroups.includes(group._id)
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground'
                        }`}
                      >
                        {selectedGroups.includes(group._id) && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {studentGroups.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No student groups available</p>
                  <p className="text-sm">Create groups in Student Management first</p>
                </div>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Selected {selectedGroups.length} of {studentGroups.length} groups
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exam Settings */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Exam Settings
          </CardTitle>
          <CardDescription>
            Configure how the exam behaves for students
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Review</Label>
                  <p className="text-sm text-muted-foreground">
                    Students can review answers before submission
                  </p>
                </div>
                <Switch
                  checked={watch("allowReview")}
                  onCheckedChange={(checked) => setValue("allowReview", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Show Results Immediately</Label>
                  <p className="text-sm text-muted-foreground">
                    Display results right after submission
                  </p>
                </div>
                <Switch
                  checked={watch("showResultsImmediately")}
                  onCheckedChange={(checked) => setValue("showResultsImmediately", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Randomize Questions</Label>
                  <p className="text-sm text-muted-foreground">
                    Shuffle question order for each student
                  </p>
                </div>
                <Switch
                  checked={watch("randomizeQuestions")}
                  onCheckedChange={(checked) => setValue("randomizeQuestions", checked)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Randomize Options</Label>
                  <p className="text-sm text-muted-foreground">
                    Shuffle answer options in MCQs
                  </p>
                </div>
                <Switch
                  checked={watch("randomizeOptions")}
                  onCheckedChange={(checked) => setValue("randomizeOptions", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Negative Marking</Label>
                  <p className="text-sm text-muted-foreground">
                    Deduct marks for incorrect answers
                  </p>
                </div>
                <Switch
                  checked={watch("negativeMarking")}
                  onCheckedChange={(checked) => setValue("negativeMarking", checked)}
                />
              </div>

              {negativeMarking && (
                <div className="space-y-2">
                  <Label htmlFor="negativeMarkingValue">Negative Marking Value</Label>
                  <Input
                    id="negativeMarkingValue"
                    type="number"
                    step="0.25"
                    {...register("negativeMarkingValue", {
                      min: { value: 0, message: "Must be 0 or greater" },
                      max: { value: 1, message: "Must be 1 or less" }
                    })}
                    placeholder="0.25"
                  />
                  <p className="text-xs text-muted-foreground">
                    Marks to deduct per incorrect answer
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Unlimited Attempts</Label>
                  <p className="text-sm text-muted-foreground">
                    Students can take this exam unlimited times
                  </p>
                </div>
                <Switch
                  checked={watch("unlimitedAttempts")}
                  onCheckedChange={(checked) => {
                    setValue("unlimitedAttempts", checked)
                    if (checked) {
                      setValue("maxAttempts", 0)
                    } else {
                      setValue("maxAttempts", 1)
                    }
                  }}
                />
              </div>

              {!unlimitedAttempts && (
                <div className="space-y-2">
                  <Label htmlFor="maxAttempts">No. of Allowed Attempts</Label>
                  <Input
                    id="maxAttempts"
                    type="number"
                    {...register("maxAttempts", {
                      required: "Number of attempts is required",
                      min: { value: 1, message: "Must be at least 1 attempt" },
                      max: { value: 10, message: "Cannot exceed 10 attempts" }
                    })}
                    placeholder="1"
                  />
                  {errors.maxAttempts && (
                    <p className="text-sm text-red-600">{errors.maxAttempts.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Maximum number of times a student can attempt this exam
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Random Question Selection</Label>
                  <p className="text-sm text-muted-foreground">
                    Randomly select a subset of questions for each exam attempt
                  </p>
                </div>
                <Switch
                  checked={watch("useRandomQuestions")}
                  onCheckedChange={(checked) => {
                    setValue("useRandomQuestions", checked)
                    if (!checked) {
                      setValue("questionsPerExam", undefined)
                    }
                  }}
                />
              </div>

              {useRandomQuestions && (
                <div className="space-y-2">
                  <Label htmlFor="questionsPerExam">Questions Per Exam Attempt</Label>
                  <Input
                    id="questionsPerExam"
                    type="number"
                    {...register("questionsPerExam", {
                      required: useRandomQuestions ? "Number of questions is required" : false,
                      min: { value: 1, message: "Must be at least 1 question" }
                    })}
                    placeholder="e.g., 20"
                  />
                  {errors.questionsPerExam && (
                    <p className="text-sm text-red-600">{errors.questionsPerExam.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    If you assign 50 questions and set this to 20, each student will get 20 randomly selected questions
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Use Video Security</Label>
                  <p className="text-sm text-muted-foreground">
                    Record student video and audio during exam
                  </p>
                </div>
                <Switch
                  checked={watch("videoRecording")}
                  onCheckedChange={(checked) => setValue("videoRecording", checked)}
                />
              </div>

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

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => navigate("/admin/exams")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="gap-2">
          {submitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Save className="h-4 w-4" />
          )}
          {mode === 'create' ? 'Create Exam' : 'Update Exam'}
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "components/admin/ExamForm"` — expect no output.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/admin/ExamForm.tsx
git commit -m "feat: extract shared ExamForm component"
```

---

### Task 3: Rewrite `CreateExam.tsx` to use `ExamForm`

**Files:**
- Modify: `client/src/pages/admin/CreateExam.tsx`

**Interfaces:**
- Consumes: `ExamForm`, `ExamPayload` (Task 2); `createExam` from `@/api/exams` (pre-existing).
- Produces: `<CreateExam />` — same export/usage, no route changes needed.

- [ ] **Step 1: Replace the file contents**

```tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { ExamForm, type ExamPayload } from "@/components/admin/ExamForm"
import { createExam } from "@/api/exams"
import { useToast } from "@/hooks/useToast"

export function CreateExam() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const estimatePayloadSize = (data: any) => {
    const jsonString = JSON.stringify(data)
    const sizeInBytes = new Blob([jsonString]).size
    const sizeInMB = sizeInBytes / (1024 * 1024)
    return { sizeInBytes, sizeInMB }
  }

  const handleCreate = async (payload: ExamPayload) => {
    setLoading(true)
    try {
      const examData = {
        ...payload,
        status: 'draft' as const,
        totalQuestions: 0,
        assignedStudents: [],
        questions: []
      }

      const { sizeInMB } = estimatePayloadSize(examData)

      if (sizeInMB > 8) {
        const confirmed = confirm(
          `The exam data is quite large (${sizeInMB.toFixed(2)} MB) due to embedded images. ` +
          'This might cause upload issues. Do you want to continue?\n\n' +
          'Tip: Consider reducing image sizes or removing some images to reduce the payload size.'
        )
        if (!confirmed) {
          setLoading(false)
          return
        }
      }

      await createExam(examData)

      toast({
        title: "Success",
        description: "Exam created successfully"
      })

      navigate("/admin/exams")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create exam",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/exams")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create New Exam</h1>
          <p className="text-muted-foreground">
            Set up a new examination with custom settings
          </p>
        </div>
      </div>

      <ExamForm mode="create" onSubmit={handleCreate} submitting={loading} />
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep CreateExam` — expect no output.

- [ ] **Step 3: Manual verification**

With both dev servers running, log in as admin, go to `/admin/exams/create`, fill in the form (title, subject, duration, start/end dates, total/passing marks), submit, and confirm: a success toast appears, you land back on `/admin/exams`, and the new exam appears in the table with `status: draft`.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/CreateExam.tsx
git commit -m "refactor: CreateExam uses shared ExamForm"
```

---

### Task 4: Rewrite `EditExam.tsx` to use `ExamForm`

**Files:**
- Modify: `client/src/pages/admin/EditExam.tsx`

**Interfaces:**
- Consumes: `ExamForm`, `ExamFormData`, `ExamPayload` (Task 2); `getExamById`, `updateExam` from `@/api/exams` (pre-existing); `LoadingState` from `@/components/ui/loading-state`.
- Produces: `<EditExam />` — same export/usage, no route changes needed.

- [ ] **Step 1: Replace the file contents**

```tsx
import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { ArrowLeft } from "lucide-react"
import { ExamForm, type ExamFormData, type ExamPayload } from "@/components/admin/ExamForm"
import { getExamById, updateExam } from "@/api/exams"
import { useToast } from "@/hooks/useToast"

export function EditExam() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetchingExam, setFetchingExam] = useState(true)
  const [initialValues, setInitialValues] = useState<Partial<ExamFormData> | null>(null)

  useEffect(() => {
    if (id) {
      fetchExam()
    }
  }, [id])

  const fetchExam = async () => {
    try {
      const response = await getExamById(id!)
      const exam = response.exam

      const startDate = new Date(exam.startDate).toISOString().slice(0, 16)
      const endDate = new Date(exam.endDate).toISOString().slice(0, 16)

      setInitialValues({
        title: exam.title,
        description: exam.description || '',
        subject: typeof exam.subject === 'string' ? exam.subject : exam.subject._id,
        duration: exam.duration,
        startDate,
        endDate,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        instructions: exam.instructions || '',
        allowReview: exam.allowReview,
        showResultsImmediately: exam.showResultsImmediately,
        randomizeQuestions: exam.randomizeQuestions,
        randomizeOptions: exam.randomizeOptions,
        negativeMarking: exam.negativeMarking,
        negativeMarkingValue: exam.negativeMarkingValue,
        unlimitedAttempts: exam.maxAttempts === 0,
        maxAttempts: exam.maxAttempts === 0 ? 1 : exam.maxAttempts,
        useRandomQuestions: exam.questionsPerExam ? true : false,
        questionsPerExam: exam.questionsPerExam || undefined,
        videoRecording: exam.videoRecording || false,
        mobileEnabled: exam.mobileEnabled || false,
        assignedGroups: exam.assignedGroups || []
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load exam",
        variant: "destructive"
      })
      navigate("/admin/exams")
    } finally {
      setFetchingExam(false)
    }
  }

  const handleUpdate = async (payload: ExamPayload) => {
    setLoading(true)
    try {
      await updateExam(id!, payload)

      toast({
        title: "Success",
        description: "Exam updated successfully"
      })

      navigate("/admin/exams")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update exam",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (fetchingExam) {
    return <LoadingState label="Loading exam..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/exams")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Exam</h1>
          <p className="text-muted-foreground">
            Update examination details and settings
          </p>
        </div>
      </div>

      {initialValues && (
        <ExamForm mode="edit" initialValues={initialValues} onSubmit={handleUpdate} submitting={loading} />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep EditExam` — expect no output.

- [ ] **Step 3: Manual verification**

Go to `/admin/exams`, pick an existing exam's "Edit Exam" action, confirm the form pre-fills every field correctly (including the subject dropdown and any active switches), change the title, submit, and confirm the change persisted (re-open edit, or check the table).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/EditExam.tsx
git commit -m "refactor: EditExam uses shared ExamForm"
```

---

### Task 5: `ExamManagement.tsx` — StatusBadge, LoadingState, EmptyState, status actions

**Files:**
- Modify: `client/src/pages/admin/ExamManagement.tsx`

**Interfaces:**
- Consumes: `getAvailableStatusActions` (Task 1); `updateExam` from `@/api/exams` (pre-existing, already used elsewhere); `StatusBadge`, `LoadingState`, `EmptyState`.
- Produces: `<ExamManagement />` — same export/usage, no route changes needed.

- [ ] **Step 1: Replace the file contents**

```tsx
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status-badge"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Users,
  Clock,
  FileText,
  HelpCircle
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { getExams, updateExam, deleteExam, type Exam } from "@/api/exams"
import { getAvailableStatusActions } from "@/lib/examStatus"
import { useToast } from "@/hooks/useToast"

export function ExamManagement() {
  const navigate = useNavigate()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    fetchExams()
  }, [])

  const fetchExams = async () => {
    try {
      const response = await getExams()
      setExams(response.exams)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load exams",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExam = async (examId: string) => {
    try {
      await deleteExam(examId)
      setExams(exams.filter(exam => exam._id !== examId))
      toast({
        title: "Success",
        description: "Exam deleted successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete exam",
        variant: "destructive"
      })
    }
  }

  const handleStatusChange = async (examId: string, nextStatus: Exam['status']) => {
    try {
      const response = await updateExam(examId, { status: nextStatus })
      setExams(exams.map(exam => exam._id === examId ? response.exam : exam))
      toast({
        title: "Success",
        description: "Exam status updated"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update exam status",
        variant: "destructive"
      })
    }
  }

  const filteredExams = exams.filter(exam => {
    const subjectName = typeof exam.subject === 'string' ? exam.subject : exam.subject.name
    return exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           subjectName.toLowerCase().includes(searchTerm.toLowerCase())
  })

  if (loading) {
    return <LoadingState label="Loading exams..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exam Management</h1>
          <p className="text-muted-foreground">
            Create, manage, and monitor your exams
          </p>
        </div>
        <Link to="/admin/exams/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Exam
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Exams</CardTitle>
          <CardDescription>
            Manage your examination schedule and settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search exams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {filteredExams.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExams.map((exam) => (
                    <TableRow key={exam._id}>
                      <TableCell className="font-medium">{exam.title}</TableCell>
                      <TableCell>
                        {typeof exam.subject === 'string'
                          ? exam.subject
                          : `${exam.subject.name} (${exam.subject.code})`
                        }
                      </TableCell>
                      <TableCell><StatusBadge status={exam.status} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {exam.duration} min
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {exam.totalQuestions}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {exam.assignedStudents.length}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(exam.createdAt).toLocaleDateString()}
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
                            <Link to={`/admin/exams/${exam._id}/details`}>
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                            </Link>
                            <Link to={`/admin/exams/edit/${exam._id}`}>
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Exam
                              </DropdownMenuItem>
                            </Link>
                            <Link to={`/admin/exams/${exam._id}/questions`}>
                              <DropdownMenuItem>
                                <HelpCircle className="mr-2 h-4 w-4" />
                                Questions
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuSeparator />
                            {getAvailableStatusActions(exam.status).map((action) => (
                              <DropdownMenuItem
                                key={action.nextStatus}
                                onSelect={() => handleStatusChange(exam._id, action.nextStatus)}
                              >
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Exam
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the exam
                                    and remove all associated data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteExam(exam._id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
              title={searchTerm ? "No exams found" : "No exams created yet"}
              description={searchTerm ? "No exams match your search." : "Create your first exam to get started."}
              action={!searchTerm ? { label: "Create Your First Exam", onClick: () => navigate("/admin/exams/create") } : undefined}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep ExamManagement` — expect no output.

- [ ] **Step 3: Manual verification**

Go to `/admin/exams`. Confirm: `StatusBadge` renders for every row (no green/blue/gray hardcoded badges), the row dropdown shows the correct status action(s) for that row's status (e.g. a draft exam shows "Publish" and "Archive"), clicking one updates the badge in place with a success toast, and clearing the search box on an empty result set shows the `EmptyState`.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/ExamManagement.tsx
git commit -m "refactor: ExamManagement adopts StatusBadge/LoadingState/EmptyState and status actions"
```

---

### Task 6: `ExamDetails.tsx` — status action surface, LoadingState, EmptyState

**Files:**
- Modify: `client/src/pages/admin/ExamDetails.tsx`

**Interfaces:**
- Consumes: `getAvailableStatusActions` (Task 1); `updateExam` from `@/api/exams` (pre-existing); `StatusBadge`, `LoadingState`, `EmptyState`.
- Produces: `<ExamDetails />` — same export/usage, no route changes needed.

- [ ] **Step 1: Replace the file contents**

```tsx
import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowLeft, Edit, Users, Clock, FileText, Calendar, Settings, Target, ChevronDown } from "lucide-react"
import { getExamById, updateExam, type Exam } from "@/api/exams"
import { getAvailableStatusActions } from "@/lib/examStatus"
import { useToast } from "@/hooks/useToast"

export function ExamDetails() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchExam()
    }
  }, [id])

  const fetchExam = async () => {
    try {
      const response = await getExamById(id!)
      setExam(response.exam)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load exam details",
        variant: "destructive"
      })
      navigate("/admin/exams")
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (nextStatus: Exam['status']) => {
    if (!exam) return
    try {
      const response = await updateExam(exam._id, { status: nextStatus })
      setExam(response.exam)
      toast({
        title: "Success",
        description: "Exam status updated"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update exam status",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return <LoadingState label="Loading exam..." />
  }

  if (!exam) {
    return (
      <EmptyState
        title="Exam not found"
        description="The exam you're looking for doesn't exist or you don't have access to it."
        action={{ label: "Back to Exams", onClick: () => navigate("/admin/exams") }}
      />
    )
  }

  const statusActions = getAvailableStatusActions(exam.status)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/exams")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{exam.title}</h1>
          <p className="text-muted-foreground">
            Detailed examination information and statistics
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/admin/exams/${exam._id}/questions`)}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Manage Questions
          </Button>
          <Button
            onClick={() => navigate(`/admin/exams/edit/${exam._id}`)}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit Exam
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBadge status={exam.status} />
            {statusActions.length === 1 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => handleStatusChange(statusActions[0].nextStatus)}
              >
                {statusActions[0].label}
              </Button>
            )}
            {statusActions.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="w-full gap-1">
                    Change Status
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {statusActions.map((action) => (
                    <DropdownMenuItem
                      key={action.nextStatus}
                      onSelect={() => handleStatusChange(action.nextStatus)}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exam.duration}</div>
            <p className="text-xs text-muted-foreground">minutes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exam.totalQuestions}</div>
            <p className="text-xs text-muted-foreground">questions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exam.assignedStudents.length}</div>
            <p className="text-xs text-muted-foreground">students</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Subject</label>
              <p className="text-sm mt-1">{exam.subject?.name || 'No subject'}</p>
            </div>

            {exam.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <div className="text-sm mt-1" dangerouslySetInnerHTML={{ __html: exam.description }} />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm mt-1">{new Date(exam.createdAt).toLocaleString()}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <p className="text-sm mt-1">{new Date(exam.updatedAt).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Schedule & Timing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule & Timing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Start Date & Time</label>
              <p className="text-sm mt-1">{new Date(exam.startDate).toLocaleString()}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">End Date & Time</label>
              <p className="text-sm mt-1">{new Date(exam.endDate).toLocaleString()}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Duration</label>
              <p className="text-sm mt-1">{exam.duration} minutes</p>
            </div>
          </CardContent>
        </Card>

        {/* Scoring Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Scoring Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Total Marks</label>
                <p className="text-sm mt-1 font-semibold">{exam.totalMarks}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Passing Marks</label>
                <p className="text-sm mt-1 font-semibold">{exam.passingMarks}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Negative Marking</label>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={exam.negativeMarking ? "destructive" : "secondary"}>
                  {exam.negativeMarking ? 'Enabled' : 'Disabled'}
                </Badge>
                {exam.negativeMarking && (
                  <span className="text-sm text-muted-foreground">
                    -{exam.negativeMarkingValue} marks per incorrect answer
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exam Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Exam Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Allow Review</span>
                <Badge variant={exam.allowReview ? "default" : "secondary"}>
                  {exam.allowReview ? 'Yes' : 'No'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Show Results Immediately</span>
                <Badge variant={exam.showResultsImmediately ? "default" : "secondary"}>
                  {exam.showResultsImmediately ? 'Yes' : 'No'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Randomize Questions</span>
                <Badge variant={exam.randomizeQuestions ? "default" : "secondary"}>
                  {exam.randomizeQuestions ? 'Yes' : 'No'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Randomize Options</span>
                <Badge variant={exam.randomizeOptions ? "default" : "secondary"}>
                  {exam.randomizeOptions ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      {exam.instructions && (
        <Card>
          <CardHeader>
            <CardTitle>Instructions for Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: exam.instructions }} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep ExamDetails` — expect no output.

- [ ] **Step 3: Manual verification**

Open a draft exam's details page (`/admin/exams/:id/details`). Confirm the Status card shows the `StatusBadge` plus a "Change Status" dropdown with "Publish" and "Archive". Click "Publish", confirm the badge updates to Active in place and the card now shows a single "Mark Completed"-or-"Archive" surface matching the two-action case, and a single "Archive" button once "Mark Completed" is clicked (one action left). Navigate to a nonexistent exam ID and confirm the `EmptyState` "Exam not found" renders with a working "Back to Exams" button.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/ExamDetails.tsx
git commit -m "refactor: ExamDetails adopts StatusBadge/LoadingState/EmptyState and status action surface"
```

---

### Task 7: `ExamQuestions.tsx` — LoadingState, EmptyState, cleanup

**Files:**
- Modify: `client/src/pages/admin/ExamQuestions.tsx`

**Interfaces:**
- Consumes: `LoadingState`, `EmptyState`.
- Produces: `<ExamQuestions />` — same export/usage, no route changes needed.

- [ ] **Step 1: Replace the file contents**

```tsx
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  Search,
  Plus,
  Check,
  X,
  FileText,
  Clock,
  Users,
  BookOpen
} from "lucide-react"
import { getExamById, updateExam, type Exam } from "@/api/exams"
import { getQuestions, type Question } from "@/api/questions"
import { useToast } from "@/hooks/useToast"

export function ExamQuestions() {
  const { examId } = useParams<{ examId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [exam, setExam] = useState<Exam | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterDifficulty, setFilterDifficulty] = useState("all")

  useEffect(() => {
    if (examId) {
      fetchData()
    }
  }, [examId])

  const fetchData = async () => {
    try {
      const [examResponse, questionsResponse] = await Promise.all([
        getExamById(examId!),
        getQuestions({ limit: 10000 })
      ])

      setExam(examResponse.exam)
      setQuestions(questionsResponse.questions)
      setSelectedQuestions(examResponse.exam.questions || [])
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load exam data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveQuestions = async () => {
    try {
      setSaving(true)

      await updateExam(examId!, {
        questions: selectedQuestions,
        totalQuestions: selectedQuestions.length
      })

      toast({
        title: "Success",
        description: `Exam updated with ${selectedQuestions.length} questions`
      })

      if (exam) {
        setExam({
          ...exam,
          questions: selectedQuestions,
          totalQuestions: selectedQuestions.length
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update exam questions",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const toggleQuestionSelection = (questionId: string) => {
    if (selectedQuestions.includes(questionId)) {
      setSelectedQuestions(selectedQuestions.filter(id => id !== questionId))
    } else {
      setSelectedQuestions([...selectedQuestions, questionId])
    }
  }

  const selectAllFiltered = () => {
    const filteredIds = filteredQuestions.map(q => q._id)
    const newSelected = [...new Set([...selectedQuestions, ...filteredIds])]
    setSelectedQuestions(newSelected)
  }

  const deselectAllFiltered = () => {
    const filteredIds = new Set(filteredQuestions.map(q => q._id))
    setSelectedQuestions(selectedQuestions.filter(id => !filteredIds.has(id)))
  }

  const getDifficultyBadge = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Easy</Badge>
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Medium</Badge>
      case 'hard':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Hard</Badge>
      default:
        return <Badge variant="secondary">{difficulty}</Badge>
    }
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'multiple-choice':
        return <Badge variant="default">MCQ</Badge>
      case 'true-false':
        return <Badge variant="secondary">T/F</Badge>
      case 'short-answer':
        return <Badge variant="outline">Short Answer</Badge>
      default:
        return <Badge variant="secondary">{type}</Badge>
    }
  }

  const filteredQuestions = questions.filter(question => {
    const matchesSearch = question.question.replace(/<[^>]*>/g, '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDifficulty = filterDifficulty === "all" || question.difficulty === filterDifficulty

    return matchesSearch && matchesDifficulty
  })

  const totalMarks = selectedQuestions.reduce((total, questionId) => {
    const question = questions.find(q => q._id === questionId)
    return total + (question?.marks || 0)
  }, 0)

  if (loading) {
    return <LoadingState label="Loading questions..." />
  }

  if (!exam) {
    return (
      <EmptyState
        title="Exam not found"
        description="The exam you're looking for doesn't exist or you don't have access to it."
        action={{ label: "Back to Exams", onClick: () => navigate("/admin/exams") }}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/exams")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Manage Questions</h1>
          <p className="text-muted-foreground">
            Assign questions to "{exam.title}"
          </p>
        </div>
        <Button
          onClick={handleSaveQuestions}
          disabled={saving}
          className="gap-2"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Check className="h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Exam Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Subject
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{exam.subject?.name || 'No Subject'}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exam.duration} min</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selectedQuestions.length}</div>
            <p className="text-xs text-muted-foreground">
              {selectedQuestions.length !== exam.totalQuestions && (
                <span className="text-orange-600">Unsaved changes</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Total Marks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMarks}</div>
            <p className="text-xs text-muted-foreground">
              Target: {exam.totalMarks} marks
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Question Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Available Questions</CardTitle>
          <CardDescription>
            Select questions to include in this exam. Click on questions to add/remove them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllFiltered}
                className="gap-2"
              >
                <Plus className="h-3 w-3" />
                Select All Filtered
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAllFiltered}
                className="gap-2"
              >
                <X className="h-3 w-3" />
                Deselect All Filtered
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              Showing {filteredQuestions.length} questions • {selectedQuestions.length} selected
            </div>
          </div>

          {/* Questions Table */}
          {filteredQuestions.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Select</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuestions.map((question) => (
                    <TableRow
                      key={question._id}
                      className={`cursor-pointer transition-colors ${
                        selectedQuestions.includes(question._id)
                          ? 'bg-primary/5 hover:bg-primary/10'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => toggleQuestionSelection(question._id)}
                    >
                      <TableCell>
                        <div
                          className={`w-4 h-4 border rounded flex items-center justify-center ${
                            selectedQuestions.includes(question._id)
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground'
                          }`}
                        >
                          {selectedQuestions.includes(question._id) && (
                            <Check className="w-3 h-3 text-white" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <div className="truncate font-medium">
                          <div dangerouslySetInnerHTML={{ __html: question.question.replace(/<[^>]*>/g, '') }} />
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(question.type)}</TableCell>
                      <TableCell>{getDifficultyBadge(question.difficulty)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{question.marks}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              title={searchTerm || filterDifficulty !== "all" ? "No questions found" : "No questions available"}
              description={searchTerm || filterDifficulty !== "all" ? "No questions match your filters." : "Create questions in the Question Bank first."}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep ExamQuestions` — expect no output.

- [ ] **Step 3: Manual verification**

Open `/admin/exams/:id/questions` for an exam. Confirm the loading flash shows "Loading questions..." (via `LoadingState`), the difficulty/type badges are unchanged, selecting/deselecting questions and "Save Changes" still works, and filtering to a difficulty with zero matches shows the `EmptyState` "No questions found".

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/ExamQuestions.tsx
git commit -m "refactor: ExamQuestions adopts LoadingState/EmptyState"
```

---

### Task 8: Full end-to-end verification

No code changes — this task exercises the whole cluster together after all 7 tasks are merged, live in the browser (`http://127.0.0.1:5173`, never `localhost` — an unrelated project on this machine binds `[::1]:5173` and shadows it).

- [ ] **Step 1: Full lifecycle walkthrough**

Log in as admin. Create a new exam via `/admin/exams/create` (confirm the shared `ExamForm` behaves identically to before — required-field errors, negative marking value field appearing/disappearing, unlimited attempts hiding the max-attempts field, student group picker). Confirm it lands in `ExamManagement` as `draft`.

From the row's dropdown, click **Publish** — confirm the badge becomes Active. Open the exam's `ExamDetails` page, click **Mark Completed** from the Status card's dropdown — confirm it becomes Completed and the surface now shows a single **Archive** button. Click **Archive** — confirm it becomes Archived and the surface shows a single **Restore to Draft** button. Click it — confirm it's back to Draft.

- [ ] **Step 2: Question assignment**

From `ExamManagement`'s row menu, click **Questions**, select a few questions, **Save Changes**, confirm the "Unsaved changes" indicator clears and the count matches on return to `ExamManagement`.

- [ ] **Step 3: Empty/not-found states**

Search `ExamManagement` for a nonexistent title — confirm `EmptyState` "No exams found". Navigate to `/admin/exams/000000000000000000000000/details` (a well-formed but nonexistent ObjectId) — confirm `EmptyState` "Exam not found" with a working "Back to Exams" link.

- [ ] **Step 4: Dark mode**

Toggle dark mode from the header and re-check `ExamManagement`, `ExamDetails`, `ExamQuestions`, and the `ExamForm` (create and edit) — confirm every `StatusBadge`, `LoadingState`, `EmptyState`, and status action control stays legible and consistent with the rest of the app.

---

## Plan Self-Review Notes

- **Spec coverage:** shared `ExamForm` extraction (Tasks 2–4), status lifecycle helper + both action surfaces (Tasks 1, 5, 6), visual/UX consistency across all 5 files (Tasks 3–7), debug-log cleanup (folded into every task's rewrite). Every spec section maps to a task.
- **Placeholder scan:** none — every step has literal code or an exact command.
- **Type consistency:** `ExamPayload` (Task 2) is exactly what `CreateExam.handleCreate` (Task 3) and `EditExam.handleUpdate` (Task 4) receive and forward to `createExam`/`updateExam`. `getAvailableStatusActions(current: Exam['status']): ExamStatusAction[]` (Task 1) is called identically in Task 5 (`getAvailableStatusActions(exam.status)`) and Task 6 (`getAvailableStatusActions(exam.status)`), and `ExamStatusAction.nextStatus` always matches `Exam['status']`, matching `updateExam`'s expected `{ status }` shape in both call sites.
