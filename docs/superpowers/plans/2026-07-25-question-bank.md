# Question Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deduplicate `QuestionManagement.tsx`'s Create/Edit question forms into a shared `QuestionForm` component (closing a real validation-asymmetry bug in the process), and bring `QuestionManagement.tsx`/`Subjects.tsx` up to the `StatusBadge`/`LoadingState`/`EmptyState` conventions established in Phase 1/3a/3b.

**Architecture:** One new shared form component first, then the two page files are rewritten to consume it and adopt the shared UI-state components, in dependency order so every task is independently compilable.

**Tech Stack:** React + TypeScript. No backend changes anywhere in this plan — the `Question`/`Subject` API surfaces already support everything this plan needs.

## Global Constraints

- No frontend or backend test framework exists in this repo; this plan does not introduce one. Every task's verification is manual: `npx tsc --noEmit -p tsconfig.app.json` from `client/`, plus a real browser for anything UI-visible.
- **`QuestionForm`'s submitted payload must stay byte-identical in shape** to both original inline handlers' output (`type`, `question`, `difficulty`, `marks`, `explanation`, `options` (MCQ only), `correctAnswers`) — this is the spec's stated risk, checked by code comparison, not just clicking through the UI.
- **The one intentional behavior change**: `EditQuestionForm` previously had no validation at all; after this plan, editing a question runs the exact same `validateForm` rules as creating one. This is the fix, not a regression.
- **Difficulty/type badges are categorical, not status** — they do NOT become `StatusBadge`. Only `Subjects.tsx`'s Active/Inactive badge (a genuine lifecycle state) becomes `<StatusBadge status={subject.isActive ? 'active' : 'archived'} />`.
- **`getTypeBadge` has two genuinely different label sets today** — the list view uses compact labels ("MCQ", "T/F"), the details dialog uses full labels ("Multiple Choice", "True/False"). These are not true duplicates of each other (only `getDifficultyBadge` is duplicated identically in both places) — dedupe by hoisting both to module scope as two distinctly-named functions, not by merging them into one and losing a label set.
- Every debug `console.log`/`console.error` call is removed from all touched files; user-facing errors surface solely via `toast(...)`.
- All commands below assume `client/` as the working directory unless stated otherwise.

---

### Task 1: Shared `QuestionForm` component

**Files:**
- Create: `client/src/components/admin/QuestionForm.tsx`

**Interfaces:**
- Consumes: `useToast()` from `@/hooks/useToast`; `type Question` from `@/api/questions` (for the `type`/`difficulty` field types only — no API calls happen inside this component).
- Produces: `QuestionForm` component, `QuestionPayload` interface, `QuestionFormInitialValues` interface. Task 2 (`QuestionManagement.tsx`) imports all three.

- [ ] **Step 1: Create the file**

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DialogFooter } from "@/components/ui/dialog"
import type { Question } from "@/api/questions"

export interface QuestionPayload {
  type: Question['type']
  question: string
  difficulty: Question['difficulty']
  marks: number
  explanation: string
  options?: string[]
  correctAnswers: string[]
}

export interface QuestionFormInitialValues {
  type: Question['type']
  question: string
  options?: string[]
  correctAnswers: string[]
  difficulty: Question['difficulty']
  marks: number
  explanation: string
}

interface QuestionFormProps {
  mode: 'create' | 'edit'
  initialValues?: QuestionFormInitialValues
  onSubmit: (payload: QuestionPayload) => Promise<void>
  submitting: boolean
}

function padOptions(source?: string[]): string[] {
  const padded = ['', '', '', '', '', '']
  ;(source || []).forEach((opt, index) => {
    if (index < 6) padded[index] = opt
  })
  return padded
}

