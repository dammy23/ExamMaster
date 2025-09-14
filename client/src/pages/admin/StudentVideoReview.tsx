import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  ArrowLeft, 
  Video, 
  Clock, 
  User, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Eye,
  Download
} from "lucide-react"
import { getExamAttemptsForReview, getAttemptForReview } from "@/api/examAttempts"
import { getExamById } from "@/api/exams"
import { useToast } from "@/hooks/useToast"

interface ExamAttemptReview {
  _id: string
  studentId: {
    _id: string
    name: string
    email: string
  }
  examId: {
    _id: string
    title: string
    subject: string
  }
  attemptNumber: number
  score?: number
  percentage?: number
  timeSpent: number
  tabSwitches: number
  status: string
  videoRecording?: {
    enabled: boolean
    videoUrl?: string
    recordingStartTime?: string
    recordingEndTime?: string
    recordingStatus: string
    fileSize?: number
  }
  activityLog: Array<{
    activity: string
    timestamp: string
  }>
  startTime: string
  endTime?: string
  createdAt: string
}

export function StudentVideoReview() {
  const { examId, attemptId } = useParams<{ examId: string; attemptId?: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [exam, setExam] = useState<any>(null)
  const [attempts, setAttempts] = useState<ExamAttemptReview[]>([])
  const [selectedAttempt, setSelectedAttempt] = useState<ExamAttemptReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [videoLoading, setVideoLoading] = useState(false)

  useEffect(() => {
    if (examId) {
      fetchExamAndAttempts()
    }
  }, [examId])

  useEffect(() => {
    if (attemptId && attempts.length > 0) {
      const attempt = attempts.find(a => a._id === attemptId)
      if (attempt) {
        setSelectedAttempt(attempt)
      } else {
        // If attempt not found in list, fetch it individually
        fetchSpecificAttempt(attemptId)
      }
    }
  }, [attemptId, attempts])

  const fetchExamAndAttempts = async () => {
    try {
      setLoading(true)
      console.log('Fetching exam and attempts for video review:', examId)

      const [examResponse, attemptsResponse] = await Promise.all([
        getExamById(examId!),
        getExamAttemptsForReview(examId!)
      ])

      setExam((examResponse as any).exam)
      setAttempts(attemptsResponse.attempts)

      console.log(`Loaded exam: ${(examResponse as any).exam.title}`)
      console.log(`Found ${attemptsResponse.attempts.length} attempts`)
    } catch (error: any) {
      console.error('Error fetching exam and attempts:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load exam data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchSpecificAttempt = async (id: string) => {
    try {
      console.log('Fetching specific attempt for review:', id)
      const response = await getAttemptForReview(id)
      setSelectedAttempt(response.attempt)
    } catch (error: any) {
      console.error('Error fetching specific attempt:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load attempt data",
        variant: "destructive"
      })
    }
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`
    }
    return `${remainingMinutes}m`
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'submitted':
        return <Badge variant="default">Completed</Badge>
      case 'in-progress':
        return <Badge variant="secondary">In Progress</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const getVideoStatusBadge = (recordingStatus: string) => {
    switch (recordingStatus) {
      case 'completed':
        return <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Available
        </Badge>
      case 'recording':
        return <Badge variant="secondary" className="gap-1 animate-pulse">
          <Video className="h-3 w-3" />
          Recording
        </Badge>
      case 'failed':
        return <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          Failed
        </Badge>
      default:
        return <Badge variant="outline">{recordingStatus}</Badge>
    }
  }

  const handleViewAttempt = (attempt: ExamAttemptReview) => {
    setSelectedAttempt(attempt)
    navigate(`/admin/exams/${examId}/video-review/${attempt._id}`)
  }

  const renderVideoPlayer = (videoUrl: string) => {
    return (
      <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
        <video
          controls
          className="w-full h-full"
          onLoadStart={() => setVideoLoading(true)}
          onCanPlay={() => setVideoLoading(false)}
        >
          <source src={videoUrl} type="video/webm" />
          <source src={videoUrl} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {videoLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
      </div>
    )
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
      <div className="text-center py-8">
        <h2 className="text-2xl font-bold mb-2">Exam not found</h2>
        <Button onClick={() => navigate('/admin/exams')}>
          Return to Exams
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(selectedAttempt ? `/admin/exams/${examId}/video-review` : '/admin/exams')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {selectedAttempt ? 'Student Video Review' : 'Video Security Review'}
          </h1>
          <p className="text-muted-foreground">
            {exam.title} - Video recordings and security analysis
          </p>
        </div>
      </div>

      {selectedAttempt ? (
        /* Individual Attempt Review */
        <div className="space-y-6">
          {/* Attempt Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Attempt Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Student</p>
                <p className="text-lg font-semibold">{selectedAttempt.studentId.name}</p>
                <p className="text-sm text-muted-foreground">{selectedAttempt.studentId.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Attempt</p>
                <p className="text-lg font-semibold">#{selectedAttempt.attemptNumber}</p>
                <p className="text-sm">{getStatusBadge(selectedAttempt.status)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Score</p>
                <p className="text-lg font-semibold">
                  {selectedAttempt.score !== undefined 
                    ? `${selectedAttempt.score}/${exam.totalMarks}` 
                    : 'Not graded'
                  }
                </p>
                {selectedAttempt.percentage !== undefined && (
                  <p className="text-sm text-muted-foreground">{selectedAttempt.percentage}%</p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Duration</p>
                <p className="text-lg font-semibold">{formatDuration(selectedAttempt.timeSpent)}</p>
                <p className="text-sm text-muted-foreground">
                  Started: {formatDateTime(selectedAttempt.startTime)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="video" className="space-y-4">
            <TabsList>
              <TabsTrigger value="video">Video Recording</TabsTrigger>
              <TabsTrigger value="security">Security Log</TabsTrigger>
              <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="video" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="h-5 w-5" />
                      Video Recording
                    </div>
                    {selectedAttempt.videoRecording?.enabled && (
                      getVideoStatusBadge(selectedAttempt.videoRecording.recordingStatus)
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedAttempt.videoRecording?.enabled ? (
                    selectedAttempt.videoRecording.videoUrl ? (
                      <div className="space-y-4">
                        {renderVideoPlayer(selectedAttempt.videoRecording.videoUrl)}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="font-medium">Recording Started</p>
                            <p className="text-muted-foreground">
                              {selectedAttempt.videoRecording.recordingStartTime 
                                ? formatDateTime(selectedAttempt.videoRecording.recordingStartTime)
                                : 'Not available'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">Recording Ended</p>
                            <p className="text-muted-foreground">
                              {selectedAttempt.videoRecording.recordingEndTime 
                                ? formatDateTime(selectedAttempt.videoRecording.recordingEndTime)
                                : 'Not available'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">File Size</p>
                            <p className="text-muted-foreground">
                              {selectedAttempt.videoRecording.fileSize 
                                ? `${(selectedAttempt.videoRecording.fileSize / (1024 * 1024)).toFixed(2)} MB`
                                : 'Unknown'
                              }
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">Status</p>
                            <p className="text-muted-foreground">{selectedAttempt.videoRecording.recordingStatus}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Video recording is enabled but not available</p>
                        <p className="text-sm">Status: {selectedAttempt.videoRecording.recordingStatus}</p>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Video recording was not enabled for this exam</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Security Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-destructive">{selectedAttempt.tabSwitches}</div>
                      <p className="text-sm text-muted-foreground">Tab Switches</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {selectedAttempt.activityLog.filter(log => log.activity === 'focus_lost').length}
                      </div>
                      <p className="text-sm text-muted-foreground">Focus Lost</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">
                        {selectedAttempt.activityLog.filter(log => log.activity.includes('fullscreen')).length}
                      </div>
                      <p className="text-sm text-muted-foreground">Fullscreen Issues</p>
                    </div>
                  </div>
                  
                  {selectedAttempt.tabSwitches > 5 && (
                    <div className="p-4 border-l-4 border-destructive bg-destructive/10">
                      <div className="flex">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        <div className="ml-2">
                          <h4 className="text-sm font-medium">High Security Risk</h4>
                          <p className="text-sm text-muted-foreground">
                            Student switched tabs {selectedAttempt.tabSwitches} times during the exam, which may indicate academic dishonesty.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Activity Timeline
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedAttempt.activityLog.map((activity, index) => (
                      <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                        <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{activity.activity.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        /* Attempts List */
        <Card>
          <CardHeader>
            <CardTitle>Exam Attempts with Video Recording</CardTitle>
            <CardDescription>
              Review video recordings and security logs for all exam attempts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attempts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No exam attempts found</p>
                <p className="text-sm">Students haven't started this exam yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {attempts.map((attempt) => (
                  <div
                    key={attempt._id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="font-medium">{attempt.studentId.name}</p>
                        <p className="text-sm text-muted-foreground">{attempt.studentId.email}</p>
                      </div>
                      
                      <Separator orientation="vertical" className="h-8" />
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Attempt #{attempt.attemptNumber}</Badge>
                        {getStatusBadge(attempt.status)}
                        {attempt.videoRecording?.enabled && (
                          getVideoStatusBadge(attempt.videoRecording.recordingStatus)
                        )}
                      </div>

                      <Separator orientation="vertical" className="h-8" />

                      <div className="text-sm text-muted-foreground">
                        <p>Score: {attempt.score !== undefined ? `${attempt.score}/${exam.totalMarks}` : 'N/A'}</p>
                        <p>Duration: {formatDuration(attempt.timeSpent)}</p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => handleViewAttempt(attempt)}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Review
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}