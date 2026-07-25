import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DialogFooter } from "@/components/ui/dialog"
import type { Question } from "@/api/questions"

export interface QuestionPayload {
  type: Question['type']
  question: string
  difficulty: Question['difficulty']
  marks: number
  explanation: string
  options?: string[]
  correctAnswers: string[]
}

export interface QuestionFormInitialValues {
  type: Question['type']
  question: string
  options?: string[]
  correctAnswers: string[]
  difficulty: Question['difficulty']
  marks: number
  explanation: string
}

interface QuestionFormProps {
  mode: 'create' | 'edit'
  initialValues?: QuestionFormInitialValues
  onSubmit: (payload: QuestionPayload) => Promise<void>
  submitting: boolean
}

function padOptions(source?: string[]): string[] {
  const padded = ['', '', '', '', '', '']
  ;(source || []).forEach((opt, index) => {
    if (index < 6) padded[index] = opt
  })
  return padded
}

export function QuestionForm({ mode, initialValues, onSubmit, submitting }: QuestionFormProps) {
  const [questionType, setQuestionType] = useState<Question['type']>(initialValues?.type || 'multiple-choice')
  const [options, setOptions] = useState<string[]>(() => padOptions(initialValues?.options))
  const [correctAnswers, setCorrectAnswers] = useState<string[]>(initialValues?.correctAnswers || [])
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({})
  const [questionText, setQuestionText] = useState(initialValues?.question || '')
  const [explanationText, setExplanationText] = useState(initialValues?.explanation || '')

  const validateForm = (formData: FormData) => {
    const errors: { [key: string]: string } = {}

    const marks = formData.get('marks') as string

    if (!questionText || questionText.replace(/<[^>]*>/g, '').trim().length < 10) {
      errors.question = 'Question must be at least 10 characters long'
    }

    if (!marks || parseInt(marks) < 1) {
      errors.marks = 'Marks must be at least 1'
    }

    if (questionType === 'multiple-choice') {
      const validOptions = options.filter(opt => opt.trim())
      if (validOptions.length < 4) {
        errors.options = 'Multiple choice questions must have at least 4 options'
      }
      if (validOptions.length > 6) {
        errors.options = 'Multiple choice questions can have at most 6 options'
      }
      if (correctAnswers.length === 0) {
        errors.correctAnswers = 'Please select at least one correct answer'
      }
    }

    if (questionType === 'true-false') {
      const trueFalseAnswer = formData.get('trueFalseAnswer') as string
      if (!trueFalseAnswer) {
        errors.trueFalseAnswer = 'Please select the correct answer'
      }
    }

    if (questionType === 'theory') {
      const theoryAnswer = formData.get('theoryAnswer') as string
      if (!theoryAnswer || theoryAnswer.trim().length === 0) {
        errors.theoryAnswer = 'Please provide a sample answer'
      }
    }

    return errors
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setValidationErrors({})

    const formData = new FormData(e.currentTarget)

    const errors = validateForm(formData)
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors)
      return
    }

    const payload: QuestionPayload = {
      type: questionType,
      question: questionText,
      difficulty: formData.get('difficulty') as Question['difficulty'],
      marks: parseInt(formData.get('marks') as string),
      explanation: explanationText,
      options: questionType === 'multiple-choice' ? options.filter(opt => opt.trim()) : undefined,
      correctAnswers: questionType === 'true-false'
        ? [formData.get('trueFalseAnswer') as string]
        : questionType === 'theory'
        ? [formData.get('theoryAnswer') as string]
        : correctAnswers
    }

    await onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="question">Question *</Label>
        <RichTextEditor
          value={questionText}
          onChange={setQuestionText}
          placeholder="Enter your question here (minimum 10 characters)..."
          height="150px"
          className={validationErrors.question ? "border-red-500" : ""}
        />
        {validationErrors.question && (
          <p className="text-sm text-red-500">{validationErrors.question}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="type">Question Type *</Label>
        <Select value={questionType} onValueChange={(value: any) => setQuestionType(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
            <SelectItem value="true-false">True/False</SelectItem>
            <SelectItem value="theory">Theory</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="difficulty">Difficulty *</Label>
          <Select name="difficulty" required defaultValue={initialValues?.difficulty}>
            <SelectTrigger>
              <SelectValue placeholder="Select difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="marks">Marks *</Label>
          <Input
            id="marks"
            name="marks"
            type="number"
            min="1"
            placeholder="5"
            required
            defaultValue={initialValues?.marks}
            className={validationErrors.marks ? "border-red-500" : ""}
          />
          {validationErrors.marks && (
            <p className="text-sm text-red-500">{validationErrors.marks}</p>
          )}
        </div>
      </div>

      {questionType === 'multiple-choice' && (
        <div className="space-y-2">
          <Label>Options * (Minimum 4, Maximum 6)</Label>
          {options.map((option, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                placeholder={`Option ${index + 1}${index < 4 ? ' (Required)' : ' (Optional)'}`}
                value={option}
                onChange={(e) => {
                  const newOptions = [...options]
                  newOptions[index] = e.target.value
                  setOptions(newOptions)
                }}
                className={index < 4 ? "border-blue-200" : ""}
              />
              <input
                type="checkbox"
                checked={correctAnswers.includes(option) && option.trim() !== ''}
                onChange={(e) => {
                  if (option.trim() === '') return

                  if (e.target.checked) {
                    setCorrectAnswers([...correctAnswers, option])
                  } else {
                    setCorrectAnswers(correctAnswers.filter(ans => ans !== option))
                  }
                }}
                disabled={option.trim() === ''}
                className="w-4 h-4"
              />
              <Label className="text-xs">Correct</Label>
            </div>
          ))}
          <p className="text-sm text-muted-foreground">
            Fill at least 4 options (first 4 are required). You can add up to 6 options total.
          </p>
          {validationErrors.options && (
            <p className="text-sm text-red-500">{validationErrors.options}</p>
          )}
          {validationErrors.correctAnswers && (
            <p className="text-sm text-red-500">{validationErrors.correctAnswers}</p>
          )}
        </div>
      )}

      {questionType === 'true-false' && (
        <div className="space-y-2">
          <Label htmlFor="trueFalseAnswer">Correct Answer *</Label>
          <Select name="trueFalseAnswer" required defaultValue={initialValues?.correctAnswers?.[0]}>
            <SelectTrigger className={validationErrors.trueFalseAnswer ? "border-red-500" : ""}>
              <SelectValue placeholder="Select correct answer" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
          {validationErrors.trueFalseAnswer && (
            <p className="text-sm text-red-500">{validationErrors.trueFalseAnswer}</p>
          )}
        </div>
      )}

      {questionType === 'theory' && (
        <div className="space-y-2">
          <Label htmlFor="theoryAnswer">Sample Answer *</Label>
          <Textarea
            id="theoryAnswer"
            name="theoryAnswer"
            placeholder="Provide a sample answer..."
            required
            rows={2}
            defaultValue={initialValues?.correctAnswers?.[0]}
            className={validationErrors.theoryAnswer ? "border-red-500" : ""}
          />
          {validationErrors.theoryAnswer && (
            <p className="text-sm text-red-500">{validationErrors.theoryAnswer}</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="explanation">Explanation (Optional)</Label>
        <RichTextEditor
          value={explanationText}
          onChange={setExplanationText}
          placeholder="Add explanation to help students understand..."
          height="120px"
        />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : mode === 'create' ? "Create Question" : "Update Question"}
        </Button>
      </DialogFooter>
    </form>
  )
}
