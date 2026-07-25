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
