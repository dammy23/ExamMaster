const express = require('express');
const router = express.Router();
const questionService = require('../services/questionService');
const { requireUser } = require('./middleware/auth');

// Get all questions with filtering and pagination
router.get('/', requireUser, async (req, res) => {
  try {
    console.log('GET /api/questions - User:', req.user?.email);
    
    const { page, limit, subject, difficulty, search } = req.query;
    
    const result = await questionService.getAllQuestions(
      { subject, difficulty, search },
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
    if (!questionData.question || !questionData.type || !questionData.subject || !questionData.difficulty || !questionData.marks) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: question, type, subject, difficulty, marks'
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

// Bulk upload questions
router.post('/bulk-upload', requireUser, async (req, res) => {
  try {
    console.log('POST /api/questions/bulk-upload - User:', req.user?.email);
    
    const { questions } = req.body;
    
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request: questions array is required'
      });
    }
    
    const result = await questionService.bulkCreateQuestions(questions, req.user._id);
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('POST /api/questions/bulk-upload error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get questions by subject
router.get('/subject/:subject', requireUser, async (req, res) => {
  try {
    console.log('GET /api/questions/subject/:subject - Subject:', req.params.subject);
    
    const questions = await questionService.getQuestionsBySubject(req.params.subject);
    
    res.json({
      success: true,
      data: { questions }
    });
  } catch (error) {
    console.error('GET /api/questions/subject/:subject error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;