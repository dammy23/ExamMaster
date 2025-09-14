import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
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
  BookOpen
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
      console.log('Fetching student results...')
      const response = await getStudentExamAttempts()
      setAttempts((response as any).attempts)
    } catch (error) {
      console.error('Error fetching results:', error)
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
    if (percentage >= 90) return <Badge className="bg-green-600">A+</Badge>
    if (percentage >= 80) return <Badge className="bg-green-500">A</Badge>
    if (percentage >= 70) return <Badge className="bg-blue-500">B</Badge>
    if (percentage >= 60) return <Badge className="bg-yellow-500">C</Badge>
    if (percentage >= 50) return <Badge className="bg-orange-500">D</Badge>
    return <Badge variant="destructive">F</Badge>
  }

  const getPerformanceBadge = (percentage: number) => {
    if (percentage >= 85) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Excellent</Badge>
    if (percentage >= 70) return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Good</Badge>
    if (percentage >= 60) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Average</Badge>
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Needs Improvement</Badge>
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Results</h1>
        <p className="text-muted-foreground">
          View your exam performance and progress
        </p>
      </div>

      {/* Performance Summary */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exams Completed</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{completedAttempts.length}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Total attempts
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {averageScore.toFixed(1)}%
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">
              Overall performance
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Best Score</CardTitle>
            <Trophy className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
              {bestScore.toFixed(1)}%
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Highest achievement
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
              {Math.floor(totalTimeSpent / 60)}h
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400">
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
                  {completedAttempts.map((attempt) => (
                    <TableRow key={attempt._id}>
                      <TableCell className="font-medium">
                        Mathematics Final Exam {/* This would come from exam data */}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(attempt.endTime!).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{attempt.score}</span>
                        <span className="text-muted-foreground">/100</span>
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
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Results Yet</h3>
              <p className="text-muted-foreground">
                Complete your first exam to see results here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}