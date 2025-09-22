const express = require('express');
const ExamAttemptService = require('../services/examAttemptService.js');
const AIGradingService = require('../services/aiGradingService.js');
const { requireUser } = require('./middleware/auth.js');
const { videoUpload, generateSecureVideoUrl, validateVideoAccessToken, getVideoFileInfo } = require('../utils/videoHandler.js');
const path = require('path');
const fs = require('fs').promises;

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
      questions: result.questions,
      videoRecording: result.videoRecording,
      attemptNumber: result.attemptNumber,
      maxAttempts: result.maxAttempts
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

// Start video recording
router.post('/video/start', requireUser, async (req, res) => {
  try {
    const { attemptId } = req.body;
    console.log(`Starting video recording for attempt: ${attemptId} by user: ${req.user.email}`);

    if (!attemptId) {
      return res.status(400).json({
        success: false,
        error: 'Attempt ID is required'
      });
    }

    const result = await ExamAttemptService.startVideoRecording(attemptId, req.user._id);

    console.log(`Video recording started successfully for user: ${req.user.email}`);
    return res.status(200).json(result);
  } catch (error) {
    console.error(`Error starting video recording for user ${req.user.email}:`, error.message);

    if (error.message === 'Exam attempt not found' || error.message === 'Invalid attempt ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized') || error.message.includes('not enabled')) {
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

// Upload video recording
router.post('/video/upload', requireUser, videoUpload.single('video'), async (req, res) => {
  try {
    const { attemptId } = req.body;
    console.log(`Uploading video for attempt: ${attemptId} by user: ${req.user.email}`);

    if (!attemptId) {
      return res.status(400).json({
        success: false,
        error: 'Attempt ID is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Video file is required'
      });
    }

    // Generate secure video URL
    const videoUrl = generateSecureVideoUrl(req.file.filename, attemptId, req.user._id.toString());

    // Update the exam attempt with video details
    const result = await ExamAttemptService.updateVideoRecording(
      attemptId, 
      videoUrl, 
      req.file.size, 
      req.user._id
    );

    console.log(`Video uploaded successfully for user: ${req.user.email}, file: ${req.file.filename}`);
    return res.status(200).json({
      ...result,
      videoUrl: videoUrl
    });
  } catch (error) {
    console.error(`Error uploading video for user ${req.user.email}:`, error.message);

    // Clean up uploaded file if there was an error
    if (req.file) {
      try {
        const filePath = req.file.path;
        await fs.unlink(filePath);
        console.log('Cleaned up uploaded file after error:', filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError.message);
      }
    }

    if (error.message === 'Exam attempt not found' || error.message === 'Invalid attempt ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized') || error.message.includes('not enabled')) {
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

// Serve video files (with access control)
router.get('/video/:examId/:studentId/:filename', async (req, res) => {
  try {
    const { examId, studentId, filename } = req.params;
    const { token, t: timestamp } = req.query;
    
    console.log(`Video access request: exam=${examId}, student=${studentId}, file=${filename}`);

    // Validate access token
    if (!validateVideoAccessToken(token, filename, examId, studentId, timestamp)) {
      console.log('Video access denied - invalid token');
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Get video file info
    const videoInfo = await getVideoFileInfo(filename);
    if (!videoInfo.exists) {
      console.log('Video file not found:', filename);
      return res.status(404).json({
        success: false,
        error: 'Video not found'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', videoInfo.size);
    res.setHeader('Accept-Ranges', 'bytes');

    // Stream the video file
    const videoStream = require('fs').createReadStream(videoInfo.path);
    videoStream.pipe(res);

    console.log('Video file served successfully:', filename);
  } catch (error) {
    console.error('Error serving video file:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to serve video file'
    });
  }
});

// Get exam attempts for admin review (with video details)
router.get('/admin/exam/:examId/attempts', requireUser, async (req, res) => {
  try {
    const { examId } = req.params;
    console.log(`Getting exam attempts for admin review: exam=${examId} by user: ${req.user.email}`);

    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view exam attempts'
      });
    }

    const attempts = await ExamAttemptService.getExamAttempts(examId, req.user._id);

    console.log(`Found ${attempts.length} attempts for exam: ${examId}`);
    return res.status(200).json({
      success: true,
      attempts: attempts
    });
  } catch (error) {
    console.error(`Error getting exam attempts for admin ${req.user.email}:`, error.message);

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

// Get specific attempt for admin review
router.get('/admin/attempt/:attemptId', requireUser, async (req, res) => {
  try {
    const { attemptId } = req.params;
    console.log(`Getting attempt for admin review: attempt=${attemptId} by user: ${req.user.email}`);

    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can review exam attempts'
      });
    }

    const attempt = await ExamAttemptService.getAttemptForReview(attemptId, req.user._id);

    console.log(`Attempt retrieved for admin review: ${attemptId}`);
    return res.status(200).json({
      success: true,
      attempt: attempt
    });
  } catch (error) {
    console.error(`Error getting attempt for admin ${req.user.email}:`, error.message);

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

// Get recent results for student dashboard
router.get('/student/recent-results', requireUser, async (req, res) => {
  try {
    console.log(`Getting recent results for student: ${req.user.email}`);
    
    // Only allow students to access this endpoint
    if (req.user.role === 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only students can access recent results'
      });
    }

    const recentResults = await ExamAttemptService.getStudentRecentResults(req.user._id);

    console.log(`Found ${recentResults.length} recent results for student: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      recentResults: recentResults
    });
  } catch (error) {
    console.error(`Error getting recent results for student ${req.user.email}:`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get recent activity for admin dashboard  
router.get('/admin/recent-activity', requireUser, async (req, res) => {
  try {
    console.log(`Getting recent activity for admin: ${req.user.email}`);
    
    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view recent activity'
      });
    }

    const recentActivity = await ExamAttemptService.getAdminRecentActivity(req.user._id);

    console.log(`Found ${recentActivity.length} recent activities for admin: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      recentActivity: recentActivity
    });
  } catch (error) {
    console.error(`Error getting recent activity for admin ${req.user.email}:`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Description: Grade theory questions for a specific exam attempt using AI
// Endpoint: POST /api/exam-attempts/grade-theory/:attemptId
// Request: { }
// Response: { success: boolean, aiGradingResults: Object, totalScore: number, updatedPercentage: number }
router.post('/grade-theory/:attemptId', requireUser, async (req, res) => {
  try {
    const { attemptId } = req.params;
    console.log(`Manually triggering AI grading for attempt: ${attemptId} by user: ${req.user.email}`);

    // Only allow admin users to manually trigger AI grading
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can manually trigger AI grading'
      });
    }

    if (!attemptId) {
      return res.status(400).json({
        success: false,
        error: 'Attempt ID is required'
      });
    }

    // Check if AI grading is available
    const aiAvailable = await AIGradingService.isAIGradingAvailable();
    if (!aiAvailable) {
      return res.status(503).json({
        success: false,
        error: 'AI grading service is not available. Please configure an AI platform in settings.'
      });
    }

    const result = await ExamAttemptService.gradeTheoryQuestionsForAttempt(attemptId, req.user._id);

    console.log(`AI grading completed for attempt: ${attemptId}`);
    return res.status(200).json(result);
  } catch (error) {
    console.error(`Error grading theory questions for attempt ${req.params.attemptId}:`, error.message);

    if (error.message === 'Exam attempt not found' || error.message === 'Invalid attempt ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized') || error.message.includes('No theory questions')) {
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