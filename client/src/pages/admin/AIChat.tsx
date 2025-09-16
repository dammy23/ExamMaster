import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/useToast"
import { 
  MessageSquare, 
  Send, 
  Paperclip, 
  Bot, 
  User,
  Loader2,
  FileText,
  X,
  Zap,
  Brain,
  Settings
} from "lucide-react"
import { sendChatMessage, getChatHistory, getAIAgents, uploadChatFile } from "@/api/aiChat"
import { getActiveAIPlatforms } from "@/api/aiPlatform"

interface ChatMessage {
  _id: string
  message: string
  response: string
  timestamp: Date
  modelId: string
  agentId: string
  isUser?: boolean
  isBot?: boolean
}

interface AIPlatform {
  _id: string
  name: string
  displayName: string
  description: string
  configuration: {
    model: string
  }
  isDefault: boolean
}

interface AIAgent {
  _id: string
  name: string
  description: string
  capabilities: string[]
  isActive: boolean
}

export function AIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState("")
  const [selectedAgent, setSelectedAgent] = useState("")
  const [platforms, setPlatforms] = useState<AIPlatform[]>([])
  const [agents, setAgents] = useState<AIAgent[]>([])
  const [attachedFile, setAttachedFile] = useState<File | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const { toast } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        console.log('AI Chat - Fetching initial data...')
        const [platformsResponse, agentsResponse, historyResponse] = await Promise.all([
          getActiveAIPlatforms(),
          getAIAgents(),
          getChatHistory()
        ])

        const platformsData = (platformsResponse as any).data.platforms
        const agentsData = (agentsResponse as any).agents
        const historyData = (historyResponse as any).messages

        console.log('AI Chat - Platforms received:', platformsData)
        console.log('AI Chat - Agents received:', agentsData)
        console.log('AI Chat - History received:', historyData)

        setPlatforms(platformsData || [])
        setAgents(agentsData || [])
        
        // Set default selections
        const defaultPlatform = platformsData?.find((p: AIPlatform) => p.isDefault) || platformsData?.[0]
        const defaultAgent = agentsData?.find((a: AIAgent) => a.isActive) || agentsData?.[0]
        
        if (defaultPlatform) setSelectedPlatform(defaultPlatform._id)
        if (defaultAgent) setSelectedAgent(defaultAgent._id)

        // Transform history to display format
        const transformedMessages: ChatMessage[] = []
        historyData?.forEach((msg: ChatMessage) => {
          transformedMessages.push({
            ...msg,
            isUser: true,
            isBot: false
          })
          transformedMessages.push({
            ...msg,
            _id: msg._id + '_response',
            message: msg.response,
            isUser: false,
            isBot: true
          })
        })
        setMessages(transformedMessages)

      } catch (error) {
        console.error('Error fetching AI Chat data:', error)
        toast({
          title: "Error",
          description: "Failed to load AI Chat data",
          variant: "destructive"
        })
      } finally {
        setLoadingHistory(false)
      }
    }

    fetchInitialData()
  }, [toast])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 5MB",
          variant: "destructive"
        })
        return
      }
      setAttachedFile(file)
      console.log('AI Chat - File selected:', file.name, file.size)
    }
  }

  const removeAttachedFile = () => {
    setAttachedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isLoading) return

    if (!selectedPlatform || !selectedAgent) {
      toast({
        title: "Selection Required",
        description: "Please select both an AI platform and agent",
        variant: "destructive"
      })
      return
    }

    const userMessage = newMessage.trim()
    console.log('AI Chat - Sending message:', userMessage)
    console.log('AI Chat - Selected platform:', selectedPlatform)
    console.log('AI Chat - Selected agent:', selectedAgent)
    console.log('AI Chat - Attached file:', attachedFile?.name)

    // Add user message to chat
    const userChatMessage: ChatMessage = {
      _id: `user_${Date.now()}`,
      message: userMessage,
      response: "",
      timestamp: new Date(),
      modelId: selectedPlatform,
      agentId: selectedAgent,
      isUser: true,
      isBot: false
    }

    setMessages(prev => [...prev, userChatMessage])
    setNewMessage("")
    setIsLoading(true)

    try {
      const response = await sendChatMessage({
        message: userMessage,
        modelId: selectedPlatform,
        agentId: selectedAgent,
        fileAttachment: attachedFile || undefined
      })

      const responseData = response as any
      console.log('AI Chat - Response received:', responseData)

      // Add bot response to chat
      const botChatMessage: ChatMessage = {
        _id: responseData.messageId || `bot_${Date.now()}`,
        message: responseData.response,
        response: responseData.response,
        timestamp: new Date(),
        modelId: selectedPlatform,
        agentId: selectedAgent,
        isUser: false,
        isBot: true
      }

      setMessages(prev => [...prev, botChatMessage])
      
      // Clear attached file after sending
      if (attachedFile) {
        removeAttachedFile()
      }

      toast({
        title: "Message Sent",
        description: "AI response received successfully"
      })

    } catch (error) {
      console.error("AI Chat error:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as any)?.message || "Failed to send message"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  const selectedPlatformInfo = platforms.find(p => p._id === selectedPlatform)
  const selectedAgentInfo = agents.find(a => a._id === selectedAgent)

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Chat Assistant</h1>
          <p className="text-muted-foreground">
            Interact with AI agents to get help with ExamMaster features and tasks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <Badge variant="outline" className="gap-1">
            <Zap className="h-3 w-3" />
            AI Powered
          </Badge>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Configuration Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuration
            </CardTitle>
            <CardDescription>Select AI platform and agent</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* AI Platform Selection */}
            {platforms.length > 0 ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">AI Platform</label>
                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select AI platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((platform) => (
                      <SelectItem key={platform._id} value={platform._id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{platform.displayName}</span>
                          <span className="text-xs text-muted-foreground">
                            {platform.configuration.model} • {platform.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPlatformInfo && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {selectedPlatformInfo.description}
                    </p>
                    <p className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      Model: {selectedPlatformInfo.configuration.model}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">AI Platform</label>
                <div className="p-4 border-2 border-dashed border-muted-foreground/25 rounded-lg text-center">
                  <Bot className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">No AI platforms configured</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Go to Settings → AI Platforms to configure OpenAI, Anthropic, or Ollama
                  </p>
                </div>
              </div>
            )}

            {/* AI Agent Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">AI Agent</label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select AI agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.filter(a => a.isActive).map((agent) => (
                    <SelectItem key={agent._id} value={agent._id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-xs text-muted-foreground">{agent.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAgentInfo && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {selectedAgentInfo.description}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedAgentInfo.capabilities.map((capability, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {capability}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Chat Interface */}
        <Card className="lg:col-span-3 flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </CardTitle>
            <CardDescription>Ask questions and get AI assistance</CardDescription>
          </CardHeader>
          
          {/* Messages Area */}
          <CardContent className="flex-1 flex flex-col p-0">
            <ScrollArea className="flex-1 p-4">
              {loadingHistory ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading chat history...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium mb-2">Welcome to AI Chat!</p>
                      <p className="text-sm">
                        Ask me anything about ExamMaster features, exam creation, or student management.
                      </p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div key={message._id} className={`flex gap-3 ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex gap-3 max-w-[80%] ${message.isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                            message.isUser 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {message.isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                          </div>
                          <div className={`rounded-lg px-4 py-2 ${
                            message.isUser 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex gap-3 justify-start">
                      <div className="flex gap-3 max-w-[80%]">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">AI is thinking...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t">
              {/* File Attachment Display */}
              {attachedFile && (
                <div className="mb-3 flex items-center gap-2 p-2 bg-muted rounded-lg">
                  <FileText className="h-4 w-4" />
                  <span className="text-sm flex-1">{attachedFile.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeAttachedFile}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  accept=".txt,.pdf,.doc,.docx,.csv,.xlsx,.json"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="shrink-0"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask me anything about ExamMaster..."
                  className="flex-1 min-h-[44px] max-h-32 resize-none"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isLoading || !selectedPlatform || !selectedAgent}
                  className="shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {(!selectedPlatform || !selectedAgent) && (
                <p className="text-xs text-muted-foreground mt-2">
                  Please select an AI platform and agent to start chatting
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}