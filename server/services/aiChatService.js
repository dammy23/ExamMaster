const AIChat = require('../models/AIChat');
const { AIAgent } = require('../models/AIConfig');
const AIPlatform = require('../models/AIPlatform');
const llmService = require('./llmService');
const ExamService = require('./examService');
const SubjectService = require('./subjectService');
const QuestionService = require('./questionService');

console.log('Loading AI Chat Service...');

class AIChatService {
  
  // Send a message to AI and get response
  static async sendMessage(userId, messageData) {
    const { message, modelId, agentId, fileAttachment } = messageData;
    
    console.log(`AI Chat Service - Processing message for user ${userId}`);
    console.log(`AI Chat Service - Platform: ${modelId}, Agent: ${agentId}`);
    console.log(`AI Chat Service - Message length: ${message.length} characters`);
    
    try {
      // Validate platform and agent exist and are active
      const [platform, agent] = await Promise.all([
        AIPlatform.findById(modelId).select('+configuration.apiKey'),
        AIAgent.findOne({ agentId, isActive: true, isDeleted: false })
      ]);
      
      if (!platform || !platform.isActive || platform.isDeleted) {
        console.error(`AI Chat Service - Platform ${modelId} not found or inactive`);
        throw new Error(`AI platform not found or inactive`);
      }
      
      if (!agent) {
        console.error(`AI Chat Service - Agent ${agentId} not found or inactive`);
        throw new Error(`AI agent '${agentId}' not found or inactive`);
      }
      
      console.log(`AI Chat Service - Using platform: ${platform.displayName} (${platform.name})`);
      console.log(`AI Chat Service - Using agent: ${agent.name}`);
      
      const startTime = Date.now();

      // Fetch recent turns for conversation memory (newest first, so reverse to chronological order)
      const recentMessages = await AIChat.getRecentMessages(userId, 5);
      const history = [];
      recentMessages.reverse().forEach(msg => {
        history.push({ role: 'user', content: msg.message });
        history.push({ role: 'assistant', content: msg.response });
      });
      console.log(`AI Chat Service - Including ${recentMessages.length} prior turns as conversation history`);

      // Extract real file content if a supported document was attached
      const extractedFileText = fileAttachment ? await this.extractFileText(fileAttachment) : null;

      // Fetch real platform context (exam/subject/question counts) for the exam-assistant agent
      let platformContext = null;
      if (agent.agentId === 'exam-assistant') {
        const [exams, subjects, recentQuestions] = await Promise.all([
          ExamService.getAll({}, userId),
          SubjectService.getAllSubjects({ isActive: true }),
          QuestionService.getAllQuestions({}, { page: 1, limit: 10 })
        ]);
        platformContext = {
          examCount: exams.length,
          subjectCount: subjects.length,
          questionCount: recentQuestions.pagination.totalItems
        };
        console.log(`AI Chat Service - Platform context: ${platformContext.examCount} exams, ${platformContext.subjectCount} subjects, ${platformContext.questionCount} questions`);
      }

      // Process AI request using configured platform
      const aiResponse = await this.processAIRequest(message, platform, agent, fileAttachment, history, extractedFileText, platformContext);

      // Update platform usage statistics
      await platform.updateUsage(aiResponse.tokenCount.input + aiResponse.tokenCount.output);

      const processingTime = Date.now() - startTime;
      console.log(`AI Chat Service - Processing completed in ${processingTime}ms`);

      // Save chat message to database
      const chatMessage = new AIChat({
        userId,
        message: message.trim(),
        response: aiResponse.response,
        modelId, // This is actually platformId now
        agentId,
        fileAttachment: fileAttachment ? {
          fileName: fileAttachment.fileName,
          fileUrl: fileAttachment.fileUrl,
          fileSize: fileAttachment.fileSize,
          mimeType: fileAttachment.mimeType
        } : undefined,
        metadata: {
          processingTime,
          tokenCount: aiResponse.tokenCount,
          cost: aiResponse.cost
        },
        isFallback: aiResponse.isFallback
      });

      const savedMessage = await chatMessage.save();
      console.log(`AI Chat Service - Message saved with ID: ${savedMessage._id}`);

      return {
        response: aiResponse.response,
        messageId: savedMessage._id.toString(),
        processingTime,
        tokenCount: aiResponse.tokenCount,
        isFallback: aiResponse.isFallback
      };

    } catch (error) {
      console.error('AI Chat Service - Error processing message:', error);
      throw error;
    }
  }
  
