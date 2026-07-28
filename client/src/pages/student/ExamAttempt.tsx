import { useEffect, useRef, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
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
  Video,
  Monitor
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
import { VideoRecorder, type VideoRecorderHandle } from "@/components/VideoRecorder"
import { ScreenRecorder, type ScreenRecorderHandle } from "@/components/ScreenRecorder"
import { ScreenShareGate } from "@/components/ScreenShareGate"
import {
  detectMultiMonitor,
  detectVmIndicator,
  probeSuspiciousExtensions,
  createDevToolsWatcher,
} from "@/lib/cheatDetection"
import { requestEntireScreenShare } from "@/lib/screenShareGate"

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
  const [screenRecordingEnabled, setScreenRecordingEnabled] = useState(false)
  const [screenShareBlocked, setScreenShareBlocked] = useState(false)
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null)
  const [screenShareError, setScreenShareError] = useState<string>("")
  const [attemptNumber, setAttemptNumber] = useState(1)
  const [maxAttempts, setMaxAttempts] = useState(1)
  const [isFullscreenMode, setIsFullscreenMode] = useState(false)
  const hasInitializedRef = useRef(false)
  const videoRecorderRef = useRef<VideoRecorderHandle>(null)
  const screenRecorderRef = useRef<ScreenRecorderHandle>(null)

  useEffect(() => {
    if (id && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      initializeExam()
    }

    // Check if we're in fullscreen mode (opened from new window)
    const isInFullscreenWindow = window.location.pathname.startsWith('/exam-fullscreen')
    setIsFullscreenMode(isInFullscreenWindow)

    // Add beforeunload event to warn about closing the exam window
    if (isInFullscreenWindow) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = ''
        return 'Are you sure you want to leave? Your exam progress may be lost.'
      }

      // Listen for auth tokens from parent window
      const handleMessage = (event: MessageEvent) => {
        // Verify the origin for security
        if (event.origin !== window.location.origin) {
          return
        }

        if (event.data.type === 'AUTH_TOKENS') {
          if (event.data.accessToken) {
            localStorage.setItem('accessToken', event.data.accessToken)
          }

          if (event.data.refreshToken) {
            localStorage.setItem('refreshToken', event.data.refreshToken)
          }

          // Re-initialize only if the mount-time init never ran (e.g. id wasn't
          // ready yet) -- otherwise this is a redundant token-sync resend and
          // must not re-trigger the exam/screen-share gate a second time.
          if (event.data.accessToken && id && !hasInitializedRef.current) {
            hasInitializedRef.current = true
            setTimeout(() => {
              initializeExam()
            }, 100)
          }
        }
      }

      window.addEventListener('beforeunload', handleBeforeUnload)
      window.addEventListener('message', handleMessage)

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
        window.removeEventListener('message', handleMessage)
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
            logExamActivity(attemptId, 'fullscreen_enabled')
          })
          .catch(() => {
            const warning = 'Failed to enable fullscreen mode'
            setSecurityWarnings(prev => [...prev, warning])
            logExamActivity(attemptId, 'fullscreen_failed')
          })
      }
    }

    enterFullScreen()

    // One-time environment heuristics (checked once at start, not expected to
    // change mid-exam)
    if (detectMultiMonitor()) {
      logExamActivity(attemptId, 'multi_monitor_detected')
    }
    if (detectVmIndicator()) {
      logExamActivity(attemptId, 'vm_indicator_detected')
    }
    probeSuspiciousExtensions().then(detected => {
      if (detected) {
        logExamActivity(attemptId, 'suspicious_extension_detected')
      }
    })

    // Continuous DevTools-open detection (edge-triggered — only fires on the
    // closed-to-open transition)
    const stopDevToolsWatcher = createDevToolsWatcher(() => {
      logExamActivity(attemptId, 'devtools_open_detected')
    })

    // Handle visibility change (tab switching detection)
    const handleVisibilityChange = () => {
      if (document.hidden && attemptId) {
        setTabSwitchCount(prev => prev + 1)
        const warning = `Tab switch detected at ${new Date().toLocaleTimeString()}`
        setSecurityWarnings(prev => [...prev, warning])
        logExamActivity(attemptId, 'tab_switch')
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
      }
    }

    // Handle fullscreen exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && attemptId) {
        setIsFullScreen(false)
        const warning = `Fullscreen mode exited at ${new Date().toLocaleTimeString()}`
        setSecurityWarnings(prev => [...prev, warning])
        logExamActivity(attemptId, 'fullscreen_exit')
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
        }
        return false
      }

      // Disable F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault()
        if (attemptId) {
          logExamActivity(attemptId, 'f12_attempt')
        }
        return false
      }

      // Alt+Tab detection
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault()
        if (attemptId) {
          logExamActivity(attemptId, 'alt_tab_attempt')
        }
        return false
      }
    }

    // Handle print screen attempts
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' && attemptId) {
        logExamActivity(attemptId, 'print_screen_attempt')
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
      stopDevToolsWatcher()
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
      const examResponse = await getExamById(id!)
      const examData = (examResponse as any).exam
      setExam(examData)

      if (examData.screenRecording) {
        setLoading(false)
        await runScreenShareGate(examData)
        return
      }

      await beginAttempt(examData)
    } catch (error: any) {
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

  const beginAttempt = async (examData: any) => {
    const attemptResponse = await startExamAttempt(id!)
    const attemptData = attemptResponse as any

    setQuestions(attemptData.questions)
    setAttemptId(attemptData.attemptId)
    setTimeRemaining(attemptData.remainingTime || examData.duration * 60) // Use remainingTime from attempt or fallback to full duration
    setVideoRecordingEnabled(attemptData.videoRecording || false)
    setScreenRecordingEnabled(attemptData.screenRecording || false)
    setAttemptNumber(attemptData.attemptNumber || 1)
    setMaxAttempts(attemptData.maxAttempts || 1)
  }

  const attemptScreenShare = async (): Promise<boolean> => {
    setScreenShareError("")
    try {
      const mediaStream = await requestEntireScreenShare()
      setScreenShareStream(mediaStream)
      setScreenShareBlocked(false)
      return true
    } catch (error: any) {
      setScreenShareError(
        error.name === 'WrongSurfaceError'
          ? error.message
          : error.name === 'NotAllowedError'
            ? 'Please allow screen sharing of your entire screen to continue.'
            : (error.message || 'Failed to access screen sharing.')
      )
      return false
    }
  }

  const runScreenShareGate = async (examData: any) => {
    setScreenShareBlocked(true)
    const granted = await attemptScreenShare()
    if (granted) {
      await beginAttempt(examData)
    }
  }

  const handleRetryScreenShare = async () => {
    const granted = await attemptScreenShare()
    if (granted && !attemptId) {
      await beginAttempt(exam)
    }
  }

  const handleScreenShareLost = () => {
    setScreenShareStream(null)
    setScreenShareBlocked(true)
    setScreenShareError("")
    if (attemptId) {
      logExamActivity(attemptId, 'screen_share_lost')
    }
  }

  const handleAnswerChange = async (questionId: string, answer: string | string[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))

    try {
      await saveExamAnswer(attemptId, questionId, answer)
    } catch (error: any) {
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

  // Neither recorder finalizes on unmount alone -- it only stops the media
  // stream, never the MediaRecorder itself -- so without this, a recording
  // still in progress at submit time is silently discarded. Waits for the
  // in-flight upload(s), capped so a slow/broken upload can't block submission
  // indefinitely.
  const finalizeRecordings = async () => {
    const finalizers: Promise<void>[] = []
    if (videoRecorderRef.current) finalizers.push(videoRecorderRef.current.finalize())
    if (screenRecorderRef.current) finalizers.push(screenRecorderRef.current.finalize())
    if (finalizers.length === 0) return

    await Promise.race([
      Promise.all(finalizers),
      new Promise<void>(resolve => setTimeout(resolve, 15000))
    ])
  }

  const handleAutoSubmit = async () => {
    try {
      await finalizeRecordings()
      await submitExamAttempt(attemptId)
      toast({
        title: "Time's Up!",
        description: "Your exam has been automatically submitted.",
      })

      if (isFullscreenMode) {
        // Small delay to ensure toast is visible before closing
        setTimeout(() => {
          window.close()
        }, 2000)
      } else {
        navigate('/student/results')
      }
    } catch (error: any) {
      toast({
        title: "Submission Error",
        description: error.message || "Failed to auto-submit exam. Please submit manually.",
        variant: "destructive"
      })
    }
  }

  const handleManualSubmit = async () => {
    try {
      await finalizeRecordings()
      const response = await submitExamAttempt(attemptId)
      const result = response as any

      toast({
        title: "Exam Submitted",
        description: result.status === 'pending-review'
          ? "Your exam has been submitted and is awaiting grading."
          : exam.showResultsImmediately
            ? `Your score: ${result.score}/${exam.totalMarks} (${result.percentage}%)`
            : "Your exam has been submitted successfully.",
      })

      if (isFullscreenMode) {
        // Small delay to ensure toast is visible before closing
        setTimeout(() => {
          window.close()
        }, 2000)
      } else {
        navigate('/student/results')
      }
    } catch (error: any) {
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
    if (percentage <= 10) return "text-status-danger-foreground"
    if (percentage <= 25) return "text-status-warning-foreground"
    return "text-status-success-foreground"
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100
  const answeredCount = Object.keys(answers).length

  if (loading) {
    return <LoadingState label="Loading exam..." className="min-h-screen" />
  }

  if (!exam ) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Exam not found"
        action={{ label: "Return to Dashboard", onClick: () => navigate('/student') }}
        className="min-h-screen"
      />
    )
  }

  if (screenShareBlocked) {
    return (
      <ScreenShareGate
        mode={attemptId ? 'reshare' : 'initial'}
        error={screenShareError}
        onRetry={handleRetryScreenShare}
      />
    )
  }

  if (!currentQuestion) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Questions not found"
        action={{ label: "Return to Dashboard", onClick: () => navigate('/student') }}
        className="min-h-screen"
      />
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
              {screenRecordingEnabled && (
                <Badge variant="secondary" className="gap-1">
                  <Monitor className="h-3 w-3" />
                  Screen Recording
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

      <div className="pt-20 max-w-12xl mx-auto">
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
                        isAnswered ? "bg-status-success/20 border-status-success" : ""
                      } ${isFlagged ? "bg-status-warning/20 border-status-warning" : ""}`}
                      onClick={() => {
                        if (exam.allowReview || index >= currentQuestionIndex) {
                          setCurrentQuestionIndex(index)
                        }
                      }}
                    >
                      {index + 1}
                      {isFlagged && (
                        <Flag className="absolute -top-1 -right-1 h-3 w-3 text-status-warning-foreground" />
                      )}
                      {isAnswered && (
                        <CheckCircle className="absolute -bottom-1 -right-1 h-3 w-3 text-status-success-foreground" />
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
                    className={flaggedQuestions.has(currentQuestion._id) ? "bg-status-warning/20" : ""}
                  >
                    <Flag className="h-4 w-4" />
                    {flaggedQuestions.has(currentQuestion._id) ? "Unflag" : "Flag"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose max-w-none">
                <div className="text-lg" dangerouslySetInnerHTML={{ __html: currentQuestion.question }} />
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

                {(currentQuestion.type === 'theory' || currentQuestion.type === 'short-answer') && (
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
                  disabled={currentQuestionIndex === 0 || !exam.allowReview}
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
        <VideoRecorder ref={videoRecorderRef} attemptId={attemptId} />
      )}
      {/* Floating Screen Recorder (if enabled) -- independent of video recording, can run alongside it */}
      {screenRecordingEnabled && screenShareStream && (
        <ScreenRecorder ref={screenRecorderRef} attemptId={attemptId} stream={screenShareStream} onStreamLost={handleScreenShareLost} />
      )}
    </div>
  )
}