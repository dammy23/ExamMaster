import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  X,
  Bot,
  TestTube,
  CheckCircle,
  XCircle,
  AlertCircle,
  Star,
  Eye,
  EyeOff
} from "lucide-react"
import { getSettings, createSetting, updateSetting, deleteSetting } from "@/api/settings"
import { 
  getAIPlatforms, 
  updateAIPlatform, 
  testAIPlatform, 
  setDefaultAIPlatform,
  initializeAIPlatforms 
} from "@/api/aiPlatform"
import { useToast } from "@/hooks/useToast"

interface Setting {
  _id: string
  name: string
  value: string
  description?: string
  createdAt: string
  updatedAt: string
}

interface AIPlatform {
  _id: string
  name: string
  displayName: string
  description: string
  configuration: {
    apiKey?: string
    baseUrl?: string
    model: string
    temperature: number
    maxTokens: number
    topP?: number
    presencePenalty?: number
    frequencyPenalty?: number
  }
  isActive: boolean
  isDefault: boolean
  lastTested?: string
  testStatus: 'success' | 'failed' | 'not_tested'
  testError?: string
  usage: {
    totalRequests: number
    totalTokens: number
    lastUsed?: string
  }
  createdAt: string
  updatedAt: string
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [platforms, setPlatforms] = useState<AIPlatform[]>([])
  const [loading, setLoading] = useState(true)
  const [platformsLoading, setPlatformsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedSetting, setSelectedSetting] = useState<Setting | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<AIPlatform | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [activeTab, setActiveTab] = useState("general")
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null)
  const [showApiKeys, setShowApiKeys] = useState<{ [key: string]: boolean }>({})
  
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    value: "",
    description: ""
  })
  const [platformFormData, setPlatformFormData] = useState({
    displayName: "",
    description: "",
    configuration: {
      apiKey: "",
      baseUrl: "",
      model: "",
      temperature: 0.7,
      maxTokens: 4096,
      topP: 1,
      presencePenalty: 0,
      frequencyPenalty: 0
    },
    isActive: true
  })
  const [submitting, setSubmitting] = useState(false)
  
  const { toast } = useToast()

  useEffect(() => {
    fetchSettings()
    fetchPlatforms()
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

  const fetchPlatforms = async () => {
    try {
      console.log('Fetching AI platforms...')
      const response = await getAIPlatforms() as any
      setPlatforms(response.data.platforms)
      console.log('AI platforms loaded:', response.data.platforms.length)
    } catch (error: any) {
      console.error('Error fetching AI platforms:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to load AI platforms",
        variant: "destructive"
      })
    } finally {
      setPlatformsLoading(false)
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

  // AI Platform Management Functions
  const handleUpdatePlatform = async (platform: AIPlatform, updates: any) => {
    try {
      setSubmitting(true)
      await updateAIPlatform(platform._id, updates)
      
      await fetchPlatforms()
      
      toast({
        title: "Success",
        description: "AI platform updated successfully"
      })
    } catch (error: any) {
      console.error("Update AI platform error:", error.message)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update AI platform"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleTestPlatform = async (platform: AIPlatform) => {
    try {
      setTestingPlatform(platform._id)
      const response = await testAIPlatform(platform._id) as any
      
      await fetchPlatforms()
      
      if (response.data.testResult.success) {
        toast({
          title: "Test Successful",
          description: `${platform.displayName} is working correctly`
        })
      } else {
        toast({
          variant: "destructive",
          title: "Test Failed",
          description: response.data.testResult.error || "Platform test failed"
        })
      }
    } catch (error: any) {
      console.error("Test AI platform error:", error.message)
      toast({
        variant: "destructive",
        title: "Test Failed",
        description: error.message || "Failed to test AI platform"
      })
    } finally {
      setTestingPlatform(null)
    }
  }

  const handleSetDefault = async (platform: AIPlatform) => {
    try {
      setSubmitting(true)
      await setDefaultAIPlatform(platform._id)
      
      await fetchPlatforms()
      
      toast({
        title: "Success",
        description: `${platform.displayName} set as default platform`
      })
    } catch (error: any) {
      console.error("Set default platform error:", error.message)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to set default platform"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleInitializePlatforms = async () => {
    try {
      setSubmitting(true)
      await initializeAIPlatforms()
      
      await fetchPlatforms()
      
      toast({
        title: "Success",
        description: "Default AI platforms initialized successfully"
      })
    } catch (error: any) {
      console.error("Initialize platforms error:", error.message)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to initialize platforms"
      })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleApiKeyVisibility = (platformId: string) => {
    setShowApiKeys(prev => ({
      ...prev,
      [platformId]: !prev[platformId]
    }))
  }

  const getTestStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />
    }
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
          <p className="text-muted-foreground">Manage system configuration and AI platform settings</p>
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General Settings</TabsTrigger>
          <TabsTrigger value="ai-platforms">AI Platforms</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="ai-platforms" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">AI Platform Configuration</h2>
              <p className="text-sm text-muted-foreground">
                Configure OpenAI, Anthropic, and Ollama AI platforms for the chat system
              </p>
            </div>
            <Button onClick={handleInitializePlatforms} disabled={submitting} variant="outline">
              <Bot className="mr-2 h-4 w-4" />
              Initialize Platforms
            </Button>
          </div>

          {platformsLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Active Platforms
                    </CardTitle>
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{platforms.filter(p => p.isActive).length}</div>
                    <p className="text-xs text-muted-foreground">
                      Available AI platforms
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Usage
                    </CardTitle>
                    <Database className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {platforms.reduce((sum, p) => sum + p.usage.totalRequests, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Total requests processed
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Default Platform
                    </CardTitle>
                    <Star className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {platforms.find(p => p.isDefault)?.displayName || "None"}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Currently selected default
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                {platforms.map((platform) => (
                  <Card key={platform._id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <CardTitle className="flex items-center gap-2">
                            <Bot className="h-5 w-5" />
                            {platform.displayName}
                            {platform.isDefault && (
                              <Badge variant="default" className="gap-1">
                                <Star className="h-3 w-3" />
                                Default
                              </Badge>
                            )}
                          </CardTitle>
                          <div className="flex items-center gap-2">
                            {getTestStatusIcon(platform.testStatus)}
                            <Switch
                              checked={platform.isActive}
                              onCheckedChange={(checked) => 
                                handleUpdatePlatform(platform, { isActive: checked })
                              }
                              disabled={submitting}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestPlatform(platform)}
                            disabled={testingPlatform === platform._id || !platform.isActive}
                          >
                            {testingPlatform === platform._id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2"></div>
                                Testing...
                              </>
                            ) : (
                              <>
                                <TestTube className="mr-2 h-3 w-3" />
                                Test
                              </>
                            )}
                          </Button>
                          {!platform.isDefault && platform.isActive && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSetDefault(platform)}
                              disabled={submitting}
                            >
                              <Star className="mr-2 h-3 w-3" />
                              Set Default
                            </Button>
                          )}
                        </div>
                      </div>
                      <CardDescription>
                        {platform.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor={`${platform.name}-model`}>Model</Label>
                            <Input
                              id={`${platform.name}-model`}
                              value={platform.configuration.model}
                              onChange={(e) => 
                                handleUpdatePlatform(platform, {
                                  configuration: { ...platform.configuration, model: e.target.value }
                                })
                              }
                              disabled={submitting}
                              placeholder="Model name"
                            />
                          </div>
                          
                          {(platform.name === 'openai' || platform.name === 'anthropic') && (
                            <div className="space-y-2">
                              <Label htmlFor={`${platform.name}-apikey`}>API Key</Label>
                              <div className="flex items-center space-x-2">
                                <Input
                                  id={`${platform.name}-apikey`}
                                  type={showApiKeys[platform._id] ? "text" : "password"}
                                  value={platform.configuration.apiKey || ""}
                                  onChange={(e) => 
                                    handleUpdatePlatform(platform, {
                                      configuration: { ...platform.configuration, apiKey: e.target.value }
                                    })
                                  }
                                  disabled={submitting}
                                  placeholder="Enter API key"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => toggleApiKeyVisibility(platform._id)}
                                  className="shrink-0"
                                >
                                  {showApiKeys[platform._id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          )}
                          
                          {platform.name === 'ollama' && (
                            <div className="space-y-2">
                              <Label htmlFor={`${platform.name}-baseurl`}>Base URL</Label>
                              <Input
                                id={`${platform.name}-baseurl`}
                                value={platform.configuration.baseUrl || ""}
                                onChange={(e) => 
                                  handleUpdatePlatform(platform, {
                                    configuration: { ...platform.configuration, baseUrl: e.target.value }
                                  })
                                }
                                disabled={submitting}
                                placeholder="http://localhost:11434"
                              />
                            </div>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor={`${platform.name}-temperature`}>Temperature</Label>
                            <Input
                              id={`${platform.name}-temperature`}
                              type="number"
                              min="0"
                              max="2"
                              step="0.1"
                              value={platform.configuration.temperature}
                              onChange={(e) => 
                                handleUpdatePlatform(platform, {
                                  configuration: { ...platform.configuration, temperature: parseFloat(e.target.value) }
                                })
                              }
                              disabled={submitting}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`${platform.name}-maxtokens`}>Max Tokens</Label>
                            <Input
                              id={`${platform.name}-maxtokens`}
                              type="number"
                              min="1"
                              max="100000"
                              value={platform.configuration.maxTokens}
                              onChange={(e) => 
                                handleUpdatePlatform(platform, {
                                  configuration: { ...platform.configuration, maxTokens: parseInt(e.target.value) }
                                })
                              }
                              disabled={submitting}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <div className="font-medium text-muted-foreground">Requests</div>
                            <div className="text-lg font-bold">{platform.usage.totalRequests}</div>
                          </div>
                          <div>
                            <div className="font-medium text-muted-foreground">Tokens</div>
                            <div className="text-lg font-bold">{platform.usage.totalTokens.toLocaleString()}</div>
                          </div>
                          <div>
                            <div className="font-medium text-muted-foreground">Last Used</div>
                            <div className="text-lg font-bold">
                              {platform.usage.lastUsed 
                                ? new Date(platform.usage.lastUsed).toLocaleDateString() 
                                : "Never"}
                            </div>
                          </div>
                          <div>
                            <div className="font-medium text-muted-foreground">Last Tested</div>
                            <div className="text-lg font-bold">
                              {platform.lastTested 
                                ? new Date(platform.lastTested).toLocaleDateString() 
                                : "Never"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {platform.testError && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                          <div className="flex items-start">
                            <XCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2 shrink-0" />
                            <div>
                              <div className="font-medium text-red-800 text-sm">Test Error</div>
                              <div className="text-red-700 text-sm mt-1">{platform.testError}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="advanced" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4" />
                Database Seeding
              </CardTitle>
              <CardDescription>
                Developer tool for populating the database with sample data. Not part of day-to-day administration.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" asChild>
                <Link to="/admin/seeding">Open Database Seeding</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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