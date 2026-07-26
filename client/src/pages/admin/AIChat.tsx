import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
  Settings,
  CheckCircle,
  AlertCircle,
  Save,
  Download
} from "lucide-react"
import { sendChatMessage, getChatHistory, getAIAgents } from "@/api/aiChat"
import { LoadingState } from "@/components/ui/loading-state"
import { getActiveAIPlatforms } from "@/api/aiPlatform"
import { AIChatQuestionAssignment } from "@/components/AIChatQuestionAssignment"
import { detectIntention, type DetectedIntent } from "@/utils/intentDetection"
import { parseGeneratedQuestions } from "@/utils/parseGeneratedQuestions"
import { IntentConfirmationDialog, CreationDialogManager } from "@/components/IntentConfirmationDialog"
import ReactMarkdown from "react-markdown"

interface ChatMessage {
  _id: string
  message: string
  response: string
  timestamp: Date
  modelId: string
  agentId: string
  isUser?: boolean
  isBot?: boolean
  isFallback?: boolean
  generatedQuestions?: any[]
  showAssignmentFlow?: boolean
}

interface ChatPagination {
  currentPage: number
  totalPages: number
  totalCount: number
  hasMore: boolean
  limit: number
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
  isConfigured: boolean
  configurationStatus: string
  configurationMessage: string
}

interface AIAgent {
  _id: string
  name: string
  description: string
  capabilities: string[]
  isActive: boolean
}

