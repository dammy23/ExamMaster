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
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { StatusBadge } from "@/components/ui/status-badge"
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
  getQuestionAnalysis,
  getExamStudentScores,
  getExamPerformanceAnalysis,
  exportReport,
  triggerFileDownload,
  type ExamReport,
  type QuestionAnalysis,
  type ExamStudentReport,
  type PerformanceAnalysis
} from "@/api/reports"
import { getExams, type Exam } from "@/api/exams"
import { generateReactPDF } from "@/api/pdfExport"
import { exportReportAsCSV } from "@/utils/csvExport"
import { useToast } from "@/hooks/useToast"

export function Reports() {
  const [examReports, setExamReports] = useState<ExamReport[]>([])
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
      const [examResponse, examsResponse] = await Promise.all([
        getExamReports(),
        getExams()
      ])

      setExamReports((examResponse as any).reports)
      setExams((examsResponse as any).exams || [])

      // Fetch question analysis with current exam filter
      await fetchQuestionAnalysis()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load reports",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchQuestionAnalysis = async () => {
    try {
      const examIdForAnalysis = selectedExam === "all" ? undefined : selectedExam
      const questionResponse = await getQuestionAnalysis(examIdForAnalysis)
      setQuestionAnalysis((questionResponse as any).analysis)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load question analysis",
        variant: "destructive"
      })
    }
  }

  const fetchExamSpecificData = async (examId: string) => {
    if (!examId || examId === "all") return

    setLoadingExamData(true)
    try {
      const [studentScoresResponse, analysisResponse] = await Promise.all([
        getExamStudentScores(examId),
        getExamPerformanceAnalysis(examId)
      ])

      setExamStudentReport(studentScoresResponse)
      setPerformanceAnalysis(analysisResponse.analysis)
    } catch (error) {
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

    // Refresh question analysis when exam selection changes
    fetchQuestionAnalysis()
  }, [selectedExam])

  // Separate effect to reset report type to avoid dependency issues
  useEffect(() => {
    if (selectedExam === "all" && (selectedReport === "exam-students" || selectedReport === "exam-analysis")) {
      setSelectedReport("exam-overview")
    }
  }, [selectedExam, selectedReport])

  const handleExportReport = async (format: 'pdf' | 'csv') => {
    try {
      if (format === 'csv') {
        // Use client-side CSV export
        exportReportAsCSV(selectedReport, {
          examReports,
          questionAnalysis,
          examStudentReport,
          performanceAnalysis
        })

        toast({
          title: "Export Complete",
          description: "Report exported successfully as CSV"
        })
      } else if (format === 'pdf') {
        // Use React PDF rendering
        const reportData = {
          selectedReport,
          selectedExam,
          examReports,
          questionAnalysis,
          examStudentReport,
          performanceAnalysis,
          exams,
          generatedAt: new Date().toISOString()
        }

        const response = await generateReactPDF(reportData, selectedReport)
        const result = response as any

        toast({
          title: "Export Complete",
          description: "Report exported successfully as PDF"
        })

        // Trigger authenticated download using the secure URL
        triggerFileDownload(result.downloadUrl, result.filename || `report.pdf`)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to export report",
        variant: "destructive"
      })
    }
  }

  const getPassRateBadge = (rate: number) => {
    if (rate >= 90) return <Badge className="bg-status-success text-status-success-foreground">Excellent</Badge>
    if (rate >= 80) return <Badge className="bg-status-info text-status-info-foreground">Good</Badge>
    if (rate >= 70) return <Badge className="bg-status-warning text-status-warning-foreground">Average</Badge>
    return <Badge className="bg-status-danger text-status-danger-foreground">Needs Attention</Badge>
  }

  const getDifficultyColor = (rating: number | null | undefined) => {
    if (!rating || rating <= 2) return "text-status-success-foreground"
    if (rating <= 3) return "text-status-warning-foreground"
    return "text-status-danger-foreground"
  }

  if (loading) {
    return <LoadingState label="Loading reports..." />
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Exams</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{examReports.length}</div>
            <p className="text-xs text-muted-foreground">
              Conducted this semester
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Pass Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {examReports.length > 0
                ? (examReports.reduce((sum, report) => sum + report.passRate, 0) / examReports.length).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Across all exams
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Questions</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{questionAnalysis.length}</div>
            <p className="text-xs text-muted-foreground">
              Analyzed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Score</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {examReports.length > 0
                ? (examReports.reduce((sum, report) => sum + report.averageScore, 0) / examReports.length).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
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
            {examReports.length > 0 ? (
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
                    {examReports.map((report, index) => (
                      <TableRow key={`exam-report-${report.examId}-${index}`}>
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
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No exam data yet"
                description="Reports will appear once exams have been conducted."
              />
            )}
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
            {questionAnalysis.length > 0 ? (
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
                    {questionAnalysis.map((analysis, index) => (
                      <TableRow key={`question-analysis-${analysis.questionId}-${index}`}>
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
                          <span className={`font-medium ${getDifficultyColor(analysis.difficultyRating || 0)}`}>
                            {analysis.difficultyRating ? analysis.difficultyRating.toFixed(1) : 'N/A'}/5
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
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No question data yet"
                description="Question analysis will appear once students have attempted questions."
              />
            )}
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
              <LoadingState label="Loading exam data..." className="py-4" />
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
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{examStudentReport.statistics.totalStudents}</div>
                  <p className="text-sm text-muted-foreground">Total Students</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-status-success-foreground">{examStudentReport.statistics.passedStudents}</div>
                  <p className="text-sm text-muted-foreground">Passed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-status-danger-foreground">{examStudentReport.statistics.failedStudents}</div>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold">{examStudentReport.statistics.passRate.toFixed(1)}%</div>
                  <p className="text-sm text-muted-foreground">Pass Rate</p>
                </CardContent>
              </Card>
            </div>

            {/* Students Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Group</TableHead>
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
                    <TableRow key={`student-score-${student.studentId}-${index}`}>
                      <TableCell className="font-medium">{student.studentName}</TableCell>
                      <TableCell className="text-muted-foreground">{student.studentIdNumber}</TableCell>
                      <TableCell className="text-muted-foreground">{student.studentGroup}</TableCell>
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
                        <StatusBadge status={student.isPassed ? 'passed' : 'failed'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedReport === "exam-students" && selectedExam && selectedExam !== "all" && !loadingExamData && !examStudentReport && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={Users}
              title="No attempts yet"
              description="Student scores will appear once this exam has been attempted."
            />
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
                <LoadingState label="Loading exam data..." className="py-4" />
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
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{performanceAnalysis.overallStats.averageScore.toFixed(1)}%</div>
                    <p className="text-sm text-muted-foreground">Average Score</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{performanceAnalysis.overallStats.highestScore}%</div>
                    <p className="text-sm text-muted-foreground">Highest Score</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{performanceAnalysis.overallStats.passRate.toFixed(1)}%</div>
                    <p className="text-sm text-muted-foreground">Pass Rate</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold">{performanceAnalysis.overallStats.averageTimeSpent}m</div>
                    <p className="text-sm text-muted-foreground">Avg Time</p>
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
                      <TableRow key={`performance-question-${question.questionId}-${index}`}>
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
                          <span className={`font-medium ${getDifficultyColor(question.difficultyRating || 0)}`}>
                            {question.difficultyRating ? question.difficultyRating.toFixed(1) : 'N/A'}/5
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

      {selectedReport === "exam-analysis" && selectedExam && selectedExam !== "all" && !loadingExamData && !performanceAnalysis && (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={BarChart3}
              title="No attempts yet"
              description="Performance analysis will appear once this exam has been attempted."
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}