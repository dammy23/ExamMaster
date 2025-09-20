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
  Settings,
  CheckCircle,
  AlertCircle,
  XCircle,
  Save,
  Download
} from "lucide-react"
import { sendChatMessage, getChatHistory, getAIAgents, uploadChatFile, createQuestionsWithAI } from "@/api/aiChat"
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
  generatedQuestions?: any[]
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
  const [savingQuestions, setSavingQuestions] = useState<{ [key: string]: boolean }>({})
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
      console.log('AI Chat - Loading more messages, page:', pagination.currentPage + 1)
      const historyResponse = await getChatHistory({
        page: pagination.currentPage + 1,
        limit: 20
      })

      const historyData = historyResponse.messages
      const newPagination = historyResponse.pagination

      console.log('AI Chat - More history received:', historyData?.length || 0, 'messages')

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
      console.error('Error loading more messages:', error)
      toast({
        title: "Error",
        description: "Failed to load more messages",
        variant: "destructive"
      })
    } finally {
      setLoadingMore(false)
    }
  }

  // Parse questions from AI response text
  const parseQuestionsFromResponse = (responseText: string): any[] => {
    const questions: any[] = []

    try {
      // Check if the response contains question-related keywords
      const hasQuestionKeywords = /question|quiz|exam|test|mcq|multiple.?choice|true.?false/i.test(responseText)

      if (!hasQuestionKeywords) {
        console.log('AI Chat - No question keywords found in response')
        return []
      }

      console.log('AI Chat - Starting question detection')
      console.log('AI Chat - Text sample (first 500 chars):', responseText.substring(0, 500))

      // PRIORITY 1: Look for JSON questions in the response with proper JSON block format
      const jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/)
      if (jsonMatch && jsonMatch[1]) {
        try {
          const parsedData = JSON.parse(jsonMatch[1])
          if (parsedData.questions && Array.isArray(parsedData.questions)) {
            console.log('AI Chat - Found JSON format questions:', parsedData.questions.length)
            return parsedData.questions.map((q: any, index: number) => ({
              ...q,
              tempId: `json-${Date.now()}-${index}`,
              marks: q.marks || 1,
              difficulty: q.difficulty || 'medium'
            }))
          }
        } catch (jsonError) {
          console.error('AI Chat - Error parsing JSON questions:', jsonError)
        }
      }

      // PRIORITY 2: Look for JSON questions anywhere in the response (fallback)
      const jsonFallbackMatch = responseText.match(/\{[\s\S]*?"questions"[\s\S]*?\}/)
      if (jsonFallbackMatch) {
        try {
          const parsedData = JSON.parse(jsonFallbackMatch[0])
          if (parsedData.questions && Array.isArray(parsedData.questions)) {
            console.log('AI Chat - Found JSON fallback questions:', parsedData.questions.length)
            return parsedData.questions.map((q: any, index: number) => ({
              ...q,
              tempId: `json-fallback-${Date.now()}-${index}`,
              marks: q.marks || 1,
              difficulty: q.difficulty || 'medium'
            }))
          }
        } catch (jsonError) {
          console.error('AI Chat - Error parsing JSON fallback questions:', jsonError)
        }
      }

      // PRIORITY 3: Look for structured AI format: **GENERATED QUESTIONS:** followed by **Question 1:** ...
      const structuredSectionMatch = responseText.match(/\*\*GENERATED QUESTIONS:\*\*[\s\S]*/)
      if (structuredSectionMatch) {
        console.log('AI Chat - Found GENERATED QUESTIONS section')
        const structuredSection = structuredSectionMatch[0]

        const aiStructuredQuestions = structuredSection.match(/\*\*Question \d+:\*\*[\s\S]*?(?=\*\*Question \d+:\*\*|$)/gi)
        if (aiStructuredQuestions && aiStructuredQuestions.length > 0) {
          console.log('AI Chat - Found AI structured questions in section:', aiStructuredQuestions.length)

          aiStructuredQuestions.forEach((questionBlock, index) => {
            const lines = questionBlock.trim().split('\n').map(line => line.trim()).filter(line => line)
            if (lines.length === 0) return

            let question = ''
            let type = 'short-answer'
            let options: string[] = []
            let correctAnswer = ''
            let explanation = ''
            let marks = 1
            let difficulty = 'medium'

            // Extract question text from first line
            const firstLine = lines[0]
            const questionMatch = firstLine.match(/\*\*Question \d+:\*\*\s*(.*)/)
            if (questionMatch) {
              question = questionMatch[1].trim()
            }

            let collectingOptions = false

            // Parse structured fields
            lines.forEach((line, lineIndex) => {
              if (line.startsWith('**Type:**')) {
                type = line.replace('**Type:**', '').trim()
                collectingOptions = false
              } else if (line.startsWith('**Options:**')) {
                collectingOptions = true
              } else if (collectingOptions && line.match(/^[a-d]\)/)) {
                // Option line
                options.push(line.replace(/^[a-d]\)\s*/, ''))
              } else if (line.startsWith('**Correct Answer:**')) {
                correctAnswer = line.replace('**Correct Answer:**', '').trim()
                collectingOptions = false
              } else if (line.startsWith('**Explanation:**')) {
                explanation = line.replace('**Explanation:**', '').trim()
                collectingOptions = false
              } else if (line.startsWith('**Marks:**')) {
                marks = parseInt(line.replace('**Marks:**', '').trim()) || 1
                collectingOptions = false
              } else if (line.startsWith('**Difficulty:**')) {
                difficulty = line.replace('**Difficulty:**', '').trim()
                collectingOptions = false
              }
            })

            if (question) {
              console.log(`AI Chat - Parsed structured question ${index + 1}:`, {
                question: question.substring(0, 50) + '...',
                type,
                optionsCount: options.length,
                correctAnswer,
                explanation: explanation.substring(0, 30) + '...'
              })

              questions.push({
                tempId: `structured-${Date.now()}-${index}`,
                type: type,
                question: question,
                options: options,
                correctAnswers: correctAnswer ? [correctAnswer] : ['Sample answer'],
                explanation: explanation || '',
                marks: marks,
                difficulty: difficulty
              })
            }
          })

          if (questions.length > 0) {
            console.log('AI Chat - Successfully parsed structured questions:', questions.length)
            return questions // Early return to prevent other parsers from running
          }
        }
      }

      // PRIORITY 4: Look for numbered structured format: 1. **Question 1:** ... (fallback for different numbering)
      const aiStructuredQuestions = responseText.match(/\d+\.\s*\*\*Question \d+:\*\*[\s\S]*?(?=\d+\.\s*\*\*Question \d+:\*\*|$)/gi)
      if (aiStructuredQuestions && aiStructuredQuestions.length > 0) {
        console.log('AI Chat - Found numbered AI structured questions:', aiStructuredQuestions.length)

        aiStructuredQuestions.forEach((questionBlock, index) => {
          const lines = questionBlock.trim().split('\n').map(line => line.trim()).filter(line => line)
          if (lines.length === 0) return

          let question = ''
          let type = 'short-answer'
          let options: string[] = []
          let correctAnswer = ''
          let explanation = ''
          let marks = 1
          let difficulty = 'medium'

          // Extract question text from first line (after the question number)
          const firstLine = lines[0]
          const questionMatch = firstLine.match(/\d+\.\s*\*\*Question \d+:\*\*\s*(.*)/)
          if (questionMatch) {
            question = questionMatch[1].trim()
          }

          let collectingOptions = false

          // Parse structured fields
          lines.forEach((line, lineIndex) => {
            if (line.startsWith('**Type:**')) {
              type = line.replace('**Type:**', '').trim()
              collectingOptions = false
            } else if (line.startsWith('**Options:**')) {
              collectingOptions = true
            } else if (collectingOptions && line.match(/^[a-d]\)/)) {
              // Option line
              options.push(line.replace(/^[a-d]\)\s*/, ''))
            } else if (line.startsWith('**Correct Answer:**')) {
              correctAnswer = line.replace('**Correct Answer:**', '').trim()
              collectingOptions = false
            } else if (line.startsWith('**Explanation:**')) {
              explanation = line.replace('**Explanation:**', '').trim()
              collectingOptions = false
            } else if (line.startsWith('**Marks:**')) {
              marks = parseInt(line.replace('**Marks:**', '').trim()) || 1
              collectingOptions = false
            } else if (line.startsWith('**Difficulty:**')) {
              difficulty = line.replace('**Difficulty:**', '').trim()
              collectingOptions = false
            }
          })

          if (question) {
            console.log(`AI Chat - Parsed numbered question ${index + 1}:`, {
              question: question.substring(0, 50) + '...',
              type,
              optionsCount: options.length,
              correctAnswer,
              explanation: explanation.substring(0, 30) + '...'
            })

            questions.push({
              tempId: `numbered-structured-${Date.now()}-${index}`,
              type: type,
              question: question,
              options: options,
              correctAnswers: correctAnswer ? [correctAnswer] : ['Sample answer'],
              explanation: explanation || '',
              marks: marks,
              difficulty: difficulty
            })
          }
        })

        if (questions.length > 0) {
          console.log('AI Chat - Successfully parsed numbered structured questions:', questions.length)
          return questions // Early return to prevent other parsers from running
        }
      }

      // FALLBACK PARSERS: Only run these if no structured questions were found above
      console.log('AI Chat - No structured questions found, trying fallback parsers')

      // Look for structured question blocks in markdown format (alternative format)
      const questionBlocks = responseText.match(/\*\*Question \d+[:.]?\*\*([\s\S]*?)(?=\*\*Question \d+[:.]?\*\*|\*\*Answer[:.]?\*\*|$)/gi)
      if (questionBlocks && questionBlocks.length > 0) {
        console.log('AI Chat - Found markdown question blocks:', questionBlocks.length)
        questionBlocks.forEach((block, index) => {
          const questionMatch = block.match(/\*\*Question \d+[:.]?\*\*(.*?)(?:\*\*(?:Options?|Choices?)[:.]?\*\*|$)/s)
          const optionsMatch = block.match(/\*\*(?:Options?|Choices?)[:.]?\*\*(.*?)(?:\*\*(?:Correct )?Answer[:.]?\*\*|$)/s)
          const answerMatch = block.match(/\*\*(?:Correct )?Answer[:.]?\*\*(.*?)(?:\*\*|$)/s)
          const explanationMatch = block.match(/\*\*Explanation[:.]?\*\*(.*?)(?:\*\*|$)/s)

          if (questionMatch) {
            const question = questionMatch[1].trim()
            const options: string[] = []
            let correctAnswers: string[] = []
            let questionType = 'short-answer'

            // Parse options if present
            if (optionsMatch) {
              const optionLines = optionsMatch[1]
                .split('\n')
                .map(line => line.trim())
                .filter(line => line && (line.match(/^[a-d]\)/) || line.match(/^[a-d]\./) || line.match(/^\d+\./)))

              optionLines.forEach(line => {
                const cleanOption = line.replace(/^[a-d][).]\s*/, '').replace(/^\d+\.\s*/, '').trim()
                if (cleanOption) options.push(cleanOption)
              })

              if (options.length >= 4) {
                questionType = 'multiple-choice'
              }
            }

            // Parse correct answer
            if (answerMatch) {
              const answerText = answerMatch[1].trim()
              if (answerText.toLowerCase() === 'true' || answerText.toLowerCase() === 'false') {
                questionType = 'true-false'
                correctAnswers = [answerText.toLowerCase()]
              } else if (options.length > 0) {
                // Try to match answer to options
                const matchedOption = options.find(opt =>
                  opt.toLowerCase().includes(answerText.toLowerCase()) ||
                  answerText.toLowerCase().includes(opt.toLowerCase())
                )
                if (matchedOption) {
                  correctAnswers = [matchedOption]
                } else {
                  correctAnswers = [answerText]
                }
              } else {
                correctAnswers = [answerText]
              }
            }

            const explanation = explanationMatch ? explanationMatch[1].trim() : ''

            questions.push({
              tempId: `markdown-${Date.now()}-${index}`,
              type: questionType,
              question: question,
              options: options,
              correctAnswers: correctAnswers.length > 0 ? correctAnswers : ['Sample answer'],
              explanation: explanation,
              marks: 1,
              difficulty: 'medium'
            })
          }
        })

        if (questions.length > 0) {
          console.log('AI Chat - Successfully parsed markdown questions:', questions.length)
          return questions
        }
      }

      // Pattern 1: Simple numbered questions with question marks
      const simpleQuestions = responseText.match(/\d+\.\s*[^?\n]*\?/g)
      if (simpleQuestions && simpleQuestions.length > 0) {
        console.log('AI Chat - Found simple questions:', simpleQuestions)
        simpleQuestions.forEach((q, index) => {
          const questionText = q.replace(/^\d+\.\s*/, '').trim()
          if (questionText.length > 15) {
            questions.push({
              tempId: `simple-${Date.now()}-${index}`,
              type: 'short-answer',
              question: questionText,
              options: [],
              correctAnswers: ['Sample answer'],
              explanation: '',
              marks: 1,
              difficulty: 'medium'
            })
          }
        })

        if (questions.length > 0) {
          console.log('AI Chat - Successfully parsed simple questions:', questions.length)
          return questions
        }
      }

      // Pattern 2: Questions that start with "What", "How", "Why", "Where", "When", "Which"
      const wh_questions = responseText.match(/(?:What|How|Why|Where|When|Which|Who)[^?\n]*\?/gi)
      if (wh_questions && wh_questions.length > 0) {
        console.log('AI Chat - Found WH questions:', wh_questions)
        wh_questions.forEach((q, index) => {
          const questionText = q.trim()
          if (questionText.length > 10 && !questions.some(existing => existing.question === questionText)) {
            questions.push({
              tempId: `wh-${Date.now()}-${index}`,
              type: 'short-answer',
              question: questionText,
              options: [],
              correctAnswers: ['Sample answer'],
              explanation: '',
              marks: 1,
              difficulty: 'medium'
            })
          }
        })

        if (questions.length > 0) {
          console.log('AI Chat - Successfully parsed WH questions:', questions.length)
          return questions
        }
      }

      // Pattern 3: Look for multiple choice blocks
      const mcqMatches = responseText.match(/(?:multiple\s*choice|mcq)[^?]*\?[\s\S]*?[a-d]\)[^\n]+/gi)
      if (mcqMatches && mcqMatches.length > 0) {
        console.log('AI Chat - Found MCQ blocks:', mcqMatches)
        mcqMatches.forEach((block, index) => {
          const questionMatch = block.match(/[^?]*\?/)
          if (questionMatch) {
            const questionText = questionMatch[0].replace(/(?:multiple\s*choice|mcq)\s*/gi, '').trim()
            const optionMatches = block.match(/[a-d]\)[^a-d\n]+/gi)
            const options = optionMatches ? optionMatches.map(opt => opt.replace(/^[a-d]\)\s*/, '')) : []

            if (questionText.length > 10) {
              questions.push({
                tempId: `mcq-${Date.now()}-${index}`,
                type: options.length >= 4 ? 'multiple-choice' : 'short-answer',
                question: questionText,
                options: options,
                correctAnswers: ['Sample answer'],
                explanation: '',
                marks: 1,
                difficulty: 'medium'
              })
            }
          }
        })

        if (questions.length > 0) {
          console.log('AI Chat - Successfully parsed MCQ questions:', questions.length)
          return questions
        }
      }

      // Pattern 4: True/False questions
      const tfQuestions = responseText.match(/(?:true|false)[^?\n]*\?/gi)
      if (tfQuestions && tfQuestions.length > 0) {
        console.log('AI Chat - Found T/F questions:', tfQuestions)
        tfQuestions.forEach((q, index) => {
          const questionText = q.trim()
          if (questionText.length > 10 && !questions.some(existing => existing.question === questionText)) {
            questions.push({
              tempId: `tf-${Date.now()}-${index}`,
              type: 'true-false',
              question: questionText,
              options: [],
              correctAnswers: ['true'],
              explanation: '',
              marks: 1,
              difficulty: 'medium'
            })
          }
        })

        if (questions.length > 0) {
          console.log('AI Chat - Successfully parsed T/F questions:', questions.length)
          return questions
        }
      }

      // Final fallbacks if no patterns matched
      console.log('AI Chat - No question patterns found, trying final fallbacks')

      // Fallback 1: Any text ending with a question mark that looks substantial
      const allQuestions = responseText.match(/[A-Z][^?\n]{15,}\?/g)
      if (allQuestions && allQuestions.length > 0) {
        console.log('AI Chat - Found questions with final fallback:', allQuestions)
        allQuestions.forEach((q, index) => {
          const questionText = q.trim()
          if (!questions.some(existing => existing.question === questionText)) {
            questions.push({
              tempId: `fallback-${Date.now()}-${index}`,
              type: 'short-answer',
              question: questionText,
              options: [],
              correctAnswers: ['Sample answer'],
              explanation: '',
              marks: 1,
              difficulty: 'medium'
            })
          }
        })

        if (questions.length > 0) {
          console.log('AI Chat - Successfully parsed fallback questions:', questions.length)
          return questions
        }
      }

      // Fallback 2: If response mentions creating/generating questions, create a generic sample
      if (questions.length === 0 && /generat|creat.*question/i.test(responseText)) {
        console.log('AI Chat - Response mentions generating questions, creating sample')
        questions.push({
          tempId: `sample-${Date.now()}`,
          type: 'multiple-choice',
          question: 'Sample question extracted from AI response (please edit)',
          options: ['Option A', 'Option B', 'Option C', 'Option D'],
          correctAnswers: ['Option A'],
          explanation: 'Please update this sample question with actual content from the AI response.',
          marks: 1,
          difficulty: 'medium'
        })
      }

      console.log('AI Chat - Total questions found by parser:', questions.length)
      return questions
    } catch (error) {
      console.error('Error parsing questions from response:', error)
      return []
    }
  }

  // Save generated questions to database
  const handleSaveQuestions = async (messageId: string, questions: any[]) => {
    if (!questions || questions.length === 0) return

    setSavingQuestions(prev => ({ ...prev, [messageId]: true }))

    try {
      const result = await createQuestionsWithAI({ questions })

      toast({
        title: "Questions Saved Successfully",
        description: `${result.createdCount} questions have been saved to your question bank.`
      })

      // Update the message to mark questions as saved
      setMessages(prev => prev.map(msg =>
        msg._id === messageId
          ? { ...msg, generatedQuestions: undefined } // Remove questions after saving
          : msg
      ))

    } catch (error) {
      console.error("Error saving questions:", error)
      toast({
        variant: "destructive",
        title: "Error Saving Questions",
        description: (error as any)?.message || "Failed to save questions to database"
      })
    } finally {
      setSavingQuestions(prev => ({ ...prev, [messageId]: false }))
    }
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
          getChatHistory({ page: 1, limit: 20 }) // Load first page of messages
        ])

        const platformsData = (platformsResponse as any).data.platforms
        const agentsData = (agentsResponse as any).agents
        const historyData = historyResponse.messages
        const historyPagination = historyResponse.pagination

        console.log('AI Chat - Platforms received:', platformsData)
        console.log('AI Chat - Agents received:', agentsData)
        console.log('AI Chat - History received:', historyData?.length || 0, 'messages')
        console.log('AI Chat - Pagination:', historyPagination)

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
    console.log('AI Chat - Sending message:', userMessage)
    console.log('AI Chat - Selected platform:', selectedPlatform)
    console.log('AI Chat - Selected agent:', selectedAgent)
    console.log('AI Chat - Attached file:', attachedFile?.name)

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
      console.log('AI Chat - Response received:', responseData)

      // Parse questions from AI response
      console.log('AI Chat - Full response text:', responseData.response)
      console.log('AI Chat - Response length:', responseData.response.length)
      const generatedQuestions = parseQuestionsFromResponse(responseData.response)
      console.log('AI Chat - Parsed questions from response:', generatedQuestions)
      console.log('AI Chat - Number of questions found:', generatedQuestions.length)

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
        generatedQuestions: generatedQuestions.length > 0 ? generatedQuestions : undefined
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
                              <CheckCircle className="h-3 w-3 text-green-500" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-amber-500" />
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
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="h-3 w-3 text-amber-600" />
                          <span className="text-xs font-medium text-amber-800">
                            Configuration Required
                          </span>
                        </div>
                        <p className="text-xs text-amber-700">
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
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Loading chat history...</span>
                </div>
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
                            <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </p>

                            {/* Save Questions Button - Show for bot messages with generated questions */}
                            {message.isBot && message.generatedQuestions && message.generatedQuestions.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-border/50">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                    <span className="text-xs font-medium">
                                      {message.generatedQuestions.length} questions detected
                                    </span>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveQuestions(message._id, message.generatedQuestions!)}
                                    disabled={savingQuestions[message._id]}
                                    className="flex items-center gap-1"
                                  >
                                    {savingQuestions[message._id] ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Save className="h-3 w-3" />
                                    )}
                                    {savingQuestions[message._id] ? 'Saving...' : 'Save Questions'}
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
                                  >
                                    <Download className="h-3 w-3" />
                                    Download
                                  </Button>
                                </div>
                              </div>
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
                    !selectedPlatformInfo?.isConfigured
                  }
                  className="shrink-0"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>

              {platforms.length === 0 ? (
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
                <p className="text-xs text-amber-600 mt-2">
                  Selected platform needs configuration. Please set it up in Settings → AI Platforms.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
