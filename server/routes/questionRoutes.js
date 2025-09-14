const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const router = express.Router();
const questionService = require('../services/questionService');
const { requireUser } = require('./middleware/auth');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/tmp/'); // Use /tmp for temporary file storage
  },
  filename: function (req, file, cb) {
    cb(null, `questions-upload-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit for questions
  }
});

// Get all questions with filtering and pagination
router.get('/', requireUser, async (req, res) => {
  try {
    console.log('GET /api/questions - User:', req.user?.email);
    
    const { page, limit, difficulty, search } = req.query;
    
    const result = await questionService.getAllQuestions(
      { difficulty, search },
      { page, limit }
    );
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('GET /api/questions error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single question by ID
router.get('/:id', requireUser, async (req, res) => {
  try {
    console.log('GET /api/questions/:id - Question ID:', req.params.id);
    
    const question = await questionService.getQuestionById(req.params.id);
    
    res.json({
      success: true,
      data: { question }
    });
  } catch (error) {
    console.error('GET /api/questions/:id error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

// Create new question
router.post('/', requireUser, async (req, res) => {
  try {
    console.log('POST /api/questions - User:', req.user?.email);
    
    const questionData = req.body;
    
    // Validate required fields
    if (!questionData.question || !questionData.type || !questionData.difficulty || !questionData.marks) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: question, type, difficulty, marks'
      });
    }
    
    const question = await questionService.createQuestion(questionData, req.user._id);
    
    res.status(201).json({
      success: true,
      data: { question }
    });
  } catch (error) {
    console.error('POST /api/questions error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update question
router.put('/:id', requireUser, async (req, res) => {
  try {
    console.log('PUT /api/questions/:id - Question ID:', req.params.id);
    
    const question = await questionService.updateQuestion(
      req.params.id,
      req.body,
      req.user._id
    );
    
    res.json({
      success: true,
      data: { question }
    });
  } catch (error) {
    console.error('PUT /api/questions/:id error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                      error.message.includes('Unauthorized') ? 403 : 400;
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

// Delete question
router.delete('/:id', requireUser, async (req, res) => {
  try {
    console.log('DELETE /api/questions/:id - Question ID:', req.params.id);
    
    const result = await questionService.deleteQuestion(req.params.id, req.user._id);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('DELETE /api/questions/:id error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 
                      error.message.includes('Unauthorized') ? 403 : 500;
    res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk upload questions from CSV file
router.post('/bulk-upload', requireUser, upload.single('file'), async (req, res) => {
  try {
    console.log('POST /api/questions/bulk-upload - User:', req.user?.email);
    
    // Handle both file upload and direct JSON data
    if (req.file) {
      // File upload handling
      console.log('Processing CSV file:', req.file.originalname);
      
      const questions = [];
      const filePath = req.file.path;
      
      // Parse CSV file
      const parseCSV = () => {
        return new Promise((resolve, reject) => {
          fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => {
              // Normalize column names
              const normalizedData = {};
              Object.keys(data).forEach(key => {
                const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
                normalizedData[normalizedKey] = data[key] ? data[key].trim() : '';
              });
              
              // Map CSV columns to question fields
              const questionData = {
                type: normalizedData.type || normalizedData.questiontype,
                question: normalizedData.question || normalizedData.questiontext,
                difficulty: normalizedData.difficulty || 'easy',
                marks: parseInt(normalizedData.marks || normalizedData.points || 1),
                explanation: normalizedData.explanation || normalizedData.hint || ''
              };

              // Handle options and correct answers based on question type
              if (questionData.type === 'multiple-choice') {
                questionData.options = [];
                const optionFields = ['option1', 'option2', 'option3', 'option4', 'option5', 'option6'];
                optionFields.forEach(field => {
                  if (normalizedData[field] && normalizedData[field].trim()) {
                    questionData.options.push(normalizedData[field].trim());
                  }
                });
                
                // Get correct answers
                const correctAnswers = normalizedData.correctanswers || normalizedData.correctanswer || '';
                if (correctAnswers) {
                  questionData.correctAnswers = correctAnswers.split(',').map(ans => ans.trim());
                } else {
                  // Fallback: check for correct option numbers
                  const correctOptions = normalizedData.correctoptions || normalizedData.correctoption || '';
                  if (correctOptions) {
                    const optionNumbers = correctOptions.split(',').map(num => parseInt(num.trim()) - 1);
                    questionData.correctAnswers = optionNumbers.map(index => questionData.options[index]).filter(Boolean);
                  }
                }
              } else if (questionData.type === 'true-false') {
                questionData.options = ['True', 'False'];
                const correctAnswer = normalizedData.correctanswer || normalizedData.correctanswers || '';
                questionData.correctAnswers = [correctAnswer.toLowerCase() === 'true' ? 'True' : 'False'];
              } else if (questionData.type === 'short-answer') {
                const correctAnswers = normalizedData.correctanswers || normalizedData.correctanswer || '';
                questionData.correctAnswers = correctAnswers ? correctAnswers.split(',').map(ans => ans.trim()) : [];
              }

              // Only add if we have required fields
              if (questionData.question && questionData.type) {
                questions.push(questionData);
              }
            })
            .on('end', () => {
              console.log(`Parsed ${questions.length} questions from CSV`);
              resolve();
            })
            .on('error', (error) => {
              console.error('Error parsing CSV:', error);
              reject(error);
            });
        });
      };

      await parseCSV();
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      
      if (questions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid question data found in CSV file'
        });
      }
      
      const result = await questionService.bulkCreateQuestions(questions, req.user._id);
      
      res.status(201).json({
        success: true,
        data: result
      });
      
    } else {
      // Direct JSON data handling (backward compatibility)
      const { questions } = req.body;
      
      if (!questions || !Array.isArray(questions)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request: questions array is required or upload a CSV file'
        });
      }
      
      const result = await questionService.bulkCreateQuestions(questions, req.user._id);
      
      res.status(201).json({
        success: true,
        data: result
      });
    }
    
  } catch (error) {
    console.error('POST /api/questions/bulk-upload error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;