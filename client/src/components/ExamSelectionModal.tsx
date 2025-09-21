import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Calendar, Clock, FileText, Users, X } from "lucide-react"
import { useToast } from "@/hooks/useToast"

interface Exam {
  _id: string
  title: string
  description: string
  subject: {
    _id: string
    name: string
    code: string
  }
  duration: number
  startDate: string
  endDate: string
  status: 'draft' | 'active' | 'completed' | 'archived'
  totalQuestions: number
  totalMarks: number
  createdAt: string
}

interface ExamSelectionModalProps {
  open: boolean
  onClose: () => void
  onExamSelected: (examId: string, examTitle: string) => void
  disabled?: boolean
}

export function ExamSelectionModal({
  open,
  onClose,
  onExamSelected,
  disabled = false
}: ExamSelectionModalProps) {
  const [exams, setExams] = useState<Exam[]>([])
  const [filteredExams, setFilteredExams] = useState<Exam[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null)
  const { toast } = useToast()

  // Load exams when modal opens
  useEffect(() => {
    if (open) {
      loadExams()
    }
  }, [open])

  // Filter exams based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredExams(exams)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = exams.filter(exam =>
        exam.title.toLowerCase().includes(query) ||
        exam.subject.name.toLowerCase().includes(query) ||
        exam.subject.code.toLowerCase().includes(query) ||
        exam.description.toLowerCase().includes(query)
      )
      setFilteredExams(filtered)
    }
  }, [searchQuery, exams])

  const loadExams = async () => {
    setLoading(true)
    try {
      console.log('ExamSelection - Loading exams...')
      const { getExams } = await import('@/api/exams')
      const response = await getExams()

      // Filter to only show draft and active exams (can assign questions to these)
      const availableExams = response.exams?.filter((exam: Exam) =>
        exam.status === 'draft' || exam.status === 'active'
      ) || []

      console.log('ExamSelection - Loaded exams:', availableExams.length)
      setExams(availableExams)
    } catch (error) {
      console.error('Error loading exams:', error)
      toast({
        variant: "destructive",
        title: "Error Loading Exams",
        description: (error as any)?.message || "Failed to load available exams"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExamSelect = (exam: Exam) => {
    if (disabled) return
    setSelectedExam(exam)
  }

  const handleConfirmSelection = () => {
    if (selectedExam && !disabled) {
      console.log('ExamSelection - Confirming selection:', selectedExam.title)
      onExamSelected(selectedExam._id, selectedExam.title)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-700 border-gray-300'
      case 'active':
        return 'bg-green-100 text-green-700 border-green-300'
      case 'completed':
        return 'bg-blue-100 text-blue-700 border-blue-300'
      case 'archived':
        return 'bg-orange-100 text-orange-700 border-orange-300'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-300'
    }
  }

  return (
    <Dialog open={open} onOpenChange={disabled ? undefined : onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Select Exam</DialogTitle>
              <DialogDescription>
                Choose an exam to assign the generated questions to
              </DialogDescription>
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col space-y-4 flex-1 min-h-0">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search exams by title, subject, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              disabled={disabled}
            />
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading exams...</span>
            </div>
          )}

          {/* No exams */}
          {!loading && filteredExams.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No Available Exams</p>
              <p className="text-sm">
                {searchQuery
                  ? "No exams match your search criteria"
                  : "No draft or active exams available for question assignment"
                }
              </p>
            </div>
          )}

          {/* Exam List */}
          {!loading && filteredExams.length > 0 && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-3">
                {filteredExams.map((exam) => (
                  <div
                    key={exam._id}
                    onClick={() => handleExamSelect(exam)}
                    className={`
                      p-4 border rounded-lg cursor-pointer transition-all
                      ${selectedExam?._id === exam._id
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }
                      ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-lg mb-1">{exam.title}</h3>
                        <p className="text-gray-600 text-sm line-clamp-2 mb-2">
                          {exam.description || "No description"}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`ml-2 ${getStatusColor(exam.status)}`}
                      >
                        {exam.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                      <div className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        <span>{exam.subject.name} ({exam.subject.code})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{exam.duration} minutes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{exam.totalQuestions} questions</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>Start: {formatDate(exam.startDate)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>End: {formatDate(exam.endDate)}</span>
                      </div>
                      <span>Total Marks: {exam.totalMarks}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={disabled}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmSelection}
              disabled={!selectedExam || disabled}
            >
              {disabled ? 'Assigning...' : 'Assign Questions to This Exam'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}