// Minimal element styling for AI-generated markdown — Tailwind's preflight reset strips
// default list/heading spacing, so react-markdown's output needs explicit classNames here.
const MARKDOWN_COMPONENTS = {
  p: ({ children }: any) => <p className="text-sm whitespace-pre-wrap mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: any) => <ul className="text-sm list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="text-sm list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  code: ({ children }: any) => <code className="text-xs bg-background/50 rounded px-1 py-0.5 font-mono">{children}</code>,
  pre: ({ children }: any) => <pre className="text-xs bg-background/50 rounded p-2 overflow-x-auto mb-2">{children}</pre>,
  a: ({ children, href }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
      {children}
    </a>
  )
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [pagination, setPagination] = useState<ChatPagination | null>(null)
  const [assigningQuestions, setAssigningQuestions] = useState<{ [key: string]: boolean }>({})

  // Intent detection and creation dialog state
  const [detectedIntent, setDetectedIntent] = useState<DetectedIntent>(null)
  const [pendingMessage, setPendingMessage] = useState<string>("")
  const [showIntentConfirmation, setShowIntentConfirmation] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const { toast } = useToast()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Load more chat history (older messages)
  const loadMoreMessages = async () => {
    if (!pagination || !pagination.hasMore || loadingMore) return

    setLoadingMore(true)
    try {
      const historyResponse = await getChatHistory({
        page: pagination.currentPage + 1,
        limit: 20
      })

      const historyData = historyResponse.messages
      const newPagination = historyResponse.pagination

      // Preserve scroll position when adding older messages
      const scrollContainer = messagesContainerRef.current
      const previousScrollHeight = scrollContainer?.scrollHeight || 0

      // Transform and prepend older messages to current list
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

      setMessages(prev => [...transformedMessages, ...prev])
      setPagination(newPagination)

      // Restore scroll position after DOM update
      setTimeout(() => {
        if (scrollContainer) {
          const newScrollHeight = scrollContainer.scrollHeight
          const heightDiff = newScrollHeight - previousScrollHeight
          scrollContainer.scrollTop = heightDiff
        }
      }, 0)

    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load more messages",
        variant: "destructive"
      })
    } finally {
      setLoadingMore(false)
    }
  }

  // Start question assignment flow
  const handleSaveQuestions = (messageId: string, questions: any[]) => {
    if (!questions || questions.length === 0) return

    setAssigningQuestions(prev => ({ ...prev, [messageId]: true }))

    // Update the message to show assignment component
    setMessages(prev => prev.map(msg =>
      msg._id === messageId
        ? { ...msg, showAssignmentFlow: true }
        : msg
    ))
  }

  // Handle assignment completion
  const handleAssignmentComplete = (messageId: string) => {
    setAssigningQuestions(prev => ({ ...prev, [messageId]: false }))

    // Remove questions and assignment flow from message
    setMessages(prev => prev.map(msg =>
      msg._id === messageId
        ? { ...msg, generatedQuestions: undefined, showAssignmentFlow: false }
        : msg
    ))
  }

  // Handle assignment cancellation
  const handleAssignmentCancel = (messageId: string) => {
    setAssigningQuestions(prev => ({ ...prev, [messageId]: false }))

    // Hide assignment flow but keep questions
    setMessages(prev => prev.map(msg =>
      msg._id === messageId
        ? { ...msg, showAssignmentFlow: false }
        : msg
    ))
  }

  // Intent detection and handling functions
  const handleIntentConfirm = () => {
    setShowIntentConfirmation(false)
    setShowCreateDialog(true)
  }

  const handleIntentCancel = () => {
    setShowIntentConfirmation(false)
    // Proceed with sending the original message to AI
    proceedWithAIMessage(pendingMessage)
  }

  const handleCreationDialogClose = () => {
    setShowCreateDialog(false)
    setDetectedIntent(null)
    setPendingMessage("")
  }

  const handleCreationSuccess = () => {
    // Clear the message since user completed the intended action
    setNewMessage("")
  }

  const proceedWithAIMessage = async (message: string) => {
    // Call the actual AI message sending logic
    await sendMessageToAI(message)
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [platformsResponse, agentsResponse, historyResponse] = await Promise.all([
          getActiveAIPlatforms(),
          getAIAgents(),
          getChatHistory({ page: 1, limit: 20 }) // Load first page of messages
        ])

        const platformsData = (platformsResponse as any).data.platforms
        const agentsData = (agentsResponse as any).agents
        const historyData = historyResponse.messages
        const historyPagination = historyResponse.pagination

        setPlatforms(platformsData || [])
        setAgents(agentsData || [])
        setPagination(historyPagination)

        // Set default selections - only select configured platforms
        const defaultPlatform = platformsData?.find((p: AIPlatform) => p.isDefault && p.isConfigured) ||
                               platformsData?.find((p: AIPlatform) => p.isConfigured)
        const defaultAgent = agentsData?.find((a: AIAgent) => a.isActive) || agentsData?.[0]

        if (defaultPlatform) setSelectedPlatform(defaultPlatform._id)
        if (defaultAgent) setSelectedAgent(defaultAgent._id)

        // Transform history to display format - messages come sorted oldest first from backend
        const transformedMessages: ChatMessage[] = []
        historyData?.forEach((msg: ChatMessage) => {
          // User message first
          transformedMessages.push({
            ...msg,
            isUser: true,
            isBot: false
          })
          // Then bot response
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
      // Check file size (2MB limit)
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 20MB",
          variant: "destructive"
        })
        return
      }
      setAttachedFile(file)
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

    // Check if selected platform is configured
    const selectedPlatformData = platforms.find(p => p._id === selectedPlatform)
    if (selectedPlatformData && !selectedPlatformData.isConfigured) {
      toast({
        title: "Platform Not Configured",
        description: selectedPlatformData.configurationMessage,
        variant: "destructive"
      })
      return
    }

    const userMessage = newMessage.trim()

    // Detect intention in the message
    const intent = detectIntention(userMessage)

    if (intent) {
      // Store the message and show confirmation dialog
      setPendingMessage(userMessage)
      setDetectedIntent(intent)
      setShowIntentConfirmation(true)
      return
    }

    // No intent detected, proceed with AI message
    await sendMessageToAI(userMessage)
  }

  const sendMessageToAI = async (userMessage: string) => {
    // Add user message to chat (at the end since latest messages appear at bottom)
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

      const generatedQuestions = parseGeneratedQuestions(responseData.response)

      // Add bot response to chat
      const botChatMessage: ChatMessage = {
        _id: responseData.messageId || `bot_${Date.now()}`,
        message: responseData.response,
        response: responseData.response,
        timestamp: new Date(),
        modelId: selectedPlatform,
        agentId: selectedAgent,
        isUser: false,
        isBot: true,
        isFallback: responseData.isFallback,
        generatedQuestions: generatedQuestions.length > 0 ? generatedQuestions : undefined
      }

      setMessages(prev => [...prev, botChatMessage])

      // Clear attached file after sending
      if (attachedFile) {
        removeAttachedFile()
      }

      if (responseData.isFallback) {
        toast({
          title: "Fallback Response",
          description: "The AI service may be unavailable — this response was generated from a fallback.",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Message Sent",
          description: "AI response received successfully"
        })
      }

    } catch (error) {
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
    <div className="h-[calc(100dvh-4rem)] w-full flex flex-col space-y-4 overflow-hidden">
      {/* Page Header */}
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

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-4">
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
                <label className="text-sm font-medium">AI Platforms</label>
                <Select
                  value={selectedPlatform}
                  onValueChange={(value) => {
                    const platform = platforms.find((p) => p._id === value)
                    if (platform && platform.isConfigured) {
                      setSelectedPlatform(value)
                    } else if (platform && !platform.isConfigured) {
                      toast({
                        variant: "destructive",
                        title: "Platform Not Configured",
                        description: platform.configurationMessage,
                      })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select AI platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {platforms.map((platform) => (
                      <SelectItem
                        key={platform._id}
                        value={platform._id}
                        disabled={!platform.isConfigured}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className="flex items-center gap-1">
                            {platform.isConfigured ? (
                              <CheckCircle className="h-3 w-3 text-status-success-foreground" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-status-warning-foreground" />
                            )}
                          </div>
                          <div className="flex flex-col flex-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-medium ${
                                  !platform.isConfigured ? "text-muted-foreground" : ""
                                }`}
                              >
                                {platform.displayName}
                              </span>
                              {platform.isDefault && (
                                <Badge variant="secondary" className="text-xs">
                                  Default
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {platform.configuration.model} • {platform.isConfigured ? "Ready" : "Needs Setup"}
                            </span>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedPlatformInfo && (
                  <div className="space-y-1">
                    {selectedPlatformInfo.isConfigured ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {selectedPlatformInfo.description}
                        </p>
                        <p className="text-xs font-mono bg-muted px-2 py-1 rounded">
                          Model: {selectedPlatformInfo.configuration.model}
                        </p>
                      </>
                    ) : (
                      <div className="p-2 bg-status-warning border border-status-warning rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="h-3 w-3 text-status-warning-foreground" />
                          <span className="text-xs font-medium text-status-warning-foreground">
                            Configuration Required
                          </span>
                        </div>
                        <p className="text-xs text-status-warning-foreground">
                          {selectedPlatformInfo.configurationMessage}
                        </p>
                      </div>
                    )}
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
                  {agents
                    .filter((a) => a.isActive)
                    .map((agent) => (
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
                  <p className="text-xs text-muted-foreground">{selectedAgentInfo.description}</p>
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
        <Card className="lg:col-span-3 flex min-h-0 flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </CardTitle>
            <CardDescription>Ask questions and get AI assistance</CardDescription>
          </CardHeader>

          {/* Messages + Input */}
          <CardContent className="flex-1 min-h-0 flex flex-col p-0">
            {/* Messages Area */}
            <ScrollArea ref={messagesContainerRef} className="h-full p-4 [scrollbar-gutter:stable] overscroll-y-contain">
              {loadingHistory ? (
                <LoadingState label="Loading chat history..." className="h-32" />
              ) : (
                <div className="space-y-4">
                  {/* Load More Button - Show at top when there are more messages */}
                  {pagination && pagination.hasMore && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadMoreMessages}
                        disabled={loadingMore}
                        className="mb-4"
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading older messages...
                          </>
                        ) : (
                          <>
                            Load More Messages ({pagination.totalCount - messages.length / 2} older)
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      {platforms.length === 0 ? (
                        <>
                          <p className="text-lg font-medium mb-2">AI Chat Setup Required</p>
                          <p className="text-sm mb-3">
                            No AI platforms are currently configured. To enable AI assistance:
                          </p>
                          <div className="bg-muted/50 rounded-lg p-4 max-w-md mx-auto">
                            <p className="text-sm font-medium mb-2">Configuration Steps:</p>
                            <ol className="text-xs text-left space-y-1">
                              <li>1. Go to <span className="font-medium">Settings → AI Platforms</span></li>
                              <li>2. Configure OpenAI, Anthropic, or Ollama</li>
                              <li>3. Add your API keys or local server URL</li>
                              <li>4. Return here to start chatting!</li>
                            </ol>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-lg font-medium mb-2">Welcome to AI Chat!</p>
                          <p className="text-sm">
                            Ask me anything about ExamMaster features, exam creation, or student management.
                          </p>
                        </>
                      )}
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message._id}
                        className={`flex gap-3 ${message.isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`flex gap-3 max-w-[80%] ${
                            message.isUser ? "flex-row-reverse" : "flex-row"
                          }`}
                        >
                          <div
                            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                              message.isUser
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {message.isUser ? (
                              <User className="h-4 w-4" />
                            ) : (
                              <Bot className="h-4 w-4" />
                            )}
                          </div>
                          <div
                            className={`rounded-lg px-4 py-2 ${
                              message.isUser ? "bg-primary text-primary-foreground" : "bg-muted"
                            }`}
                          >
                            {message.isBot ? (
                              <ReactMarkdown components={MARKDOWN_COMPONENTS}>{message.message}</ReactMarkdown>
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                            )}
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </p>

                            {message.isBot && message.isFallback && (
                              <p className="text-xs mt-1 flex items-center gap-1 text-status-warning-foreground">
                                <AlertCircle className="h-3 w-3" />
                                Fallback response — AI service may be unavailable
                              </p>
                            )}

                            {/* Save Questions Button - Show for bot messages with generated questions (only if not in assignment flow) */}
                            {message.isBot && message.generatedQuestions && message.generatedQuestions.length > 0 && !message.showAssignmentFlow && (
                              <div className="mt-3 pt-3 border-t border-border/50">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-status-success-foreground" />
                                    <span className="text-xs font-medium">
                                      {message.generatedQuestions.length} questions detected
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveQuestions(message._id, message.generatedQuestions!)}
                                    disabled={assigningQuestions[message._id]}
                                    className="flex items-center gap-1"
                                  >
                                    <Save className="h-3 w-3" />
                                    Save Questions
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      // Download questions as JSON for review
                                      const dataStr = JSON.stringify(message.generatedQuestions, null, 2)
                                      const dataBlob = new Blob([dataStr], { type: 'application/json' })
                                      const url = URL.createObjectURL(dataBlob)
                                      const link = document.createElement('a')
                                      link.href = url
                                      link.download = `generated-questions-${Date.now()}.json`
                                      link.click()
                                      URL.revokeObjectURL(url)
                                    }}
                                    className="flex items-center gap-1"
                                    disabled={assigningQuestions[message._id]}
                                  >
                                    <Download className="h-3 w-3" />
                                    Download
                                  </Button>
                                </div>
                              </div>
                            )}

                            {/* Question Assignment Flow */}
                            {message.isBot && message.showAssignmentFlow && message.generatedQuestions && (
                              <AIChatQuestionAssignment
                                questions={message.generatedQuestions}
                                onAssignmentComplete={() => handleAssignmentComplete(message._id)}
                                onCancel={() => handleAssignmentCancel(message._id)}
                              />
                            )}
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
                  disabled={
                    !newMessage.trim() ||
                    isLoading ||
                    !selectedPlatform ||
                    !selectedAgent ||
                    !selectedPlatformInfo?.isConfigured ||
                    Object.values(assigningQuestions).some(Boolean)
                  }
                  className="shrink-0"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>

              {Object.values(assigningQuestions).some(Boolean) ? (
                <p className="text-xs text-status-info-foreground mt-2">
                  Question assignment in progress. Chat is temporarily disabled.
                </p>
              ) : platforms.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-2">
                  No AI platforms are configured. Please configure AI platforms in Settings → AI Platforms to enable chat
                  functionality.
                </p>
              ) : platforms.filter((p) => p.isConfigured).length === 0 ? (
                <p className="text-xs text-muted-foreground mt-2">
                  AI platforms need configuration. Please set up API keys or connection details in Settings → AI
                  Platforms.
                </p>
              ) : !selectedPlatform || !selectedAgent ? (
                <p className="text-xs text-muted-foreground mt-2">
                  Please select an AI platform and agent to start chatting
                </p>
              ) : !selectedPlatformInfo?.isConfigured ? (
                <p className="text-xs text-status-warning-foreground mt-2">
                  Selected platform needs configuration. Please set it up in Settings → AI Platforms.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Intent Confirmation Dialog */}
      <IntentConfirmationDialog
        open={showIntentConfirmation}
        intent={detectedIntent}
        originalMessage={pendingMessage}
        onConfirm={handleIntentConfirm}
        onCancel={handleIntentCancel}
        onClose={() => setShowIntentConfirmation(false)}
      />

      {/* Creation Dialog Manager */}
      <CreationDialogManager
        intent={detectedIntent}
        showCreateDialog={showCreateDialog}
        onDialogClose={handleCreationDialogClose}
        onCreationSuccess={handleCreationSuccess}
      />
    </div>
  )
}
