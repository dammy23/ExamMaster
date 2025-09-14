import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Save, Clock, Settings, Users } from "lucide-react"
import { createExam } from "@/api/exams"
import { getStudentGroups, type StudentGroup } from "@/api/students"
import { getActiveSubjects, type Subject } from "@/api/subjects"
import { useToast } from "@/hooks/useToast"

interface ExamFormData {
  title: string
  description: string
  subject: string
  duration: number
  startDate: string
  endDate: string
  totalMarks: number
  passingMarks: number
  instructions: string
  allowReview: boolean
  showResultsImmediately: boolean
  randomizeQuestions: boolean
  randomizeOptions: boolean
  negativeMarking: boolean
  negativeMarkingValue: number
  assignedGroups: string[]
}

export function CreateExam() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ExamFormData>({
    defaultValues: {
      allowReview: true,
      showResultsImmediately: false,
      randomizeQuestions: true,
      randomizeOptions: true,
      negativeMarking: false,
      negativeMarkingValue: 0.25,
      assignedGroups: []
    }
  })

  useEffect(() => {
    fetchStudentGroups()
    fetchSubjects()
  }, [])

  const fetchStudentGroups = async () => {
    try {
      console.log('Fetching student groups for exam creation...')
      const response = await getStudentGroups()
      setStudentGroups(response.groups)
    } catch (error: any) {
      console.error('Error fetching student groups:', error)
      toast({
        title: "Warning",
        description: "Failed to load student groups",
        variant: "destructive"
      })
    }
  }

  const fetchSubjects = async () => {
    try {
      console.log('Fetching subjects for exam creation...')
      const response = await getActiveSubjects() as any
      setSubjects(response.subjects)
    } catch (error: any) {
      console.error('Error fetching subjects:', error)
      toast({
        title: "Warning",
        description: "Failed to load subjects",
        variant: "destructive"
      })
    }
  }

  const negativeMarking = watch("negativeMarking")

  const onSubmit = async (data: ExamFormData) => {
    setLoading(true)
    try {
      console.log('Creating exam with data:', data)
      
      // Convert string values to numbers for proper validation
      const examData = {
        ...data,
        duration: Number(data.duration),
        totalMarks: Number(data.totalMarks),
        passingMarks: Number(data.passingMarks),
        negativeMarkingValue: Number(data.negativeMarkingValue),
        status: 'draft',
        totalQuestions: 0,
        assignedStudents: [],
        assignedGroups: selectedGroups,
        questions: []
      }
      
      console.log('Converted exam data:', examData)
      const response = await createExam(examData)

      toast({
        title: "Success",
        description: "Exam created successfully"
      })

      navigate("/admin/exams")
    } catch (error: any) {
      console.error('Error creating exam:', error)
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

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Enter the fundamental details of your exam
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Exam Title *</Label>
                <Input
                  id="title"
                  {...register("title", { required: "Title is required" })}
                  placeholder="e.g., Mathematics Final Exam"
                />
                {errors.title && (
                  <p className="text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Brief description of the exam content and objectives"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Select onValueChange={(value) => setValue("subject", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject._id} value={subject._id}>
                        {subject.name} ({subject.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {subjects.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No active subjects found. Please create subjects first.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions for Students</Label>
                <Textarea
                  id="instructions"
                  {...register("instructions")}
                  placeholder="Enter detailed instructions for students taking this exam"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Timing & Scoring */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Timing & Scoring
              </CardTitle>
              <CardDescription>
                Configure exam duration and marking scheme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes) *</Label>
                <Input
                  id="duration"
                  type="number"
                  {...register("duration", {
                    required: "Duration is required",
                    min: { value: 1, message: "Duration must be at least 1 minute" }
                  })}
                  placeholder="120"
                />
                {errors.duration && (
                  <p className="text-sm text-red-600">{errors.duration.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date & Time *</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    {...register("startDate", { required: "Start date is required" })}
                  />
                  {errors.startDate && (
                    <p className="text-sm text-red-600">{errors.startDate.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date & Time *</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    {...register("endDate", { required: "End date is required" })}
                  />
                  {errors.endDate && (
                    <p className="text-sm text-red-600">{errors.endDate.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalMarks">Total Marks *</Label>
                  <Input
                    id="totalMarks"
                    type="number"
                    {...register("totalMarks", {
                      required: "Total marks is required",
                      min: { value: 1, message: "Must be at least 1" }
                    })}
                    placeholder="100"
                  />
                  {errors.totalMarks && (
                    <p className="text-sm text-red-600">{errors.totalMarks.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="passingMarks">Passing Marks *</Label>
                  <Input
                    id="passingMarks"
                    type="number"
                    {...register("passingMarks", {
                      required: "Passing marks is required",
                      min: { value: 1, message: "Must be at least 1" }
                    })}
                    placeholder="40"
                  />
                  {errors.passingMarks && (
                    <p className="text-sm text-red-600">{errors.passingMarks.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Student Groups */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Student Groups Assignment
            </CardTitle>
            <CardDescription>
              Select student groups that will have access to this exam
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Assigned Groups</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {studentGroups.map((group) => (
                    <div
                      key={group._id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedGroups.includes(group._id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => {
                        if (selectedGroups.includes(group._id)) {
                          setSelectedGroups(selectedGroups.filter(id => id !== group._id))
                        } else {
                          setSelectedGroups([...selectedGroups, group._id])
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{group.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {group.studentCount} students
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 border rounded ${
                            selectedGroups.includes(group._id)
                              ? 'bg-primary border-primary'
                              : 'border-muted-foreground'
                          }`}
                        >
                          {selectedGroups.includes(group._id) && (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {studentGroups.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No student groups available</p>
                    <p className="text-sm">Create groups in Student Management first</p>
                  </div>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                Selected {selectedGroups.length} of {studentGroups.length} groups
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exam Settings */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Exam Settings
            </CardTitle>
            <CardDescription>
              Configure how the exam behaves for students
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Allow Review</Label>
                    <p className="text-sm text-muted-foreground">
                      Students can review answers before submission
                    </p>
                  </div>
                  <Switch
                    checked={watch("allowReview")}
                    onCheckedChange={(checked) => setValue("allowReview", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Show Results Immediately</Label>
                    <p className="text-sm text-muted-foreground">
                      Display results right after submission
                    </p>
                  </div>
                  <Switch
                    checked={watch("showResultsImmediately")}
                    onCheckedChange={(checked) => setValue("showResultsImmediately", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Randomize Questions</Label>
                    <p className="text-sm text-muted-foreground">
                      Shuffle question order for each student
                    </p>
                  </div>
                  <Switch
                    checked={watch("randomizeQuestions")}
                    onCheckedChange={(checked) => setValue("randomizeQuestions", checked)}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Randomize Options</Label>
                    <p className="text-sm text-muted-foreground">
                      Shuffle answer options in MCQs
                    </p>
                  </div>
                  <Switch
                    checked={watch("randomizeOptions")}
                    onCheckedChange={(checked) => setValue("randomizeOptions", checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Negative Marking</Label>
                    <p className="text-sm text-muted-foreground">
                      Deduct marks for incorrect answers
                    </p>
                  </div>
                  <Switch
                    checked={watch("negativeMarking")}
                    onCheckedChange={(checked) => setValue("negativeMarking", checked)}
                  />
                </div>

                {negativeMarking && (
                  <div className="space-y-2">
                    <Label htmlFor="negativeMarkingValue">Negative Marking Value</Label>
                    <Input
                      id="negativeMarkingValue"
                      type="number"
                      step="0.25"
                      {...register("negativeMarkingValue", {
                        min: { value: 0, message: "Must be 0 or greater" },
                        max: { value: 1, message: "Must be 1 or less" }
                      })}
                      placeholder="0.25"
                    />
                    <p className="text-xs text-muted-foreground">
                      Marks to deduct per incorrect answer
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/admin/exams")}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="gap-2">
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="h-4 w-4" />
            )}
            Create Exam
          </Button>
        </div>
      </form>
    </div>
  )
}