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
router.post('/', requireUser, async (req, res) => {
  try {
    console.log(`Creating new exam for user: ${req.user.email}`);

    // Only admin users can create exams
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can create exams'
      });
    }

    const examData = req.body;
    const exam = await ExamService.create(examData, req.user._id);

    console.log(`Exam created successfully: ${exam.title} by user: ${req.user.email}`);
    return res.status(201).json({
      success: true,
      exam: exam
    });
  } catch (error) {
    console.error(`Error creating exam for user ${req.user.email}:`, error.message);

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

module.exports = router;