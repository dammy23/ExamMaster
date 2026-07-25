import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { ExamForm, type ExamPayload } from "@/components/admin/ExamForm"
import { createExam } from "@/api/exams"
import { useToast } from "@/hooks/useToast"

export function CreateExam() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)

  const estimatePayloadSize = (data: any) => {
    const jsonString = JSON.stringify(data)
    const sizeInBytes = new Blob([jsonString]).size
    const sizeInMB = sizeInBytes / (1024 * 1024)
    return { sizeInBytes, sizeInMB }
  }

  const handleCreate = async (payload: ExamPayload) => {
    setLoading(true)
    try {
      const examData = {
        ...payload,
        status: 'draft' as const,
        totalQuestions: 0,
        assignedStudents: [],
        questions: []
      }

      const { sizeInMB } = estimatePayloadSize(examData)

      if (sizeInMB > 8) {
        const confirmed = confirm(
          `The exam data is quite large (${sizeInMB.toFixed(2)} MB) due to embedded images. ` +
          'This might cause upload issues. Do you want to continue?\n\n' +
          'Tip: Consider reducing image sizes or removing some images to reduce the payload size.'
        )
        if (!confirmed) {
          setLoading(false)
          return
        }
      }

      await createExam(examData)

      toast({
        title: "Success",
        description: "Exam created successfully"
      })

      navigate("/admin/exams")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create exam",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Create New Exam</h1>
          <p className="text-muted-foreground">
            Set up a new examination with custom settings
          </p>
        </div>
      </div>

      <ExamForm mode="create" onSubmit={handleCreate} submitting={loading} />
    </div>
  )
}
