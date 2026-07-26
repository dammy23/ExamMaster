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
