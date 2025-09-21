import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, FileText, Plus } from "lucide-react"
import { ExamSelectionModal } from "./ExamSelectionModal"
import { CreateExamModal } from "./CreateExamModal"
import { useToast } from "@/hooks/useToast"

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
    console.log('AI Chat - User wants to assign questions to exam')
    setStep('select-option')
  }

  const handleNoAssignment = () => {
    console.log('AI Chat - User declined to assign questions to exam')
    onAssignmentComplete()
  }

  const handleExistingExam = () => {
    console.log('AI Chat - User selected existing exam option')
    setStep('select-exam')
    setShowExamModal(true)
  }

  const handleNewExam = () => {
    console.log('AI Chat - User selected create new exam option')
    setStep('create-exam')
    setShowCreateModal(true)
  }

  const handleExamSelected = async (examId: string, examTitle: string) => {
    console.log('AI Chat - Exam selected:', examId, examTitle)
    setShowExamModal(false)
    setAssigning(true)

    try {
      // Import the API function here to avoid circular dependencies
      const { assignQuestionsToExam } = await import('@/api/exams')

      // First, we need to create the questions in the database
      const { createQuestionsWithAI } = await import('@/api/aiChat')

      console.log('AI Chat - Creating questions in database...')
      const createResult = await createQuestionsWithAI({ questions })

      if (createResult.questions && createResult.questions.length > 0) {
        const questionIds = createResult.questions.map((q: any) => q._id)

        console.log('AI Chat - Assigning questions to exam:', questionIds)
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
      console.error('Error assigning questions to exam:', error)
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
    console.log('AI Chat - Exam created:', exam)
    setShowCreateModal(false)
    setAssigning(true)

    try {
      // First, we need to create the questions in the database
      const { createQuestionsWithAI } = await import('@/api/aiChat')

      console.log('AI Chat - Creating questions in database...')
      const createResult = await createQuestionsWithAI({ questions })

      if (createResult.questions && createResult.questions.length > 0) {
        const questionIds = createResult.questions.map((q: any) => q._id)

        // Import the API function here to avoid circular dependencies
        const { assignQuestionsToExam } = await import('@/api/exams')

        console.log('AI Chat - Assigning questions to new exam:', questionIds)
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
      console.error('Error creating exam and assigning questions:', error)
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
      <Card className="mt-4 border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2 text-green-700">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">Questions assigned successfully!</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === 'ask') {
    return (
      <Card className="mt-4 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <FileText className="h-5 w-5" />
            Question Assignment
          </CardTitle>
          <CardDescription className="text-blue-700">
            Would you like to assign these {questions.length} generated questions to an exam?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              onClick={handleYesAssignment}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Yes, assign to exam
            </Button>
            <Button
              variant="outline"
              onClick={handleNoAssignment}
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              No, just save questions
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (step === 'select-option') {
    return (
      <Card className="mt-4 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <FileText className="h-5 w-5" />
            Choose Assignment Option
          </CardTitle>
          <CardDescription className="text-blue-700">
            Would you like to assign questions to an existing exam or create a new one?
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              onClick={handleExistingExam}
              disabled={assigning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <FileText className="h-4 w-4 mr-2" />
              Select existing exam
            </Button>
            <Button
              onClick={handleNewExam}
              disabled={assigning}
              variant="outline"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create new exam
            </Button>
            {onCancel && (
              <Button
                variant="ghost"
                onClick={onCancel}
                disabled={assigning}
                className="text-gray-600 hover:bg-gray-100"
              >
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
      <Card className="mt-4 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2 text-blue-700">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700"></div>
            <span className="font-medium">
              {assigning ? 'Assigning questions...' : 'Please complete the assignment process'}
            </span>
          </div>
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