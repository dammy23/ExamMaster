import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Clock,
  BookOpen,
  Trophy,
  Play,
  Calendar,
  Award,
  LogOut,
  User
} from "lucide-react"
import { Link } from "react-router-dom"
import { getAvailableExamsForStudent } from "@/api/exams"
import { getStudentRecentResults } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"

interface StudentStats {
  availableExams: number
  completedExams: number
}

export function StudentDashboard() {
  const [stats, setStats] = useState<StudentStats>({
    availableExams: 0,
    completedExams: 0
  })
  const [availableExams, setAvailableExams] = useState<any[]>([])
  const [recentResults, setRecentResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Get user info from localStorage
  const userEmail = localStorage.getItem('userEmail') || 'Student'
  const userName = localStorage.getItem('userName') || userEmail

  const handleLogout = () => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userName')
    window.location.href = '/login'
  }

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch available exams and recent results in parallel
        const [availableExamsResponse, recentResultsResponse] = await Promise.all([
          getAvailableExamsForStudent(),
          getStudentRecentResults()
        ])

        const availableExamsData = (availableExamsResponse as any).exams || []
        const recentResultsData = (recentResultsResponse as any).recentResults || []

        setStats({
          availableExams: availableExamsData.length,
          completedExams: recentResultsData.length
        })

        setAvailableExams(availableExamsData)
        setRecentResults(recentResultsData)
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to load dashboard data",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [toast])

  if (loading) {
    return <LoadingState label="Loading dashboard..." className="min-h-screen" />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ExamMaster</h1>
              <p className="text-sm text-muted-foreground">Student Portal</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>{userName}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="flex items-center space-x-1"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Welcome back, {userName}!</h2>
            <p className="text-muted-foreground text-lg">
              Ready to take on your next exam challenge?
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 max-w-4xl mx-auto">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Available Exams</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.availableExams}</div>
                <p className="text-xs text-muted-foreground">
                  Ready to attempt now
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed Exams</CardTitle>
                <Trophy className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{stats.completedExams}</div>
                <p className="text-xs text-muted-foreground">
                  With results available
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Available Exams */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Available Exams
                </CardTitle>
                <CardDescription>
                  Exams you can take right now
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {availableExams.length > 0 ? (
                    availableExams.map((exam) => (
                      <div key={exam._id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border hover:bg-muted/70 transition-colors">
                        <div className="space-y-1 flex-1">
                          <p className="text-sm font-medium">{exam.title}</p>
                          <p className="text-xs text-muted-foreground">{exam.subject?.name || 'No Subject'}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {exam.duration} minutes
                            </div>
                            <div className="flex items-center gap-1">
                              <Award className="h-3 w-3" />
                              {exam.totalMarks} marks
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <Badge className="bg-status-success text-status-success-foreground">
                            Available
                          </Badge>
                          <div>
                            <Link to={`/student/exam/${exam._id}/instructions`}>
                              <Button size="sm" className="gap-1">
                                <Play className="h-3 w-3" />
                                Start Exam
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={Calendar}
                      title="No exams available at this time"
                      description="Check back later for new exams"
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Results */}
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Recent Results
                </CardTitle>
                <CardDescription>
                  Your latest exam performances (results available immediately)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentResults.length > 0 ? (
                    recentResults.map((result, index) => (
                      <div key={result._id || index} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                        <div className="space-y-1 flex-1">
                          <p className="text-sm font-medium">{result.exam}</p>
                          <p className="text-xs text-muted-foreground">{result.subject}</p>
                          <p className="text-xs text-muted-foreground">{result.date}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <div className="text-lg font-bold">{result.percentage}%</div>
                          <Badge
                            className={
                              result.percentage >= 80 ? 'bg-status-success text-status-success-foreground' :
                              result.percentage >= 60 ? 'bg-status-info text-status-info-foreground' :
                              'bg-status-danger text-status-danger-foreground'
                            }
                          >
                            {result.percentage >= 80 ? 'Excellent' :
                             result.percentage >= 60 ? 'Good' :
                             'Needs Improvement'}
                          </Badge>
                          <p className="text-xs text-muted-foreground">Score: {result.score}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      icon={Trophy}
                      title="No exam results available yet"
                      description="Complete some exams to see your results here"
                    />
                  )}
                </div>

                {recentResults.length > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <Link to="/student/results">
                      <Button variant="outline" className="w-full">
                        View All Results
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Tips */}
          <Card>
            <CardHeader>
              <CardTitle>📚 Quick Tips for Success</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="flex items-start space-x-2">
                  <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Manage Your Time</p>
                    <p className="text-muted-foreground">Keep an eye on the timer and pace yourself</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Read Carefully</p>
                    <p className="text-muted-foreground">Take time to understand each question</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <Award className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium">Stay Focused</p>
                    <p className="text-muted-foreground">Minimize distractions during exams</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}