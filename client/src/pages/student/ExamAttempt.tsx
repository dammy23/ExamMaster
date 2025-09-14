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
  CheckCircle,
  Video
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
import { VideoRecorder } from "@/components/VideoRecorder"

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
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([])
  const [focusLostCount, setFocusLostCount] = useState(0)
  const [videoRecordingEnabled, setVideoRecordingEnabled] = useState(false)
  const [attemptNumber, setAttemptNumber] = useState(1)
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [isFullscreenMode, setIsFullscreenMode] = useState(false)

  useEffect(() => {
    if (id) {
      initializeExam()
    }
    
    // Check if we're in fullscreen mode (opened from new window)
    const isInFullscreenWindow = window.location.pathname.startsWith('/exam-fullscreen')
    setIsFullscreenMode(isInFullscreenWindow)
    
    console.log('ExamAttempt: Fullscreen mode detected:', isInFullscreenWindow)
    
    // Add beforeunload event to warn about closing the exam window
    if (isInFullscreenWindow) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = ''
        return 'Are you sure you want to leave? Your exam progress may be lost.'
      }
      
      window.addEventListener('beforeunload', handleBeforeUnload)
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
      }
    }
  }, [id])

  useEffect(() => {
    if (!attemptId) return

    // Enable fullscreen
    const enterFullScreen = () => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
          .then(() => {
            setIsFullScreen(true)
            console.log('Exam: Fullscreen mode activated')
            logExamActivity(attemptId, 'fullscreen_enabled')
          })
          .catch(err => {
            console.error('Failed to enable fullscreen:', err)
            const warning = 'Failed to enable fullscreen mode'
            setSecurityWarnings(prev => [...prev, warning])
            logExamActivity(attemptId, 'fullscreen_failed')
          })
      }
    }

    enterFullScreen()

    // Handle visibility change (tab switching detection)
    const handleVisibilityChange = () => {
      if (document.hidden && attemptId) {
        setTabSwitchCount(prev => prev + 1)
        const warning = `Tab switch detected at ${new Date().toLocaleTimeString()}`
        setSecurityWarnings(prev => [...prev, warning])
        logExamActivity(attemptId, 'tab_switch')
        console.log('Exam Security: Tab switch detected')
        toast({
          title: "Security Warning",
          description: "Tab switching detected and logged. Multiple violations may result in exam termination.",
          variant: "destructive"
        })
      }
    }

    // Handle window focus loss
    const handleFocusLoss = () => {
      if (attemptId) {
        setFocusLostCount(prev => prev + 1)
        const warning = `Window focus lost at ${new Date().toLocaleTimeString()}`
        setSecurityWarnings(prev => [...prev, warning])
        logExamActivity(attemptId, 'focus_lost')
        console.log('Exam Security: Window focus lost')
      }
    }

    // Handle fullscreen exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && attemptId) {
        setIsFullScreen(false)
        const warning = `Fullscreen mode exited at ${new Date().toLocaleTimeString()}`
        setSecurityWarnings(prev => [...prev, warning])
        logExamActivity(attemptId, 'fullscreen_exit')
        console.log('Exam Security: Fullscreen mode exited')
        toast({
          title: "Security Alert",
          description: "Fullscreen mode was exited. Please return to fullscreen.",
          variant: "destructive"
        })
        
        // Try to re-enable fullscreen after a short delay
        setTimeout(() => {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {
              // Ignore errors, user might have dismissed the request
            })
          }
        }, 1000)
      }
    }

    // Handle right-click context menu (disable)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      if (attemptId) {
        logExamActivity(attemptId, 'right_click_attempt')
        console.log('Exam Security: Right-click attempt blocked')
      }
      return false
    }

    // Handle keyboard shortcuts that might be used for cheating
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable common developer tools shortcuts
      if (
        (e.ctrlKey || e.metaKey) && 
        (e.key === 'i' || e.key === 'I' || // DevTools
         e.key === 'j' || e.key === 'J' || // Console
         e.key === 'u' || e.key === 'U' || // View Source
         e.key === 's' || e.key === 'S' || // Save page
         e.key === 'a' || e.key === 'A' || // Select all
         e.key === 'c' || e.key === 'C' || // Copy
         e.key === 'v' || e.key === 'V' || // Paste
         e.key === 'x' || e.key === 'X')   // Cut
      ) {
        e.preventDefault()
        if (attemptId) {
          logExamActivity(attemptId, `blocked_shortcut_${e.key.toLowerCase()}`)
          console.log(`Exam Security: Blocked keyboard shortcut Ctrl+${e.key}`)
        }
        return false
      }

      // Disable F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault()
        if (attemptId) {
          logExamActivity(attemptId, 'f12_attempt')
          console.log('Exam Security: F12 attempt blocked')
        }
        return false
      }

      // Alt+Tab detection
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault()
        if (attemptId) {
          logExamActivity(attemptId, 'alt_tab_attempt')
          console.log('Exam Security: Alt+Tab attempt blocked')
        }
        return false
      }
    }

    // Handle print screen attempts
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' && attemptId) {
        logExamActivity(attemptId, 'print_screen_attempt')
        console.log('Exam Security: Print screen attempt detected')
        toast({
          title: "Security Warning",
          description: "Screenshot attempt detected and logged.",
          variant: "destructive"
        })
      }
    }

    // Disable text selection to prevent copying
    const handleSelectStart = (e: Event) => {
      e.preventDefault()
      return false
    }

    // Disable drag and drop
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault()
      return false
    }

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleFocusLoss)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)
    document.addEventListener('selectstart', handleSelectStart)
    document.addEventListener('dragstart', handleDragStart)

    // Disable selection via CSS
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'

    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleFocusLoss)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('selectstart', handleSelectStart)
      document.removeEventListener('dragstart', handleDragStart)
      
      // Re-enable selection
      document.body.style.userSelect = ''
      document.body.style.webkitUserSelect = ''
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
      setVideoRecordingEnabled(attemptData.videoRecording || false)
      setAttemptNumber(attemptData.attemptNumber || 1)
      setMaxAttempts(attemptData.maxAttempts || 1)
    } catch (error: any) {
      console.error('Error initializing exam:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to start exam",
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
    } catch (error: any) {
      console.error('Error saving answer:', error)
      toast({
        title: "Warning", 
        description: "Failed to save answer. Please try again.",
        variant: "destructive"
      })
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
      
      if (isFullscreenMode) {
        console.log('Closing exam window after auto-submit')
        // Small delay to ensure toast is visible before closing
        setTimeout(() => {
          window.close()
        }, 2000)
      } else {
        navigate('/student/results')
      }
    } catch (error: any) {
      console.error('Error auto-submitting exam:', error)
      toast({
        title: "Submission Error",
        description: error.message || "Failed to auto-submit exam. Please submit manually.",
        variant: "destructive"
      })
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
      
      if (isFullscreenMode) {
        console.log('Closing exam window after manual submit')
        // Small delay to ensure toast is visible before closing
        setTimeout(() => {
          window.close()
        }, 2000)
      } else {
        navigate('/student/results')
      }
    } catch (error: any) {
      console.error('Error submitting exam:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to submit exam",
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

  if (!exam ) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Exam not found</h2>
          <Button onClick={() => navigate('/student')}>Return to Dashboard</Button>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Questions not found</h2>
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
            <p className="text-sm text-muted-foreground">{exam.subject?.name || 'No subject'}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${getTimeColor()}`}>
              <Clock className="h-4 w-4" />
              <span className="font-mono text-lg font-bold">
                {formatTime(timeRemaining)}
              </span>
            </div>

            {/* Attempt Information */}
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                Attempt {attemptNumber} of {maxAttempts}
              </Badge>
              
              {videoRecordingEnabled && (
                <Badge variant="secondary" className="gap-1">
                  <Video className="h-3 w-3" />
                  Recording
                </Badge>
              )}
            </div>

            {/* Security Status Indicators */}
            <div className="flex items-center gap-2">
              {!isFullScreen && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Not Fullscreen
                </Badge>
              )}
              
              {tabSwitchCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {tabSwitchCount} tab switches
                </Badge>
              )}
              
              {focusLostCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {focusLostCount} focus lost
                </Badge>
              )}

              {securityWarnings.length > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {securityWarnings.length} violations
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-20 max-w-7xl mx-auto">
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
      
      {/* Floating Video Recorder (if enabled) */}
      {videoRecordingEnabled && (
        <VideoRecorder 
          attemptId={attemptId}
          onRecordingComplete={(videoUrl) => {
            console.log('Video recording completed:', videoUrl)
          }}
        />
      )}
    </div>
  )
}