import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Trophy,
  Calendar,
  Clock,
  Target,
  TrendingUp,
  Award,
  BookOpen,
  ArrowLeft
} from "lucide-react"
import { getStudentExamAttempts, type ExamAttempt } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"

export function StudentResults() {
  const [attempts, setAttempts] = useState<ExamAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchResults()
  }, [])

  const fetchResults = async () => {
    try {
      const response = await getStudentExamAttempts()
      setAttempts((response as any).attempts)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load results",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getGradeBadge = (percentage: number) => {
    if (percentage >= 90) return <Badge className="bg-status-success text-status-success-foreground">A+</Badge>
    if (percentage >= 80) return <Badge className="bg-status-success text-status-success-foreground">A</Badge>
    if (percentage >= 70) return <Badge className="bg-status-info text-status-info-foreground">B</Badge>
    if (percentage >= 60) return <Badge className="bg-status-warning text-status-warning-foreground">C</Badge>
    if (percentage >= 50) return <Badge className="bg-status-warning text-status-warning-foreground">D</Badge>
    return <Badge className="bg-status-danger text-status-danger-foreground">F</Badge>
  }

  const getPerformanceBadge = (percentage: number) => {
    if (percentage >= 85) return <Badge className="bg-status-success text-status-success-foreground">Excellent</Badge>
    if (percentage >= 70) return <Badge className="bg-status-info text-status-info-foreground">Good</Badge>
    if (percentage >= 60) return <Badge className="bg-status-warning text-status-warning-foreground">Average</Badge>
    return <Badge className="bg-status-danger text-status-danger-foreground">Needs Improvement</Badge>
  }

  const completedAttempts = attempts.filter(attempt => attempt.status === 'completed')
  const averageScore = completedAttempts.length > 0
    ? completedAttempts.reduce((sum, attempt) => sum + (attempt.percentage || 0), 0) / completedAttempts.length
    : 0
  const bestScore = completedAttempts.length > 0
    ? Math.max(...completedAttempts.map(attempt => attempt.percentage || 0))
    : 0
  const totalTimeSpent = completedAttempts.reduce((sum, attempt) => sum + attempt.timeSpent, 0)

  if (loading) {
    return <LoadingState label="Loading results..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/student">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Results</h1>
        <p className="text-muted-foreground">
          View your exam performance and progress
        </p>
      </div>

      {/* Performance Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Exams Completed</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{completedAttempts.length}</div>
            <p className="text-xs text-muted-foreground">
              Total attempts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {averageScore.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall performance
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Best Score</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {bestScore.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Highest achievement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Time Spent</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {Math.floor(totalTimeSpent / 60)}h
            </div>
            <p className="text-xs text-muted-foreground">
              Total exam time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Overview
          </CardTitle>
          <CardDescription>
            Your progress across different performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Average Performance</span>
                <span>{averageScore.toFixed(1)}%</span>
              </div>
              <Progress value={averageScore} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Best Performance</span>
                <span>{bestScore.toFixed(1)}%</span>
              </div>
              <Progress value={bestScore} className="h-2" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Completion Rate</span>
                <span>100%</span>
              </div>
              <Progress value={100} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Exam Results
          </CardTitle>
          <CardDescription>
            Detailed breakdown of your exam performances
          </CardDescription>
        </CardHeader>
        <CardContent>
          {completedAttempts.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Time Taken</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {completedAttempts.map((attempt) => {
                    const examTitle = typeof attempt.examId === 'object' ? attempt.examId.title : 'Untitled Exam'
                    const examTotalMarks = typeof attempt.examId === 'object' ? attempt.examId.totalMarks : 100
                    return (
                      <TableRow key={attempt._id}>
                        <TableCell className="font-medium">
                          {examTitle}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(attempt.endTime!).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{attempt.score}</span>
                          <span className="text-muted-foreground">/{examTotalMarks}</span>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{attempt.percentage?.toFixed(1)}%</span>
                        </TableCell>
                        <TableCell>
                          {getGradeBadge(attempt.percentage || 0)}
                        </TableCell>
                        <TableCell>
                          {getPerformanceBadge(attempt.percentage || 0)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {Math.floor(attempt.timeSpent / 60)}m {attempt.timeSpent % 60}s
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={Trophy}
              title="No Results Yet"
              description="Complete your first exam to see results here."
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}