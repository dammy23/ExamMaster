import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { LoadingState } from "@/components/ui/loading-state"
import { ArrowLeft } from "lucide-react"
import { ExamForm, type ExamFormData, type ExamPayload } from "@/components/admin/ExamForm"
import { getExamById, updateExam } from "@/api/exams"
import { useToast } from "@/hooks/useToast"

export function EditExam() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [fetchingExam, setFetchingExam] = useState(true)
  const [initialValues, setInitialValues] = useState<Partial<ExamFormData> | null>(null)

  useEffect(() => {
    if (id) {
      fetchExam()
    }
  }, [id])

  const fetchExam = async () => {
    try {
      const response = await getExamById(id!)
      const exam = response.exam

      const startDate = new Date(exam.startDate).toISOString().slice(0, 16)
      const endDate = new Date(exam.endDate).toISOString().slice(0, 16)

      setInitialValues({
        title: exam.title,
        description: exam.description || '',
        subject: typeof exam.subject === 'string' ? exam.subject : exam.subject._id,
        duration: exam.duration,
        startDate,
        endDate,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        instructions: exam.instructions || '',
        allowReview: exam.allowReview,
        showResultsImmediately: exam.showResultsImmediately,
        randomizeQuestions: exam.randomizeQuestions,
        randomizeOptions: exam.randomizeOptions,
        negativeMarking: exam.negativeMarking,
        negativeMarkingValue: exam.negativeMarkingValue,
        unlimitedAttempts: exam.maxAttempts === 0,
        maxAttempts: exam.maxAttempts === 0 ? 1 : exam.maxAttempts,
        useRandomQuestions: exam.questionsPerExam ? true : false,
        questionsPerExam: exam.questionsPerExam || undefined,
        videoRecording: exam.videoRecording || false,
        mobileEnabled: exam.mobileEnabled || false,
        assignedGroups: exam.assignedGroups || []
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load exam",
        variant: "destructive"
      })
      navigate("/admin/exams")
    } finally {
      setFetchingExam(false)
    }
  }

  const handleUpdate = async (payload: ExamPayload) => {
    setLoading(true)
    try {
      await updateExam(id!, payload)

      toast({
        title: "Success",
        description: "Exam updated successfully"
      })

      navigate("/admin/exams")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update exam",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  if (fetchingExam) {
    return <LoadingState label="Loading exam..." />
  }

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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Exam</h1>
          <p className="text-muted-foreground">
            Update examination details and settings
          </p>
        </div>
      </div>

      {initialValues && (
        <ExamForm mode="edit" initialValues={initialValues} onSubmit={handleUpdate} submitting={loading} />
      )}
    </div>
  )
}
