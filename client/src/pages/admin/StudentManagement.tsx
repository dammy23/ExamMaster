import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  Plus,
  Search,
  Users,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
  GraduationCap,
  Upload
} from "lucide-react"
import { getStudents, getStudentGroups, createStudentGroup, createStudent, bulkUploadStudents, type Student, type StudentGroup } from "@/api/students"
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
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      console.log('Fetching students and groups...')
      const [studentsResponse, groupsResponse] = await Promise.all([
        getStudents(),
        getStudentGroups()
      ])

      setStudents((studentsResponse as any).students)
      setGroups((groupsResponse as any).groups)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: "Error",
        description: "Failed to load student data",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    return status === 'active'
      ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</Badge>
      : <Badge variant="secondary">Inactive</Badge>
  }

  const getPerformanceBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-600">Excellent</Badge>
    if (score >= 80) return <Badge className="bg-blue-500">Good</Badge>
    if (score >= 70) return <Badge className="bg-yellow-500">Average</Badge>
    return <Badge className="bg-red-500">Needs Improvement</Badge>
  }

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (student.studentId && student.studentId.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (student.applicationNo && student.applicationNo.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesGroup = filterGroup === "all" || student.group === filterGroup
    const matchesStatus = filterStatus === "all" || student.status === filterStatus

    return matchesSearch && matchesGroup && matchesStatus
  })

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
          <h1 className="text-3xl font-bold tracking-tight">Student Management</h1>
          <p className="text-muted-foreground">
            Manage students and organize them into groups
          </p>
        </div>
        <div className="flex gap-2">
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
          <Card key={group._id} className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {group.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-1">
                {group.studentCount}
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400">
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

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Application No</TableHead>
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
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((student) => (
                    <TableRow key={student._id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{student.name}</div>
                          <div className="text-sm text-muted-foreground">{student.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{student.studentId || 'N/A'}</TableCell>
                      <TableCell className="font-mono">{student.applicationNo || 'N/A'}</TableCell>
                      <TableCell>{student.group || 'Not assigned'}</TableCell>
                      <TableCell>{getStatusBadge(student.status)}</TableCell>
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
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Student
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              View Performance
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600 focus:text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove Student
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8">
                      <div className="text-muted-foreground">
                        {searchTerm || filterGroup !== "all" || filterStatus !== "all"
                          ? "No students found matching your filters."
                          : "No students enrolled yet."}
                      </div>
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
      console.log('Creating student group:', groupData)
      await createStudentGroup(groupData)
      toast({
        title: "Success",
        description: "Student group created successfully"
      })
      onSuccess()
    } catch (error) {
      console.error('Error creating group:', error)
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
  const [selectedGroup, setSelectedGroup] = useState<string>("")
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
      applicationNo: formData.get('applicationNo') as string || undefined,
      group: selectedGroup || undefined
    }

    try {
      console.log('Creating student:', { ...studentData, password: '[HIDDEN]' })
      await createStudent(studentData)
      toast({
        title: "Success",
        description: "Student created successfully"
      })
      onSuccess()
    } catch (error: any) {
      console.error('Error creating student:', error.message)
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="studentId">Student ID</Label>
          <Input
            id="studentId"
            name="studentId"
            placeholder="e.g., STU001"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="applicationNo">Application No</Label>
          <Input
            id="applicationNo"
            name="applicationNo"
            placeholder="e.g., APP001"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="group">Group</Label>
        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
          <SelectTrigger>
            <SelectValue placeholder="Select a group (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">No group</SelectItem>
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
      console.log('Uploading CSV file:', file.name)
      const result = await bulkUploadStudents(file)
      
      toast({
        title: "Success",
        description: `Imported ${result.imported} students successfully${result.errors && result.errors.length > 0 ? ` with ${result.errors.length} errors` : ''}`
      })
      
      if (result.errors && result.errors.length > 0) {
        console.log('Bulk upload errors:', result.errors)
      }
      
      onSuccess()
    } catch (error: any) {
      console.error('Error uploading file:', error.message)
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
          Upload a CSV file with columns: name, email, password, studentId, applicationNo, group
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