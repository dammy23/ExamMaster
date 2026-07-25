import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, FileText, Plus } from "lucide-react"
import { ExamSelectionModal } from "./ExamSelectionModal"
import { CreateExamModal } from "./CreateExamModal"
import { useToast } from "@/hooks/useToast"
import { LoadingState } from "@/components/ui/loading-state"

interface Question {
  tempId: string
  type: string
  question: string
  options: string[]
  correctAnswers: string[]
  explanation: string
  marks: number
  difficulty: string
}

interface AIChatQuestionAssignmentProps {
  questions: Question[]
  onAssignmentComplete: () => void
  onCancel?: () => void
}

export function AIChatQuestionAssignment({
  questions,
  onAssignmentComplete,
  onCancel
}: AIChatQuestionAssignmentProps) {
  const [step, setStep] = useState<'ask' | 'select-option' | 'select-exam' | 'create-exam' | 'completed'>('ask')
  const [showExamModal, setShowExamModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const { toast } = useToast()

  const handleYesAssignment = () => {
    setStep('select-option')
  }

  const handleNoAssignment = () => {
    onAssignmentComplete()
  }

  const handleExistingExam = () => {
    setStep('select-exam')
    setShowExamModal(true)
  }

  const handleNewExam = () => {
    setStep('create-exam')
    setShowCreateModal(true)
  }

  const handleExamSelected = async (examId: string, examTitle: string) => {
    setShowExamModal(false)
    setAssigning(true)

    try {
      // Import the API function here to avoid circular dependencies
      const { assignQuestionsToExam } = await import('@/api/exams')

      // First, we need to create the questions in the database
      const { createQuestionsWithAI } = await import('@/api/aiChat')

      const createResult = await createQuestionsWithAI({ questions })

      if (createResult.questions && createResult.questions.length > 0) {
        const questionIds = createResult.questions.map((q: any) => q._id)

        await assignQuestionsToExam(examId, questionIds)

        toast({
          title: "Questions Assigned Successfully",
          description: `${createResult.questions.length} questions have been assigned to "${examTitle}".`
        })

        setStep('completed')
        setTimeout(() => onAssignmentComplete(), 1500)
      } else {
        throw new Error('Failed to create questions in database')
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Assigning Questions",
        description: (error as any)?.message || "Failed to assign questions to exam"
      })
      setStep('select-option') // Go back to selection
    } finally {
      setAssigning(false)
    }
  }

  const handleExamCreated = async (exam: any) => {
    setShowCreateModal(false)
    setAssigning(true)

    try {
      // First, we need to create the questions in the database
      const { createQuestionsWithAI } = await import('@/api/aiChat')

      const createResult = await createQuestionsWithAI({ questions })

      if (createResult.questions && createResult.questions.length > 0) {
        const questionIds = createResult.questions.map((q: any) => q._id)

        // Import the API function here to avoid circular dependencies
        const { assignQuestionsToExam } = await import('@/api/exams')

        await assignQuestionsToExam(exam._id, questionIds)

        toast({
          title: "Exam Created and Questions Assigned",
          description: `"${exam.title}" has been created with ${createResult.questions.length} questions.`
        })

        setStep('completed')
        setTimeout(() => onAssignmentComplete(), 1500)
      } else {
        throw new Error('Failed to create questions in database')
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Creating Exam",
        description: (error as any)?.message || "Failed to create exam and assign questions"
      })
      setStep('select-option') // Go back to selection
    } finally {
      setAssigning(false)
    }
  }

  const handleModalClose = () => {
    if (!assigning) {
      setShowExamModal(false)
      setShowCreateModal(false)
      setStep('select-option')
    }
  }

  if (step === 'completed') {
    return (
      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2 text-status-success-foreground">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Questions assigned successfully!</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === 'ask') {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Question Assignment
          </CardTitle>
          <CardDescription>
            Would you like to assign these {questions.length} generated questions to an exam?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button onClick={handleYesAssignment}>
              Yes, assign to exam
            </Button>
            <Button variant="outline" onClick={handleNoAssignment}>
              No, just save questions
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === 'select-option') {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Choose Assignment Option
          </CardTitle>
          <CardDescription>
            Would you like to assign questions to an existing exam or create a new one?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button onClick={handleExistingExam} disabled={assigning}>
              <FileText className="h-4 w-4 mr-2" />
              Select existing exam
            </Button>
            <Button onClick={handleNewExam} disabled={assigning} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create new exam
            </Button>
            {onCancel && (
              <Button variant="ghost" onClick={onCancel} disabled={assigning}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="mt-4">
        <CardContent className="pt-6">
          <LoadingState
            label={assigning ? 'Assigning questions...' : 'Please complete the assignment process'}
            className="py-2"
          />
        </CardContent>
      </Card>

      {showExamModal && (
        <ExamSelectionModal
          open={showExamModal}
          onClose={handleModalClose}
          onExamSelected={handleExamSelected}
          disabled={assigning}
        />
      )}

      {showCreateModal && (
        <CreateExamModal
          open={showCreateModal}
          onClose={handleModalClose}
          onExamCreated={handleExamCreated}
          disabled={assigning}
        />
      )}
    </>
  )
}