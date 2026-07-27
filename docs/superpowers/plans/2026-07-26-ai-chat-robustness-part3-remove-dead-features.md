# AI Chat Robustness — Part 3: Remove/Consolidate Dead Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete 6 fully-dead AI Chat routes/exports (two of them backed by a fake, non-AI question generator) and the fake generator itself, and fold the one dead-but-valuable route (`getConversationContext`'s real exam/subject/question counts) into the live chat pipeline instead of leaving it unreachable.

**Architecture:** Four independent changes: strip dead routes/helpers from `aiChatRoutes.js`, strip the now-fully-unused fake-generator methods from `documentParsingService.js`, add real platform-context injection to `aiChatService.js`'s prompt-building pipeline, and strip the matching dead exports from the client API file.

**Tech Stack:** Express + Mongoose (backend), React + TypeScript (client). No automated test framework exists in this repo.

## Global Constraints

- Backend verification: `node --check <file>` (no test framework exists).
- Client verification: `npx tsc --noEmit -p tsconfig.app.json` from `client/`, compared against the current baseline of **101** pre-existing errors — task changes must not increase this count.
- After each deletion task, grep-verify zero remaining references to anything removed.
- `sendChatMessage`, `getChatHistory`, `getAIAgents`, and `createQuestionsWithAI` (the only exports with a live UI caller) are not deleted — only their surrounding dead siblings.

---

### Task 1: Strip dead routes and helpers from `aiChatRoutes.js`

