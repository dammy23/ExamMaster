import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BookOpen, FileText, X } from "lucide-react"
import { DetectedIntent, getIntentDescription } from "@/utils/intentDetection"
import { SubjectForm } from "@/components/SubjectForm"
import { CreateExamModal } from "@/components/CreateExamModal"
import { useToast } from "@/hooks/useToast"

interface IntentConfirmationDialogProps {
  open: boolean
  intent: DetectedIntent
  originalMessage: string
  onConfirm: () => void
  onCancel: () => void
  onClose: () => void
}

export function IntentConfirmationDialog({
  open,
  intent,
  originalMessage,
  onConfirm,
  onCancel,
  onClose
}: IntentConfirmationDialogProps) {
  if (!intent) return null

  const getIcon = () => {
    switch (intent) {
      case 'create-subject':
        return <BookOpen className="h-6 w-6 text-status-info-foreground" />
      case 'create-exam':
        return <FileText className="h-6 w-6 text-status-success-foreground" />
      default:
        return null
    }
  }

  const getTitle = () => {
    switch (intent) {
      case 'create-subject':
        return 'Create New Subject?'
      case 'create-exam':
        return 'Create New Exam?'
      default:
        return 'Confirm Action'
    }
  }

  const getDescription = () => {
    const actionDescription = getIntentDescription(intent)
    return `It looks like you want to ${actionDescription}. Would you like to open the creation dialog instead of asking the AI?`
  }

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>{getDescription()}</p>
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm font-medium text-muted-foreground">Your message:</p>
              <p className="text-sm italic">"{originalMessage}"</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            No, Ask AI Instead
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Yes, Open Creation Dialog
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

interface CreationDialogManagerProps {
  intent: DetectedIntent | null
  showCreateDialog: boolean
  onDialogClose: () => void
  onCreationSuccess: () => void
}

export function CreationDialogManager({
  intent,
  showCreateDialog,
  onDialogClose,
  onCreationSuccess
}: CreationDialogManagerProps) {
  const { toast } = useToast()

  const handleSubjectSuccess = () => {
    toast({
      title: "Subject Created",
      description: "Subject has been created successfully!"
    })
    onCreationSuccess()
    onDialogClose()
  }

  const handleExamCreated = (exam: any) => {
    toast({
      title: "Exam Created",
      description: `"${exam.title}" has been created successfully!`
    })
    onCreationSuccess()
    onDialogClose()
  }

  if (intent === 'create-subject' && showCreateDialog) {
    return (
      <Dialog open={showCreateDialog} onOpenChange={onDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Create New Subject
                </DialogTitle>
                <DialogDescription>
                  Create a new subject for organizing exams
                </DialogDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onDialogClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>

          <div className="mt-4">
            <SubjectForm onSuccess={handleSubjectSuccess} />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (intent === 'create-exam' && showCreateDialog) {
    return (
      <CreateExamModal
        open={showCreateDialog}
        onClose={onDialogClose}
        onExamCreated={handleExamCreated}
      />
    )
  }

  return null
}