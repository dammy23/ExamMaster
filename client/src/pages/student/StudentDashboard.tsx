import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Clock,
  BookOpen,
  Trophy,
  TrendingUp,
  Play,
  Calendar,
  Target,
  Award
} from "lucide-react"
import { Link } from "react-router-dom"
import { getExams } from "@/api/exams"
import { getStudentExamAttempts } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"

interface StudentStats {
  upcomingExams: number
  completedExams: number
  averageScore: number
  totalTimeSpent: number
}

export function StudentDashboard() {
  const [stats, setStats] = useState<StudentStats>({
    upcomingExams: 0,
    completedExams: 0,
    averageScore: 0,
    totalTimeSpent: 0
  })
  const [upcomingExams, setUpcomingExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        console.log('Fetching student dashboard data...')
        const [examsResponse, attemptsResponse] = await Promise.all([
          getExams(),
          getStudentExamAttempts()
        ])

        const exams = (examsResponse as any).exams
        const attempts = (attemptsResponse as any).attempts

        console.log('Student Dashboard - All exams received:', exams)
        console.log('Student Dashboard - All attempts received:', attempts)

        // For students, show exams that are either 'active' or 'draft' (available to attempt)
        // Also check if exam is within the time window
        const now = new Date()
        const upcoming = exams.filter((exam: any) => {
          const isAvailable = exam.status === 'active' || exam.status === 'draft'
          const startDate = new Date(exam.startDate)
          const endDate = new Date(exam.endDate)
          const isInTimeWindow = now >= startDate && now <= endDate
          
          console.log(`Exam ${exam.title}: status=${exam.status}, isAvailable=${isAvailable}, isInTimeWindow=${isInTimeWindow}`)
          
          return isAvailable && isInTimeWindow
        })
        
        console.log('Student Dashboard - Filtered upcoming exams:', upcoming)
        
        const completed = attempts.filter((attempt: any) => attempt.status === 'completed')
        const avgScore = completed.length > 0
          ? completed.reduce((sum: number, attempt: any) => sum + attempt.percentage, 0) / completed.length
          : 0

        setStats({
          upcomingExams: upcoming.length,
          completedExams: completed.length,
          averageScore: avgScore,
          totalTimeSpent: attempts.reduce((sum: number, attempt: any) => sum + attempt.timeSpent, 0)
        })

        setUpcomingExams(upcoming.slice(0, 3))
      } catch (error) {
        console.error('Error fetching student dashboard data:', error)
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

  const recentResults = [
    { exam: "Mathematics Final", score: 85, percentage: 85, date: "2024-01-15" },
    { exam: "Physics Quiz", score: 42, percentage: 84, date: "2024-01-10" },
    { exam: "Chemistry Test", score: 38, percentage: 76, date: "2024-01-05" },
  ]

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
          <h1 className="text-3xl font-bold tracking-tight">My Dashboard</h1>
          <p className="text-muted-foreground">
            Track your exam progress and performance
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Exams</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.upcomingExams}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Ready to attempt
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <BookOpen className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.completedExams}</div>
            <p className="text-xs text-green-600 dark:text-green-400">
              Exams finished
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Target className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {stats.averageScore.toFixed(1)}%
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Overall performance
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Time Spent</CardTitle>
            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {Math.floor(stats.totalTimeSpent / 60)}h
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              Total exam time
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming Exams */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Available Exams
            </CardTitle>
            <CardDescription>
              Exams available for you to attempt
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingExams.length > 0 ? (
                upcomingExams.map((exam) => (
                  <div key={exam._id} className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">{exam.subject?.name || 'No Subject'}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {exam.duration} minutes
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Status: {exam.status}</span>
                      </div>
                    </div>
                    <div className="text-right space-y-2">
                      <Badge variant="secondary">Available</Badge>
                      <Link to={`/student/exam/${exam._id}/instructions`}>
                        <Button size="sm" className="gap-1">
                          <Play className="h-3 w-3" />
                          View Details
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No exams available at this time
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Recent Results
            </CardTitle>
            <CardDescription>
              Your latest exam performances
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{result.exam}</p>
                    <p className="text-xs text-muted-foreground">{result.date}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{result.percentage}%</div>
                    <Badge variant={result.percentage >= 80 ? 'default' : result.percentage >= 60 ? 'secondary' : 'destructive'}>
                      {result.percentage >= 80 ? 'Excellent' : result.percentage >= 60 ? 'Good' : 'Needs Improvement'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Link to="/student/results">
                <Button variant="outline" className="w-full">
                  View All Results
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Overview
          </CardTitle>
          <CardDescription>
            Your progress across different subjects
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Mathematics</span>
                <span>85%</span>
              </div>
              <Progress value={85} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Physics</span>
                <span>78%</span>
              </div>
              <Progress value={78} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Chemistry</span>
                <span>92%</span>
              </div>
              <Progress value={92} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}