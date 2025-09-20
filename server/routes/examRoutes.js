const express = require('express');
const ExamService = require('../services/examService.js');
const { requireUser } = require('./middleware/auth.js');

const router = express.Router();

// Get all exams
router.get('/', requireUser, async (req, res) => {
  try {
    console.log(`Getting all exams for user: ${req.user.email}, role: ${req.user.role}`);

    const filters = {};
    if (req.query.status) {
      filters.status = req.query.status;
    }
    if (req.query.subject) {
      filters.subject = req.query.subject;
    }

    // For admin users, only show exams created by them
    // For students, show all exams (they should see available exams regardless of who created them)
    const userId = req.user.role === 'admin' ? req.user._id : null;

    const exams = await ExamService.getAll(filters, userId);

    console.log(`Found ${exams.length} exams for user: ${req.user.email}`);
    console.log('Exams details:', exams.map(exam => ({ 
      id: exam._id, 
      title: exam.title, 
      status: exam.status, 
      startDate: exam.startDate, 
      endDate: exam.endDate 
    })));
    
    return res.status(200).json({
      success: true,
      exams: exams
    });
  } catch (error) {
    console.error(`Error getting exams for user ${req.user.email}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get exam by ID
router.get('/:id', requireUser, async (req, res) => {
  try {
    const examId = req.params.id;
    console.log(`Getting exam ${examId} for user: ${req.user.email}`);

    const exam = await ExamService.getById(examId);

    // Check if user has access to this exam
    if (req.user.role === 'admin' && exam.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view this exam'
      });
    }
    
    // For students, they can view exams that are active and within the time window
    // Additional access control can be added here for assigned students/groups if needed

    console.log(`Found exam: ${exam.title} for user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      exam: exam
    });
  } catch (error) {
    console.error(`Error getting exam ${req.params.id} for user ${req.user.email}:`, error.message);

    if (error.message === 'Exam not found' || error.message === 'Invalid exam ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new exam
// Description: Create a new exam
// Endpoint: POST /api/exams
// Request: { exam data including description and instructions with potential base64 images }
// Response: { success: boolean, exam: Exam }
router.post('/', requireUser, async (req, res) => {
  try {
    console.log(`POST /api/exams - Creating new exam for user: ${req.user.email}`);
    console.log(`Request body size: ${JSON.stringify(req.body).length} characters`);

    // Only admin users can create exams
    if (req.user.role !== 'admin') {
      console.log(`Access denied - User ${req.user.email} is not admin`);
      return res.status(403).json({
        success: false,
        error: 'Only admin users can create exams'
      });
    }

    const examData = req.body;
    console.log(`Exam data received: title="${examData.title}", duration=${examData.duration}`);

    if (examData.description && examData.description.length > 1000) {
      console.log(`Description contains ${examData.description.length} characters (likely has base64 images)`);
    }
    if (examData.instructions && examData.instructions.length > 1000) {
      console.log(`Instructions contains ${examData.instructions.length} characters (likely has base64 images)`);
    }

    const exam = await ExamService.create(examData, req.user._id);

    console.log(`Exam created successfully: ${exam.title} (ID: ${exam._id}) by user: ${req.user.email}`);
    return res.status(201).json({
      success: true,
      exam: exam
    });
  } catch (error) {
    console.error(`Error creating exam for user ${req.user.email}:`, error);
    console.error(`Error stack:`, error.stack);

    if (error.message.includes('required') || error.message.includes('validation') ||
        error.message.includes('exceed') || error.message.includes('must be')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update exam
router.put('/:id', requireUser, async (req, res) => {
  try {
    const examId = req.params.id;
    console.log(`Updating exam ${examId} for user: ${req.user.email}`);

    // Only admin users can update exams
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can update exams'
      });
    }

    const examData = req.body;
    const exam = await ExamService.update(examId, examData, req.user._id);

    console.log(`Exam updated successfully: ${exam.title} by user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      exam: exam
    });
  } catch (error) {
    console.error(`Error updating exam ${req.params.id} for user ${req.user.email}:`, error.message);

    if (error.message === 'Exam not found' || error.message === 'Invalid exam ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message === 'You are not authorized to update this exam') {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('required') || error.message.includes('validation') ||
        error.message.includes('exceed') || error.message.includes('must be')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete exam
router.delete('/:id', requireUser, async (req, res) => {
  try {
    const examId = req.params.id;
    console.log(`Deleting exam ${examId} for user: ${req.user.email}`);

    // Only admin users can delete exams
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can delete exams'
      });
    }

    const result = await ExamService.delete(examId, req.user._id);

    console.log(`Exam deleted successfully by user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error(`Error deleting exam ${req.params.id} for user ${req.user.email}:`, error.message);

    if (error.message === 'Exam not found' || error.message === 'Invalid exam ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message === 'You are not authorized to delete this exam') {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get questions for an exam
router.get('/:id/questions', requireUser, async (req, res) => {
  try {
    const examId = req.params.id;
    console.log(`Getting questions for exam ${examId} by user: ${req.user.email}`);

    const questions = await ExamService.getExamQuestions(examId, req.user._id);

    console.log(`Found ${questions.length} questions for exam ${examId}`);
    return res.status(200).json({
      success: true,
      questions: questions
    });
  } catch (error) {
    console.error(`Error getting questions for exam ${req.params.id} by user ${req.user.email}:`, error.message);

    if (error.message === 'Exam not found' || error.message === 'Invalid exam ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Assign questions to an exam
router.post('/:id/questions', requireUser, async (req, res) => {
  try {
    const examId = req.params.id;
    const { questionIds } = req.body;
    console.log(`Assigning ${questionIds?.length || 0} questions to exam ${examId} by user: ${req.user.email}`);

    // Only admin users can assign questions to exams
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can assign questions to exams'
      });
    }

    if (!questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({
        success: false,
        error: 'Question IDs array is required'
      });
    }

    const result = await ExamService.assignQuestions(examId, questionIds, req.user._id);

    console.log(`Successfully assigned questions to exam ${examId} by user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      message: result.message,
      questionsCount: result.questionsCount
    });
  } catch (error) {
    console.error(`Error assigning questions to exam ${req.params.id} by user ${req.user.email}:`, error.message);

    if (error.message === 'Exam not found' || error.message === 'Invalid exam ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not found') || error.message.includes('invalid')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Remove questions from an exam
router.delete('/:id/questions', requireUser, async (req, res) => {
  try {
    const examId = req.params.id;
    const { questionIds } = req.body;
    console.log(`Removing ${questionIds?.length || 0} questions from exam ${examId} by user: ${req.user.email}`);

    // Only admin users can remove questions from exams
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can remove questions from exams'
      });
    }

    if (!questionIds || !Array.isArray(questionIds)) {
      return res.status(400).json({
        success: false,
        error: 'Question IDs array is required'
      });
    }

    const result = await ExamService.removeQuestions(examId, questionIds, req.user._id);

    console.log(`Successfully removed questions from exam ${examId} by user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      message: result.message,
      questionsCount: result.questionsCount
    });
  } catch (error) {
    console.error(`Error removing questions from exam ${req.params.id} by user ${req.user.email}:`, error.message);

    if (error.message === 'Exam not found' || error.message === 'Invalid exam ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not found') || error.message.includes('invalid')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;