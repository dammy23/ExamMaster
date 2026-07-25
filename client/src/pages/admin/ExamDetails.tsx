import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ArrowLeft, Edit, Users, Clock, FileText, Calendar, Settings, Target, ChevronDown } from "lucide-react"
import { getExamById, updateExam, type Exam } from "@/api/exams"
import { getAvailableStatusActions } from "@/lib/examStatus"
import { useToast } from "@/hooks/useToast"

export function ExamDetails() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [exam, setExam] = useState<Exam | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchExam()
    }
  }, [id])

  const fetchExam = async () => {
    try {
      const response = await getExamById(id!)
      setExam(response.exam)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load exam details",
        variant: "destructive"
      })
      navigate("/admin/exams")
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (nextStatus: Exam['status']) => {
    if (!exam) return
    try {
      const response = await updateExam(exam._id, { status: nextStatus })
      setExam(response.exam)
      toast({
        title: "Success",
        description: "Exam status updated"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update exam status",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return <LoadingState label="Loading exam..." />
  }

  if (!exam) {
    return (
      <EmptyState
        title="Exam not found"
        description="The exam you're looking for doesn't exist or you don't have access to it."
        action={{ label: "Back to Exams", onClick: () => navigate("/admin/exams") }}
      />
    )
  }

  const statusActions = getAvailableStatusActions(exam.status)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin/exams")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{exam.title}</h1>
          <p className="text-muted-foreground">
            Detailed examination information and statistics
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/admin/exams/${exam._id}/questions`)}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Manage Questions
          </Button>
          <Button
            onClick={() => navigate(`/admin/exams/edit/${exam._id}`)}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            Edit Exam
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusBadge status={exam.status} />
            {statusActions.length === 1 && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => handleStatusChange(statusActions[0].nextStatus)}
              >
                {statusActions[0].label}
              </Button>
            )}
            {statusActions.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="w-full gap-1">
                    Change Status
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {statusActions.map((action) => (
                    <DropdownMenuItem
                      key={action.nextStatus}
                      onSelect={() => handleStatusChange(action.nextStatus)}
                    >
                      {action.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exam.duration}</div>
            <p className="text-xs text-muted-foreground">minutes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exam.totalQuestions}</div>
            <p className="text-xs text-muted-foreground">questions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{exam.assignedStudents.length}</div>
            <p className="text-xs text-muted-foreground">students</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Subject</label>
              <p className="text-sm mt-1">{exam.subject?.name || 'No subject'}</p>
            </div>

            {exam.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <div className="text-sm mt-1" dangerouslySetInnerHTML={{ __html: exam.description }} />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-muted-foreground">Created</label>
              <p className="text-sm mt-1">{new Date(exam.createdAt).toLocaleString()}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Last Updated</label>
              <p className="text-sm mt-1">{new Date(exam.updatedAt).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* Schedule & Timing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Schedule & Timing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Start Date & Time</label>
              <p className="text-sm mt-1">{new Date(exam.startDate).toLocaleString()}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">End Date & Time</label>
              <p className="text-sm mt-1">{new Date(exam.endDate).toLocaleString()}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Duration</label>
              <p className="text-sm mt-1">{exam.duration} minutes</p>
            </div>
          </CardContent>
        </Card>

        {/* Scoring Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Scoring Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Total Marks</label>
                <p className="text-sm mt-1 font-semibold">{exam.totalMarks}</p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">Passing Marks</label>
                <p className="text-sm mt-1 font-semibold">{exam.passingMarks}</p>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">Negative Marking</label>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={exam.negativeMarking ? "destructive" : "secondary"}>
                  {exam.negativeMarking ? 'Enabled' : 'Disabled'}
                </Badge>
                {exam.negativeMarking && (
                  <span className="text-sm text-muted-foreground">
                    -{exam.negativeMarkingValue} marks per incorrect answer
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exam Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Exam Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Allow Review</span>
                <Badge variant={exam.allowReview ? "default" : "secondary"}>
                  {exam.allowReview ? 'Yes' : 'No'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Show Results Immediately</span>
                <Badge variant={exam.showResultsImmediately ? "default" : "secondary"}>
                  {exam.showResultsImmediately ? 'Yes' : 'No'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Randomize Questions</span>
                <Badge variant={exam.randomizeQuestions ? "default" : "secondary"}>
                  {exam.randomizeQuestions ? 'Yes' : 'No'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm">Randomize Options</span>
                <Badge variant={exam.randomizeOptions ? "default" : "secondary"}>
                  {exam.randomizeOptions ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Instructions */}
      {exam.instructions && (
        <Card>
          <CardHeader>
            <CardTitle>Instructions for Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: exam.instructions }} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
