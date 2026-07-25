import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { StatusBadge } from "@/components/ui/status-badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
  Search,
  Users,
  MoreHorizontal,
  Edit,
  UserPlus,
  UserX,
  UserCheck,
  GraduationCap,
  Upload,
  Download
} from "lucide-react"
import { getStudents, getStudentGroups, createStudentGroup, createStudent, updateStudent, bulkUploadStudents, type Student, type StudentGroup } from "@/api/students"
import { useToast } from "@/hooks/useToast"

export function StudentManagement() {
  const [students, setStudents] = useState<Student[]>([])
  const [groups, setGroups] = useState<StudentGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterGroup, setFilterGroup] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [showCreateGroupDialog, setShowCreateGroupDialog] = useState(false)
  const [showAddStudentDialog, setShowAddStudentDialog] = useState(false)
  const [showEditStudentDialog, setShowEditStudentDialog] = useState(false)
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [studentsResponse, groupsResponse] = await Promise.all([
        getStudents(),
        getStudentGroups()
      ])

      setStudents((studentsResponse as any).students)
      setGroups((groupsResponse as any).groups)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load student data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadStudentTemplate = () => {
    try {
      const csvHeaders = [
        'name',
        'email',
        'password',
        'studentId',
        'group'
      ]

      const csvContent = [
        csvHeaders.join(','),
        'John Doe,john.doe@example.com,password123,STU001,2025/2026',
        'Jane Smith,jane.smith@example.com,password456,STU002,2025/2026',
        'Bob Johnson,bob.johnson@example.com,password789,STU003,2024/2025'
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', 'students_template.csv')
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Success",
        description: "CSV template downloaded successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to download CSV template",
        variant: "destructive"
      })
    }
  }

  const getPerformanceBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-600">Excellent</Badge>
    if (score >= 80) return <Badge className="bg-blue-500">Good</Badge>
    if (score >= 70) return <Badge className="bg-yellow-500">Average</Badge>
    return <Badge className="bg-red-500">Needs Improvement</Badge>
  }

  const handleEditStudent = (student: Student) => {
    setSelectedStudent(student)
    setShowEditStudentDialog(true)
  }

  const handleEditStudentSubmit = async (formData: {
    name: string;
    email: string;
    studentId: string;
    group: string;
    status: 'active' | 'inactive';
  }) => {
    if (!selectedStudent) return

    try {
      await updateStudent(selectedStudent._id, formData)

      setShowEditStudentDialog(false)
      setSelectedStudent(null)
      fetchData()

      toast({
        title: "Success",
        description: "Student updated successfully"
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update student",
        variant: "destructive"
      })
    }
  }

  const handleToggleStudentStatus = async (student: Student) => {
    const nextStatus = student.status === 'active' ? 'inactive' : 'active'
    try {
      await updateStudent(student._id, { status: nextStatus })
      setStudents(students.map(s => s._id === student._id ? { ...s, status: nextStatus } : s))
      toast({
        title: "Success",
        description: `Student ${nextStatus === 'active' ? 'reactivated' : 'deactivated'} successfully`
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update student status",
        variant: "destructive"
      })
    }
  }

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (student.studentId && student.studentId.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesGroup = filterGroup === "all" || student.group === filterGroup
    const matchesStatus = filterStatus === "all" || student.status === filterStatus

    return matchesSearch && matchesGroup && matchesStatus
  })

  if (loading) {
    return <LoadingState label="Loading students..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Management</h1>
          <p className="text-muted-foreground">
            Manage students and organize them into groups
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => handleDownloadStudentTemplate()}
          >
            <Download className="h-4 w-4" />
            Download Template
          </Button>
          <Dialog open={showBulkUploadDialog} onOpenChange={setShowBulkUploadDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="h-4 w-4" />
                Bulk Upload
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk Upload Students</DialogTitle>
                <DialogDescription>
                  Upload a CSV file with student information
                </DialogDescription>
              </DialogHeader>
              <BulkUploadForm
                onSuccess={() => {
                  setShowBulkUploadDialog(false)
                  fetchData()
                }}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={showCreateGroupDialog} onOpenChange={setShowCreateGroupDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Users className="h-4 w-4" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Student Group</DialogTitle>
                <DialogDescription>
                  Create a new group to organize students
                </DialogDescription>
              </DialogHeader>
              <CreateGroupForm
                onSuccess={() => {
                  setShowCreateGroupDialog(false)
                  fetchData()
                }}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={showAddStudentDialog} onOpenChange={setShowAddStudentDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" />
                Add Student
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Student</DialogTitle>
                <DialogDescription>
                  Create a new student account
                </DialogDescription>
              </DialogHeader>
              <AddStudentForm
                groups={groups}
                onSuccess={() => {
                  setShowAddStudentDialog(false)
                  fetchData()
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Groups Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {groups.map((group) => (
          <Card key={group._id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {group.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold mb-1">
                {group.studentCount}
              </div>
              <p className="text-xs text-muted-foreground">
                Students enrolled
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            All Students
          </CardTitle>
          <CardDescription>
            Manage student accounts and track their performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterGroup} onValueChange={setFilterGroup}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group._id} value={group.name}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredStudents.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Group</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Exams Taken</TableHead>
                    <TableHead>Average Score</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStudents.map((student) => (
                    <TableRow key={student._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{student.name}</div>
                          <div className="text-sm text-muted-foreground">{student.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{student.studentId || 'N/A'}</TableCell>
                      <TableCell>{student.group || 'Not assigned'}</TableCell>
                      <TableCell><StatusBadge status={student.status === 'active' ? 'active' : 'archived'} /></TableCell>
                      <TableCell>{(student as any).totalExamsAttempted || 0}</TableCell>
                      <TableCell>
                        {(student as any).averageScore ? `${((student as any).averageScore).toFixed(1)}%` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {(student as any).averageScore ? getPerformanceBadge((student as any).averageScore) :
                         <Badge variant="secondary">No data</Badge>}
                      </TableCell>
                      <TableCell>
                        {student.enrollmentDate ? new Date(student.enrollmentDate).toLocaleDateString() : 'N/A'}
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
                            <DropdownMenuItem onClick={() => handleEditStudent(student)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Student
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleToggleStudentStatus(student)}>
                              {student.status === 'active' ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  Deactivate
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Reactivate
                                </>
                              )}
                            </DropdownMenuItem>
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
              title={searchTerm || filterGroup !== "all" || filterStatus !== "all" ? "No students found" : "No students enrolled yet"}
              description={searchTerm || filterGroup !== "all" || filterStatus !== "all" ? "No students match your filters." : "Add your first student to get started."}
              action={!searchTerm && filterGroup === "all" && filterStatus === "all" ? { label: "Add Student", onClick: () => setShowAddStudentDialog(true) } : undefined}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit Student Dialog */}
      <Dialog open={showEditStudentDialog} onOpenChange={setShowEditStudentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Student</DialogTitle>
            <DialogDescription>
              Update student information
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <EditStudentForm
              student={selectedStudent}
              groups={groups}
              onSuccess={handleEditStudentSubmit}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EditStudentForm({
  student,
  groups,
  onSuccess
}: {
  student: Student;
  groups: StudentGroup[];
  onSuccess: (data: {
    name: string;
    email: string;
    studentId: string;
    group: string;
    status: 'active' | 'inactive';
  }) => void;
}) {
  const [loading, setLoading] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState(student.group || 'none')
  const [selectedStatus, setSelectedStatus] = useState(student.status)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const studentId = formData.get('studentId') as string
    const group = selectedGroup === 'none' ? '' : selectedGroup
    const status = selectedStatus

    if (!name || !email) {
      toast({
        title: "Error",
        description: "Name and email are required",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      await onSuccess({
        name,
        email,
        studentId,
        group,
        status
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update student",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-name">Full Name *</Label>
        <Input
          id="edit-name"
          name="name"
          defaultValue={student.name}
          placeholder="Enter full name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-email">Email *</Label>
        <Input
          id="edit-email"
          name="email"
          type="email"
          defaultValue={student.email}
          placeholder="Enter email address"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-studentId">Student ID</Label>
        <Input
          id="edit-studentId"
          name="studentId"
          defaultValue={student.studentId || ''}
          placeholder="Enter student ID"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-group">Group</Label>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger>
            <SelectValue placeholder="Select group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Group</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group._id} value={group.name}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-status">Status</Label>
        <Select value={selectedStatus} onValueChange={setSelectedStatus}>
          <SelectTrigger>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            "Update Student"
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

function CreateGroupForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const groupData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string
    }

    try {
      await createStudentGroup(groupData)
      toast({
        title: "Success",
        description: "Student group created successfully"
      })
      onSuccess()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create student group",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Group Name *</Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g., Computer Science A"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          placeholder="Brief description of the group"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            "Create Group"
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

function AddStudentForm({ groups, onSuccess }: { groups: StudentGroup[]; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<string>("none")
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const studentData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      studentId: formData.get('studentId') as string || undefined,
      group: selectedGroup === "none" ? undefined : selectedGroup || undefined
    }

    try {
      await createStudent(studentData)
      toast({
        title: "Success",
        description: "Student created successfully"
      })
      onSuccess()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create student",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name *</Label>
          <Input
            id="name"
            name="name"
            placeholder="e.g., John Doe"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="john.doe@example.com"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Enter a secure password"
          required
          minLength={6}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="studentId">Student ID</Label>
        <Input
          id="studentId"
          name="studentId"
          placeholder="e.g., STU001"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="group">Group</Label>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger>
            <SelectValue placeholder="Select a group (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No group</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group._id} value={group.name}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DialogFooter>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            "Create Student"
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}

function BulkUploadForm({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Error",
          description: "Please select a CSV file",
          variant: "destructive"
        })
        return
      }
      setFile(selectedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive"
      })
      return
    }

    setLoading(true)

    try {
      const result = await bulkUploadStudents(file)

      toast({
        title: "Success",
        description: `Imported ${result.imported} students successfully${result.errors && result.errors.length > 0 ? ` with ${result.errors.length} errors` : ''}`
      })

      onSuccess()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload students",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="file">CSV File *</Label>
        <Input
          id="file"
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          required
        />
        <p className="text-sm text-muted-foreground">
          Upload a CSV file with columns: name, email, password, studentId, group
        </p>
      </div>

      {file && (
        <div className="p-2 bg-muted rounded">
          <p className="text-sm">Selected file: {file.name}</p>
          <p className="text-xs text-muted-foreground">Size: {Math.round(file.size / 1024)} KB</p>
        </div>
      )}

      <DialogFooter>
        <Button type="submit" disabled={loading || !file}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            "Upload Students"
          )}
        </Button>
      </DialogFooter>
    </form>
  )
}
