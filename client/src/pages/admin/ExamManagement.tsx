import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/ui/status-badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Users,
  Clock,
  FileText,
  HelpCircle
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { getExams, updateExam, deleteExam, type Exam } from "@/api/exams"
import { getAvailableStatusActions } from "@/lib/examStatus"
import { useToast } from "@/hooks/useToast"

export function ExamManagement() {
  const navigate = useNavigate()
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    fetchExams()
  }, [])

  const fetchExams = async () => {
    try {
      const response = await getExams()
      setExams(response.exams)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load exams",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteExam = async (examId: string) => {
    try {
      await deleteExam(examId)
      setExams(exams.filter(exam => exam._id !== examId))
      toast({
        title: "Success",
        description: "Exam deleted successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete exam",
        variant: "destructive"
      })
    }
  }

  const handleStatusChange = async (examId: string, nextStatus: Exam['status']) => {
    try {
      const response = await updateExam(examId, { status: nextStatus })
      setExams(exams.map(exam => exam._id === examId ? response.exam : exam))
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

  const filteredExams = exams.filter(exam => {
    const subjectName = typeof exam.subject === 'string' ? exam.subject : exam.subject.name
    return exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
           subjectName.toLowerCase().includes(searchTerm.toLowerCase())
  })

  if (loading) {
    return <LoadingState label="Loading exams..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Exam Management</h1>
          <p className="text-muted-foreground">
            Create, manage, and monitor your exams
          </p>
        </div>
        <Link to="/admin/exams/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Create Exam
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Exams</CardTitle>
          <CardDescription>
            Manage your examination schedule and settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search exams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {filteredExams.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExams.map((exam) => (
                    <TableRow key={exam._id}>
                      <TableCell className="font-medium">{exam.title}</TableCell>
                      <TableCell>
                        {typeof exam.subject === 'string'
                          ? exam.subject
                          : `${exam.subject.name} (${exam.subject.code})`
                        }
                      </TableCell>
                      <TableCell><StatusBadge status={exam.status} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {exam.duration} min
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {exam.totalQuestions}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {exam.assignedStudents.length}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(exam.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <Link to={`/admin/exams/${exam._id}/details`}>
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                            </Link>
                            <Link to={`/admin/exams/edit/${exam._id}`}>
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Exam
                              </DropdownMenuItem>
                            </Link>
                            <Link to={`/admin/exams/${exam._id}/questions`}>
                              <DropdownMenuItem>
                                <HelpCircle className="mr-2 h-4 w-4" />
                                Questions
                              </DropdownMenuItem>
                            </Link>
                            <DropdownMenuSeparator />
                            {getAvailableStatusActions(exam.status).map((action) => (
                              <DropdownMenuItem
                                key={action.nextStatus}
                                onSelect={() => handleStatusChange(exam._id, action.nextStatus)}
                              >
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete Exam
                                </DropdownMenuItem>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the exam
                                    and remove all associated data.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteExam(exam._id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              title={searchTerm ? "No exams found" : "No exams created yet"}
              description={searchTerm ? "No exams match your search." : "Create your first exam to get started."}
              action={!searchTerm ? { label: "Create Your First Exam", onClick: () => navigate("/admin/exams/create") } : undefined}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
