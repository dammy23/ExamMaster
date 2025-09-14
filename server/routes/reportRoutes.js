const express = require('express');
const { requireUser } = require('./middleware/auth.js');
const ExamAttempt = require('../models/ExamAttempt.js');
const Exam = require('../models/Exam.js');
const User = require('../models/User.js');
const mongoose = require('mongoose');

const router = express.Router();

// Get exam reports
router.get('/exams', requireUser, async (req, res) => {
  try {
    console.log(`Getting exam reports for user: ${req.user.email}, role: ${req.user.role}`);

    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view exam reports'
      });
    }

    // Get all exams created by this admin
    const exams = await Exam.find({ createdBy: req.user._id })
      .populate('subject', 'name')
      .sort({ createdAt: -1 });

    // Calculate reports for each exam
    const reports = await Promise.all(exams.map(async (exam) => {
      const attempts = await ExamAttempt.find({ examId: exam._id, status: 'completed' });
      const totalStudents = await ExamAttempt.distinct('studentId', { examId: exam._id }).then(students => students.length);
      
      const completedAttempts = attempts.length;
      const scores = attempts.filter(a => a.score !== undefined).map(a => a.score);
      
      const averageScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
      const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
      const lowestScore = scores.length > 0 ? Math.min(...scores) : 0;
      const passedStudents = attempts.filter(a => a.score >= exam.passingMarks).length;
      const passRate = completedAttempts > 0 ? (passedStudents / completedAttempts) * 100 : 0;
      
      const totalTimeSpent = attempts.reduce((sum, attempt) => sum + (attempt.timeSpent || 0), 0);
      const averageTimeSpent = completedAttempts > 0 ? Math.round(totalTimeSpent / completedAttempts) : 0;

      return {
        examId: exam._id.toString(),
        examTitle: exam.title,
        totalStudents,
        completedAttempts,
        averageScore: Math.round(averageScore * 100) / 100,
        passRate: Math.round(passRate * 100) / 100,
        highestScore,
        lowestScore,
        averageTimeSpent
      };
    }));

    console.log(`Found ${reports.length} exam reports for user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      reports
    });
  } catch (error) {
    console.error(`Error getting exam reports for user ${req.user.email}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get student performance reports
router.get('/students', requireUser, async (req, res) => {
  try {
    console.log(`Getting student performance reports for user: ${req.user.email}, role: ${req.user.role}`);

    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view student reports'
      });
    }

    // Get all exams created by this admin
    const exams = await Exam.find({ createdBy: req.user._id });
    const examIds = exams.map(exam => exam._id);

    // Get all attempts for these exams
    const attempts = await ExamAttempt.find({ 
      examId: { $in: examIds },
      status: 'completed'
    }).populate('studentId', 'name email');

    // Group attempts by student
    const studentPerformanceMap = new Map();

    attempts.forEach(attempt => {
      if (!attempt.studentId) return;

      const studentId = attempt.studentId._id.toString();
      if (!studentPerformanceMap.has(studentId)) {
        studentPerformanceMap.set(studentId, {
          studentId,
          studentName: attempt.studentId.name,
          totalExams: 0,
          scores: [],
          totalTimeSpent: 0
        });
      }

      const studentData = studentPerformanceMap.get(studentId);
      studentData.totalExams += 1;
      if (attempt.score !== undefined) {
        studentData.scores.push(attempt.score);
      }
      studentData.totalTimeSpent += attempt.timeSpent || 0;
    });

    // Calculate performance metrics
    const performances = Array.from(studentPerformanceMap.values()).map(student => {
      const averageScore = student.scores.length > 0 
        ? student.scores.reduce((sum, score) => sum + score, 0) / student.scores.length 
        : 0;
      
      const bestScore = student.scores.length > 0 ? Math.max(...student.scores) : 0;
      const worstScore = student.scores.length > 0 ? Math.min(...student.scores) : 0;

      return {
        studentId: student.studentId,
        studentName: student.studentName,
        totalExams: student.totalExams,
        averageScore: Math.round(averageScore * 100) / 100,
        bestScore,
        worstScore,
        totalTimeSpent: student.totalTimeSpent,
        strengths: [], // TODO: Implement based on subject performance
        weaknesses: [] // TODO: Implement based on subject performance
      };
    });

    console.log(`Found ${performances.length} student performance reports for user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      performances
    });
  } catch (error) {
    console.error(`Error getting student performance reports for user ${req.user.email}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get question analysis
router.get('/questions', requireUser, async (req, res) => {
  try {
    const { examId } = req.query;
    console.log(`Getting question analysis for user: ${req.user.email}, examId: ${examId || 'all'}`);

    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view question analysis'
      });
    }

    // For now, return mock data since we're using mock questions in attempts
    const analysis = [
      {
        questionId: '1',
        question: 'What is the derivative of x²?',
        totalAttempts: 15,
        correctAnswers: 12,
        incorrectAnswers: 3,
        difficultyRating: 2.1,
        averageTimeSpent: 45
      },
      {
        questionId: '2',
        question: 'The speed of light is approximately 3 × 10⁸ m/s.',
        totalAttempts: 15,
        correctAnswers: 14,
        incorrectAnswers: 1,
        difficultyRating: 1.2,
        averageTimeSpent: 25
      },
      {
        questionId: '3',
        question: 'Explain the concept of photosynthesis in plants.',
        totalAttempts: 15,
        correctAnswers: 8,
        incorrectAnswers: 7,
        difficultyRating: 3.5,
        averageTimeSpent: 180
      }
    ];

    console.log(`Returning question analysis for user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error(`Error getting question analysis for user ${req.user.email}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export report
router.post('/export', requireUser, async (req, res) => {
  try {
    const { type, examId, format } = req.body;
    console.log(`Exporting report for user: ${req.user.email}, type: ${type}, format: ${format}`);

    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can export reports'
      });
    }

    // Mock export functionality
    const downloadUrl = `/api/downloads/report-${Date.now()}.${format}`;

    console.log(`Report export initiated for user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      downloadUrl
    });
  } catch (error) {
    console.error(`Error exporting report for user ${req.user.email}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;