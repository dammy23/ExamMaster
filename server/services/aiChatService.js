const AIChat = require('../models/AIChat');
const { AIModel, AIAgent } = require('../models/AIConfig');

console.log('Loading AI Chat Service...');

class AIChatService {
  
  // Send a message to AI and get response
  static async sendMessage(userId, messageData) {
    const { message, modelId, agentId, fileAttachment } = messageData;
    
    console.log(`AI Chat Service - Processing message for user ${userId}`);
    console.log(`AI Chat Service - Model: ${modelId}, Agent: ${agentId}`);
    console.log(`AI Chat Service - Message length: ${message.length} characters`);
    
    try {
      // Validate model and agent exist and are active
      const [model, agent] = await Promise.all([
        AIModel.findOne({ modelId, isActive: true, isDeleted: false }),
        AIAgent.findOne({ agentId, isActive: true, isDeleted: false })
      ]);
      
      if (!model) {
        console.error(`AI Chat Service - Model ${modelId} not found or inactive`);
        throw new Error(`AI model '${modelId}' not found or inactive`);
      }
      
      if (!agent) {
        console.error(`AI Chat Service - Agent ${agentId} not found or inactive`);
        throw new Error(`AI agent '${agentId}' not found or inactive`);
      }
      
      console.log(`AI Chat Service - Using model: ${model.name}`);
      console.log(`AI Chat Service - Using agent: ${agent.name}`);
      
      const startTime = Date.now();
      
      // Simulate AI response processing
      // In a real implementation, this would call the actual AI API
      const aiResponse = await this.processAIRequest(message, model, agent, fileAttachment);
      
      const processingTime = Date.now() - startTime;
      console.log(`AI Chat Service - Processing completed in ${processingTime}ms`);
      
      // Save chat message to database
      const chatMessage = new AIChat({
        userId,
        message: message.trim(),
        response: aiResponse.response,
        modelId,
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
        }
      });
      
      const savedMessage = await chatMessage.save();
      console.log(`AI Chat Service - Message saved with ID: ${savedMessage._id}`);
      
      return {
        response: aiResponse.response,
        messageId: savedMessage._id.toString(),
        processingTime,
        tokenCount: aiResponse.tokenCount
      };
      
    } catch (error) {
      console.error('AI Chat Service - Error processing message:', error);
      throw error;
    }
  }
  
  // Simulate AI request processing
  static async processAIRequest(message, model, agent, fileAttachment) {
    console.log(`AI Chat Service - Processing AI request with ${model.name} and ${agent.name}`);
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    let response = '';
    
    // Generate contextual response based on agent type and message content
    if (agent.agentId === 'exam-assistant') {
      response = this.generateExamAssistantResponse(message, fileAttachment);
    } else if (agent.agentId === 'student-support') {
      response = this.generateStudentSupportResponse(message, fileAttachment);
    } else if (agent.agentId === 'content-creator') {
      response = this.generateContentCreatorResponse(message, fileAttachment);
    } else if (agent.agentId === 'data-analyst') {
      response = this.generateDataAnalystResponse(message, fileAttachment);
    } else {
      response = this.generateGeneralResponse(message, fileAttachment);
    }
    
    // Add file attachment context if present
    if (fileAttachment) {
      response += `\n\nI've reviewed the uploaded file "${fileAttachment.fileName}". `;
    }
    
    // Simulate token usage and cost
    const inputTokens = Math.ceil(message.length / 4);
    const outputTokens = Math.ceil(response.length / 4);
    const cost = ((inputTokens * model.pricing.inputTokenPrice) + (outputTokens * model.pricing.outputTokenPrice)) / 1000;
    
    return {
      response,
      tokenCount: {
        input: inputTokens,
        output: outputTokens
      },
      cost: Math.round(cost * 100) / 100 // round to 2 decimal places
    };
  }
  
  static generateExamAssistantResponse(message, fileAttachment) {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('create') && lowerMessage.includes('exam')) {
      return "To create a new exam in ExamMaster:\n\n1. Navigate to 'Exam Management' in the admin sidebar\n2. Click 'Create Exam'\n3. Fill in exam details (title, description, duration)\n4. Set scheduling and configuration options\n5. Add questions from your question bank\n6. Assign students or groups\n7. Review and publish\n\nWould you like me to guide you through any specific step?";
    }
    
    if (lowerMessage.includes('question') && (lowerMessage.includes('add') || lowerMessage.includes('create'))) {
      return "ExamMaster supports multiple question types:\n\n• **Multiple Choice Questions (MCQ)**: 4-6 options with single or multiple correct answers\n• **True/False Questions**: Simple binary choice questions\n• **Short Answer Questions**: Open-ended text responses\n\nTo add questions:\n1. Go to 'Questions' in the admin panel\n2. Click 'Add New Question'\n3. Select question type\n4. Enter question text and options/answers\n5. Set difficulty level and subject\n6. Save and assign to exams\n\nNeed help with a specific question type?";
    }
    
    if (lowerMessage.includes('grade') || lowerMessage.includes('grading')) {
      return "ExamMaster features automated grading:\n\n• **Objective Questions**: Automatically graded (MCQ, True/False)\n• **Subjective Questions**: Queued for manual review\n• **Partial Marking**: Configurable for multi-part questions\n• **Negative Marking**: Optional penalty for incorrect answers\n\nYou can configure grading schemes in the exam settings. The system provides detailed analytics and reports after grading completion.";
    }
    
    return "As your Exam Assistant, I can help you with:\n\n• Creating and managing exams\n• Adding and organizing questions\n• Setting up grading schemes\n• Configuring exam settings and security\n• Managing student assignments\n• Analyzing exam results\n\nWhat specific aspect of exam management would you like assistance with?";
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
  
  // Get chat history for a user
  static async getChatHistory(userId, options = {}) {
    console.log(`AI Chat Service - Getting chat history for user ${userId}`);
    
    try {
      const messages = await AIChat.getChatHistory(userId, options);
      console.log(`AI Chat Service - Retrieved ${messages.length} chat messages`);
      
      return {
        messages: messages.map(msg => ({
          _id: msg._id,
          message: msg.message,
          response: msg.response,
          timestamp: msg.createdAt,
          modelId: msg.modelId,
          agentId: msg.agentId,
          fileAttachment: msg.fileAttachment
        }))
      };
    } catch (error) {
      console.error('AI Chat Service - Error getting chat history:', error);
      throw error;
    }
  }
  
  // Get available AI models
  static async getModels() {
    console.log('AI Chat Service - Getting available AI models');
    
    try {
      const models = await AIModel.findActive();
      console.log(`AI Chat Service - Retrieved ${models.length} AI models`);
      
      return {
        models: models.map(model => ({
          _id: model.modelId,
          name: model.name,
          description: model.description,
          isActive: model.isActive
        }))
      };
    } catch (error) {
      console.error('AI Chat Service - Error getting models:', error);
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