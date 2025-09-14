const express = require('express');
const ExamAttemptService = require('../services/examAttemptService.js');
const { requireUser } = require('./middleware/auth.js');

const router = express.Router();

// Start exam attempt
router.post('/start', requireUser, async (req, res) => {
  try {
    const { examId } = req.body;
    console.log(`Starting exam attempt for exam: ${examId} by user: ${req.user.email}`);

    if (!examId) {
      return res.status(400).json({
        success: false,
        error: 'Exam ID is required'
      });
    }

    const result = await ExamAttemptService.startAttempt(examId, req.user._id);

    console.log(`Exam attempt started successfully for user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      attemptId: result.attemptId,
      questions: result.questions
    });
  } catch (error) {
    console.error(`Error starting exam attempt for user ${req.user.email}:`, error.message);

    if (error.message === 'Exam not found' || error.message === 'Invalid exam ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not active') || error.message.includes('not available')) {
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

// Save answer
router.post('/save-answer', requireUser, async (req, res) => {
  try {
    const { attemptId, questionId, answer } = req.body;
    console.log(`Saving answer for attempt: ${attemptId} by user: ${req.user.email}`);

    if (!attemptId || !questionId || answer === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Attempt ID, question ID, and answer are required'
      });
    }

    const result = await ExamAttemptService.saveAnswer(attemptId, questionId, answer, req.user._id);

    return res.status(200).json(result);
  } catch (error) {
    console.error(`Error saving answer for user ${req.user.email}:`, error.message);

    if (error.message === 'Exam attempt not found' || error.message === 'Invalid attempt ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized') || error.message.includes('completed')) {
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

// Submit exam attempt
router.post('/submit', requireUser, async (req, res) => {
  try {
    const { attemptId } = req.body;
    console.log(`Submitting exam attempt: ${attemptId} by user: ${req.user.email}`);

    if (!attemptId) {
      return res.status(400).json({
        success: false,
        error: 'Attempt ID is required'
      });
    }

    const result = await ExamAttemptService.submitAttempt(attemptId, req.user._id);

    console.log(`Exam attempt submitted successfully for user: ${req.user.email}`);
    return res.status(200).json(result);
  } catch (error) {
    console.error(`Error submitting exam attempt for user ${req.user.email}:`, error.message);

    if (error.message === 'Exam attempt not found' || error.message === 'Invalid attempt ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized') || error.message.includes('already completed')) {
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

// Get student exam attempts
router.get('/student', requireUser, async (req, res) => {
  try {
    console.log(`Getting exam attempts for user: ${req.user.email}`);

    const attempts = await ExamAttemptService.getStudentAttempts(req.user._id);

    console.log(`Found ${attempts.length} exam attempts for user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      attempts: attempts
    });
  } catch (error) {
    console.error(`Error getting exam attempts for user ${req.user.email}:`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Log activity
router.post('/log-activity', requireUser, async (req, res) => {
  try {
    const { attemptId, activity } = req.body;
    console.log(`Logging activity for attempt: ${attemptId} by user: ${req.user.email}`);

    if (!attemptId || !activity) {
      return res.status(400).json({
        success: false,
        error: 'Attempt ID and activity are required'
      });
    }

    const result = await ExamAttemptService.logActivity(attemptId, activity, req.user._id);

    return res.status(200).json(result);
  } catch (error) {
    console.error(`Error logging activity for user ${req.user.email}:`, error.message);

    if (error.message === 'Exam attempt not found' || error.message === 'Invalid attempt ID format') {
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

module.exports = router;