  // Process AI request using configured platform
  static async processAIRequest(message, platform, agent, fileAttachment, history, extractedFileText, platformContext) {
    console.log(`AI Chat Service - Processing AI request with ${platform.displayName} (${platform.configuration.model}) and ${agent.name}`);

    try {
      // Validate platform has required configuration
      if (!platform.configuration.apiKey && platform.name !== 'ollama') {
        throw new Error(`API key not configured for ${platform.displayName}`);
      }

      if (platform.name === 'ollama' && !platform.configuration.baseUrl) {
        throw new Error(`Base URL not configured for ${platform.displayName}`);
      }

      // Build system prompt using agent configuration
      const systemPrompt = this.buildSystemPrompt(agent, fileAttachment, extractedFileText, platformContext);

      console.log(`AI Chat Service - Sending request to ${platform.name} with model ${platform.configuration.model}`);
      console.log(`AI Chat Service - System prompt length: ${systemPrompt.length} characters, history turns: ${history.length}`);

      let response;
      let inputTokens = 0;
      let outputTokens = 0;
      const estimatedInputLength = systemPrompt.length + message.length + history.reduce((sum, h) => sum + h.content.length, 0);

      if (platform.name === 'ollama') {
        // Handle Ollama separately as it uses different API
        response = await this.processOllamaRequest(message, platform, systemPrompt, history);
        // Estimate tokens for Ollama (no exact count available)
        inputTokens = Math.ceil(estimatedInputLength / 4);
        outputTokens = Math.ceil(response.length / 4);
      } else {
        // Use existing LLM service for OpenAI and Anthropic
        const options = {
          maxTokens: platform.configuration.maxTokens || 4096,
          temperature: platform.configuration.temperature || 0.7,
          topP: platform.configuration.topP || 1.0,
          presencePenalty: platform.configuration.presencePenalty || 0,
          frequencyPenalty: platform.configuration.frequencyPenalty || 0
        };


        const llmResponse = await llmService.sendLLMRequest(
          platform.name,
          platform.configuration.model,
          systemPrompt,
          history,
          message,
          platform.configuration.apiKey,
          options
        );

        response = llmResponse.content;

        // Use real token counts if available, otherwise estimate
        if (llmResponse.usage) {
          inputTokens = llmResponse.usage.prompt_tokens || llmResponse.usage.input_tokens || 0;
          outputTokens = llmResponse.usage.completion_tokens || llmResponse.usage.output_tokens || 0;
          console.log(`AI Chat Service - Real token usage from ${platform.name}: input=${inputTokens}, output=${outputTokens}`);
        } else {
          // Fallback to estimation if no usage data available
          inputTokens = Math.ceil(estimatedInputLength / 4);
          outputTokens = Math.ceil(response.length / 4);
          console.log(`AI Chat Service - Estimated token usage: input=${inputTokens}, output=${outputTokens}`);
        }
      }

      // Calculate estimated cost based on platform pricing
      const cost = this.calculateCost(platform, inputTokens, outputTokens);

      console.log(`AI Chat Service - Response received from ${platform.name}`);
      console.log(`AI Chat Service - Tokens used - Input: ${inputTokens}, Output: ${outputTokens}, Cost: $${cost}`);

      return {
        response: response.trim(),
        tokenCount: {
          input: inputTokens,
          output: outputTokens
        },
        cost: Math.round(cost * 100) / 100, // round to 2 decimal places
        isFallback: false
      };

    } catch (error) {
      console.error(`AI Chat Service - Error processing request with ${platform.name}:`, error);

      // Provide fallback response if AI service fails
      const fallbackResponse = await this.generateFallbackResponse(agent.agentId, message, error.message);

      return {
        response: fallbackResponse,
        tokenCount: {
          input: Math.ceil(message.length / 4),
          output: Math.ceil(fallbackResponse.length / 4)
        },
        cost: 0, // No cost for fallback response
        isFallback: true
      };
    }
  }
  
