import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { createSubject, updateSubject, type Subject, type CreateSubjectData } from "@/api/subjects"
import { useToast } from "@/hooks/useToast"

interface SubjectFormProps {
  subject?: Subject
  onSuccess: () => void
}

export function SubjectForm({ subject, onSuccess }: SubjectFormProps) {
  const [formData, setFormData] = useState<CreateSubjectData>({
    name: "",
    description: "",
    code: "",
    isActive: true
  })
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()
  const isEditing = !!subject

  useEffect(() => {
    if (subject) {
      setFormData({
        name: subject.name,
        description: subject.description || "",
        code: subject.code,
        isActive: subject.isActive
      })
    }
  }, [subject])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Subject name is required",
        variant: "destructive"
      })
      return
    }
    
    if (!formData.code.trim()) {
      toast({
        title: "Validation Error",
        description: "Subject code is required",
        variant: "destructive"
      })
      return
    }

    if (formData.code.length < 2 || formData.code.length > 20) {
      toast({
        title: "Validation Error",
        description: "Subject code must be between 2 and 20 characters",
        variant: "destructive"
      })
      return
    }

    if (formData.name.length < 2 || formData.name.length > 100) {
      toast({
        title: "Validation Error",
        description: "Subject name must be between 2 and 100 characters",
        variant: "destructive"
      })
      return
    }

    if (formData.description && formData.description.length > 500) {
      toast({
        title: "Validation Error",
        description: "Description cannot exceed 500 characters",
        variant: "destructive"
      })
      return
    }

    try {
      setLoading(true)
      
      const submitData = {
        ...formData,
        code: formData.code.toUpperCase().trim(),
        name: formData.name.trim(),
        description: formData.description?.trim() || ""
      }
      
      if (isEditing && subject) {
        console.log('Updating subject:', subject._id, submitData)
        await updateSubject(subject._id, submitData)
      } else {
        console.log('Creating new subject:', submitData)
        await createSubject(submitData)
      }
      
      onSuccess()
    } catch (error: any) {
      console.error('Error saving subject:', error)
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEditing ? 'update' : 'create'} subject`,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof CreateSubjectData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">
            Subject Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="Enter subject name (e.g., Mathematics)"
            disabled={loading}
            maxLength={100}
          />
          <p className="text-sm text-muted-foreground">
            {formData.name.length}/100 characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="code">
            Subject Code <span className="text-red-500">*</span>
          </Label>
          <Input
            id="code"
            value={formData.code}
            onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
            placeholder="Enter subject code (e.g., MATH)"
            disabled={loading}
            maxLength={20}
            className="uppercase"
          />
          <p className="text-sm text-muted-foreground">
            Short unique code for the subject. {formData.code.length}/20 characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            placeholder="Enter subject description (optional)"
            disabled={loading}
            rows={4}
            maxLength={500}
          />
          <p className="text-sm text-muted-foreground">
            {formData.description.length}/500 characters
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="isActive"
            checked={formData.isActive}
            onCheckedChange={(checked) => handleInputChange('isActive', checked)}
            disabled={loading}
          />
          <Label htmlFor="isActive">
            Active Subject
          </Label>
        </div>
        <p className="text-sm text-muted-foreground">
          Inactive subjects will not be available for new exams
        </p>
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="submit"
          disabled={loading || !formData.name.trim() || !formData.code.trim()}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {isEditing ? "Updating..." : "Creating..."}
            </>
          ) : (
            isEditing ? "Update Subject" : "Create Subject"
          )}
        </Button>
      </div>
    </form>
  )
}