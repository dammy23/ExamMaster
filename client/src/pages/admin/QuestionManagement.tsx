import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { useToast } from "@/hooks/useToast"

export function QuestionManagement() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterSubject, setFilterSubject] = useState("all")
  const [filterDifficulty, setFilterDifficulty] = useState("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 50
  })
  const { toast } = useToast()

  useEffect(() => {
    fetchQuestions()
  }, [searchTerm, filterSubject, filterDifficulty, pagination.currentPage])

  const fetchQuestions = async () => {
    try {
      console.log('Fetching questions...')
      setLoading(true)
      const response = await getQuestions({
        page: pagination.currentPage,
        limit: pagination.itemsPerPage,
        subject: filterSubject !== "all" ? filterSubject : undefined,
        difficulty: filterDifficulty !== "all" ? filterDifficulty : undefined,
        search: searchTerm || undefined
      })

      setQuestions(response.questions)
      setPagination(response.pagination)
    } catch (error: any) {
      console.error('Error fetching questions:', error)
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
      console.log('Fetching question details for ID:', questionId)
      const response = await getQuestionById(questionId)
      setSelectedQuestion(response.question)
      setShowDetailsDialog(true)
    } catch (error: any) {
      console.error('Error fetching question details:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load question details",
        variant: "destructive"
      })
    }
  }

  const handleEditClick = async (questionId: string) => {
    try {
      console.log('Fetching question for editing, ID:', questionId)
      const response = await getQuestionById(questionId)
      setSelectedQuestion(response.question)
      setShowEditDialog(true)
    } catch (error: any) {
      console.error('Error fetching question for editing:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load question for editing",
        variant: "destructive"
      })
    }
  }

  const handleDeleteQuestion = async (questionId: string) => {
    try {
      console.log('Deleting question:', questionId)
      await deleteQuestion(questionId)
      setQuestions(questions.filter(q => q._id !== questionId))
      toast({
        title: "Success",
        description: "Question deleted successfully"
      })
    } catch (error: any) {
      console.error('Error deleting question:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete question",
        variant: "destructive"
      })
    }
  }

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      console.log('Uploading questions file:', file.name)
      const response = await bulkUploadQuestions(file)

      toast({
        title: "Upload Complete",
        description: `${response.imported} questions imported successfully`
      })

      if (response.errors && response.errors.length > 0) {
        console.warn('Upload errors:', response.errors)
      }

      fetchQuestions()
    } catch (error: any) {
      console.error('Error uploading questions:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to upload questions",
        variant: "destructive"
      })
    }
  }

  const handleDownloadTemplate = () => {
    try {
      console.log('Downloading questions CSV template...')
      
      // Create CSV content
      const csvHeaders = [
        'type',
        'question', 
        'subject',
        'difficulty',
        'marks',
        'options',
        'correctAnswers',
        'explanation'
      ]
      
      const csvContent = [
        csvHeaders.join(','),
        // Add sample row with example data
        'multiple-choice,"What is 2 + 2?",mathematics,easy,1,"A) 1|B) 2|C) 3|D) 4","D) 4","Basic arithmetic operation"',
        'true-false,"The Earth is round",physics,easy,1,"","true","Basic geography fact"',
        'short-answer,"Name the capital of France",geography,easy,2,"","Paris","Basic geography knowledge"'
      ].join('\n')

      // Create and download file
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
      console.error('Error downloading template:', error)
      toast({
        title: "Error", 
        description: "Failed to download CSV template",
        variant: "destructive"
      })
    }
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
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
          <Button 
            variant="outline" 
            className="gap-2"
            onClick={() => handleDownloadTemplate()}
          >
            <Download className="h-4 w-4" />
            Download Template
          </Button>
          <input
            type="file"
            accept=".csv,.xlsx"
            onChange={handleBulkUpload}
            className="hidden"
            id="bulk-upload"
          />
          <label htmlFor="bulk-upload">
            <Button variant="outline" className="gap-2" asChild>
              <span>
                <Upload className="h-4 w-4" />
                Bulk Upload
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
              <CreateQuestionForm
                onSuccess={() => {
                  setShowCreateDialog(false)
                  fetchQuestions()
                }}
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
            <Select value={filterSubject} onValueChange={setFilterSubject}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Subject" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                <SelectItem value="mathematics">Mathematics</SelectItem>
                <SelectItem value="physics">Physics</SelectItem>
                <SelectItem value="chemistry">Chemistry</SelectItem>
                <SelectItem value="biology">Biology</SelectItem>
              </SelectContent>
            </Select>
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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Marks</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.length > 0 ? (
                  questions.map((question) => (
                    <TableRow
                      key={question._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleQuestionClick(question._id)}
                    >
                      <TableCell className="max-w-md">
                        <div className="truncate font-medium">
                          {question.question}
                        </div>
                      </TableCell>
                      <TableCell>{getTypeBadge(question.type)}</TableCell>
                      <TableCell className="capitalize">{question.subject}</TableCell>
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="text-muted-foreground">
                        {searchTerm || filterSubject !== "all" || filterDifficulty !== "all"
                          ? "No questions found matching your filters."
                          : "No questions created yet."}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

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
            <EditQuestionForm
              question={selectedQuestion}
              onSuccess={() => {
                setShowEditDialog(false)
                setSelectedQuestion(null)
                fetchQuestions()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QuestionDetailsView({ question }: { question: Question }) {
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
        return <Badge variant="default">Multiple Choice</Badge>
      case 'true-false':
        return <Badge variant="secondary">True/False</Badge>
      case 'short-answer':
        return <Badge variant="outline">Short Answer</Badge>
      default:
        return <Badge variant="secondary">{type}</Badge>
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Type</Label>
          <div className="mt-1">{getTypeBadge(question.type)}</div>
        </div>
        <div>
          <Label className="text-sm font-medium text-muted-foreground">Subject</Label>
          <div className="mt-1 capitalize">{question.subject}</div>
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
        <div className="mt-1 p-3 bg-muted rounded-md">
          {question.question}
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

      {question.type === 'short-answer' && (
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
          <div className="mt-1 p-3 bg-muted rounded-md">
            {question.explanation}
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

function CreateQuestionForm({ onSuccess }: { onSuccess: () => void }) {
  const [questionType, setQuestionType] = useState<'multiple-choice' | 'true-false' | 'short-answer'>('multiple-choice')
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctAnswers, setCorrectAnswers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})
  const { toast } = useToast()

  const validateForm = (formData: FormData) => {
    const errors: {[key: string]: string} = {}

    const questionText = formData.get('question') as string
    const marks = formData.get('marks') as string

    if (!questionText || questionText.trim().length < 10) {
      errors.question = 'Question must be at least 10 characters long'
    }

    if (!marks || parseInt(marks) < 1) {
      errors.marks = 'Marks must be at least 1'
    }

    if (questionType === 'multiple-choice') {
      const validOptions = options.filter(opt => opt.trim())
      if (validOptions.length < 2) {
        errors.options = 'Multiple choice questions must have at least 2 options'
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

    if (questionType === 'short-answer') {
      const shortAnswer = formData.get('shortAnswer') as string
      if (!shortAnswer || shortAnswer.trim().length === 0) {
        errors.shortAnswer = 'Please provide a sample answer'
      }
    }

    return errors
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setValidationErrors({})

    const formData = new FormData(e.currentTarget)

    const errors = validateForm(formData)
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      setLoading(false)
      return
    }

    const questionData = {
      type: questionType,
      question: formData.get('question') as string,
      subject: formData.get('subject') as string,
      difficulty: formData.get('difficulty') as 'easy' | 'medium' | 'hard',
      marks: parseInt(formData.get('marks') as string),
      explanation: formData.get('explanation') as string,
      options: questionType === 'multiple-choice' ? options.filter(opt => opt.trim()) : undefined,
      correctAnswers: questionType === 'true-false'
        ? [formData.get('trueFalseAnswer') as string]
        : questionType === 'short-answer'
        ? [formData.get('shortAnswer') as string]
        : correctAnswers
    }

    try {
      console.log('Creating question:', questionData)
      await createQuestion(questionData)
      toast({
        title: "Success",
        description: "Question created successfully"
      })
      onSuccess()
    } catch (error: any) {
      console.error('Error creating question:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to create question",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="question">Question *</Label>
        <Textarea
          id="question"
          name="question"
          placeholder="Enter your question here (minimum 10 characters)..."
          required
          rows={3}
          className={validationErrors.question ? "border-red-500" : ""}
        />
        {validationErrors.question && (
          <p className="text-sm text-red-500">{validationErrors.question}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Question Type *</Label>
          <Select value={questionType} onValueChange={(value: any) => setQuestionType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
              <SelectItem value="true-false">True/False</SelectItem>
              <SelectItem value="short-answer">Short Answer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject *</Label>
          <Select name="subject" required>
            <SelectTrigger>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mathematics">Mathematics</SelectItem>
              <SelectItem value="physics">Physics</SelectItem>
              <SelectItem value="chemistry">Chemistry</SelectItem>
              <SelectItem value="biology">Biology</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty *</Label>
          <Select name="difficulty" required>
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
            className={validationErrors.marks ? "border-red-500" : ""}
          />
          {validationErrors.marks && (
            <p className="text-sm text-red-500">{validationErrors.marks}</p>
          )}
        </div>
      </div>

      {questionType === 'multiple-choice' && (
        <div className="space-y-2">
          <Label>Options *</Label>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder={`Option ${index + 1}`}
                value={option}
                onChange={(e) => {
                  const newOptions = [...options]
                  newOptions[index] = e.target.value
                  setOptions(newOptions)
                }}
              />
              <input
                type="checkbox"
                checked={correctAnswers.includes(option)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setCorrectAnswers([...correctAnswers, option])
                  } else {
                    setCorrectAnswers(correctAnswers.filter(ans => ans !== option))
                  }
                }}
                className="w-4 h-4"
              />
              <Label className="text-xs">Correct</Label>
            </div>
          ))}
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
          <Select name="trueFalseAnswer" required>
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

      {questionType === 'short-answer' && (
        <div className="space-y-2">
          <Label htmlFor="shortAnswer">Sample Answer *</Label>
          <Textarea
            id="shortAnswer"
            name="shortAnswer"
            placeholder="Provide a sample answer..."
            required
            rows={2}
            className={validationErrors.shortAnswer ? "border-red-500" : ""}
          />
          {validationErrors.shortAnswer && (
            <p className="text-sm text-red-500">{validationErrors.shortAnswer}</p>
          )}
        </div>
      )}

<div className="space-y-2">
        <Label htmlFor="explanation">Explanation (Optional)</Label>
        <Textarea
          id="explanation"
          name="explanation"
          placeholder="Add explanation to help students understand..."
          rows={3}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Create Question"}
        </Button>
      </DialogFooter>
    </form>
  )
}

function EditQuestionForm({ question, onSuccess }: { question: Question, onSuccess: () => void }) {
  const [questionType, setQuestionType] = useState(question.type)
  const [options, setOptions] = useState(question.options || ['', '', '', ''])
  const [correctAnswers, setCorrectAnswers] = useState<string[]>(question.correctAnswers || [])
  const [loading, setLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setValidationErrors({})

    const formData = new FormData(e.currentTarget)

    const updatedQuestion = {
      type: questionType,
      question: formData.get('question') as string,
      subject: formData.get('subject') as string,
      difficulty: formData.get('difficulty') as 'easy' | 'medium' | 'hard',
      marks: parseInt(formData.get('marks') as string),
      explanation: formData.get('explanation') as string,
      options: questionType === 'multiple-choice' ? options.filter(opt => opt.trim()) : undefined,
      correctAnswers: questionType === 'true-false'
        ? [formData.get('trueFalseAnswer') as string]
        : questionType === 'short-answer'
        ? [formData.get('shortAnswer') as string]
        : correctAnswers
    }

    try {
      console.log('Updating question:', updatedQuestion)
      await updateQuestion(question._id, updatedQuestion)
      toast({
        title: "Success",
        description: "Question updated successfully"
      })
      onSuccess()
    } catch (error: any) {
      console.error('Error updating question:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to update question",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="question">Question *</Label>
        <Textarea
          id="question"
          name="question"
          defaultValue={question.question}
          required
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Question Type *</Label>
          <Select value={questionType} onValueChange={(value: any) => setQuestionType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
              <SelectItem value="true-false">True/False</SelectItem>
              <SelectItem value="short-answer">Short Answer</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject *</Label>
          <Select name="subject" defaultValue={question.subject}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mathematics">Mathematics</SelectItem>
              <SelectItem value="physics">Physics</SelectItem>
              <SelectItem value="chemistry">Chemistry</SelectItem>
              <SelectItem value="biology">Biology</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty *</Label>
          <Select name="difficulty" defaultValue={question.difficulty}>
            <SelectTrigger>
              <SelectValue />
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
            defaultValue={question.marks}
          />
        </div>
      </div>

      {questionType === 'multiple-choice' && (
        <div className="space-y-2">
          <Label>Options *</Label>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                value={option}
                onChange={(e) => {
                  const newOptions = [...options]
                  newOptions[index] = e.target.value
                  setOptions(newOptions)
                }}
              />
              <input
                type="checkbox"
                checked={correctAnswers.includes(option)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setCorrectAnswers([...correctAnswers, option])
                  } else {
                    setCorrectAnswers(correctAnswers.filter(ans => ans !== option))
                  }
                }}
                className="w-4 h-4"
              />
              <Label className="text-xs">Correct</Label>
            </div>
          ))}
        </div>
      )}

      {questionType === 'true-false' && (
        <div className="space-y-2">
          <Label htmlFor="trueFalseAnswer">Correct Answer *</Label>
          <Select name="trueFalseAnswer" defaultValue={question.correctAnswers[0]}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {questionType === 'short-answer' && (
        <div className="space-y-2">
          <Label htmlFor="shortAnswer">Sample Answer *</Label>
          <Textarea
            id="shortAnswer"
            name="shortAnswer"
            defaultValue={question.correctAnswers[0]}
            rows={2}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="explanation">Explanation (Optional)</Label>
        <Textarea
          id="explanation"
          name="explanation"
          defaultValue={question.explanation}
          rows={3}
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Update Question"}
        </Button>
      </DialogFooter>
    </form>
  )
}
