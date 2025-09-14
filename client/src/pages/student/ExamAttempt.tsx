import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
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
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  Send,
  AlertTriangle,
  CheckCircle
} from "lucide-react"
import {
  startExamAttempt,
  saveExamAnswer,
  submitExamAttempt,
  logExamActivity,
  type ExamQuestion
} from "@/api/examAttempts"
import { getExamById } from "@/api/exams"
import { useToast } from "@/hooks/useToast"

export function ExamAttempt() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [exam, setExam] = useState<any>(null)
  const [questions, setQuestions] = useState<ExamQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<{ [questionId: string]: string | string[] }>({})
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set())
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [attemptId, setAttemptId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [tabSwitchCount, setTabSwitchCount] = useState(0)

  useEffect(() => {
    if (id) {
      initializeExam()
    }
  }, [id])

  useEffect(() => {
    // Enable fullscreen
    const enterFullScreen = () => {
      document.documentElement.requestFullscreen?.()
      setIsFullScreen(true)
    }

    enterFullScreen()

    // Handle visibility change (tab switching detection)
    const handleVisibilityChange = () => {
      if (document.hidden && attemptId) {
        setTabSwitchCount(prev => prev + 1)
        logExamActivity(attemptId, 'tab_switch')
        toast({
          title: "Warning",
          description: "Tab switching detected. This activity is being logged.",
          variant: "destructive"
        })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [attemptId, toast])

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleAutoSubmit()
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [timeRemaining])

  const initializeExam = async () => {
    try {
      console.log('Initializing exam:', id)
      const [examResponse, attemptResponse] = await Promise.all([
        getExamById(id!),
        startExamAttempt(id!)
      ])

      const examData = (examResponse as any).exam
      const attemptData = (attemptResponse as any)

      setExam(examData)
      setQuestions(attemptData.questions)
      setAttemptId(attemptData.attemptId)
      setTimeRemaining(examData.duration * 60) // Convert minutes to seconds
    } catch (error) {
      console.error('Error initializing exam:', error)
      toast({
        title: "Error",
        description: "Failed to start exam",
        variant: "destructive"
      })
      navigate('/student')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerChange = async (questionId: string, answer: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))

    try {
      await saveExamAnswer(attemptId, questionId, answer)
    } catch (error) {
      console.error('Error saving answer:', error)
    }
  }

  const handleFlagQuestion = (questionId: string) => {
    setFlaggedQuestions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(questionId)) {
        newSet.delete(questionId)
      } else {
        newSet.add(questionId)
      }
      return newSet
    })
  }

  const handleAutoSubmit = async () => {
    try {
      console.log('Auto-submitting exam due to time expiry')
      await submitExamAttempt(attemptId)
      toast({
        title: "Time's Up!",
        description: "Your exam has been automatically submitted.",
      })
      navigate('/student/results')
    } catch (error) {
      console.error('Error auto-submitting exam:', error)
    }
  }

  const handleManualSubmit = async () => {
    try {
      console.log('Manually submitting exam')
      const response = await submitExamAttempt(attemptId)
      const result = response as any

      toast({
        title: "Exam Submitted",
        description: `Your score: ${result.score}/${exam.totalMarks} (${result.percentage}%)`,
      })
      navigate('/student/results')
    } catch (error) {
      console.error('Error submitting exam:', error)
      toast({
        title: "Error",
        description: "Failed to submit exam",
        variant: "destructive"
      })
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const getTimeColor = () => {
    const percentage = (timeRemaining / (exam?.duration * 60)) * 100
    if (percentage <= 10) return "text-red-600"
    if (percentage <= 25) return "text-orange-600"
    return "text-green-600"
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100
  const answeredCount = Object.keys(answers).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!exam || !currentQuestion) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Exam not found</h2>
          <Button onClick={() => navigate('/student')}>Return to Dashboard</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-background/95 backdrop-blur border-b z-50 p-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <div>
            <h1 className="text-xl font-bold">{exam.title}</h1>
            <p className="text-sm text-muted-foreground">{exam.subject}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${getTimeColor()}`}>
              <Clock className="h-4 w-4" />
              <span className="font-mono text-lg font-bold">
                {formatTime(timeRemaining)}
              </span>
            </div>

            {tabSwitchCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {tabSwitchCount} warnings
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="pt-20 max-w-6xl mx-auto">
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Question Navigation */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-sm">Question Navigation</CardTitle>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {answeredCount} of {questions.length} answered
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((question, index) => {
                  const isAnswered = answers[question._id]
                  const isFlagged = flaggedQuestions.has(question._id)
                  const isCurrent = index === currentQuestionIndex

                  return (
                    <Button
                      key={question._id}
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      className={`relative h-8 w-8 p-0 ${
                        isAnswered ? "bg-green-100 border-green-300" : ""
                      } ${isFlagged ? "bg-yellow-100 border-yellow-300" : ""}`}
                      onClick={() => setCurrentQuestionIndex(index)}
                    >
                      {index + 1}
                      {isFlagged && (
                        <Flag className="absolute -top-1 -right-1 h-3 w-3 text-yellow-600" />
                      )}
                      {isAnswered && (
                        <CheckCircle className="absolute -bottom-1 -right-1 h-3 w-3 text-green-600" />
                      )}
                    </Button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Question Content */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  Question {currentQuestionIndex + 1} of {questions.length}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{currentQuestion.marks} marks</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFlagQuestion(currentQuestion._id)}
                    className={flaggedQuestions.has(currentQuestion._id) ? "bg-yellow-100" : ""}
                  >
                    <Flag className="h-4 w-4" />
                    {flaggedQuestions.has(currentQuestion._id) ? "Unflag" : "Flag"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose max-w-none">
                <p className="text-lg">{currentQuestion.question}</p>
              </div>

              {/* Answer Options */}
              <div className="space-y-4">
                {currentQuestion.type === 'multiple-choice' && (
                  <RadioGroup
                    value={answers[currentQuestion._id] as string || ""}
                    onValueChange={(value) => handleAnswerChange(currentQuestion._id, value)}
                  >
                    {currentQuestion.options?.map((option, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`option-${index}`} />
                        <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {currentQuestion.type === 'true-false' && (
                  <RadioGroup
                    value={answers[currentQuestion._id] as string || ""}
                    onValueChange={(value) => handleAnswerChange(currentQuestion._id, value)}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="true" id="true" />
                      <Label htmlFor="true" className="cursor-pointer">True</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="false" id="false" />
                      <Label htmlFor="false" className="cursor-pointer">False</Label>
                    </div>
                  </RadioGroup>
                )}

                {currentQuestion.type === 'short-answer' && (
                  <Textarea
                    placeholder="Enter your answer here..."
                    value={answers[currentQuestion._id] as string || ""}
                    onChange={(e) => handleAnswerChange(currentQuestion._id, e.target.value)}
                    rows={4}
                  />
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleAnswerChange(currentQuestion._id, "")}
                  >
                    Clear Response
                  </Button>

                  {currentQuestionIndex === questions.length - 1 ? (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="gap-2">
                          <Send className="h-4 w-4" />
                          Submit Exam
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to submit your exam? You have answered {answeredCount} out of {questions.length} questions.
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Review Answers</AlertDialogCancel>
                          <AlertDialogAction onClick={handleManualSubmit}>
                            Submit Exam
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  ) : (
                    <Button
                      onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                      className="gap-2"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}