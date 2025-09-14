import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import {
  BarChart3,
  Download,
  FileText,
  TrendingUp,
  Users,
  Target,
  Clock,
  Award
} from "lucide-react"
import {
  getExamReports,
  getStudentPerformanceReports,
  getQuestionAnalysis,
  exportReport,
  type ExamReport,
  type StudentPerformance,
  type QuestionAnalysis
} from "@/api/reports"
import { useToast } from "@/hooks/useToast"

export function Reports() {
  const [examReports, setExamReports] = useState<ExamReport[]>([])
  const [studentPerformances, setStudentPerformances] = useState<StudentPerformance[]>([])
  const [questionAnalysis, setQuestionAnalysis] = useState<QuestionAnalysis[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedReport, setSelectedReport] = useState("exam-overview")
  const { toast } = useToast()

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      console.log('Fetching reports...')
      const [examResponse, studentResponse, questionResponse] = await Promise.all([
        getExamReports(),
        getStudentPerformanceReports(),
        getQuestionAnalysis()
      ])

      setExamReports((examResponse as any).reports)
      setStudentPerformances((studentResponse as any).performances)
      setQuestionAnalysis((questionResponse as any).analysis)
    } catch (error) {
      console.error('Error fetching reports:', error)
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportReport = async (format: 'pdf' | 'csv') => {
    try {
      console.log('Exporting report:', selectedReport, format)
      const response = await exportReport(selectedReport, undefined, format)
      const result = response as any

      toast({
        title: "Export Complete",
        description: `Report exported successfully as ${format.toUpperCase()}`
      })

      // In a real app, this would trigger a download
      window.open(result.downloadUrl, '_blank')
    } catch (error) {
      console.error('Error exporting report:', error)
      toast({
        title: "Error",
        description: "Failed to export report",
        variant: "destructive"
      })
    }
  }

  const getPassRateBadge = (rate: number) => {
    if (rate >= 90) return <Badge className="bg-green-600">Excellent</Badge>
    if (rate >= 80) return <Badge className="bg-blue-500">Good</Badge>
    if (rate >= 70) return <Badge className="bg-yellow-500">Average</Badge>
    return <Badge className="bg-red-500">Needs Attention</Badge>
  }

  const getDifficultyColor = (rating: number) => {
    if (rating <= 2) return "text-green-600"
    if (rating <= 3) return "text-yellow-600"
    return "text-red-600"
  }

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
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights into exam performance and student progress
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedReport} onValueChange={setSelectedReport}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exam-overview">Exam Overview</SelectItem>
              <SelectItem value="student-performance">Student Performance</SelectItem>
              <SelectItem value="question-analysis">Question Analysis</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => handleExportReport('pdf')} className="gap-2">
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
          <Button variant="outline" onClick={() => handleExportReport('csv')} className="gap-2">
            <FileText className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Exams</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{examReports.length}</div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Conducted this semester
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Pass Rate</CardTitle>
            <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {examReports.length > 0 
                ? (examReports.reduce((sum, report) => sum + report.passRate, 0) / examReports.length).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-green-600 dark:text-green-400">
              Across all exams
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Students</CardTitle>
            <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{studentPerformances.length}</div>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              Taking exams
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <Award className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
              {examReports.length > 0 
                ? (examReports.reduce((sum, report) => sum + report.averageScore, 0) / examReports.length).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              Overall performance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Report Content */}
      {selectedReport === "exam-overview" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Exam Performance Overview
            </CardTitle>
            <CardDescription>
              Detailed statistics for each exam conducted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Exam</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Average Score</TableHead>
                    <TableHead>Pass Rate</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Avg Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examReports.map((report) => (
                    <TableRow key={report.examId}>
                      <TableCell className="font-medium">{report.examTitle}</TableCell>
                      <TableCell>{report.totalStudents}</TableCell>
                      <TableCell>{report.completedAttempts}</TableCell>
                      <TableCell>{report.averageScore.toFixed(1)}%</TableCell>
                      <TableCell>{report.passRate.toFixed(1)}%</TableCell>
                      <TableCell>{getPassRateBadge(report.passRate)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {report.averageTimeSpent}m
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedReport === "student-performance" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Student Performance Analysis
            </CardTitle>
            <CardDescription>
              Individual student performance metrics and insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Exams Taken</TableHead>
                    <TableHead>Average Score</TableHead>
                    <TableHead>Best Score</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Strengths</TableHead>
                    <TableHead>Areas to Improve</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentPerformances.map((performance) => (
                    <TableRow key={performance.studentId}>
                      <TableCell className="font-medium">{performance.studentName}</TableCell>
                      <TableCell>{performance.totalExams}</TableCell>
                      <TableCell>{performance.averageScore.toFixed(1)}%</TableCell>
                      <TableCell>{performance.bestScore.toFixed(1)}%</TableCell>
                      <TableCell>
                        <Progress value={performance.averageScore} className="w-16 h-2" />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {performance.strengths.slice(0, 2).map((strength, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {strength}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {performance.weaknesses.slice(0, 2).map((weakness, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {weakness}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedReport === "question-analysis" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Question Difficulty Analysis
            </CardTitle>
            <CardDescription>
              Analyze question performance and difficulty ratings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Correct</TableHead>
                    <TableHead>Success Rate</TableHead>
                    <TableHead>Difficulty</TableHead>
                    <TableHead>Avg Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questionAnalysis.map((analysis) => (
                    <TableRow key={analysis.questionId}>
                      <TableCell className="max-w-md">
                        <div className="truncate font-medium">
                          {analysis.question}
                        </div>
                      </TableCell>
                      <TableCell>{analysis.totalAttempts}</TableCell>
                      <TableCell>{analysis.correctAnswers}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={(analysis.correctAnswers / analysis.totalAttempts) * 100} 
                            className="w-16 h-2" 
                          />
                          <span className="text-sm">
                            {((analysis.correctAnswers / analysis.totalAttempts) * 100).toFixed(1)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${getDifficultyColor(analysis.difficultyRating)}`}>
                          {analysis.difficultyRating.toFixed(1)}/5
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {analysis.averageTimeSpent}s
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}