  // Build system prompt using agent configuration
  static buildSystemPrompt(agent, fileAttachment, extractedFileText, platformContext) {
    let systemPrompt = agent.systemPrompt || `You are ${agent.name}, ${agent.description}`;

    // Add ExamMaster context — real counts when available (exam-assistant), generic description otherwise
    if (platformContext) {
      systemPrompt += `\n\nYou are working within ExamMaster, a comprehensive Computer-Based Examination (CBE) platform. You currently have ${platformContext.examCount} exam(s), ${platformContext.subjectCount} subject(s), and ${platformContext.questionCount} question(s) in the question bank.`;
    } else {
      systemPrompt += `\n\nYou are working within ExamMaster, a comprehensive Computer-Based Examination (CBE) platform. The system includes:
- Exam creation and management
- Question banks with multiple question types (MCQ, True/False, Short Answer)
- Student management and group organization
- Automated grading and manual review for subjective questions
- Real-time monitoring and proctoring features
- Performance analytics and reporting
- AI-powered assistance for various tasks`;
    }

    systemPrompt += `\n\nYour capabilities include: ${agent.capabilities.join(', ')}.`;

    // Add file attachment context if present
    if (fileAttachment && extractedFileText) {
      systemPrompt += `\n\nThe user has attached a file "${fileAttachment.fileName}". Its content:\n\n${extractedFileText}\n\nConsider this content in your response.`;
    } else if (fileAttachment) {
      systemPrompt += `\n\nNote: The user has attached a file "${fileAttachment.fileName}" (${fileAttachment.mimeType}). Its content could not be read automatically; ask the user to paste relevant text if needed.`;
    }

    systemPrompt += `\n\nProvide helpful, accurate, and detailed responses. Format your responses clearly with markdown when appropriate.

IMPORTANT: When generating questions for exams, always format them using this EXACT structure at the end of your response:

**GENERATED QUESTIONS:**
**Question 1:** [Question text here]
**Type:** multiple-choice|true-false|short-answer
**Options:** (only for multiple-choice)
a) Option 1
b) Option 2
c) Option 3
d) Option 4
**Correct Answer:** [Answer here]
**Explanation:** [Explanation here]
**Marks:** 1
**Difficulty:** easy|medium|hard

**Question 2:** [Question text here]
... [continue for all questions]

This format is crucial for the system to detect and save questions properly.`;
    
    console.log(`AI Chat Service - Built system prompt for agent ${agent.agentId}, length: ${systemPrompt.length} characters`);
    return systemPrompt;
  }
  
