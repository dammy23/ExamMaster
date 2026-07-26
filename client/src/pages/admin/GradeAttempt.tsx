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
