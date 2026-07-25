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
