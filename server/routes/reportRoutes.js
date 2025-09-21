const express = require('express');
const { requireUser } = require('./middleware/auth.js');
const ExamAttempt = require('../models/ExamAttempt.js');
const Exam = require('../models/Exam.js');
const User = require('../models/User.js');
const pdfService = require('../services/pdfService.js');
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

// Get individual student scores for a specific exam
router.get('/exam/:examId/students', requireUser, async (req, res) => {
  try {
    const { examId } = req.params;
    console.log(`Getting student scores for exam ${examId} by user: ${req.user.email}`);

    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view student scores'
      });
    }

    // Verify the exam belongs to this admin
    const exam = await Exam.findOne({ _id: examId, createdBy: req.user._id })
      .populate('subject', 'name');

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found or not accessible'
      });
    }

    // Get all attempts for this exam
    const attempts = await ExamAttempt.find({
      examId: examId,
      status: { $in: ['completed', 'submitted'] }
    })
    .populate('studentId', 'name email')
    .sort({ createdAt: -1 });

    // Calculate student scores and performance data
    const studentScores = attempts.map(attempt => ({
      studentId: attempt.studentId._id,
      studentName: attempt.studentId.name,
      studentEmail: attempt.studentId.email,
      score: attempt.score || 0,
      percentage: attempt.percentage || 0,
      timeSpent: attempt.timeSpent || 0,
      startTime: attempt.startTime,
      endTime: attempt.endTime,
      status: attempt.status,
      tabSwitches: attempt.tabSwitches || 0,
      attemptNumber: attempt.attemptNumber || 1,
      isPassed: (attempt.score || 0) >= exam.passingMarks
    }));

    // Calculate exam statistics
    const totalStudents = studentScores.length;
    const passedStudents = studentScores.filter(s => s.isPassed).length;
    const scores = studentScores.map(s => s.score);

    const examStats = {
      totalStudents,
      passedStudents,
      failedStudents: totalStudents - passedStudents,
      passRate: totalStudents > 0 ? (passedStudents / totalStudents) * 100 : 0,
      averageScore: scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
      highestScore: scores.length > 0 ? Math.max(...scores) : 0,
      lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
      averageTimeSpent: studentScores.length > 0 ?
        studentScores.reduce((sum, s) => sum + s.timeSpent, 0) / studentScores.length : 0
    };

    console.log(`Found ${studentScores.length} student scores for exam ${examId}`);
    return res.status(200).json({
      success: true,
      exam: {
        id: exam._id,
        title: exam.title,
        subject: exam.subject.name,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        duration: exam.duration
      },
      statistics: examStats,
      studentScores
    });
  } catch (error) {
    console.error(`Error getting student scores for exam ${req.params.examId}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get performance analysis for a specific exam
router.get('/exam/:examId/analysis', requireUser, async (req, res) => {
  try {
    const { examId } = req.params;
    console.log(`Getting performance analysis for exam ${examId} by user: ${req.user.email}`);

    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view performance analysis'
      });
    }

    // Verify the exam belongs to this admin
    const exam = await Exam.findOne({ _id: examId, createdBy: req.user._id })
      .populate('subject', 'name')
      .populate('questions', 'question type marks');

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: 'Exam not found or not accessible'
      });
    }

    // Get all attempts for this exam
    const attempts = await ExamAttempt.find({
      examId: examId,
      status: { $in: ['completed', 'submitted'] }
    })
    .populate('studentId', 'name email');

    const totalAttempts = attempts.length;
    const scores = attempts.filter(a => a.score !== undefined).map(a => a.score);

    // Score distribution analysis
    const scoreRanges = {
      '90-100': 0,
      '80-89': 0,
      '70-79': 0,
      '60-69': 0,
      '50-59': 0,
      'Below 50': 0
    };

    scores.forEach(score => {
      if (score >= 90) scoreRanges['90-100']++;
      else if (score >= 80) scoreRanges['80-89']++;
      else if (score >= 70) scoreRanges['70-79']++;
      else if (score >= 60) scoreRanges['60-69']++;
      else if (score >= 50) scoreRanges['50-59']++;
      else scoreRanges['Below 50']++;
    });

    // Time analysis
    const timeSpentData = attempts.map(a => a.timeSpent || 0);
    const avgTimeSpent = timeSpentData.length > 0 ?
      timeSpentData.reduce((sum, time) => sum + time, 0) / timeSpentData.length : 0;

    // Question-wise analysis (mock data for now since answers structure varies)
    const questionAnalysis = exam.questions.map((question, index) => {
      const questionAttempts = totalAttempts;
      const correctAnswers = Math.floor(Math.random() * questionAttempts * 0.8) + Math.floor(questionAttempts * 0.2);

      return {
        questionId: question._id,
        questionText: question.question,
        type: question.type,
        marks: question.marks,
        totalAttempts: questionAttempts,
        correctAnswers,
        incorrectAnswers: questionAttempts - correctAnswers,
        successRate: questionAttempts > 0 ? (correctAnswers / questionAttempts) * 100 : 0,
        difficultyRating: 5 - ((correctAnswers / questionAttempts) * 4), // Inverse relationship
        averageTimeSpent: Math.floor(Math.random() * 120) + 30 // Mock time data
      };
    });

    const analysis = {
      examInfo: {
        id: exam._id,
        title: exam.title,
        subject: exam.subject.name,
        totalMarks: exam.totalMarks,
        passingMarks: exam.passingMarks,
        duration: exam.duration,
        totalQuestions: exam.questions.length
      },
      overallStats: {
        totalAttempts,
        averageScore: scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0,
        highestScore: scores.length > 0 ? Math.max(...scores) : 0,
        lowestScore: scores.length > 0 ? Math.min(...scores) : 0,
        passRate: totalAttempts > 0 ? (attempts.filter(a => (a.score || 0) >= exam.passingMarks).length / totalAttempts) * 100 : 0,
        averageTimeSpent: Math.round(avgTimeSpent)
      },
      scoreDistribution: scoreRanges,
      questionAnalysis
    };

    console.log(`Generated performance analysis for exam ${examId}`);
    return res.status(200).json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error(`Error getting performance analysis for exam ${req.params.examId}:`, error.message);
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

    if (format === 'pdf') {
      // Generate PDF report
      let reportData = {};
      let reportType = 'exam';

      if (type === 'exam-overview' || type === 'student-performance' || type === 'question-analysis') {
        // Get data based on type
        if (examId) {
          // Specific exam report
          const exam = await Exam.findOne({ _id: examId, createdBy: req.user._id })
            .populate('subject', 'name');

          if (!exam) {
            return res.status(404).json({
              success: false,
              error: 'Exam not found'
            });
          }

          const attempts = await ExamAttempt.find({
            examId: examId,
            status: { $in: ['completed', 'submitted'] }
          }).populate('studentId', 'name email');

          const scores = attempts.map(a => a.score || 0);
          const passRate = attempts.length > 0 ?
            (attempts.filter(a => (a.score || 0) >= exam.passingMarks).length / attempts.length) * 100 : 0;

          reportData = {
            title: `${exam.title} - Performance Analysis`,
            exam: {
              title: exam.title,
              subject: exam.subject.name,
              totalMarks: exam.totalMarks,
              passingMarks: exam.passingMarks
            },
            summary: {
              totalExams: 1,
              averageScore: scores.length > 0 ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0,
              highestScore: scores.length > 0 ? Math.max(...scores) : 0,
              passRate: Math.round(passRate)
            },
            details: attempts.map(attempt => ({
              studentName: attempt.studentId.name,
              score: attempt.score || 0,
              timeSpent: attempt.timeSpent || 0,
              status: attempt.status,
              submissionDate: attempt.endTime ? attempt.endTime.toLocaleDateString() : 'N/A'
            })),
            scoreDistribution: [
              { range: '90-100', count: scores.filter(s => s >= 90).length },
              { range: '80-89', count: scores.filter(s => s >= 80 && s < 90).length },
              { range: '70-79', count: scores.filter(s => s >= 70 && s < 80).length },
              { range: '60-69', count: scores.filter(s => s >= 60 && s < 70).length },
              { range: '50-59', count: scores.filter(s => s >= 50 && s < 60).length },
              { range: 'Below 50', count: scores.filter(s => s < 50).length }
            ],
            insights: [
              `Total ${attempts.length} students attempted the exam`,
              `Pass rate is ${Math.round(passRate)}%`,
              scores.length > 0 ?
                `Average score is ${Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)}%` :
                'No completed attempts yet',
              passRate >= 80 ? 'Excellent performance overall' :
                passRate >= 60 ? 'Good performance with room for improvement' :
                'Performance needs significant improvement'
            ]
          };
          reportType = 'exam';
        } else {
          // General overview report
          const exams = await Exam.find({ createdBy: req.user._id }).populate('subject', 'name');
          const allAttempts = await ExamAttempt.find({
            examId: { $in: exams.map(e => e._id) },
            status: { $in: ['completed', 'submitted'] }
          }).populate('studentId', 'name');

          const allScores = allAttempts.map(a => a.score || 0);
          const avgScore = allScores.length > 0 ? allScores.reduce((sum, score) => sum + score, 0) / allScores.length : 0;

          reportData = {
            title: 'Overall Performance Analysis',
            summary: {
              totalExams: exams.length,
              averageScore: Math.round(avgScore),
              highestScore: allScores.length > 0 ? Math.max(...allScores) : 0,
              passRate: 0 // Calculate based on individual exam pass rates
            },
            details: exams.map(exam => {
              const examAttempts = allAttempts.filter(a => a.examId.toString() === exam._id.toString());
              const examScores = examAttempts.map(a => a.score || 0);
              return {
                examTitle: exam.title,
                subject: exam.subject.name,
                score: examScores.length > 0 ? Math.round(examScores.reduce((sum, s) => sum + s, 0) / examScores.length) : 0,
                timeSpent: examAttempts.length > 0 ? Math.round(examAttempts.reduce((sum, a) => sum + (a.timeSpent || 0), 0) / examAttempts.length) : 0,
                date: exam.createdAt.toLocaleDateString()
              };
            }),
            insights: [
              `Total ${exams.length} exams created`,
              `${allAttempts.length} total attempts across all exams`,
              `Average performance is ${Math.round(avgScore)}%`
            ]
          };
          reportType = 'exam';
        }

        // Generate PDF
        const pdfBuffer = await pdfService.generatePerformanceReportPDF(reportData, reportType);
        const filename = `report-${type}-${Date.now()}.pdf`;
        const filePath = await pdfService.savePDFToFile(pdfBuffer, filename);

        const downloadUrl = `/api/reports/download/${filename}`;

        console.log(`PDF report generated successfully for user: ${req.user.email}`);
        return res.status(200).json({
          success: true,
          downloadUrl,
          filename
        });
      }
    } else {
      // CSV export (mock for now)
      const downloadUrl = `/api/downloads/report-${Date.now()}.${format}`;

      console.log(`CSV export initiated for user: ${req.user.email}`);
      return res.status(200).json({
        success: true,
        downloadUrl
      });
    }

    console.log(`Report export initiated for user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      downloadUrl: `/api/downloads/report-${Date.now()}.${format}`
    });
  } catch (error) {
    console.error(`Error exporting report for user ${req.user.email}:`, error.message, error.stack);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download generated report
router.get('/download/:filename', requireUser, async (req, res) => {
  try {
    const { filename } = req.params;
    console.log(`Downloading report file: ${filename} for user: ${req.user.email}`);

    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can download reports'
      });
    }

    const path = require('path');
    const fs = require('fs');
    const filePath = path.join(__dirname, '../uploads/reports', filename);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'Report file not found'
      });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    console.log(`Report file ${filename} downloaded successfully by user: ${req.user.email}`);
  } catch (error) {
    console.error(`Error downloading report file for user ${req.user.email}:`, error.message, error.stack);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;