import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent } from "@/components/ui/card"
import { CalendarIcon, Clock, FileText, X } from "lucide-react"
import { useToast } from "@/hooks/useToast"
import { useForm } from "react-hook-form"

interface Subject {
  _id: string
  name: string
  code: string
  description?: string
}

interface CreateExamFormData {
  title: string
  description: string
  subject: string
  duration: number
  startDate: string
  startTime: string
  endDate: string
  endTime: string
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
  videoRecording: boolean
  mobileEnabled: boolean
}

interface CreateExamModalProps {
  open: boolean
  onClose: () => void
  onExamCreated: (exam: any) => void
  disabled?: boolean
}

export function CreateExamModal({
  open,
  onClose,
  onExamCreated,
  disabled = false
}: CreateExamModalProps) {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loadingSubjects, setLoadingSubjects] = useState(false)
  const [creating, setCreating] = useState(false)
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue
  } = useForm<CreateExamFormData>({
    defaultValues: {
      title: "",
      description: "",
      subject: "",
      duration: 60,
      startDate: new Date().toISOString().split('T')[0],
      startTime: "09:00",
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      endTime: "18:00",
      totalMarks: 100,
      passingMarks: 50,
      instructions: "Please read all questions carefully before answering.",
      allowReview: true,
      showResultsImmediately: false,
      randomizeQuestions: true,
      randomizeOptions: true,
      negativeMarking: false,
      negativeMarkingValue: 0.25,
      unlimitedAttempts: false,
      maxAttempts: 1,
      videoRecording: false,
      mobileEnabled: false
    }
  })

  const watchNegativeMarking = watch('negativeMarking')
  const watchUnlimitedAttempts = watch('unlimitedAttempts')

  // Load subjects when modal opens
  useEffect(() => {
    if (open) {
      loadSubjects()
    }
  }, [open])

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  const loadSubjects = async () => {
    setLoadingSubjects(true)
    try {
      console.log('CreateExam - Loading subjects...')
      const { getActiveSubjects } = await import('@/api/subjects')
      const response = await getActiveSubjects()

      console.log('CreateExam - Loaded subjects:', response.subjects?.length || 0)
      setSubjects(response.subjects || [])
    } catch (error) {
      console.error('Error loading subjects:', error)
      toast({
        variant: "destructive",
        title: "Error Loading Subjects",
        description: (error as any)?.message || "Failed to load available subjects"
      })
    } finally {
      setLoadingSubjects(false)
    }
  }

  const onSubmit = async (data: CreateExamFormData) => {
    if (disabled || creating) return

    console.log('CreateExam - Submitting exam data:', data)
    setCreating(true)

    try {
      // Combine date and time fields
      const startDateTime = new Date(`${data.startDate}T${data.startTime}:00.000Z`)
      const endDateTime = new Date(`${data.endDate}T${data.endTime}:00.000Z`)

      // Validate dates
      if (startDateTime >= endDateTime) {
        throw new Error('End date/time must be after start date/time')
      }

      if (startDateTime < new Date()) {
        throw new Error('Start date/time cannot be in the past')
      }

      if (data.passingMarks > data.totalMarks) {
        throw new Error('Passing marks cannot be greater than total marks')
      }

      const examData = {
        title: data.title,
        description: data.description,
        subject: data.subject,
        duration: data.duration,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        totalMarks: data.totalMarks,
        passingMarks: data.passingMarks,
        instructions: data.instructions,
        allowReview: data.allowReview,
        showResultsImmediately: data.showResultsImmediately,
        randomizeQuestions: data.randomizeQuestions,
        randomizeOptions: data.randomizeOptions,
        negativeMarking: data.negativeMarking,
        negativeMarkingValue: data.negativeMarking ? data.negativeMarkingValue : 0,
        maxAttempts: data.unlimitedAttempts ? 0 : data.maxAttempts,
        videoRecording: data.videoRecording,
        mobileEnabled: data.mobileEnabled,
        status: 'draft'
      }

      console.log('CreateExam - Final exam data:', examData)

      const { createExam } = await import('@/api/exams')
      const response = await createExam(examData)

      console.log('CreateExam - Exam created successfully:', response.exam)

      toast({
        title: "Exam Created Successfully",
        description: `"${response.exam.title}" has been created successfully.`
      })

      onExamCreated(response.exam)

    } catch (error) {
      console.error('Error creating exam:', error)
      toast({
        variant: "destructive",
        title: "Error Creating Exam",
        description: (error as any)?.message || "Failed to create exam"
      })
    } finally {
      setCreating(false)
    }
  }

  const handleClose = () => {
    if (!creating && !disabled) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={disabled ? undefined : handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Create New Exam</DialogTitle>
              <DialogDescription>
                Create a new exam and assign the generated questions to it
              </DialogDescription>
            </div>
            {!disabled && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="h-8 w-8 p-0"
                disabled={creating}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Basic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label htmlFor="title">Exam Title *</Label>
                  <Input
                    id="title"
                    {...register('title', { required: 'Title is required' })}
                    placeholder="Enter exam title"
                    disabled={creating}
                  />
                  {errors.title && (
                    <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    placeholder="Enter exam description (optional)"
                    disabled={creating}
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="subject">Subject *</Label>
                  <Select
                    onValueChange={(value) => setValue('subject', value)}
                    disabled={creating || loadingSubjects}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingSubjects ? "Loading subjects..." : "Select subject"} />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject._id} value={subject._id}>
                          {subject.name} ({subject.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.subject && (
                    <p className="text-sm text-red-600 mt-1">{errors.subject.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="duration">Duration (minutes) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    {...register('duration', {
                      required: 'Duration is required',
                      min: { value: 1, message: 'Duration must be at least 1 minute' },
                      max: { value: 1440, message: 'Duration cannot exceed 1440 minutes (24 hours)' }
                    })}
                    placeholder="60"
                    disabled={creating}
                  />
                  {errors.duration && (
                    <p className="text-sm text-red-600 mt-1">{errors.duration.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Schedule
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    {...register('startDate', { required: 'Start date is required' })}
                    disabled={creating}
                  />
                  {errors.startDate && (
                    <p className="text-sm text-red-600 mt-1">{errors.startDate.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    {...register('startTime', { required: 'Start time is required' })}
                    disabled={creating}
                  />
                  {errors.startTime && (
                    <p className="text-sm text-red-600 mt-1">{errors.startTime.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="endDate">End Date *</Label>
                  <Input
                    id="endDate"
                    type="date"
                    {...register('endDate', { required: 'End date is required' })}
                    disabled={creating}
                  />
                  {errors.endDate && (
                    <p className="text-sm text-red-600 mt-1">{errors.endDate.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="endTime">End Time *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    {...register('endTime', { required: 'End time is required' })}
                    disabled={creating}
                  />
                  {errors.endTime && (
                    <p className="text-sm text-red-600 mt-1">{errors.endTime.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Marks & Grading */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Marks & Grading
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="totalMarks">Total Marks *</Label>
                  <Input
                    id="totalMarks"
                    type="number"
                    {...register('totalMarks', {
                      required: 'Total marks is required',
                      min: { value: 1, message: 'Total marks must be at least 1' }
                    })}
                    placeholder="100"
                    disabled={creating}
                  />
                  {errors.totalMarks && (
                    <p className="text-sm text-red-600 mt-1">{errors.totalMarks.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="passingMarks">Passing Marks *</Label>
                  <Input
                    id="passingMarks"
                    type="number"
                    {...register('passingMarks', {
                      required: 'Passing marks is required',
                      min: { value: 0, message: 'Passing marks cannot be negative' }
                    })}
                    placeholder="50"
                    disabled={creating}
                  />
                  {errors.passingMarks && (
                    <p className="text-sm text-red-600 mt-1">{errors.passingMarks.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center space-x-2 mb-2">
                    <Switch
                      id="negativeMarking"
                      {...register('negativeMarking')}
                      disabled={creating}
                    />
                    <Label htmlFor="negativeMarking">Enable Negative Marking</Label>
                  </div>

                  {watchNegativeMarking && (
                    <div>
                      <Label htmlFor="negativeMarkingValue">Negative Marking Value</Label>
                      <Input
                        id="negativeMarkingValue"
                        type="number"
                        step="0.1"
                        {...register('negativeMarkingValue', {
                          min: { value: 0, message: 'Cannot be negative' },
                          max: { value: 1, message: 'Cannot exceed 1' }
                        })}
                        placeholder="0.25"
                        disabled={creating}
                      />
                      {errors.negativeMarkingValue && (
                        <p className="text-sm text-red-600 mt-1">{errors.negativeMarkingValue.message}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center space-x-2 mb-2">
                    <Switch
                      id="unlimitedAttempts"
                      {...register('unlimitedAttempts')}
                      disabled={creating}
                    />
                    <Label htmlFor="unlimitedAttempts">Unlimited Attempts</Label>
                  </div>

                  {!watchUnlimitedAttempts && (
                    <div>
                      <Label htmlFor="maxAttempts">Maximum Attempts</Label>
                      <Input
                        id="maxAttempts"
                        type="number"
                        {...register('maxAttempts', {
                          required: !watchUnlimitedAttempts && 'Maximum attempts is required',
                          min: { value: 1, message: 'Attempts must be at least 1' },
                          max: { value: 10, message: 'Attempts cannot exceed 10' }
                        })}
                        placeholder="1"
                        disabled={creating}
                      />
                      {errors.maxAttempts && (
                        <p className="text-sm text-red-600 mt-1">{errors.maxAttempts.message}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructions & Settings */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-lg font-semibold mb-4">Instructions & Settings</h3>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="instructions">Instructions for Students</Label>
                  <Textarea
                    id="instructions"
                    {...register('instructions')}
                    rows={4}
                    placeholder="Enter instructions for students taking this exam"
                    disabled={creating}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="allowReview"
                      {...register('allowReview')}
                      disabled={creating}
                    />
                    <Label htmlFor="allowReview">Allow Review Before Submit</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="showResultsImmediately"
                      {...register('showResultsImmediately')}
                      disabled={creating}
                    />
                    <Label htmlFor="showResultsImmediately">Show Results Immediately</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="randomizeQuestions"
                      {...register('randomizeQuestions')}
                      disabled={creating}
                    />
                    <Label htmlFor="randomizeQuestions">Randomize Questions</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="randomizeOptions"
                      {...register('randomizeOptions')}
                      disabled={creating}
                    />
                    <Label htmlFor="randomizeOptions">Randomize Options</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="videoRecording"
                      {...register('videoRecording')}
                      disabled={creating}
                    />
                    <Label htmlFor="videoRecording">Enable Video Recording</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="mobileEnabled"
                      {...register('mobileEnabled')}
                      disabled={creating}
                    />
                    <Label htmlFor="mobileEnabled">Allow Mobile Devices</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={creating || disabled}
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Exam...
                </>
              ) : (
                'Create Exam & Assign Questions'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}