**Files:**
- Modify: `server/routes/aiChatRoutes.js` (imports; delete `/models`, `/upload`, `/generate-questions`, `/create-exam`, `/create-subject`, `/generate-sample-questions`, `/conversation-context` routes and their `generateTopicContent`/`generateContextualSuggestions` helpers; simplify `/create-questions`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `POST /create-questions`'s response shape narrows to `{questions, createdCount, errors, message}` (drops `exam`), consumed by Task 4's client update to `createQuestionsWithAI`. No other route in this file changes shape.

- [ ] **Step 1: Drop now-unused imports**

Replace:

```js
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
const { requireUser, requireAdmin } = require('./middleware/auth');
```

with:

```js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const AIChatService = require('../services/aiChatService');
const QuestionService = require('../services/questionService');
const { requireAdmin } = require('./middleware/auth');
```

- [ ] **Step 2: Delete `/models`**

Replace:

```js
// GET /api/ai-chat/models - Get available AI models
router.get('/models', requireAdmin, async (req, res) => {
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
```

with:

```js
// GET /api/ai-chat/agents - Get available AI agents
```

- [ ] **Step 3: Delete `/upload`, `/generate-questions`, `/create-exam`, and `/create-subject`**

Replace:

```js
// POST /api/ai-chat/upload - Upload file for AI context
router.post('/upload', requireAdmin, upload.single('file'), async (req, res) => {
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
router.post('/generate-questions', requireAdmin, upload.single('document'), async (req, res) => {
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
router.post('/create-exam', requireAdmin, async (req, res) => {
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
router.post('/create-subject', requireAdmin, async (req, res) => {
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
```

with:

```js
// POST /api/ai-chat/create-questions - Create questions through AI assistant
```

- [ ] **Step 4: Simplify `/create-questions` — remove the unreachable `examId`-driven auto-assign branch**

Replace:

```js
router.post('/create-questions', requireAdmin, async (req, res) => {
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
```

with:

```js
router.post('/create-questions', requireAdmin, async (req, res) => {
  console.log('AI Chat Routes - POST /create-questions');
  console.log('Request body:', req.body);

  try {
    const { questions } = req.body;
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

    console.log(`AI Chat Routes - Question creation completed: ${result.imported} questions created`);

    res.json({
      success: true,
      data: {
        questions: result.questions,
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
```

- [ ] **Step 5: Delete `/generate-sample-questions`, `generateTopicContent`, `/conversation-context`, and `generateContextualSuggestions`**

Replace:

```js
// POST /api/ai-chat/generate-sample-questions - Generate sample questions for a topic without external AI
// Description: Generate sample questions using built-in templates and patterns
// Endpoint: POST /api/ai-chat/generate-sample-questions
// Request: { topic: string, questionCount?: number, difficulty?: string, questionTypes?: Array<string> }
// Response: { questions: Array<Question>, message: string, topic: string }
router.post('/generate-sample-questions', requireAdmin, async (req, res) => {
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
router.get('/conversation-context', requireAdmin, async (req, res) => {
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
```

with:

```js
// Error handling middleware for multer errors
```

- [ ] **Step 6: Verify syntax**

Run: `node --check server/routes/aiChatRoutes.js`
Expected: no output (exits 0)

- [ ] **Step 7: Verify no remaining references to deleted route paths or helpers**

Run: `grep -n "generateTopicContent\|generateContextualSuggestions\|/generate-questions\|/generate-sample-questions\|/create-exam\|/create-subject\|/conversation-context\|'/models'\|'/upload'" server/routes/aiChatRoutes.js`
Expected: no output

- [ ] **Step 8: Commit**

```bash
git add server/routes/aiChatRoutes.js
git commit -m "refactor: delete 6 dead AI Chat routes, simplify create-questions"
```

---

### Task 2: Strip the fake question-generator from `documentParsingService.js`

**Files:**
- Modify: `server/services/documentParsingService.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DocumentParsingService` now exports only `parseDocument`, `parseTextFile`, `parsePDF`, `parseWordDocument` (all unchanged) — consumed by Part 2's existing `AIChatService.extractFileText`, untouched by this task.

- [ ] **Step 1: Delete the fake-generator methods**

Replace:

```js
  // Generate questions from parsed text using AI
  static async generateQuestionsFromText(text, options = {}) {
    console.log(`Document Parsing Service - Generating questions from ${text.length} characters of text`);

    const {
      questionCount = 5,
      difficulty = 'medium',
      questionTypes = ['multiple-choice', 'true-false', 'short-answer'],
      subject = 'General'
    } = options;

    try {
      // Create comprehensive prompt for question generation
      const prompt = this.buildQuestionGenerationPrompt(text, {
        questionCount,
        difficulty,
        questionTypes,
        subject
      });

      console.log(`Document Parsing Service - Generated prompt length: ${prompt.length} characters`);

      // In a real implementation, this would call an AI service
      // For now, we'll generate sample questions based on content analysis
      const questions = this.generateSampleQuestions(text, {
        questionCount,
        difficulty,
        questionTypes,
        subject
      });

      console.log(`Document Parsing Service - Generated ${questions.length} questions`);
      return questions;

    } catch (error) {
      console.error(`Document Parsing Service - Error generating questions:`, error);
      throw new Error(`Failed to generate questions: ${error.message}`);
    }
  }

  // Build comprehensive prompt for AI question generation
  static buildQuestionGenerationPrompt(text, options) {
    const { questionCount, difficulty, questionTypes, subject } = options;

    return `Generate ${questionCount} educational questions based on the following text content.

REQUIREMENTS:
- Question Types: ${questionTypes.join(', ')}
- Difficulty Level: ${difficulty}
- Subject Area: ${subject}
- Each question must be valid according to ExamMaster schema requirements

FORMAT REQUIREMENTS:
For Multiple Choice Questions:
- Must have 4-6 options
- At least one correct answer
- Include explanation
- Question length: 10-1000 characters

For True/False Questions:
- Must have exactly one correct answer ("true" or "false")
- Include explanation
- Question length: 10-1000 characters

For Short Answer Questions:
- Provide sample correct answers
- Include explanation
- Question length: 10-1000 characters

CONTENT TO ANALYZE:
${text.substring(0, 4000)}${text.length > 4000 ? '...[truncated]' : ''}

Return questions in JSON format with the following structure:
{
  "questions": [
    {
      "type": "multiple-choice|true-false|short-answer",
      "question": "Question text here",
      "options": ["option1", "option2", "option3", "option4"], // Only for MCQ
      "correctAnswers": ["correct answer(s)"],
      "explanation": "Explanation of the answer",
      "difficulty": "${difficulty}",
      "marks": 1-5 // Assign marks based on difficulty
    }
  ]
}`;
  }

  // Generate sample questions based on text analysis (fallback method)
  static generateSampleQuestions(text, options) {
    const { questionCount, difficulty, questionTypes, subject } = options;

    console.log(`Document Parsing Service - Generating ${questionCount} sample questions`);

    const questions = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

    for (let i = 0; i < questionCount && i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      const questionType = questionTypes[i % questionTypes.length];

      let question;

      switch (questionType) {
        case 'multiple-choice':
          question = this.generateMCQFromSentence(sentence, difficulty);
          break;
        case 'true-false':
          question = this.generateTrueFalseFromSentence(sentence, difficulty);
          break;
        case 'short-answer':
          question = this.generateShortAnswerFromSentence(sentence, difficulty);
          break;
        default:
          question = this.generateMCQFromSentence(sentence, difficulty);
      }

      if (question) {
        questions.push(question);
      }
    }

    return questions;
  }

  // Generate MCQ from sentence
  static generateMCQFromSentence(sentence, difficulty) {
    const marks = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;

    // Extract key terms and create question
    const words = sentence.split(' ').filter(word => word.length > 4);
    const keyWord = words[Math.floor(Math.random() * words.length)];

    return {
      type: 'multiple-choice',
      question: `Based on the content, which statement is most accurate regarding ${keyWord}?`,
      options: [
        sentence.substring(0, 100) + '...',
        'This is an incorrect alternative option A',
        'This is an incorrect alternative option B',
        'This is an incorrect alternative option C'
      ],
      correctAnswers: [sentence.substring(0, 100) + '...'],
      explanation: `This question tests comprehension of the key concept about ${keyWord} mentioned in the source material.`,
      difficulty,
      marks
    };
  }

  // Generate True/False from sentence
  static generateTrueFalseFromSentence(sentence, difficulty) {
    const marks = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1 : 2;

    const isTrue = Math.random() > 0.5;
    const questionText = isTrue ? sentence : sentence.replace(/is|are|was|were/, 'is not');

    return {
      type: 'true-false',
      question: `True or False: ${questionText.substring(0, 200)}`,
      correctAnswers: [isTrue ? 'true' : 'false'],
      explanation: `This statement is ${isTrue ? 'true' : 'false'} according to the source material.`,
      difficulty,
      marks
    };
  }

  // Generate Short Answer from sentence
  static generateShortAnswerFromSentence(sentence, difficulty) {
    const marks = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 5;

    const words = sentence.split(' ').filter(word => word.length > 4);
    const keyWord = words[0] || 'concept';

    return {
      type: 'short-answer',
      question: `Explain the significance of ${keyWord} as mentioned in the content. Provide a brief explanation with supporting details.`,
      correctAnswers: [
        sentence.substring(0, 200),
        `Key points about ${keyWord} include the information provided in the source material.`
      ],
      explanation: `This question assesses understanding of ${keyWord} and requires students to demonstrate comprehension through written explanation.`,
      difficulty,
      marks
    };
  }

  // Validate generated questions against schema
  static validateGeneratedQuestions(questions) {
    console.log(`Document Parsing Service - Validating ${questions.length} generated questions`);

    const validQuestions = [];
    const errors = [];

    questions.forEach((question, index) => {
      try {
        // Basic validation
        if (!question.question || question.question.length < 10 || question.question.length > 1000) {
          throw new Error(`Question text must be between 10-1000 characters`);
        }

        if (!question.type || !['multiple-choice', 'true-false', 'short-answer'].includes(question.type)) {
          throw new Error(`Invalid question type: ${question.type}`);
        }

        if (!question.correctAnswers || question.correctAnswers.length === 0) {
          throw new Error(`Question must have at least one correct answer`);
        }

        if (!question.difficulty || !['easy', 'medium', 'hard'].includes(question.difficulty)) {
          throw new Error(`Invalid difficulty level: ${question.difficulty}`);
        }

        if (!question.marks || question.marks < 1 || question.marks > 100) {
          throw new Error(`Marks must be between 1-100`);
        }

        // Type-specific validation
        if (question.type === 'multiple-choice') {
          if (!question.options || question.options.length < 4 || question.options.length > 6) {
            throw new Error(`MCQ must have 4-6 options`);
          }

          // Verify correct answers exist in options
          for (const correctAnswer of question.correctAnswers) {
            if (!question.options.includes(correctAnswer)) {
              throw new Error(`Correct answer "${correctAnswer}" not found in options`);
            }
          }
        }

        if (question.type === 'true-false') {
          if (question.correctAnswers.length !== 1) {
            throw new Error(`True/false questions must have exactly one correct answer`);
          }

          if (!['true', 'false'].includes(question.correctAnswers[0].toLowerCase())) {
            throw new Error(`True/false answer must be "true" or "false"`);
          }
        }

        validQuestions.push(question);

      } catch (error) {
        console.error(`Document Parsing Service - Question ${index + 1} validation error:`, error.message);
        errors.push(`Question ${index + 1}: ${error.message}`);
      }
    });

    console.log(`Document Parsing Service - Validated ${validQuestions.length}/${questions.length} questions`);

    return {
      validQuestions,
      errors,
      totalGenerated: questions.length,
      totalValid: validQuestions.length
    };
  }

  // Clean up uploaded files after processing
  static async cleanupFile(filePath) {
    try {
      console.log(`Document Parsing Service - Cleaning up file: ${filePath}`);
      await fs.unlink(filePath);
      console.log(`Document Parsing Service - File cleaned up successfully`);
    } catch (error) {
      console.error(`Document Parsing Service - Error cleaning up file:`, error);
      // Don't throw error for cleanup failures
    }
  }
}
```

with:

```js
}
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server/services/documentParsingService.js`
Expected: no output (exits 0)

- [ ] **Step 3: Verify no remaining references to the deleted methods anywhere**

Run: `grep -rn "generateQuestionsFromText\|buildQuestionGenerationPrompt\|generateSampleQuestions\|generateMCQFromSentence\|generateTrueFalseFromSentence\|generateShortAnswerFromSentence\|validateGeneratedQuestions\|cleanupFile" server/`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add server/services/documentParsingService.js
git commit -m "refactor: delete fake non-AI question generator from DocumentParsingService"
```

---

### Task 3: Inject real platform context into the chat system prompt

**Files:**
- Modify: `server/services/aiChatService.js` (imports; `sendMessage`; `processAIRequest`; `buildSystemPrompt`)

**Interfaces:**
- Consumes: `ExamService.getAll(filter, userId)`, `SubjectService.getAllSubjects(filter)`, `QuestionService.getAllQuestions(filter, pagination)` (existing methods, same calls the deleted `/conversation-context` route made).
- Produces: `AIChatService.buildSystemPrompt(agent, fileAttachment, extractedFileText, platformContext)` — signature gains a 4th parameter, `platformContext: {examCount, subjectCount, questionCount} | null`. `processAIRequest`'s signature gains a matching 7th parameter. No other method's signature changes.

- [ ] **Step 1: Add service imports**

Replace:

```js
const AIChat = require('../models/AIChat');
const { AIAgent } = require('../models/AIConfig');
const AIPlatform = require('../models/AIPlatform');
const llmService = require('./llmService');
```

with:

```js
const AIChat = require('../models/AIChat');
const { AIAgent } = require('../models/AIConfig');
const AIPlatform = require('../models/AIPlatform');
const llmService = require('./llmService');
const ExamService = require('./examService');
const SubjectService = require('./subjectService');
const QuestionService = require('./questionService');
```

- [ ] **Step 2: Fetch real platform context in `sendMessage` and pass it through**

Replace:

```js
      // Extract real file content if a supported document was attached
      const extractedFileText = fileAttachment ? await this.extractFileText(fileAttachment) : null;

      // Process AI request using configured platform
      const aiResponse = await this.processAIRequest(message, platform, agent, fileAttachment, history, extractedFileText);
```

with:

```js
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
```

- [ ] **Step 3: Thread `platformContext` through `processAIRequest`**

Replace:

```js
  static async processAIRequest(message, platform, agent, fileAttachment, history, extractedFileText) {
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
      const systemPrompt = this.buildSystemPrompt(agent, fileAttachment, extractedFileText);
```

with:

```js
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
```

- [ ] **Step 4: Use `platformContext` in `buildSystemPrompt`**

Replace:

```js
  // Build system prompt using agent configuration
  static buildSystemPrompt(agent, fileAttachment, extractedFileText) {
    let systemPrompt = agent.systemPrompt || `You are ${agent.name}, ${agent.description}`;

    // Add ExamMaster context
    systemPrompt += `\n\nYou are working within ExamMaster, a comprehensive Computer-Based Examination (CBE) platform. The system includes:
- Exam creation and management
- Question banks with multiple question types (MCQ, True/False, Short Answer)
- Student management and group organization
- Automated grading and manual review for subjective questions
- Real-time monitoring and proctoring features
- Performance analytics and reporting
- AI-powered assistance for various tasks

Your capabilities include: ${agent.capabilities.join(', ')}.`;

    // Add file attachment context if present
```

with:

```js
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
```

- [ ] **Step 5: Verify syntax**

Run: `node --check server/services/aiChatService.js`
Expected: no output (exits 0)

- [ ] **Step 6: Commit**

```bash
git add server/services/aiChatService.js
git commit -m "feat: inject real exam/subject/question counts into the exam-assistant system prompt"
```

---

### Task 4: Delete dead exports from `client/src/api/aiChat.ts`

**Files:**
- Modify: `client/src/api/aiChat.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `createQuestionsWithAI(data: {questions: any[]})` — signature narrows (drops `examId`), consumed unchanged by `AIChatQuestionAssignment.tsx` (which never passed `examId` in the first place, confirmed in Part 1's investigation).

- [ ] **Step 1: Delete `getAIModels`**

Replace:

```ts
// Description: Get available AI models
// Endpoint: GET /api/ai-chat/models
// Request: {}
// Response: { models: Array<{ _id: string, name: string, description: string, isActive: boolean }> }
export const getAIModels = async () => {
  try {
    const response = await api.get('/api/ai-chat/models');
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get available AI agents
```

with:

```ts
// Description: Get available AI agents
```

- [ ] **Step 2: Delete `uploadChatFile`, `generateQuestions`, `createExamWithAI`, and `createSubjectWithAI`**

Replace:

```ts
// Description: Upload file for AI chat context
// Endpoint: POST /api/ai-chat/upload
// Request: { file: File, description?: string }
// Response: { fileId: string, fileName: string, fileUrl: string }
export const uploadChatFile = async (data: { file: File; description?: string }) => {
  try {
    const formData = new FormData();
    formData.append('file', data.file);
    if (data.description) {
      formData.append('description', data.description);
    }
    const response = await api.post('/api/ai-chat/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Generate questions from document or text using AI
// Endpoint: POST /api/ai-chat/generate-questions
// Request: { document?: File, text?: string, questionCount?: number, difficulty?: string, questionTypes?: string, subject?: string }
// Response: { questions: Array<Question>, validationResults: { validQuestions: number, totalGenerated: number, errors: Array<string> }, sourceTextLength: number }
export const generateQuestions = async (data: { document?: File; text?: string; questionCount?: number; difficulty?: string; questionTypes?: string; subject?: string }) => {
  try {
    const formData = new FormData();
    if (data.document) {
      formData.append('document', data.document);
    }
    if (data.text) {
      formData.append('text', data.text);
    }
    if (data.questionCount) {
      formData.append('questionCount', data.questionCount.toString());
    }
    if (data.difficulty) {
      formData.append('difficulty', data.difficulty);
    }
    if (data.questionTypes) {
      formData.append('questionTypes', data.questionTypes);
    }
    if (data.subject) {
      formData.append('subject', data.subject);
    }

    const response = await api.post('/api/ai-chat/generate-questions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  } catch (error) {
    console.error(error);

    // Handle HTML error responses (like 413 Request Entity Too Large)
    if (error?.response?.status === 413) {
      throw new Error('File too large. Please select a file smaller than 20MB.');
    }

    // Try to parse error message from different response formats
    let errorMessage = 'Failed to generate questions';

    if (error?.response?.data) {
      if (typeof error.response.data === 'string' && error.response.data.includes('413 Request Entity Too Large')) {
        errorMessage = 'File too large. Please select a file smaller than 20MB.';
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
      } else if (error.response.data.message) {
        errorMessage = error.response.data.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

// Description: Create exam through AI assistant
// Endpoint: POST /api/ai-chat/create-exam
// Request: { title: string, subject: string, duration: number, startDate: Date, endDate: Date, totalMarks: number, passingMarks: number, instructions?: string, questions?: Array<string> }
// Response: { exam: Exam, message: string }
export const createExamWithAI = async (data: { title: string; subject: string; duration: number; startDate: Date; endDate: Date; totalMarks: number; passingMarks: number; instructions?: string; questions?: string[] }) => {
  try {
    const response = await api.post('/api/ai-chat/create-exam', data);
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create subject through AI assistant
// Endpoint: POST /api/ai-chat/create-subject
// Request: { name: string, code: string, description?: string, isActive?: boolean }
// Response: { subject: Subject, message: string }
export const createSubjectWithAI = async (data: { name: string; code: string; description?: string; isActive?: boolean }) => {
  try {
    const response = await api.post('/api/ai-chat/create-subject', data);
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create questions through AI assistant
// Endpoint: POST /api/ai-chat/create-questions
// Request: { questions: Array<Question>, examId?: string }
// Response: { questions: Array<Question>, exam?: Exam, createdCount: number, errors: Array<string>, message: string }
export const createQuestionsWithAI = async (data: { questions: any[]; examId?: string }) => {
```

with:

```ts
// Description: Create questions through AI assistant
// Endpoint: POST /api/ai-chat/create-questions
// Request: { questions: Array<Question> }
// Response: { questions: Array<Question>, createdCount: number, errors: Array<string>, message: string }
export const createQuestionsWithAI = async (data: { questions: any[] }) => {
```

- [ ] **Step 3: Delete `getConversationContext` and `generateSampleQuestions`**

Replace:

```ts
// Description: Get conversation context and available options
// Endpoint: GET /api/ai-chat/conversation-context
// Request: { agentId?: string }
// Response: { exams: Array<Exam>, subjects: Array<Subject>, questions: Array<Question>, suggestions: Array<string>, counts: { totalExams: number, totalSubjects: number, totalQuestions: number } }
export const getConversationContext = async (agentId?: string) => {
  try {
    const response = await api.get('/api/ai-chat/conversation-context', {
      params: agentId ? { agentId } : {}
    });
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Generate sample questions for a topic using built-in knowledge
// Endpoint: POST /api/ai-chat/generate-sample-questions
// Request: { topic: string, questionCount?: number, difficulty?: string, questionTypes?: Array<string> }
// Response: { questions: Array<Question>, message: string, topic: string, validationResults: { validQuestions: number, totalGenerated: number, errors: Array<string> } }
export const generateSampleQuestions = async (data: { topic: string; questionCount?: number; difficulty?: string; questionTypes?: string[] }) => {
  try {
    const response = await api.post('/api/ai-chat/generate-sample-questions', data);
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
```

with: (nothing — delete the block entirely)

- [ ] **Step 4: Verify**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `101` (unchanged baseline)

- [ ] **Step 5: Verify no remaining references anywhere in the client**

Run: `grep -rn "getAIModels\|uploadChatFile\|generateQuestions\b\|createExamWithAI\|createSubjectWithAI\|getConversationContext\|generateSampleQuestions" client/src/`
Expected: no output

- [ ] **Step 6: Commit**

```bash
git add client/src/api/aiChat.ts
git commit -m "refactor: delete dead AI Chat client API exports"
```

---

### Task 5: Manual verification

No automated test framework exists in this repo — this task is a manual walkthrough.

**Files:** none (verification only)

- [ ] **Step 1: Start both servers**

Backend (`server/`): `npm run dev`
Client (`client/`): `npm run dev` — confirm it serves at `http://127.0.0.1:5173`

- [ ] **Step 2: Confirm the live AI Chat flows still work**

As admin, in AI Chat: send a message and confirm a response comes back; confirm chat history loads on page reload; confirm the "Save Questions" flow (generate questions via the AI, then click "Save Questions" through `AIChatQuestionAssignment`) still successfully creates and assigns questions to an exam — this exercises `createQuestionsWithAI` and the simplified `/create-questions` route end-to-end.

- [ ] **Step 3: Confirm deleted routes are actually gone**

Using an admin JWT (`curl -X POST http://localhost:3000/api/auth/login ...` as done in prior parts), confirm each of these now 404s: `GET /api/ai-chat/models`, `POST /api/ai-chat/upload`, `POST /api/ai-chat/generate-questions`, `POST /api/ai-chat/create-exam`, `POST /api/ai-chat/create-subject`, `POST /api/ai-chat/generate-sample-questions`, `GET /api/ai-chat/conversation-context`.

- [ ] **Step 4: Confirm the exam-assistant system prompt now includes real counts**

Send a message as the `exam-assistant` agent and check the backend log line `AI Chat Service - Platform context: N exams, M subjects, K questions` — confirm the numbers match what's actually in the dev DB (cross-check via the Reports page or Exam Management list). If the configured platform is fast enough to inspect the actual model response, ask something like "How many exams do I currently have?" and confirm the real number comes back rather than a generic non-answer.

- [ ] **Step 5: Report results**

Summarize pass/fail for each step above before moving to `finishing-a-development-branch`.
