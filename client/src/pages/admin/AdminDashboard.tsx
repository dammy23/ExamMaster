import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Users,
  FileText,
  Clock,
  TrendingUp,
  Plus,
  BarChart3,
  AlertCircle,
  ClipboardCheck,
  ClipboardList,
  Bookmark,
  Video
} from "lucide-react"
import { Link } from "react-router-dom"
import { getExams, type Exam } from "@/api/exams"
import { getStudents } from "@/api/students"
import { getAdminRecentActivity, getPendingGradingCount, getPendingVideoReviewsCount } from "@/api/examAttempts"
import { getActiveSubjects, type Subject } from "@/api/subjects"
import { useToast } from "@/hooks/useToast"

interface DashboardStats {
  totalExams: number
  activeExams: number
  totalStudents: number
  recentSubmissions: number
  pendingGrading: number
  pendingVideoReviews: number
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalExams: 0,
    activeExams: 0,
    totalStudents: 0,
    recentSubmissions: 0,
    pendingGrading: 0,
    pendingVideoReviews: 0
  })
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [recentExams, setRecentExams] = useState<Exam[]>([])
  const [activeSubjects, setActiveSubjects] = useState<Partial<Subject>[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [examsResponse, studentsResponse, recentActivityResponse, pendingGradingResponse, pendingVideoReviewsResponse, activeSubjectsResponse] = await Promise.all([
          getExams(),
          getStudents(),
          getAdminRecentActivity(),
          getPendingGradingCount(),
          getPendingVideoReviewsCount(),
          getActiveSubjects()
        ])

        const exams = (examsResponse as any).exams as Exam[]
        const students = (studentsResponse as any).students
        const recentActivityData = (recentActivityResponse as any).recentActivity
        const pendingGrading = (pendingGradingResponse as any).count
        const pendingVideoReviews = (pendingVideoReviewsResponse as any).count
        const subjects = (activeSubjectsResponse as any).subjects as Partial<Subject>[]

        const recentSubmissions = recentActivityData?.filter((activity: any) =>
          activity.action === 'Completed' || activity.action === 'Submitted'
        ).length || 0

        setStats({
          totalExams: exams.length,
          activeExams: exams.filter((exam) => exam.status === 'active').length,
          totalStudents: students.length,
          recentSubmissions: recentSubmissions,
          pendingGrading: pendingGrading,
          pendingVideoReviews: pendingVideoReviews
        })

        setRecentActivities(recentActivityData || [])
        setRecentExams(
          [...exams]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
        )
        setActiveSubjects(subjects || [])
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
    return <LoadingState label="Loading dashboard..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your exams today.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/exams/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Exam
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat Tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Exams</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.totalExams}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Exams</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-primary">{stats.activeExams}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.totalStudents}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Submissions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{stats.recentSubmissions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Grading</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-status-warning-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-status-warning-foreground">{stats.pendingGrading}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Video Reviews</CardTitle>
            <Video className="h-4 w-4 text-status-warning-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-status-warning-foreground">{stats.pendingVideoReviews}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest student exam activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivities.length > 0 ? (
              <div className="space-y-4">
                {recentActivities.map((activity) => (
                  <div key={activity._id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{activity.student}</p>
                      <p className="text-xs text-muted-foreground">{activity.exam}</p>
                      {activity.percentage !== null && (
                        <p className="text-xs text-muted-foreground">Score: {activity.percentage}%</p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant={activity.action === 'Completed' ? 'default' : activity.action === 'Started' ? 'secondary' : 'outline'}>
                        {activity.action}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No recent activity" description="Student exam activity will appear here as it happens." />
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Common tasks and shortcuts
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link to="/admin/exams/create">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Plus className="h-4 w-4" />
                Create New Exam
              </Button>
            </Link>
            <Link to="/admin/questions">
              <Button variant="outline" className="w-full justify-start gap-2">
                <FileText className="h-4 w-4" />
                Manage Questions
              </Button>
            </Link>
            <Link to="/admin/students">
              <Button variant="outline" className="w-full justify-start gap-2">
                <Users className="h-4 w-4" />
                View Students
              </Button>
            </Link>
            <Link to="/admin/reports">
              <Button variant="outline" className="w-full justify-start gap-2">
                <BarChart3 className="h-4 w-4" />
                Generate Reports
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Exams */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Recent Exams
            </CardTitle>
            <CardDescription>
              The 5 most recently created exams
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentExams.length > 0 ? (
              <div className="space-y-3">
                {recentExams.map((exam) => (
                  <Link
                    key={exam._id}
                    to={`/admin/exams/${exam._id}/details`}
                    className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{exam.title}</p>
                      <p className="text-xs text-muted-foreground">{exam.subject?.name}</p>
                    </div>
                    <StatusBadge status={exam.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="No exams yet" description="Create your first exam to see it listed here." />
            )}
          </CardContent>
        </Card>

        {/* Active Subjects */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bookmark className="h-5 w-5" />
              Active Subjects ({activeSubjects.length})
            </CardTitle>
            <CardDescription>
              Subjects currently available for exams
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeSubjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {activeSubjects.map((subject) => (
                  <Badge key={subject._id} variant="secondary">
                    {subject.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <EmptyState title="No active subjects" description="Activate a subject to see it listed here." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
