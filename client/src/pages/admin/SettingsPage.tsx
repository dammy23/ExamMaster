import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
  Settings,
  MoreHorizontal,
  Edit,
  Trash2,
  Database,
  Save,
  X
} from "lucide-react"
import { getSettings, createSetting, updateSetting, deleteSetting } from "@/api/settings"
import { useToast } from "@/hooks/useToast"

interface Setting {
  _id: string
  name: string
  value: string
  description?: string
  createdAt: string
  updatedAt: string
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedSetting, setSelectedSetting] = useState<Setting | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    value: "",
    description: ""
  })
  const [submitting, setSubmitting] = useState(false)
  
  const { toast } = useToast()

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      console.log('Fetching settings...')
      const response = await getSettings() as any
      setSettings(response.data.settings)
    } catch (error: any) {
      console.error('Error fetching settings:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load settings",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: "",
      value: "",
      description: ""
    })
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim() || !formData.value.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and value are required",
        variant: "destructive"
      })
      return
    }

    try {
      setSubmitting(true)
      await createSetting({
        name: formData.name.trim(),
        value: formData.value.trim(),
        description: formData.description.trim()
      })
      
      setShowCreateDialog(false)
      resetForm()
      fetchSettings()
      
      toast({
        title: "Success",
        description: "Setting created successfully"
      })
    } catch (error: any) {
      console.error("Create setting error:", error.message)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create setting"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedSetting || !formData.name.trim() || !formData.value.trim()) {
      toast({
        title: "Validation Error",
        description: "Name and value are required",
        variant: "destructive"
      })
      return
    }

    try {
      setSubmitting(true)
      await updateSetting(selectedSetting._id, {
        name: formData.name.trim(),
        value: formData.value.trim(),
        description: formData.description.trim()
      })
      
      setShowEditDialog(false)
      setSelectedSetting(null)
      resetForm()
      fetchSettings()
      
      toast({
        title: "Success",
        description: "Setting updated successfully"
      })
    } catch (error: any) {
      console.error("Update setting error:", error.message)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update setting"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!selectedSetting) return

    try {
      console.log('Deleting setting:', selectedSetting._id)
      await deleteSetting(selectedSetting._id)
      
      setShowDeleteDialog(false)
      setSelectedSetting(null)
      fetchSettings()
      
      toast({
        title: "Success",
        description: "Setting deleted successfully"
      })
    } catch (error: any) {
      console.error('Error deleting setting:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to delete setting",
        variant: "destructive"
      })
    }
  }

  const handleEdit = (setting: Setting) => {
    setSelectedSetting(setting)
    setFormData({
      name: setting.name,
      value: setting.value,
      description: setting.description || ""
    })
    setShowEditDialog(true)
  }

  const handleCreateClick = () => {
    resetForm()
    setShowCreateDialog(true)
  }

  const filteredSettings = settings.filter(setting => {
    return (
      setting.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      setting.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (setting.description && setting.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
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
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">Manage system configuration settings</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button onClick={handleCreateClick}>
              <Plus className="mr-2 h-4 w-4" />
              Add Setting
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Setting</DialogTitle>
              <DialogDescription>
                Add a new configuration setting to the system
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Name *</Label>
                <Input
                  id="create-name"
                  type="text"
                  placeholder="Enter setting name (e.g., APP_NAME)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="create-value">Value *</Label>
                <Input
                  id="create-value"
                  type="text"
                  placeholder="Enter setting value"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="create-description">Description</Label>
                <Textarea
                  id="create-description"
                  placeholder="Enter description (optional)"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="min-h-[80px]"
                />
              </div>
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setShowCreateDialog(false)
                    resetForm()
                  }}
                  disabled={submitting}
                >
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Setting
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Settings
            </CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{settings.length}</div>
            <p className="text-xs text-muted-foreground">
              Configuration settings in system
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Last Updated
            </CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settings.length > 0 
                ? new Date(Math.max(...settings.map(s => new Date(s.updatedAt).getTime()))).toLocaleDateString()
                : "N/A"
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Most recent setting update
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings List</CardTitle>
          <CardDescription>
            View and manage all configuration settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search settings..."
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
                  <TableHead>Name</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSettings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchTerm 
                        ? "No settings match your search criteria" 
                        : "No settings created yet. Create your first setting to get started."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSettings.map((setting) => (
                    <TableRow key={setting._id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Settings className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium font-mono text-sm">{setting.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="truncate font-mono text-sm bg-muted px-2 py-1 rounded">
                          {setting.value}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <span className="truncate text-sm">
                          {setting.description || "No description"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {new Date(setting.updatedAt).toLocaleDateString()}
                        </span>
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
                            <DropdownMenuItem
                              onClick={() => handleEdit(setting)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Setting
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setSelectedSetting(setting)
                                setShowDeleteDialog(true)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Setting
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Setting Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Setting</DialogTitle>
            <DialogDescription>
              Make changes to the setting configuration
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                type="text"
                placeholder="Enter setting name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-value">Value *</Label>
              <Input
                id="edit-value"
                type="text"
                placeholder="Enter setting value"
                value={formData.value}
                onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Enter description (optional)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[80px]"
              />
            </div>
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowEditDialog(false)
                  setSelectedSetting(null)
                  resetForm()
                }}
                disabled={submitting}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Update Setting
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Setting</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedSetting?.name}"? This action cannot be undone and may affect system functionality.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowDeleteDialog(false)
                setSelectedSetting(null)
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}