  // Process Ollama request (different API structure)
  static async processOllamaRequest(message, platform, systemPrompt, history) {
    console.log(`AI Chat Service - Processing Ollama request to ${platform.configuration.baseUrl}`);

    try {
      const axios = require('axios');

      let historyText = '';
      if (history && history.length > 0) {
        historyText += 'Previous conversation:\n';
        for (let i = 0; i < history.length; i += 2) {
          historyText += `User: ${history[i].content}\nAssistant: ${history[i + 1].content}\n`;
        }
        historyText += '\n';
      }

      const prompt = `${systemPrompt}\n\n${historyText}Current question:\nUser: ${message}\n\nAssistant:`;

      const response = await axios.post(`${platform.configuration.baseUrl}/api/generate`, {
        model: platform.configuration.model,
        prompt,
        stream: false,
        options: {
          temperature: platform.configuration.temperature || 0.7,
          top_p: platform.configuration.topP || 1.0,
          num_predict: platform.configuration.maxTokens || 4096
        }
      }, {
        timeout: 60000 // 60 second timeout
      });

      if (response.data && response.data.response) {
        console.log(`AI Chat Service - Received response from Ollama: ${response.data.response.length} characters`);
        return response.data.response;
      } else {
        throw new Error('Invalid response format from Ollama');
      }
    } catch (error) {
      console.error(`AI Chat Service - Ollama request failed:`, error);
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to Ollama server at ${platform.configuration.baseUrl}. Please ensure Ollama is running.`);
      }
      throw new Error(`Ollama request failed: ${error.message}`);
    }
  }

  // Extract real text content from a supported uploaded file for AI context
  static async extractFileText(fileAttachment) {
    const SUPPORTED_MIME_TYPES = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!SUPPORTED_MIME_TYPES.includes(fileAttachment.mimeType)) {
      console.log(`AI Chat Service - Skipping file text extraction, unsupported mime type: ${fileAttachment.mimeType}`);
      return null;
    }

    try {
      const path = require('path');
      const DocumentParsingService = require('./documentParsingService');
      const diskPath = path.join(__dirname, '..', fileAttachment.fileUrl);
      const text = await DocumentParsingService.parseDocument(diskPath, fileAttachment.mimeType);

      const MAX_LENGTH = 8000;
      if (text.length > MAX_LENGTH) {
        console.log(`AI Chat Service - Truncating extracted file text from ${text.length} to ${MAX_LENGTH} characters`);
        return `${text.substring(0, MAX_LENGTH)}\n...[truncated]`;
      }
      return text;
    } catch (error) {
      console.error(`AI Chat Service - Failed to extract file text for ${fileAttachment.fileName}:`, error.message);
      return null;
    }
  }
  
  // Calculate cost based on platform pricing
  static calculateCost(platform, inputTokens, outputTokens) {
    // Default pricing per 1000 tokens (in dollars)
    const pricing = {
      openai: {
        'gpt-4': { input: 0.03, output: 0.06 },
        'gpt-4-turbo': { input: 0.01, output: 0.03 },
        'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
        'gpt-3.5-turbo-16k': { input: 0.003, output: 0.004 }
      },
      anthropic: {
        'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
        'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
        'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
      },
      ollama: { default: { input: 0, output: 0 } } // Ollama is free
    };
    
    const platformPricing = pricing[platform.name];
    if (!platformPricing) {
      console.log(`AI Chat Service - No pricing info for platform ${platform.name}, assuming free`);
      return 0;
    }
    
    const modelPricing = platformPricing[platform.configuration.model] || platformPricing['default'];
    if (!modelPricing) {
      console.log(`AI Chat Service - No pricing info for model ${platform.configuration.model}, assuming free`);
      return 0;
    }
    
    const inputCost = (inputTokens / 1000) * modelPricing.input;
    const outputCost = (outputTokens / 1000) * modelPricing.output;
    const totalCost = inputCost + outputCost;
    
    console.log(`AI Chat Service - Cost calculation: ${inputTokens} input tokens ($${inputCost.toFixed(4)}) + ${outputTokens} output tokens ($${outputCost.toFixed(4)}) = $${totalCost.toFixed(4)}`);
    return totalCost;
  }
  
  // Generate fallback response when AI service fails
  static async generateFallbackResponse(agentId, message, errorMessage) {
    console.log(`AI Chat Service - Generating fallback response for agent ${agentId}, error: ${errorMessage}`);

    // Determine if this is a configuration issue
    const isConfigIssue = errorMessage.includes('API key not configured') ||
                         errorMessage.includes('Base URL') ||
                         errorMessage.includes('not configured');

    if (isConfigIssue) {
      // Provide specific guidance for configuration issues
      const fallbackResponses = {
        'exam-assistant': `I'm currently unavailable due to AI service configuration requirements. You can still access these features directly:\n\n• **Create Exams**: Use the Create Exam page\n• **Manage Questions**: Add or import questions in the Questions section\n• **Organize Subjects**: Manage subjects in the Subjects section\n\nFor AI-powered exam and question assistance, please ask your administrator to configure the AI platforms.`,

        'student-support': `I'm currently unavailable due to AI service configuration requirements. You can still access these features directly:\n\n• **Student Performance**: View reports in the Reports section\n• **Group Management**: Manage student groups in Student Management\n• **Data Export**: Use the available export options\n• **Analytics**: Check the Dashboard for basic statistics\n\nFor AI-powered insights, please ask your administrator to configure the AI platforms.`,

        'content-creator': `I'm currently unavailable because the AI service needs administrator configuration. You can still:\n\n• **Create Questions**: Use the Questions section for manual creation\n• **Import Content**: Upload questions via CSV/Excel templates\n• **Browse Question Banks**: Explore existing question collections\n• **Use Templates**: Access built-in question templates\n\nFor AI-assisted content creation, ask your administrator to set up AI platforms in Settings.`,

        'data-analyst': `I'm currently unavailable due to AI service configuration needs. You can still access:\n\n• **Standard Reports**: Use pre-built reports in the Reports section\n• **Raw Data**: Export data for external analysis\n• **Dashboard Statistics**: View basic metrics on the Dashboard\n• **Custom Reports**: Generate standard performance reports\n\nFor advanced AI-powered analytics, please have your administrator configure the AI platforms.`
      };

      return fallbackResponses[agentId] || `I apologize, but I'm currently unavailable due to AI service configuration requirements. Please ask your administrator to configure the AI platforms in Settings → AI Platforms to enable AI assistance.`;
    } else {
      // Generic temporary issue
      const fallbackResponses = {
        'exam-assistant': `I'm temporarily unavailable due to technical difficulties. You can still:\n\n• **Create Exams**: Use the Create Exam page\n• **Manage Questions**: Add or import questions in the Questions section\n• **Organize Subjects**: Manage subjects in the Subjects section\n\nPlease try again shortly.`,

        'student-support': `I'm temporarily unavailable due to technical difficulties. You can still:\n\n• **View Performance**: Check the Reports section\n• **Manage Groups**: Use Student Management\n• **Export Data**: Access available export options\n• **Contact Support**: For immediate assistance\n\nPlease try again shortly.`,

        'content-creator': `I'm currently experiencing technical difficulties. While I recover, you can:\n\n• **Create Questions**: Use the Questions section\n• **Import Content**: Upload via CSV/Excel templates\n• **Browse Questions**: Explore existing question banks\n• **Use Templates**: Access built-in templates\n\nPlease try again in a few moments.`,

        'data-analyst': `I'm temporarily unavailable due to technical difficulties. You can still:\n\n• **View Reports**: Access the Reports section\n• **Export Data**: Use export options for external analysis\n• **Dashboard**: Check basic statistics\n• **Standard Reports**: Generate performance reports\n\nPlease retry your request shortly.`
      };

      return fallbackResponses[agentId] || `I apologize, but I'm currently experiencing technical difficulties. Please try again in a few moments. If this issue persists, please contact support.`;
    }
  }
  
  static generateStudentSupportResponse(message, fileAttachment) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('performance') || lowerMessage.includes('analytics')) {
      return "Student performance analytics in ExamMaster include:\n\n• **Individual Performance**: Detailed score breakdowns and trends\n• **Comparative Analysis**: Performance vs class averages\n• **Subject-wise Analysis**: Strengths and weakness identification\n• **Time Analysis**: Study patterns and exam completion times\n• **Progress Tracking**: Historical performance over multiple exams\n\nYou can access these insights in the 'Reports' section. Would you like help interpreting specific performance metrics?";
    }
    
    if (lowerMessage.includes('student') && (lowerMessage.includes('manage') || lowerMessage.includes('add'))) {
      return "Student management features:\n\n• **Individual Students**: Add, edit, and manage student profiles\n• **Group Management**: Create and organize student groups\n• **Bulk Operations**: Import students via CSV\n• **Performance Tracking**: Monitor individual and group progress\n• **Communication**: Send notifications and updates\n\nAccess all student management tools in the 'Students' section of the admin panel.";
    }
    
    return "As your Student Support Agent, I can assist with:\n\n• Student performance analysis and reporting\n• Managing student accounts and groups\n• Tracking learning progress and outcomes\n• Identifying at-risk students\n• Generating study recommendations\n• Setting up remedial actions\n\nWhat student support task can I help you with today?";
  }
  
  static generateContentCreatorResponse(message, fileAttachment) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('question') && lowerMessage.includes('generate')) {
      return "I can help generate questions for your exams:\n\n**Question Generation Tips:**\n• Start with clear learning objectives\n• Use Bloom's Taxonomy for difficulty levels\n• Include distractors that test common misconceptions\n• Vary question formats for engagement\n• Ensure questions align with curriculum standards\n\n**Content Areas I Can Help With:**\n• Mathematics and Sciences\n• Language Arts and Literature\n• Social Studies and History\n• Technical and Professional subjects\n\nWhat subject and difficulty level would you like questions for?";
    }
    
    if (lowerMessage.includes('curriculum') || lowerMessage.includes('syllabus')) {
      return "Curriculum and content planning assistance:\n\n• **Learning Objective Mapping**: Align content with educational goals\n• **Progressive Difficulty**: Structure content from basic to advanced\n• **Assessment Integration**: Balance formative and summative assessments\n• **Content Gaps Analysis**: Identify missing curriculum elements\n• **Standards Alignment**: Ensure compliance with educational standards\n\nI can help you organize and structure your educational content effectively.";
    }
    
    return "As your Content Creator Agent, I can help with:\n\n• Generating exam questions across subjects\n• Creating study materials and resources\n• Developing curriculum maps and lesson plans\n• Writing educational content and explanations\n• Designing assessment rubrics\n• Planning learning progressions\n\nWhat type of content would you like me to help create?";
  }
  
  static generateDataAnalystResponse(message, fileAttachment) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('report') || lowerMessage.includes('analytics')) {
      return "Available analytics and reporting options:\n\n**Exam Analytics:**\n• Pass/fail rates and grade distributions\n• Question difficulty analysis\n• Time analysis and completion rates\n• Cheating detection patterns\n\n**Student Analytics:**\n• Individual performance trends\n• Class performance comparisons\n• Learning outcome achievements\n• At-risk student identification\n\n**System Analytics:**\n• Usage patterns and peak times\n• System performance metrics\n• User engagement statistics\n\nWhich type of analysis would you like me to help you with?";
    }
    
    if (lowerMessage.includes('trend') || lowerMessage.includes('pattern')) {
      return "I can help identify important patterns in your ExamMaster data:\n\n• **Performance Trends**: Improving or declining scores over time\n• **Question Analysis**: Which questions are too easy/hard\n• **Timing Patterns**: How long students spend on different questions\n• **Success Predictors**: Factors that correlate with better performance\n• **Engagement Metrics**: Student interaction and participation patterns\n\nWhat specific trends or patterns would you like me to analyze?";
    }
    
    return "As your Data Analyst Agent, I can help with:\n\n• Analyzing exam and student performance data\n• Generating comprehensive reports\n• Identifying trends and patterns\n• Creating data visualizations\n• Statistical analysis and insights\n• Predictive analytics for student success\n\nWhat data analysis task can I assist you with today?";
  }
  
  static generateGeneralResponse(message, fileAttachment) {
    return "Hello! I'm here to help you with ExamMaster. I can assist with:\n\n• **Exam Management**: Creating, editing, and organizing exams\n• **Question Banks**: Managing and organizing questions\n• **Student Management**: Adding and tracking student progress\n• **Reports & Analytics**: Generating insights and performance reports\n• **System Configuration**: Settings and customization options\n\nFeel free to ask me about any ExamMaster feature or functionality. How can I help you today?";
  }
  
  // Get chat history for a user with pagination
  static async getChatHistory(userId, options = {}) {
    console.log(`AI Chat Service - Getting chat history for user ${userId}`);

    try {
      const result = await AIChat.getChatHistory(userId, options);
      console.log(`AI Chat Service - Retrieved ${result.messages.length} chat messages from ${result.pagination.totalCount} total`);

      return {
        messages: result.messages.map(msg => ({
          _id: msg._id,
          message: msg.message,
          response: msg.response,
          timestamp: msg.createdAt,
          modelId: msg.modelId,
          agentId: msg.agentId,
          fileAttachment: msg.fileAttachment,
          isFallback: msg.isFallback,
          processingTime: msg.metadata?.processingTime,
          tokenCount: msg.metadata?.tokenCount
        })),
        pagination: result.pagination
      };
    } catch (error) {
      console.error('AI Chat Service - Error getting chat history:', error);
      throw error;
    }
  }

  // Bulk clear (soft-delete) all chat history for a user
  static async clearHistory(userId) {
    console.log(`AI Chat Service - Clearing chat history for user ${userId}`);

    try {
      await AIChat.clearHistory(userId);
      console.log(`AI Chat Service - Chat history cleared for user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('AI Chat Service - Error clearing chat history:', error);
      throw error;
    }
  }

  // Get available AI platforms (for backwards compatibility)
  static async getModels() {
    console.log('AI Chat Service - Getting available AI platforms (models)');
    
    try {
      const platforms = await AIPlatform.findActive();
      console.log(`AI Chat Service - Retrieved ${platforms.length} AI platforms`);
      
      return {
        models: platforms.map(platform => ({
          _id: platform._id,
          name: `${platform.displayName} (${platform.configuration.model})`,
          description: platform.description,
          isActive: platform.isActive
        }))
      };
    } catch (error) {
      console.error('AI Chat Service - Error getting platforms:', error);
      throw error;
    }
  }
  
  // Get available AI agents
  static async getAgents() {
    console.log('AI Chat Service - Getting available AI agents');
    
    try {
      const agents = await AIAgent.findActive();
      console.log(`AI Chat Service - Retrieved ${agents.length} AI agents`);
      
      return {
        agents: agents.map(agent => ({
          _id: agent.agentId,
          name: agent.name,
          description: agent.description,
          capabilities: agent.capabilities,
          isActive: agent.isActive
        }))
      };
    } catch (error) {
      console.error('AI Chat Service - Error getting agents:', error);
      throw error;
    }
  }
  
  // Upload and process file for AI context
  static async uploadFile(userId, fileData) {
    console.log(`AI Chat Service - Processing file upload for user ${userId}`);
    console.log(`AI Chat Service - File: ${fileData.fileName}, Size: ${fileData.fileSize} bytes`);
    
    try {
      // In a real implementation, this would:
      // 1. Validate file type and size
      // 2. Upload to cloud storage (AWS S3, etc.)
      // 3. Extract text content for AI processing
      // 4. Store file metadata
      
      const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const fileUrl = `/uploads/ai-chat/${userId}/${fileId}_${fileData.fileName}`;
      
      console.log(`AI Chat Service - File processed successfully, URL: ${fileUrl}`);
      
      return {
        fileId,
        fileName: fileData.fileName,
        fileUrl
      };
    } catch (error) {
      console.error('AI Chat Service - Error uploading file:', error);
      throw error;
    }
  }
}

console.log('AI Chat Service loaded successfully');

module.exports = AIChatService;