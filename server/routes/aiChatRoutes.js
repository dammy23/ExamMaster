const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const AIChatService = require('../services/aiChatService');
const DocumentParsingService = require('../services/documentParsingService');
const ExamService = require('../services/examService');
const QuestionService = require('../services/questionService');
const SubjectService = require('../services/subjectService');
const { requireUser } = require('./middleware/auth');

console.log('Loading AI Chat Routes...');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/ai-chat');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.log(`File type ${file.mimetype} not allowed`);
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2MB limit (reduced to work within proxy constraints)
  }
});

// POST /api/ai-chat/message - Send message to AI
router.post('/message', requireUser, upload.single('fileAttachment'), async (req, res) => {
  console.log('AI Chat Routes - POST /message');
  console.log('Request body:', req.body);
  console.log('Uploaded file:', req.file ? req.file.filename : 'None');
  
  try {
    const { message, modelId, agentId } = req.body;
    const userId = req.user._id;
    
    // Validation
    if (!message || !message.trim()) {
      console.error('AI Chat Routes - Message is required');
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    if (!modelId || !agentId) {
      console.error('AI Chat Routes - Model ID and Agent ID are required');
      return res.status(400).json({
        success: false,
        error: 'Model ID and Agent ID are required'
      });
    }
    
    if (message.length > 5000) {
      console.error('AI Chat Routes - Message too long');
      return res.status(400).json({
        success: false,
        error: 'Message must be less than 5000 characters'
      });
    }
    
    // Prepare file attachment data if present
    let fileAttachment = null;
    if (req.file) {
      fileAttachment = {
        fileName: req.file.originalname,
        fileUrl: `/uploads/ai-chat/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      };
      console.log('AI Chat Routes - File attachment prepared:', fileAttachment);
    }
    
    // Process message through AI service
    const result = await AIChatService.sendMessage(userId, {
      message: message.trim(),
      modelId,
      agentId,
      fileAttachment
    });
    
    console.log('AI Chat Routes - Message processed successfully');
    
    res.json({
      success: true,
      data: {
        response: result.response,
        messageId: result.messageId,
        processingTime: result.processingTime,
        tokenCount: result.tokenCount
      }
    });
    
  } catch (error) {
    console.error('AI Chat Routes - Error processing message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process AI chat message'
    });
  }
});

// GET /api/ai-chat/history - Get chat history
router.get('/history', requireUser, async (req, res) => {
  console.log('AI Chat Routes - GET /history');
  
  try {
    const userId = req.user._id;
    const { page = 1, limit = 50 } = req.query;
    
    console.log(`AI Chat Routes - Getting history for user ${userId}, page ${page}, limit ${limit}`);
    
    // Validate pagination parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      console.error('AI Chat Routes - Invalid pagination parameters');
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination parameters'
      });
    }
    
    const result = await AIChatService.getChatHistory(userId, {
      page: pageNum,
      limit: limitNum
    });
    
    console.log(`AI Chat Routes - Retrieved ${result.messages.length} messages`);
    
    res.json({
      success: true,
      data: {
        messages: result.messages,
        page: pageNum,
        limit: limitNum
      }
    });
    
  } catch (error) {
    console.error('AI Chat Routes - Error getting chat history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get chat history'
    });
  }
});

// GET /api/ai-chat/models - Get available AI models
router.get('/models', requireUser, async (req, res) => {
  console.log('AI Chat Routes - GET /models');
  
  try {
    const result = await AIChatService.getModels();
    
    console.log(`AI Chat Routes - Retrieved ${result.models.length} AI models`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('AI Chat Routes - Error getting AI models:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AI models'
    });
  }
});

// GET /api/ai-chat/agents - Get available AI agents
router.get('/agents', requireUser, async (req, res) => {
  console.log('AI Chat Routes - GET /agents');
  
  try {
    const result = await AIChatService.getAgents();
    
    console.log(`AI Chat Routes - Retrieved ${result.agents.length} AI agents`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('AI Chat Routes - Error getting AI agents:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AI agents'
    });
  }
});

// POST /api/ai-chat/upload - Upload file for AI context
router.post('/upload', requireUser, upload.single('file'), async (req, res) => {
  console.log('AI Chat Routes - POST /upload');
  console.log('Uploaded file:', req.file ? req.file.filename : 'None');
  
  try {
    if (!req.file) {
      console.error('AI Chat Routes - No file uploaded');
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    const userId = req.user._id;
    const { description } = req.body;
    
    const result = await AIChatService.uploadFile(userId, {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      filePath: req.file.path,
      description
    });
    
    console.log('AI Chat Routes - File uploaded successfully');
    
    res.json({
      success: true,
      data: {
        fileId: result.fileId,
        fileName: result.fileName,
        fileUrl: result.fileUrl
      }
    });
    
  } catch (error) {
    console.error('AI Chat Routes - Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
});

// POST /api/ai-chat/generate-questions - Generate questions from document or text
// Description: Generate exam questions from uploaded document or text input
// Endpoint: POST /api/ai-chat/generate-questions
// Request: { document?: File, text?: string, questionCount?: number, difficulty?: string, questionTypes?: Array<string>, subject?: string }
// Response: { questions: Array<Question>, validationResults: { validQuestions: number, totalGenerated: number, errors: Array<string> } }
router.post('/generate-questions', requireUser, upload.single('document'), async (req, res) => {
  console.log('AI Chat Routes - POST /generate-questions');
  console.log('Request body:', req.body);
  console.log('Uploaded file:', req.file ? req.file.filename : 'None');

  try {
    const { text, questionCount = 5, difficulty = 'medium', questionTypes = 'multiple-choice,true-false,short-answer', subject = 'General' } = req.body;
    const userId = req.user._id;

    // Parse question types array
    const questionTypesArray = typeof questionTypes === 'string'
      ? questionTypes.split(',').map(type => type.trim())
      : questionTypes;

    let sourceText = '';

    // Extract text from uploaded document or use provided text
    if (req.file) {
      console.log(`AI Chat Routes - Processing uploaded document: ${req.file.originalname}`);
      try {
        sourceText = await DocumentParsingService.parseDocument(req.file.path, req.file.mimetype);
        console.log(`AI Chat Routes - Extracted ${sourceText.length} characters from document`);

        // Clean up uploaded file
        await DocumentParsingService.cleanupFile(req.file.path);
      } catch (parseError) {
        console.error('AI Chat Routes - Document parsing failed:', parseError);
        return res.status(400).json({
          success: false,
          error: `Failed to parse document: ${parseError.message}`
        });
      }
    } else if (text) {
      sourceText = text.trim();
      console.log(`AI Chat Routes - Using provided text: ${sourceText.length} characters`);
    } else {
      console.error('AI Chat Routes - No document or text provided');
      return res.status(400).json({
        success: false,
        error: 'Please provide either a document file or text content'
      });
    }

    if (sourceText.length < 100) {
      console.error('AI Chat Routes - Insufficient content for question generation');
      return res.status(400).json({
        success: false,
        error: 'Content is too short. Please provide at least 100 characters of text for question generation.'
      });
    }

    // Generate questions from text
    console.log(`AI Chat Routes - Generating ${questionCount} questions from text`);
    const generatedQuestions = await DocumentParsingService.generateQuestionsFromText(sourceText, {
      questionCount: parseInt(questionCount, 10),
      difficulty,
      questionTypes: questionTypesArray,
      subject
    });

    // Validate generated questions
    const validationResults = DocumentParsingService.validateGeneratedQuestions(generatedQuestions);

    console.log(`AI Chat Routes - Question generation completed: ${validationResults.totalValid}/${validationResults.totalGenerated} questions valid`);

    res.json({
      success: true,
      data: {
        questions: validationResults.validQuestions,
        validationResults: {
          validQuestions: validationResults.totalValid,
          totalGenerated: validationResults.totalGenerated,
          errors: validationResults.errors
        },
        sourceTextLength: sourceText.length
      }
    });

  } catch (error) {
    console.error('AI Chat Routes - Error generating questions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate questions'
    });
  }
});

// POST /api/ai-chat/create-exam - Create exam through AI assistant
// Description: Create a new exam with AI assistance and guided flow
// Endpoint: POST /api/ai-chat/create-exam
// Request: { title: string, subject: string, duration: number, startDate: Date, endDate: Date, totalMarks: number, passingMarks: number, instructions?: string, questions?: Array<ObjectId> }
// Response: { exam: Exam, message: string }
router.post('/create-exam', requireUser, async (req, res) => {
  console.log('AI Chat Routes - POST /create-exam');
  console.log('Request body:', req.body);

  try {
    const examData = req.body;
    const userId = req.user._id;

    // Validate required fields
    const requiredFields = ['title', 'subject', 'duration', 'startDate', 'endDate', 'totalMarks', 'passingMarks'];
    const missingFields = requiredFields.filter(field => !examData[field]);

    if (missingFields.length > 0) {
      console.error(`AI Chat Routes - Missing required fields: ${missingFields.join(', ')}`);
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        missingFields
      });
    }

    // Create exam using existing service
    console.log('AI Chat Routes - Creating exam with provided data');
    const exam = await ExamService.create(examData, userId);

    console.log(`AI Chat Routes - Exam created successfully: ${exam._id}`);

    res.json({
      success: true,
      data: {
        exam,
        message: `Exam "${exam.title}" created successfully! ${exam.questions.length > 0 ? `${exam.questions.length} questions have been assigned.` : 'You can now add questions to this exam.'}`
      }
    });

  } catch (error) {
    console.error('AI Chat Routes - Error creating exam:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create exam'
    });
  }
});

// POST /api/ai-chat/create-subject - Create subject through AI assistant
// Description: Create a new subject with AI assistance
// Endpoint: POST /api/ai-chat/create-subject
// Request: { name: string, code: string, description?: string, isActive?: boolean }
// Response: { subject: Subject, message: string }
router.post('/create-subject', requireUser, async (req, res) => {
  console.log('AI Chat Routes - POST /create-subject');
  console.log('Request body:', req.body);

  try {
    const { name, code, description, isActive = true } = req.body;
    const userId = req.user._id;

    // Validate required fields
    if (!name || !code) {
      console.error('AI Chat Routes - Missing required fields: name and code are required');
      return res.status(400).json({
        success: false,
        error: 'Subject name and code are required',
        missingFields: !name && !code ? ['name', 'code'] : !name ? ['name'] : ['code']
      });
    }

    // Create subject using existing service
    console.log('AI Chat Routes - Creating subject with provided data');
    const subject = await SubjectService.createSubject({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description?.trim(),
      isActive
    }, userId);

    console.log(`AI Chat Routes - Subject created successfully: ${subject._id}`);

    res.json({
      success: true,
      data: {
        subject,
        message: `Subject "${subject.name}" (${subject.code}) created successfully! You can now use this subject when creating exams.`
      }
    });

  } catch (error) {
    console.error('AI Chat Routes - Error creating subject:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create subject'
    });
  }
});

// POST /api/ai-chat/create-questions - Create questions through AI assistant
// Description: Create questions from validated question data
// Endpoint: POST /api/ai-chat/create-questions
// Request: { questions: Array<Question>, examId?: ObjectId }
// Response: { questions: Array<Question>, exam?: Exam, message: string }
router.post('/create-questions', requireUser, async (req, res) => {
  console.log('AI Chat Routes - POST /create-questions');
  console.log('Request body:', req.body);

  try {
    const { questions, examId } = req.body;
    const userId = req.user._id;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      console.error('AI Chat Routes - No questions provided');
      return res.status(400).json({
        success: false,
        error: 'Please provide an array of questions to create'
      });
    }

    console.log(`AI Chat Routes - Creating ${questions.length} questions`);

    // Create questions using existing service
    const result = await QuestionService.bulkCreateQuestions(questions, userId);

    let responseMessage = `Successfully created ${result.imported} questions.`;

    if (result.errors && result.errors.length > 0) {
      responseMessage += ` ${result.errors.length} questions had errors and were not created.`;
    }

    let updatedExam = null;

    // If examId is provided, assign questions to the exam
    if (examId && result.questions && result.questions.length > 0) {
      try {
        console.log(`AI Chat Routes - Assigning ${result.questions.length} questions to exam ${examId}`);
        const questionIds = result.questions.map(q => q._id);
        await ExamService.assignQuestions(examId, questionIds, userId);

        // Get updated exam
        updatedExam = await ExamService.getById(examId);
        responseMessage += ` Questions have been assigned to the exam "${updatedExam.title}".`;
      } catch (assignError) {
        console.error('AI Chat Routes - Error assigning questions to exam:', assignError);
        responseMessage += ` However, there was an error assigning questions to the exam: ${assignError.message}`;
      }
    }

    console.log(`AI Chat Routes - Question creation completed: ${result.imported} questions created`);

    res.json({
      success: true,
      data: {
        questions: result.questions,
        exam: updatedExam,
        createdCount: result.imported,
        errors: result.errors || [],
        message: responseMessage
      }
    });

  } catch (error) {
    console.error('AI Chat Routes - Error creating questions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create questions'
    });
  }
});

// POST /api/ai-chat/generate-sample-questions - Generate sample questions for a topic without external AI
// Description: Generate sample questions using built-in templates and patterns
// Endpoint: POST /api/ai-chat/generate-sample-questions
// Request: { topic: string, questionCount?: number, difficulty?: string, questionTypes?: Array<string> }
// Response: { questions: Array<Question>, message: string, topic: string }
router.post('/generate-sample-questions', requireUser, async (req, res) => {
  console.log('AI Chat Routes - POST /generate-sample-questions');
  console.log('Request body:', req.body);

  try {
    const { topic = 'General Knowledge', questionCount = 5, difficulty = 'medium', questionTypes = ['multiple-choice', 'true-false'] } = req.body;
    const userId = req.user._id;

    console.log(`AI Chat Routes - Generating ${questionCount} sample questions about ${topic}`);

    // Create sample content based on the topic for question generation
    const sampleContent = generateTopicContent(topic);

    // Generate questions using the document parsing service
    const generatedQuestions = await DocumentParsingService.generateQuestionsFromText(sampleContent, {
      questionCount: parseInt(questionCount, 10),
      difficulty,
      questionTypes: Array.isArray(questionTypes) ? questionTypes : questionTypes.split(',').map(t => t.trim()),
      subject: topic
    });

    // Validate generated questions
    const validationResults = DocumentParsingService.validateGeneratedQuestions(generatedQuestions);

    console.log(`AI Chat Routes - Sample question generation completed: ${validationResults.totalValid}/${validationResults.totalGenerated} questions valid`);

    res.json({
      success: true,
      data: {
        questions: validationResults.validQuestions,
        validationResults: {
          validQuestions: validationResults.totalValid,
          totalGenerated: validationResults.totalGenerated,
          errors: validationResults.errors
        },
        message: `Generated ${validationResults.totalValid} sample questions about ${topic}. You can review and edit them before adding to your question bank.`,
        topic,
        sourceType: 'sample_generation'
      }
    });

  } catch (error) {
    console.error('AI Chat Routes - Error generating sample questions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate sample questions'
    });
  }
});

// Helper function to generate sample content for different topics
function generateTopicContent(topic) {
  const topicLower = topic.toLowerCase();

  // Topic-specific sample content for question generation
  const topicContents = {
    'biology': 'Biology is the scientific study of life and living organisms. It encompasses various levels of organization from molecules and cells to organisms and ecosystems. Key areas include genetics, evolution, ecology, and physiology. Photosynthesis is the process by which plants convert light energy into chemical energy. DNA contains genetic information and is composed of nucleotides. Cell division includes mitosis and meiosis. Evolution occurs through natural selection and genetic variation.',

    'mathematics': 'Mathematics is the study of numbers, shapes, patterns, and relationships. Algebra involves solving equations and working with variables. Geometry deals with shapes, angles, and spatial relationships. Calculus studies rates of change and areas under curves. Statistics involves collecting, analyzing, and interpreting data. Probability measures the likelihood of events occurring. Prime numbers are integers greater than 1 divisible only by 1 and themselves.',

    'physics': 'Physics is the fundamental science that studies matter, energy, and their interactions. Force equals mass times acceleration according to Newton\'s second law. Energy cannot be created or destroyed, only transformed from one form to another. Light travels at approximately 300,000 kilometers per second in a vacuum. Gravity is the force that attracts objects toward each other. Electric current is the flow of electric charge through a conductor.',

    'chemistry': 'Chemistry is the science that studies the composition, structure, and properties of matter. Atoms are the basic building blocks of matter and consist of protons, neutrons, and electrons. Chemical bonds form when atoms share or transfer electrons. The periodic table organizes elements by atomic number and properties. Chemical reactions involve breaking and forming bonds between atoms. pH measures the acidity or alkalinity of solutions.',

    'history': 'History is the study of past events and their impact on human civilization. Ancient civilizations like Egypt, Greece, and Rome laid foundations for modern society. The Renaissance marked a period of cultural and scientific rebirth in Europe. The Industrial Revolution transformed manufacturing and transportation. World War I and II were major global conflicts that shaped the 20th century. Democracy developed as a system of government by the people.',

    'english': 'English language and literature encompass grammar, vocabulary, composition, and literary analysis. Nouns are words that name people, places, things, or ideas. Verbs express action or state of being. Adjectives describe or modify nouns. Literary devices include metaphor, simile, and symbolism. Shakespeare wrote numerous plays and sonnets that remain influential today. Poetry uses rhythm, rhyme, and imagery to express ideas and emotions.',

    'geography': 'Geography is the study of Earth\'s physical features, climate, and human populations. Continents are large landmasses including Asia, Africa, North America, South America, Antarctica, Europe, and Australia. The water cycle involves evaporation, condensation, and precipitation. Climate is determined by factors such as latitude, altitude, and proximity to water bodies. Natural resources include renewable and non-renewable materials used by humans.',

    'computer science': 'Computer science involves the study of algorithms, programming, and computational systems. Programming languages include Python, Java, JavaScript, and C++. Algorithms are step-by-step procedures for solving problems. Data structures organize and store information efficiently. Software engineering involves designing and building computer applications. Artificial intelligence enables computers to perform tasks that typically require human intelligence.',
  };

  // Check for topic matches and return appropriate content
  for (const [key, content] of Object.entries(topicContents)) {
    if (topicLower.includes(key) || key.includes(topicLower)) {
      return content;
    }
  }

  // General fallback content
  return `${topic} is an important subject of study that involves understanding key concepts, principles, and applications. Students should develop critical thinking skills and analytical abilities in this area. Important topics include fundamental theories, practical applications, and current developments in the field. Understanding the historical context and future trends can provide valuable insights. Regular practice and application of concepts helps in mastering the subject matter.`;
}

// GET /api/ai-chat/conversation-context - Get conversation context and available options
// Description: Get current conversation context and available actions for the AI assistant
// Endpoint: GET /api/ai-chat/conversation-context
// Request: { agentId?: string }
// Response: { exams: Array<Exam>, subjects: Array<Subject>, questions: Array<Question>, suggestions: Array<string> }
router.get('/conversation-context', requireUser, async (req, res) => {
  console.log('AI Chat Routes - GET /conversation-context');

  try {
    const { agentId = 'exam-assistant' } = req.query;
    const userId = req.user._id;

    console.log(`AI Chat Routes - Getting conversation context for agent: ${agentId}`);

    // Get relevant data based on agent type
    const [exams, subjects, recentQuestions] = await Promise.all([
      ExamService.getAll({}, userId),
      SubjectService.getAllSubjects({ isActive: true }),
      QuestionService.getAllQuestions({}, { page: 1, limit: 10 })
    ]);

    // Generate contextual suggestions based on current data
    const suggestions = generateContextualSuggestions(agentId, {
      examCount: exams.length,
      subjectCount: subjects.length,
      questionCount: recentQuestions.pagination.totalItems
    });

    console.log(`AI Chat Routes - Context retrieved: ${exams.length} exams, ${subjects.length} subjects, ${recentQuestions.pagination.totalItems} questions`);

    res.json({
      success: true,
      data: {
        exams: exams.slice(0, 5), // Latest 5 exams
        subjects,
        questions: recentQuestions.questions,
        suggestions,
        counts: {
          totalExams: exams.length,
          totalSubjects: subjects.length,
          totalQuestions: recentQuestions.pagination.totalItems
        }
      }
    });

  } catch (error) {
    console.error('AI Chat Routes - Error getting conversation context:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get conversation context'
    });
  }
});

// Helper function to generate contextual suggestions
function generateContextualSuggestions(agentId, data) {
  const suggestions = [];

  if (agentId === 'exam-assistant') {
    if (data.examCount === 0) {
      suggestions.push("Let's create your first exam! I can guide you through the process.");
    } else {
      suggestions.push("Would you like to create a new exam or manage existing ones?");
    }

    if (data.subjectCount === 0) {
      suggestions.push("You'll need subjects to organize your exams. Shall I help you create some?");
    }

    if (data.questionCount === 0) {
      suggestions.push("I can help you create questions from documents or generate them manually.");
    } else {
      suggestions.push("I can help you generate more questions or organize existing ones.");
    }

    suggestions.push("Upload a document and I'll generate questions from it automatically.");
    suggestions.push("What type of exam would you like to create? (MCQ, Mixed, Essay-based)");
  }

  return suggestions;
}

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 2MB.'
      });
    }
    
    return res.status(400).json({
      success: false,
      error: 'File upload error'
    });
  }
  
  if (error.message === 'File type not allowed') {
    return res.status(400).json({
      success: false,
      error: 'File type not allowed. Supported formats: TXT, PDF, DOC, DOCX, CSV, XLS, XLSX, JSON'
    });
  }
  
  next(error);
});

console.log('AI Chat Routes loaded successfully');

module.exports = router;