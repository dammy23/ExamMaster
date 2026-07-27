import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Save, Clock, Settings, Users } from "lucide-react"
import { getStudentGroups, type StudentGroup } from "@/api/students"
import { getActiveSubjects, type Subject } from "@/api/subjects"
import { useToast } from "@/hooks/useToast"

export interface ExamFormData {
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
  unlimitedAttempts: boolean
  maxAttempts: number
  questionsPerExam?: number
  useRandomQuestions: boolean
  videoRecording: boolean
  screenRecording: boolean
  mobileEnabled: boolean
  gradingMethod: 'ai' | 'manual'
  assignedGroups: string[]
}

export interface ExamPayload extends Omit<ExamFormData, 'questionsPerExam'> {
  questionsPerExam: number | null
}

const CREATE_DEFAULT_VALUES: Partial<ExamFormData> = {
  allowReview: true,
  showResultsImmediately: false,
  randomizeQuestions: true,
  randomizeOptions: true,
  negativeMarking: false,
  negativeMarkingValue: 0.25,
  unlimitedAttempts: false,
  maxAttempts: 1,
  useRandomQuestions: false,
  questionsPerExam: undefined,
  videoRecording: false,
  screenRecording: false,
  mobileEnabled: false,
  gradingMethod: 'ai',
  assignedGroups: []
}

interface ExamFormProps {
  mode: 'create' | 'edit'
  initialValues?: Partial<ExamFormData>
  onSubmit: (payload: ExamPayload) => Promise<void>
  submitting: boolean
}

export function ExamForm({ mode, initialValues, onSubmit, submitting }: ExamFormProps) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [studentGroups, setStudentGroups] = useState<StudentGroup[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedGroups, setSelectedGroups] = useState<string[]>(initialValues?.assignedGroups || [])
  const [description, setDescription] = useState(initialValues?.description || '')
  const [instructions, setInstructions] = useState(initialValues?.instructions || '')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<ExamFormData>({
    defaultValues: mode === 'create' ? CREATE_DEFAULT_VALUES : (initialValues || {})
  })

  useEffect(() => {
    const fetchStudentGroups = async () => {
      try {
        const response = await getStudentGroups()
        setStudentGroups(response.groups)
      } catch (error: any) {
        toast({
          title: "Warning",
          description: "Failed to load student groups",
          variant: "destructive"
        })
      }
    }

    const fetchSubjects = async () => {
      try {
        const response = await getActiveSubjects() as any
        setSubjects(response.subjects)
      } catch (error: any) {
        toast({
          title: "Warning",
          description: "Failed to load subjects",
          variant: "destructive"
        })
      }
    }

    fetchStudentGroups()
    fetchSubjects()
  }, [])

  const negativeMarking = watch("negativeMarking")
  const unlimitedAttempts = watch("unlimitedAttempts")
  const useRandomQuestions = watch("useRandomQuestions")

  const handleFormSubmit = async (data: ExamFormData) => {
    const payload: ExamPayload = {
      ...data,
      description,
      instructions,
      duration: Number(data.duration),
      totalMarks: Number(data.totalMarks),
      passingMarks: Number(data.passingMarks),
      negativeMarkingValue: Number(data.negativeMarkingValue),
      maxAttempts: data.unlimitedAttempts ? 0 : Number(data.maxAttempts),
      questionsPerExam: data.useRandomQuestions && data.questionsPerExam ? Number(data.questionsPerExam) : null,
      assignedGroups: selectedGroups
    }
    await onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Basic Information
            </CardTitle>
            <CardDescription>
              {mode === 'create' ? 'Enter the fundamental details of your exam' : 'Update the fundamental details of your exam'}
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
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Brief description of the exam content and objectives"
                height="120px"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Subject *</Label>
              <Select value={watch("subject")} onValueChange={(value) => setValue("subject", value)}>
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
              <RichTextEditor
                value={instructions}
                onChange={setInstructions}
                placeholder="Enter detailed instructions for students taking this exam"
                height="150px"
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

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Unlimited Attempts</Label>
                  <p className="text-sm text-muted-foreground">
                    Students can take this exam unlimited times
                  </p>
                </div>
                <Switch
                  checked={watch("unlimitedAttempts")}
                  onCheckedChange={(checked) => {
                    setValue("unlimitedAttempts", checked)
                    if (checked) {
                      setValue("maxAttempts", 0)
                    } else {
                      setValue("maxAttempts", 1)
                    }
                  }}
                />
              </div>

              {!unlimitedAttempts && (
                <div className="space-y-2">
                  <Label htmlFor="maxAttempts">No. of Allowed Attempts</Label>
                  <Input
                    id="maxAttempts"
                    type="number"
                    {...register("maxAttempts", {
                      required: "Number of attempts is required",
                      min: { value: 1, message: "Must be at least 1 attempt" },
                      max: { value: 10, message: "Cannot exceed 10 attempts" }
                    })}
                    placeholder="1"
                  />
                  {errors.maxAttempts && (
                    <p className="text-sm text-red-600">{errors.maxAttempts.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Maximum number of times a student can attempt this exam
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Random Question Selection</Label>
                  <p className="text-sm text-muted-foreground">
                    Randomly select a subset of questions for each exam attempt
                  </p>
                </div>
                <Switch
                  checked={watch("useRandomQuestions")}
                  onCheckedChange={(checked) => {
                    setValue("useRandomQuestions", checked)
                    if (!checked) {
                      setValue("questionsPerExam", undefined)
                    }
                  }}
                />
              </div>

              {useRandomQuestions && (
                <div className="space-y-2">
                  <Label htmlFor="questionsPerExam">Questions Per Exam Attempt</Label>
                  <Input
                    id="questionsPerExam"
                    type="number"
                    {...register("questionsPerExam", {
                      required: useRandomQuestions ? "Number of questions is required" : false,
                      min: { value: 1, message: "Must be at least 1 question" }
                    })}
                    placeholder="e.g., 20"
                  />
                  {errors.questionsPerExam && (
                    <p className="text-sm text-red-600">{errors.questionsPerExam.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    If you assign 50 questions and set this to 20, each student will get 20 randomly selected questions
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Use Video Security</Label>
                  <p className="text-sm text-muted-foreground">
                    Record student video and audio during exam
                  </p>
                </div>
                <Switch
                  checked={watch("videoRecording")}
                  onCheckedChange={(checked) => setValue("videoRecording", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Screen Recording</Label>
                  <p className="text-sm text-muted-foreground">
                    Record the student's screen during exam
                  </p>
                </div>
                <Switch
                  checked={watch("screenRecording")}
                  onCheckedChange={(checked) => setValue("screenRecording", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Mobile Devices</Label>
                  <p className="text-sm text-muted-foreground">
                    Students can take this exam on mobile devices
                  </p>
                </div>
                <Switch
                  checked={watch("mobileEnabled")}
                  onCheckedChange={(checked) => setValue("mobileEnabled", checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gradingMethod">Grading Method</Label>
                <Select
                  value={watch("gradingMethod")}
                  onValueChange={(value) => setValue("gradingMethod", value as 'ai' | 'manual')}
                >
                  <SelectTrigger id="gradingMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ai">AI Auto-Grade</SelectItem>
                    <SelectItem value="manual">Human Manual Grade</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How theory questions are scored after submission
                </p>
              </div>
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
        <Button type="submit" disabled={submitting} className="gap-2">
          {submitting ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Save className="h-4 w-4" />
          )}
          {mode === 'create' ? 'Create Exam' : 'Update Exam'}
        </Button>
      </div>
    </form>
  )
}
