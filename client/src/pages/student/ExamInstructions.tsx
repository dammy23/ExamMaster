import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Users,
  Calendar,
  Target,
  Play,
  ArrowLeft,
  Shield,
  Eye,
  MonitorCheck
} from "lucide-react"
import { getExamById } from "@/api/exams"
import { useToast } from "@/hooks/useToast"

export function ExamInstructions() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [exam, setExam] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [systemCheck, setSystemCheck] = useState({
    fullScreen: false,
    browser: true,
    javascript: true,
    connection: true
  })

  useEffect(() => {
    if (id) {
      fetchExamDetails()
      performSystemCheck()
    }
  }, [id])

  const fetchExamDetails = async () => {
    try {
      console.log('Fetching exam details for instructions:', id)
      const response = await getExamById(id!)
      const examData = (response as any).exam
      
      console.log('Exam details loaded:', examData)
      setExam(examData)
    } catch (error) {
      console.error('Error fetching exam details:', error)
      toast({
        title: "Error",
        description: "Failed to load exam details",
        variant: "destructive"
      })
      navigate('/student')
    } finally {
      setLoading(false)
    }
  }

  const performSystemCheck = () => {
    console.log('Performing system check...')
    
    // Check if browser supports fullscreen
    const supportsFullscreen = !!(
      document.documentElement.requestFullscreen ||
      (document.documentElement as any).webkitRequestFullscreen ||
      (document.documentElement as any).mozRequestFullScreen ||
      (document.documentElement as any).msRequestFullscreen
    )

    setSystemCheck({
      fullScreen: supportsFullscreen,
      browser: true, // Assuming modern browser if JS is running
      javascript: true, // Obviously true if this code is running
      connection: navigator.onLine
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getTimeUntilStart = () => {
    if (!exam) return null
    const now = new Date()
    const start = new Date(exam.startDate)
    const end = new Date(exam.endDate)
    
    if (now < start) {
      const diff = start.getTime() - now.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      return { type: 'starts', time: `${hours}h ${minutes}m` }
    } else if (now > end) {
      return { type: 'expired', time: null }
    }
    return { type: 'available', time: null }
  }

  const canStartExam = () => {
    if (!exam) return false
    const timeStatus = getTimeUntilStart()
    return timeStatus?.type === 'available' && Object.values(systemCheck).every(check => check === true)
  }

  const handleStartExam = () => {
    if (!canStartExam()) {
      toast({
        title: "Cannot Start Exam",
        description: "Please ensure all system requirements are met and the exam is available.",
        variant: "destructive"
      })
      return
    }
    
    console.log('Starting exam in new fullscreen window:', id)
    
    // Open exam in new window with fullscreen
    const examUrl = `/exam-fullscreen/${id}`
    const examWindow = window.open(
      examUrl, 
      'examWindow', 
      'fullscreen=yes,scrollbars=no,resizable=no,toolbar=no,menubar=no,location=no,status=no'
    )
    
    if (examWindow) {
      // Try to maximize the window
      examWindow.moveTo(0, 0)
      examWindow.resizeTo(screen.width, screen.height)
      
      // Focus on the new window
      examWindow.focus()
      
      // Pass authentication tokens to the new window
      const accessToken = localStorage.getItem('accessToken')
      const refreshToken = localStorage.getItem('refreshToken')
      
      console.log('Passing auth tokens to exam window. AccessToken exists:', !!accessToken)
      
      // Wait for the new window to load, then send auth tokens
      const sendAuthTokens = () => {
        try {
          examWindow.postMessage({
            type: 'AUTH_TOKENS',
            accessToken: accessToken,
            refreshToken: refreshToken
          }, window.location.origin)
          console.log('Auth tokens sent to exam window')
        } catch (error) {
          console.error('Error sending auth tokens to exam window:', error)
        }
      }
      
      // Send tokens immediately and also after a short delay to ensure the window is ready
      sendAuthTokens()
      setTimeout(sendAuthTokens, 1000)
      setTimeout(sendAuthTokens, 2000)
      
      toast({
        title: "Exam Window Opened",
        description: "Your exam has opened in a new fullscreen window. Complete your exam in that window.",
      })
      
      // Listen for window close to refresh current page
      const checkClosed = setInterval(() => {
        if (examWindow.closed) {
          clearInterval(checkClosed)
          console.log('Exam window closed, refreshing dashboard')
          toast({
            title: "Exam Window Closed",
            description: "Returning to dashboard...",
          })
          navigate('/student')
        }
      }, 1000)
    } else {
      toast({
        title: "Pop-up Blocked",
        description: "Please allow pop-ups for this site and try again.",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!exam) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Exam not found</h2>
          <Button onClick={() => navigate('/student')}>Return to Dashboard</Button>
        </div>
      </div>
    )
  }

  const timeStatus = getTimeUntilStart()
  const allChecksPass = Object.values(systemCheck).every(check => check === true)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/student">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Exam Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-2xl">{exam.title}</CardTitle>
                  <CardDescription className="text-base mt-2">
                    {exam.description}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="ml-4">
                  {exam.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{exam.duration} minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{exam.totalQuestions || 'N/A'} questions</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{exam.totalMarks} marks</span>
                </div>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Pass: {exam.passingMarks}</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Schedule
                </h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>Start: {formatDateTime(exam.startDate)}</div>
                  <div>End: {formatDateTime(exam.endDate)}</div>
                </div>
              </div>

              {timeStatus && (
                <div className="p-4 rounded-lg bg-muted">
                  {timeStatus.type === 'starts' && (
                    <div className="flex items-center gap-2 text-orange-600">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Exam starts in {timeStatus.time}
                      </span>
                    </div>
                  )}
                  {timeStatus.type === 'available' && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Exam is available now
                      </span>
                    </div>
                  )}
                  {timeStatus.type === 'expired' && (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Exam time has expired
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Exam Instructions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none text-sm">
                {exam.instructions ? (
                  <div className="whitespace-pre-wrap">{exam.instructions}</div>
                ) : (
                  <div className="space-y-3">
                    <h4 className="font-medium">General Instructions:</h4>
                    <ul className="space-y-1 ml-4">
                      <li>• Read all questions carefully before answering</li>
                      <li>• You can navigate between questions using the question palette</li>
                      <li>• Mark questions for review if you want to revisit them</li>
                      <li>• Your answers are saved automatically every 30 seconds</li>
                      <li>• Submit your exam before the time expires</li>
                    </ul>
                    
                    <h4 className="font-medium mt-4">Marking Scheme:</h4>
                    <ul className="space-y-1 ml-4">
                      <li>• Each correct answer carries the marks mentioned</li>
                      {exam.negativeMarking && (
                        <li>• Negative marking: -{exam.negativeMarkingValue || 0.25} marks for wrong answers</li>
                      )}
                      <li>• No marks for unanswered questions</li>
                    </ul>

                    <h4 className="font-medium mt-4">Technical Requirements:</h4>
                    <ul className="space-y-1 ml-4">
                      <li>• Stable internet connection required</li>
                      <li>• Full-screen mode will be activated</li>
                      <li>• Tab switching is monitored and logged</li>
                      <li>• Do not close the browser during the exam</li>
                    </ul>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Check & Actions */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MonitorCheck className="h-5 w-5" />
                System Check
              </CardTitle>
              <CardDescription>
                Ensure your system meets the requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemCheck.browser ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm">Browser Support</span>
                </div>
                {systemCheck.browser ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemCheck.javascript ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm">JavaScript Enabled</span>
                </div>
                {systemCheck.javascript ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemCheck.fullScreen ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm">Fullscreen Support</span>
                </div>
                {systemCheck.fullScreen ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemCheck.connection ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm">Internet Connection</span>
                </div>
                {systemCheck.connection ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>

              {!allChecksPass && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">System Requirements Not Met</span>
                  </div>
                  <p className="text-xs text-red-600 mt-1">
                    Please ensure all system checks pass before starting the exam.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <div className="flex items-start gap-2">
                  <Eye className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>Full-screen mode will be activated</span>
                </div>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>Tab switching will be monitored and logged</span>
                </div>
                <div className="flex items-start gap-2">
                  <MonitorCheck className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>Your activity will be tracked for exam integrity</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ready to Start?</CardTitle>
              <CardDescription>
                Review everything and begin your exam when ready
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {canStartExam() ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="lg" className="w-full gap-2">
                      <Play className="h-4 w-4" />
                      Start Exam
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Start Exam Confirmation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you ready to begin "{exam.title}"? 
                        <br /><br />
                        Once you start:
                        <br />• The timer will begin counting down
                        <br />• Full-screen mode will be activated
                        <br />• Your activity will be monitored
                        <br />• You cannot pause the exam
                        <br /><br />
                        Make sure you have a stable internet connection and won't be disturbed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Not Ready</AlertDialogCancel>
                      <AlertDialogAction onClick={handleStartExam}>
                        Yes, Start Exam
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Button size="lg" className="w-full" disabled>
                  {timeStatus?.type === 'starts' && `Exam starts in ${timeStatus.time}`}
                  {timeStatus?.type === 'expired' && 'Exam has expired'}
                  {timeStatus?.type === 'available' && !allChecksPass && 'System requirements not met'}
                </Button>
              )}
              
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full" 
                onClick={() => navigate('/student')}
              >
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}