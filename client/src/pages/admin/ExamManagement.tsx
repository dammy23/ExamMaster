import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { Link } from "react-router-dom"
import { getExams, deleteExam, type Exam } from "@/api/exams"
import { useToast } from "@/hooks/useToast"

export function ExamManagement() {
  const [exams, setExams] = useState<Exam[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  useEffect(() => {
    fetchExams()
  }, [])

  const fetchExams = async () => {
    try {
      console.log('Fetching exams...')
      const response = await getExams()
      setExams(response.exams)
    } catch (error: any) {
      console.error('Error fetching exams:', error)
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
      console.log('Deleting exam:', examId)
      await deleteExam(examId)
      setExams(exams.filter(exam => exam._id !== examId))
      toast({
        title: "Success",
        description: "Exam deleted successfully"
      })
    } catch (error: any) {
      console.error('Error deleting exam:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete exam",
        variant: "destructive"
      })
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</Badge>
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>
      case 'completed':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Completed</Badge>
      case 'archived':
        return <Badge variant="outline">Archived</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const filteredExams = exams.filter(exam =>
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exam.subject.toLowerCase().includes(searchTerm.toLowerCase())
  )

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
                {filteredExams.length > 0 ? (
                  filteredExams.map((exam) => (
                    <TableRow key={exam._id}>
                      <TableCell className="font-medium">{exam.title}</TableCell>
                      <TableCell>{exam.subject}</TableCell>
                      <TableCell>{getStatusBadge(exam.status)}</TableCell>
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
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
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
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <div className="text-muted-foreground">
                        {searchTerm ? "No exams found matching your search." : "No exams created yet."}
                      </div>
                      {!searchTerm && (
                        <Link to="/admin/exams/create">
                          <Button variant="outline" className="mt-2">
                            Create Your First Exam
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}