export function QuestionForm({ mode, initialValues, onSubmit, submitting }: QuestionFormProps) {
  const [questionType, setQuestionType] = useState<Question['type']>(initialValues?.type || 'multiple-choice')
  const [options, setOptions] = useState<string[]>(() => padOptions(initialValues?.options))
  const [correctAnswers, setCorrectAnswers] = useState<string[]>(initialValues?.correctAnswers || [])
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({})
  const [questionText, setQuestionText] = useState(initialValues?.question || '')
  const [explanationText, setExplanationText] = useState(initialValues?.explanation || '')

  const validateForm = (formData: FormData) => {
    const errors: { [key: string]: string } = {}

    const marks = formData.get('marks') as string

    if (!questionText || questionText.replace(/<[^>]*>/g, '').trim().length < 10) {
      errors.question = 'Question must be at least 10 characters long'
    }

    if (!marks || parseInt(marks) < 1) {
      errors.marks = 'Marks must be at least 1'
    }

    if (questionType === 'multiple-choice') {
      const validOptions = options.filter(opt => opt.trim())
      if (validOptions.length < 4) {
        errors.options = 'Multiple choice questions must have at least 4 options'
      }
      if (validOptions.length > 6) {
        errors.options = 'Multiple choice questions can have at most 6 options'
      }
      if (correctAnswers.length === 0) {
        errors.correctAnswers = 'Please select at least one correct answer'
      }
    }

    if (questionType === 'true-false') {
      const trueFalseAnswer = formData.get('trueFalseAnswer') as string
      if (!trueFalseAnswer) {
        errors.trueFalseAnswer = 'Please select the correct answer'
      }
    }

    if (questionType === 'theory') {
      const theoryAnswer = formData.get('theoryAnswer') as string
      if (!theoryAnswer || theoryAnswer.trim().length === 0) {
        errors.theoryAnswer = 'Please provide a sample answer'
      }
    }

    return errors
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setValidationErrors({})

    const formData = new FormData(e.currentTarget)

    const errors = validateForm(formData)
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    const payload: QuestionPayload = {
      type: questionType,
      question: questionText,
      difficulty: formData.get('difficulty') as Question['difficulty'],
      marks: parseInt(formData.get('marks') as string),
      explanation: explanationText,
      options: questionType === 'multiple-choice' ? options.filter(opt => opt.trim()) : undefined,
      correctAnswers: questionType === 'true-false'
        ? [formData.get('trueFalseAnswer') as string]
        : questionType === 'theory'
        ? [formData.get('theoryAnswer') as string]
        : correctAnswers
    }

    await onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="question">Question *</Label>
        <RichTextEditor
          value={questionText}
          onChange={setQuestionText}
          placeholder="Enter your question here (minimum 10 characters)..."
          height="150px"
          className={validationErrors.question ? "border-red-500" : ""}
        />
        {validationErrors.question && (
          <p className="text-sm text-red-500">{validationErrors.question}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Question Type *</Label>
        <Select value={questionType} onValueChange={(value: any) => setQuestionType(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
            <SelectItem value="true-false">True/False</SelectItem>
            <SelectItem value="theory">Theory</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty *</Label>
          <Select name="difficulty" required defaultValue={initialValues?.difficulty}>
            <SelectTrigger>
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="marks">Marks *</Label>
          <Input
            id="marks"
            name="marks"
            type="number"
            min="1"
            placeholder="5"
            required
            defaultValue={initialValues?.marks}
            className={validationErrors.marks ? "border-red-500" : ""}
          />
          {validationErrors.marks && (
            <p className="text-sm text-red-500">{validationErrors.marks}</p>
          )}
        </div>
      </div>

      {questionType === 'multiple-choice' && (
        <div className="space-y-2">
          <Label>Options * (Minimum 4, Maximum 6)</Label>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder={`Option ${index + 1}${index < 4 ? ' (Required)' : ' (Optional)'}`}
                value={option}
                onChange={(e) => {
                  const newOptions = [...options]
                  newOptions[index] = e.target.value
                  setOptions(newOptions)
                }}
                className={index < 4 ? "border-blue-200" : ""}
              />
              <input
                type="checkbox"
                checked={correctAnswers.includes(option) && option.trim() !== ''}
                onChange={(e) => {
                  if (option.trim() === '') return

                  if (e.target.checked) {
                    setCorrectAnswers([...correctAnswers, option])
                  } else {
                    setCorrectAnswers(correctAnswers.filter(ans => ans !== option))
                  }
                }}
                disabled={option.trim() === ''}
                className="w-4 h-4"
              />
              <Label className="text-xs">Correct</Label>
            </div>
          ))}
          <p className="text-sm text-muted-foreground">
            Fill at least 4 options (first 4 are required). You can add up to 6 options total.
          </p>
          {validationErrors.options && (
            <p className="text-sm text-red-500">{validationErrors.options}</p>
          )}
          {validationErrors.correctAnswers && (
            <p className="text-sm text-red-500">{validationErrors.correctAnswers}</p>
          )}
        </div>
      )}

      {questionType === 'true-false' && (
        <div className="space-y-2">
          <Label htmlFor="trueFalseAnswer">Correct Answer *</Label>
          <Select name="trueFalseAnswer" required defaultValue={initialValues?.correctAnswers?.[0]}>
            <SelectTrigger className={validationErrors.trueFalseAnswer ? "border-red-500" : ""}>
              <SelectValue placeholder="Select correct answer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
          {validationErrors.trueFalseAnswer && (
            <p className="text-sm text-red-500">{validationErrors.trueFalseAnswer}</p>
          )}
        </div>
      )}

      {questionType === 'theory' && (
        <div className="space-y-2">
          <Label htmlFor="theoryAnswer">Sample Answer *</Label>
          <Textarea
            id="theoryAnswer"
            name="theoryAnswer"
            placeholder="Provide a sample answer..."
            required
            rows={2}
            defaultValue={initialValues?.correctAnswers?.[0]}
            className={validationErrors.theoryAnswer ? "border-red-500" : ""}
          />
          {validationErrors.theoryAnswer && (
            <p className="text-sm text-red-500">{validationErrors.theoryAnswer}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="explanation">Explanation (Optional)</Label>
        <RichTextEditor
          value={explanationText}
          onChange={setExplanationText}
          placeholder="Add explanation to help students understand..."
          height="120px"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : mode === 'create' ? "Create Question" : "Update Question"}
        </Button>
      </DialogFooter>
    </form>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "components/admin/QuestionForm"` — expect no output.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/admin/QuestionForm.tsx
git commit -m "feat: extract shared QuestionForm component"
```

---

### Task 2: Rewrite `QuestionManagement.tsx`

**Files:**
- Modify: `client/src/pages/admin/QuestionManagement.tsx`

**Interfaces:**
- Consumes: `QuestionForm`, `QuestionPayload` (Task 1); `LoadingState` from `@/components/ui/loading-state`; `EmptyState` from `@/components/ui/empty-state`; all pre-existing `@/api/questions` functions.
- Produces: `<QuestionManagement />` — same export/usage, no route changes needed.

- [ ] **Step 1: Replace the file contents**

```tsx
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Plus,
  Search,
  Upload,
  Download,
  MoreHorizontal,
  Edit,
  Trash2,
  FileText,
  Eye
} from "lucide-react"
import { getQuestions, createQuestion, deleteQuestion, bulkUploadQuestions, getQuestionById, updateQuestion, type Question } from "@/api/questions"
import { QuestionForm, type QuestionPayload } from "@/components/admin/QuestionForm"
import { useToast } from "@/hooks/useToast"

function getDifficultyBadge(difficulty: string) {
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

function getTypeBadge(type: string) {
  switch (type) {
    case 'multiple-choice':
      return <Badge variant="default">MCQ</Badge>
    case 'true-false':
      return <Badge variant="secondary">T/F</Badge>
    case 'theory':
      return <Badge variant="outline">Theory</Badge>
    default:
      return <Badge variant="secondary">{type}</Badge>
  }
}

function getTypeBadgeVerbose(type: string) {
  switch (type) {
    case 'multiple-choice':
      return <Badge variant="default">Multiple Choice</Badge>
    case 'true-false':
      return <Badge variant="secondary">True/False</Badge>
    case 'theory':
      return <Badge variant="outline">Theory</Badge>
    default:
      return <Badge variant="secondary">{type}</Badge>
  }
}

export function QuestionManagement() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterDifficulty, setFilterDifficulty] = useState("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [creating, setCreating] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 50
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchQuestions()
  }, [searchTerm, filterDifficulty, pagination.currentPage])

  const fetchQuestions = async () => {
    try {
      setLoading(true)
      const response = await getQuestions({
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        difficulty: filterDifficulty !== "all" ? filterDifficulty : undefined,
        search: searchTerm || undefined
      })

      setQuestions(response.questions)
      setPagination(response.pagination)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load questions",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleQuestionClick = async (questionId: string) => {
    try {
      const response = await getQuestionById(questionId)
      setSelectedQuestion(response.question)
      setShowDetailsDialog(true)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load question details",
        variant: "destructive"
      })
    }
  }

  const handleEditClick = async (questionId: string) => {
    try {
      const response = await getQuestionById(questionId)
      setSelectedQuestion(response.question)
      setShowEditDialog(true)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load question for editing",
        variant: "destructive"
      })
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      await deleteQuestion(questionId)
      setQuestions(questions.filter(q => q._id !== questionId))
      toast({
        title: "Success",
        description: "Question deleted successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete question",
        variant: "destructive"
      })
    }
  }

  const handleCreateQuestion = async (payload: QuestionPayload) => {
    setCreating(true)
    try {
      await createQuestion(payload)
      toast({
        title: "Success",
        description: "Question created successfully"
      })
      setShowCreateDialog(false)
      fetchQuestions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create question",
        variant: "destructive"
      })
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateQuestion = async (questionId: string, payload: QuestionPayload) => {
    setUpdating(true)
    try {
      await updateQuestion(questionId, payload)
      toast({
        title: "Success",
        description: "Question updated successfully"
      })
      setShowEditDialog(false)
      setSelectedQuestion(null)
      fetchQuestions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update question",
        variant: "destructive"
      })
    } finally {
      setUpdating(false)
    }
  }

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const response = await bulkUploadQuestions(file)

      toast({
        title: "Upload Complete",
        description: `${response.imported} questions imported successfully`
      })

      fetchQuestions()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload questions",
        variant: "destructive"
      })
    }
  }

  const handleDownloadTemplate = () => {
    try {
      const csvHeaders = [
        'type',
        'question',
        'difficulty',
        'marks',
        'option1',
        'option2',
        'option3',
        'option4',
        'option5',
        'option6',
        'correctAnswer',
        'explanation'
      ]

      const csvContent = [
        csvHeaders.join(','),
        'multiple-choice,"What is 2 + 2?",easy,1,"1","2","3","4","","","4","Basic arithmetic operation"',
        'multiple-choice,"Which are programming languages?",medium,2,"Python","Java","HTML","CSS","JavaScript","TypeScript","1,2,5,6","Programming languages vs markup/styling"',
        'true-false,"The Earth is round",easy,1,"","","","","","","true","Basic geography fact"',
        'theory,"Name the capital of France",easy,2,"","","","","","","Paris","Basic geography knowledge"'
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', 'questions_template.csv')
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

  const handleDownloadJsonTemplate = () => {
    try {
      const jsonTemplate = [
        {
          "tempId": "q-001",
          "type": "multiple-choice",
          "question": "What is 2 + 2?",
          "options": ["1", "2", "3", "4"],
          "correctAnswers": ["4"],
          "explanation": "Basic arithmetic operation",
          "marks": 1,
          "difficulty": "easy"
        },
        {
          "tempId": "q-002",
          "type": "multiple-choice",
          "question": "Which are programming languages? (Select all that apply)",
          "options": ["Python", "Java", "HTML", "CSS", "JavaScript", "TypeScript"],
          "correctAnswers": ["Python", "Java", "JavaScript", "TypeScript"],
          "explanation": "Programming languages vs markup/styling",
          "marks": 2,
          "difficulty": "medium"
        },
        {
          "tempId": "q-003",
          "type": "true-false",
          "question": "The Earth is round",
          "correctAnswers": ["True"],
          "explanation": "Basic geography fact",
          "marks": 1,
          "difficulty": "easy"
        },
        {
          "tempId": "q-004",
          "type": "short-answer",
          "question": "Name the capital of France",
          "correctAnswers": ["Paris"],
          "explanation": "Basic geography knowledge",
          "marks": 2,
          "difficulty": "easy"
        }
      ]

      const blob = new Blob([JSON.stringify(jsonTemplate, null, 2)], { type: 'application/json' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', 'questions_template.json')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Success",
        description: "JSON template downloaded successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download JSON template",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return <LoadingState label="Loading questions..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Question Management</h1>
          <p className="text-muted-foreground">
            Create and manage your question bank ({pagination.totalItems} questions)
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Download className="h-4 w-4" />
                Download Template
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Select Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDownloadTemplate}>
                <FileText className="mr-2 h-4 w-4" />
                CSV Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadJsonTemplate}>
                <FileText className="mr-2 h-4 w-4" />
                JSON Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            type="file"
            accept=".csv,.xlsx,.json"
            onChange={handleBulkUpload}
            className="hidden"
            id="bulk-upload"
          />
          <label htmlFor="bulk-upload">
            <Button variant="outline" className="gap-2" asChild>
              <span>
                <Upload className="h-4 w-4" />
                Bulk Upload (CSV/JSON)
              </span>
            </Button>
          </label>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Question
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Question</DialogTitle>
                <DialogDescription>
                  Add a new question to your question bank
                </DialogDescription>
              </DialogHeader>
              <QuestionForm
                mode="create"
                onSubmit={handleCreateQuestion}
                submitting={creating}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Question Bank</CardTitle>
          <CardDescription>
            Manage your collection of exam questions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
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

          {questions.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questions.map((question) => (
                    <TableRow
                      key={question._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleQuestionClick(question._id)}
                    >
                      <TableCell className="max-w-md">
                        <div className="truncate font-medium" dangerouslySetInnerHTML={{ __html: question.question.replace(/<[^>]*>/g, '') }}>
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(question.type)}</TableCell>
                      <TableCell>{getDifficultyBadge(question.difficulty)}</TableCell>
                      <TableCell>{question.marks}</TableCell>
                      <TableCell>
                        {new Date(question.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              handleQuestionClick(question._id)
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              handleEditClick(question._id)
                            }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Question
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteQuestion(question._id)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Question
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
              title={searchTerm || filterDifficulty !== "all" ? "No questions found" : "No questions created yet"}
              description={searchTerm || filterDifficulty !== "all" ? "No questions match your filters." : "Add your first question to get started."}
              action={!searchTerm && filterDifficulty === "all" ? { label: "Add Question", onClick: () => setShowCreateDialog(true) } : undefined}
            />
          )}

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((pagination.currentPage - 1) * pagination.itemsPerPage) + 1} to {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems} questions
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                  disabled={pagination.currentPage <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                  disabled={pagination.currentPage >= pagination.totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Question Details</DialogTitle>
            <DialogDescription>
              View detailed information about this question
            </DialogDescription>
          </DialogHeader>
          {selectedQuestion && (
            <QuestionDetailsView question={selectedQuestion} />
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Question Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Update the question information
            </DialogDescription>
          </DialogHeader>
          {selectedQuestion && (
            <QuestionForm
              mode="edit"
              initialValues={{
                type: selectedQuestion.type,
                question: selectedQuestion.question,
                options: selectedQuestion.options,
                correctAnswers: selectedQuestion.correctAnswers || [],
                difficulty: selectedQuestion.difficulty,
                marks: selectedQuestion.marks,
                explanation: selectedQuestion.explanation || ''
              }}
              onSubmit={(payload) => handleUpdateQuestion(selectedQuestion._id, payload)}
              submitting={updating}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QuestionDetailsView({ question }: { question: Question }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Type</Label>
          <div className="mt-1">{getTypeBadgeVerbose(question.type)}</div>
        </div>
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Difficulty</Label>
          <div className="mt-1">{getDifficultyBadge(question.difficulty)}</div>
        </div>
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Marks</Label>
          <div className="mt-1">{question.marks}</div>
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium text-muted-foreground">Question</Label>
        <div className="mt-1 p-3 bg-muted rounded-md" dangerouslySetInnerHTML={{ __html: question.question }}>
        </div>
      </div>

      {question.options && question.options.length > 0 && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Options</Label>
          <div className="mt-1 space-y-2">
            {question.options.map((option, index) => (
              <div
                key={index}
                className={`p-2 rounded border ${
                  question.correctAnswers.includes(option)
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                    : 'bg-background border-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{String.fromCharCode(65 + index)}.</span>
                  <span>{option}</span>
                  {question.correctAnswers.includes(option) && (
                    <Badge variant="secondary" className="ml-auto text-xs">Correct</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {question.type === 'true-false' && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Correct Answer</Label>
          <div className="mt-1">
            <Badge variant={question.correctAnswers[0] === 'true' ? 'default' : 'secondary'}>
              {question.correctAnswers[0] === 'true' ? 'True' : 'False'}
            </Badge>
          </div>
        </div>
      )}

      {question.type === 'theory' && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Sample Answer</Label>
          <div className="mt-1 p-3 bg-muted rounded-md">
            {question.correctAnswers[0]}
          </div>
        </div>
      )}

      {question.explanation && (
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Explanation</Label>
          <div className="mt-1 p-3 bg-muted rounded-md" dangerouslySetInnerHTML={{ __html: question.explanation }}>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Created</Label>
          <div className="mt-1">{new Date(question.createdAt).toLocaleString()}</div>
        </div>
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Last Updated</Label>
          <div className="mt-1">{new Date(question.updatedAt).toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep QuestionManagement` — expect no output.

- [ ] **Step 3: Manual verification**

With both dev servers running, log in as admin, go to `/admin/questions`. Confirm: creating a question of each type (MCQ, true/false, theory) still works exactly as before; editing an existing question and clearing its text (or, for an MCQ, removing options below 4) now shows the same red validation errors create does, instead of silently submitting; the details dialog shows verbose type labels ("Multiple Choice") while the list shows compact ones ("MCQ"); bulk-upload template downloads (CSV and JSON) still work; the empty-state and filtered-empty-state render via `EmptyState`; `LoadingState` shows on initial load.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/QuestionManagement.tsx
git commit -m "refactor: QuestionManagement uses shared QuestionForm, fixes edit validation gap, adopts LoadingState/EmptyState"
```

---

### Task 3: `Subjects.tsx` and `SubjectForm.tsx` — StatusBadge, LoadingState, EmptyState, cleanup

**Files:**
- Modify: `client/src/pages/admin/Subjects.tsx`
- Modify: `client/src/components/SubjectForm.tsx`

**Interfaces:**
- Consumes: `StatusBadge` from `@/components/ui/status-badge`; `LoadingState` from `@/components/ui/loading-state`; `EmptyState` from `@/components/ui/empty-state`.
- Produces: `<Subjects />` — same export/usage, no route changes needed.

- [ ] **Step 1: Update `Subjects.tsx`**

Replace the file contents:

```tsx
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status-badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
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
  Plus,
  Search,
  Bookmark,
  MoreHorizontal,
  Edit,
  Trash2,
  BookOpen,
  Eye,
  EyeOff
} from "lucide-react"
import { getSubjects, deleteSubject, type Subject } from "@/api/subjects"
import { useToast } from "@/hooks/useToast"
import { SubjectForm } from "@/components/SubjectForm"

export function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all") // all, active, inactive
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchSubjects()
  }, [])

  const fetchSubjects = async () => {
    try {
      const response = await getSubjects() as any
      setSubjects(response.subjects)
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load subjects",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSuccess = () => {
    setShowCreateDialog(false)
    fetchSubjects()
    toast({
      title: "Success",
      description: "Subject created successfully"
    })
  }

  const handleEditSuccess = () => {
    setShowEditDialog(false)
    setSelectedSubject(null)
    fetchSubjects()
    toast({
      title: "Success",
      description: "Subject updated successfully"
    })
  }

  const handleDelete = async () => {
    if (!selectedSubject) return

    try {
      await deleteSubject(selectedSubject._id)

      setShowDeleteDialog(false)
      setSelectedSubject(null)
      fetchSubjects()

      toast({
        title: "Success",
        description: "Subject deleted successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete subject",
        variant: "destructive"
      })
    }
  }

  const filteredSubjects = subjects.filter(subject => {
    const matchesSearch =
      subject.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subject.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (subject.description && subject.description.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && subject.isActive) ||
      (filterStatus === "inactive" && !subject.isActive)

    return matchesSearch && matchesStatus
  })

  if (loading) {
    return <LoadingState label="Loading subjects..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Subjects</h1>
          <p className="text-muted-foreground">Manage exam subjects and their details</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Subject
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Subject</DialogTitle>
              <DialogDescription>
                Add a new subject for your examinations
              </DialogDescription>
            </DialogHeader>
            <SubjectForm onSuccess={handleCreateSuccess} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Subjects
            </CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subjects.length}</div>
            <p className="text-xs text-muted-foreground">
              All subjects in system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Subjects
            </CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subjects.filter(s => s.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Available for exams
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Inactive Subjects
            </CardTitle>
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {subjects.filter(s => !s.isActive).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Archived subjects
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subject List</CardTitle>
          <CardDescription>
            View and manage all subjects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search subjects..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant={filterStatus === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("all")}
            >
              All
            </Button>
            <Button
              variant={filterStatus === "active" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("active")}
            >
              Active
            </Button>
            <Button
              variant={filterStatus === "inactive" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus("inactive")}
            >
              Inactive
            </Button>
          </div>

          {filteredSubjects.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSubjects.map((subject) => (
                    <TableRow key={subject._id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Bookmark className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{subject.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{subject.code}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="truncate">
                          {subject.description || "No description"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={subject.isActive ? 'active' : 'archived'} />
                      </TableCell>
                      <TableCell>
                        {new Date(subject.createdAt).toLocaleDateString()}
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
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedSubject(subject)
                                setShowEditDialog(true)
                              }}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Subject
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelectedSubject(subject)
                                setShowDeleteDialog(true)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Subject
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
              title={searchTerm || filterStatus !== "all" ? "No subjects found" : "No subjects created yet"}
              description={searchTerm || filterStatus !== "all" ? "No subjects match your search criteria." : "Create your first subject to get started."}
              action={!searchTerm && filterStatus === "all" ? { label: "Add Subject", onClick: () => setShowCreateDialog(true) } : undefined}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Subject Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Subject</DialogTitle>
            <DialogDescription>
              Make changes to the subject details
            </DialogDescription>
          </DialogHeader>
          {selectedSubject && (
            <SubjectForm
              subject={selectedSubject}
              onSuccess={handleEditSuccess}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Subject</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedSubject?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                setSelectedSubject(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Remove debug logging from `SubjectForm.tsx`**

In `client/src/components/SubjectForm.tsx`, delete these two lines (leave everything else — including its existing symmetric create/edit validation — untouched):

```js
      console.log('Updating subject:', subject._id, submitData)
```
and
```js
      console.log('Creating new subject:', submitData)
```
and the `console.error('Error saving subject:', error)` line inside the `catch` block.

- [ ] **Step 3: Verify it compiles**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -E "Subjects.tsx|SubjectForm.tsx"` — expect no output.

- [ ] **Step 4: Manual verification**

Go to `/admin/subjects`. Confirm: `StatusBadge` renders "Active"/"Archived" for every row (no hardcoded green class), create/edit/delete a subject still works, the empty and filtered-empty states render via `EmptyState`, and `LoadingState` shows on initial load.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/Subjects.tsx client/src/components/SubjectForm.tsx
git commit -m "refactor: Subjects adopts StatusBadge/LoadingState/EmptyState, cleanup debug logging"
```

---

### Task 4: Full end-to-end verification

No code changes — this task exercises the whole cluster together after all 3 tasks are merged, live in the browser (`http://127.0.0.1:5173`, never `localhost`).

- [ ] **Step 1: Question lifecycle**

Log in as admin, go to `/admin/questions`. Create one question of each type (MCQ with 4 options, true/false, theory) via the shared `QuestionForm`, confirming validation errors appear for: a question under 10 characters, marks below 1, an MCQ with fewer than 4 filled options, an MCQ with no correct answer checked, a true/false with no answer selected, a theory question with no sample answer. Then edit one of the created questions and confirm the **same** validation errors now appear on edit (e.g. clear the question text and submit — this is the fix this phase makes).

- [ ] **Step 2: Details view label verification**

Open a question's details (row click or "View Details") and confirm the Type badge shows the full label ("Multiple Choice" / "True/False" / "Theory") while the list row for the same question shows the compact label ("MCQ" / "T/F" / "Theory").

- [ ] **Step 3: Bulk upload/download and empty states**

Download both the CSV and JSON templates and confirm they still download correctly. Search for a nonexistent question — confirm `EmptyState` "No questions found". Filter to a difficulty with zero matches — same.

- [ ] **Step 4: Subjects**

Go to `/admin/subjects`. Confirm the `StatusBadge` shows "Active"/"Archived" correctly for existing subjects, create/edit/delete a subject, and confirm the empty/filtered-empty states render via `EmptyState`.

- [ ] **Step 5: Dark mode**

Toggle dark mode and re-check `QuestionManagement` (list, create dialog, edit dialog, details dialog) and `Subjects` (list, create/edit dialogs) — confirm every `StatusBadge`, `LoadingState`, `EmptyState`, and badge stays legible and consistent with the rest of the app.

---

## Plan Self-Review Notes

- **Spec coverage:** shared `QuestionForm` extraction closing the validation gap (Task 1–2), `Subjects.tsx`'s `StatusBadge` adoption (Task 3), `LoadingState`/`EmptyState` adoption in both files (Tasks 2–3), debug-log cleanup in all three touched files including `SubjectForm.tsx` (Tasks 2–3). Every spec section maps to a task.
- **Placeholder scan:** none — every step has literal code or an exact command.
- **Type consistency:** `QuestionPayload` (Task 1) is exactly what `QuestionManagement`'s `handleCreateQuestion`/`handleUpdateQuestion` (Task 2) receive and forward to `createQuestion`/`updateQuestion`. `QuestionFormInitialValues.options` is typed `string[] | undefined` and `QuestionForm` pads it internally via `padOptions()`, matching the exact 6-slot padding the original `EditQuestionForm` did inline — the parent (Task 2) passes `selectedQuestion.options` straight through with no pre-padding, keeping that logic in exactly one place.
