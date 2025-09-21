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
  Award,
  BookOpen,
  CheckCircle,
  AlertTriangle
} from "lucide-react"
import {
  getExamReports,
  getStudentPerformanceReports,
  getQuestionAnalysis,
  getExamStudentScores,
  getExamPerformanceAnalysis,
  exportReport,
  type ExamReport,
  type StudentPerformance,
  type QuestionAnalysis,
  type ExamStudentReport,
  type PerformanceAnalysis
} from "@/api/reports"
import { getExams, type Exam } from "@/api/exams"
import { useToast } from "@/hooks/useToast"

export function Reports() {
  const [examReports, setExamReports] = useState<ExamReport[]>([])
  const [studentPerformances, setStudentPerformances] = useState<StudentPerformance[]>([])
  const [questionAnalysis, setQuestionAnalysis] = useState<QuestionAnalysis[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [selectedExam, setSelectedExam] = useState<string>("all")
  const [examStudentReport, setExamStudentReport] = useState<ExamStudentReport | null>(null)
  const [performanceAnalysis, setPerformanceAnalysis] = useState<PerformanceAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingExamData, setLoadingExamData] = useState(false)
  const [selectedReport, setSelectedReport] = useState("exam-overview")
  const { toast } = useToast()

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      console.log('Fetching reports...')
      const [examResponse, studentResponse, questionResponse, examsResponse] = await Promise.all([
        getExamReports(),
        getStudentPerformanceReports(),
        getQuestionAnalysis(),
        getExams()
      ])

      setExamReports((examResponse as any).reports)
      setStudentPerformances((studentResponse as any).performances)
      setQuestionAnalysis((questionResponse as any).analysis)
      setExams((examsResponse as any).exams || [])
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

  const fetchExamSpecificData = async (examId: string) => {
    if (!examId || examId === "all") return

    setLoadingExamData(true)
    try {
      console.log('Fetching exam-specific data for exam:', examId)
      const [studentScoresResponse, analysisResponse] = await Promise.all([
        getExamStudentScores(examId),
        getExamPerformanceAnalysis(examId)
      ])

      setExamStudentReport(studentScoresResponse)
      setPerformanceAnalysis(analysisResponse.analysis)
    } catch (error) {
      console.error('Error fetching exam-specific data:', error)
      toast({
        title: "Error",
        description: "Failed to load exam data",
        variant: "destructive"
      })
    } finally {
      setLoadingExamData(false)
    }
  }

  useEffect(() => {
    if (selectedExam && selectedExam !== "all") {
      fetchExamSpecificData(selectedExam)
    } else {
      // Clear exam-specific data when "all" is selected
      setExamStudentReport(null)
      setPerformanceAnalysis(null)
    }
  }, [selectedExam])

  // Separate effect to reset report type to avoid dependency issues
  useEffect(() => {
    if (selectedExam === "all" && (selectedReport === "exam-students" || selectedReport === "exam-analysis")) {
      setSelectedReport("exam-overview")
    }
  }, [selectedExam, selectedReport])

  const handleExportReport = async (format: 'pdf' | 'csv') => {
    try {
      console.log('Exporting report:', selectedReport, format, 'for exam:', selectedExam)
      const examIdToUse = selectedExam === "all" ? undefined : selectedExam
      const response = await exportReport(selectedReport, examIdToUse, format)
      const result = response as any

      toast({
        title: "Export Complete",
        description: `Report exported successfully as ${format.toUpperCase()}`
      })

      // In a real app, this would trigger a download
      window.open(result.downloadUrl, '_blank')
    } catch (error: any) {
      console.error('Error exporting report:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to export report",
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
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedExam} onValueChange={setSelectedExam}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select an exam for detailed analysis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Exams Overview</SelectItem>
              {exams.map((exam) => (
                <SelectItem key={exam._id} value={exam._id}>
                  {exam.title} ({exam.subject.name})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedReport} onValueChange={setSelectedReport}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="exam-overview">Exam Overview</SelectItem>
              <SelectItem value="student-performance">Student Performance</SelectItem>
              <SelectItem value="question-analysis">Question Analysis</SelectItem>
              {selectedExam && selectedExam !== "all" && (
                <>
                  <SelectItem value="exam-students">Student Scores</SelectItem>
                  <SelectItem value="exam-analysis">Performance Analysis</SelectItem>
                </>
              )}
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

      {/* Individual Student Scores for Selected Exam */}
      {selectedReport === "exam-students" && selectedExam && selectedExam !== "all" && examStudentReport && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Student Scores - {examStudentReport.exam.title}
            </CardTitle>
            <CardDescription>
              Individual student performance for the selected exam
            </CardDescription>
            {loadingExamData && (
              <div className="flex items-center justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {/* Exam Info */}
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Subject</p>
                  <p className="text-lg font-semibold">{examStudentReport.exam.subject}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Marks</p>
                  <p className="text-lg font-semibold">{examStudentReport.exam.totalMarks}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Passing Marks</p>
                  <p className="text-lg font-semibold">{examStudentReport.exam.passingMarks}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Duration</p>
                  <p className="text-lg font-semibold">{examStudentReport.exam.duration} min</p>
                </div>
              </div>
            </div>

            {/* Exam Statistics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700">{examStudentReport.statistics.totalStudents}</div>
                  <p className="text-sm text-blue-600">Total Students</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">{examStudentReport.statistics.passedStudents}</div>
                  <p className="text-sm text-green-600">Passed</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-700">{examStudentReport.statistics.failedStudents}</div>
                  <p className="text-sm text-red-600">Failed</p>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-700">{examStudentReport.statistics.passRate.toFixed(1)}%</div>
                  <p className="text-sm text-orange-600">Pass Rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Students Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Time Spent</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tab Switches</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {examStudentReport.studentScores.map((student, index) => (
                    <TableRow key={student.studentId}>
                      <TableCell className="font-medium">{student.studentName}</TableCell>
                      <TableCell className="text-muted-foreground">{student.studentEmail}</TableCell>
                      <TableCell className="font-medium">{student.score}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={student.percentage} className="w-16 h-2" />
                          <span className="text-sm">{student.percentage.toFixed(1)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {student.timeSpent}m
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={student.status === 'completed' ? 'default' : 'secondary'}>
                          {student.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {student.tabSwitches > 0 && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {student.tabSwitches}
                          </Badge>
                        )}
                        {student.tabSwitches === 0 && (
                          <Badge variant="outline" className="gap-1">
                            <CheckCircle className="h-3 w-3" />
                            0
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={student.isPassed ? 'default' : 'destructive'}>
                          {student.isPassed ? 'Passed' : 'Failed'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Analysis for Selected Exam */}
      {selectedReport === "exam-analysis" && selectedExam && selectedExam !== "all" && performanceAnalysis && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Analysis - {performanceAnalysis.examInfo.title}
              </CardTitle>
              <CardDescription>
                Comprehensive performance analysis for the selected exam
              </CardDescription>
              {loadingExamData && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {/* Exam Overview */}
              <div className="mb-6 p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Subject</p>
                    <p className="font-semibold">{performanceAnalysis.examInfo.subject}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Questions</p>
                    <p className="font-semibold">{performanceAnalysis.examInfo.totalQuestions}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Marks</p>
                    <p className="font-semibold">{performanceAnalysis.examInfo.totalMarks}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Passing</p>
                    <p className="font-semibold">{performanceAnalysis.examInfo.passingMarks}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Duration</p>
                    <p className="font-semibold">{performanceAnalysis.examInfo.duration}m</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Attempts</p>
                    <p className="font-semibold">{performanceAnalysis.overallStats.totalAttempts}</p>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-purple-700">{performanceAnalysis.overallStats.averageScore.toFixed(1)}%</div>
                    <p className="text-sm text-purple-600">Average Score</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">{performanceAnalysis.overallStats.highestScore}%</div>
                    <p className="text-sm text-green-600">Highest Score</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">{performanceAnalysis.overallStats.passRate.toFixed(1)}%</div>
                    <p className="text-sm text-blue-600">Pass Rate</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-700">{performanceAnalysis.overallStats.averageTimeSpent}m</div>
                    <p className="text-sm text-orange-600">Avg Time</p>
                  </CardContent>
                </Card>
              </div>

              {/* Score Distribution */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Score Distribution
                </h3>
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                  {Object.entries(performanceAnalysis.scoreDistribution).map(([range, count]) => (
                    <Card key={range} className="text-center">
                      <CardContent className="p-4">
                        <div className="text-xl font-bold text-primary">{count}</div>
                        <p className="text-sm text-muted-foreground">{range}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Question Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Question-wise Analysis
              </CardTitle>
              <CardDescription>
                Performance breakdown by individual questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Question</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Marks</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Correct</TableHead>
                      <TableHead>Success Rate</TableHead>
                      <TableHead>Difficulty</TableHead>
                      <TableHead>Avg Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {performanceAnalysis.questionAnalysis.map((question, index) => (
                      <TableRow key={question.questionId}>
                        <TableCell className="max-w-md">
                          <div className="truncate font-medium">
                            {question.questionText}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{question.type}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{question.marks}</TableCell>
                        <TableCell>{question.totalAttempts}</TableCell>
                        <TableCell className="text-green-600 font-medium">{question.correctAnswers}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress
                              value={question.successRate}
                              className="w-16 h-2"
                            />
                            <span className="text-sm font-medium">
                              {question.successRate.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${getDifficultyColor(question.difficultyRating)}`}>
                            {question.difficultyRating.toFixed(1)}/5
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {question.averageTimeSpent}s
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}