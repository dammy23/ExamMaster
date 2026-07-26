const ExamAttempt = require('../models/ExamAttempt.js');
const Exam = require('../models/Exam.js');
const Question = require('../models/Question.js');
const User = require('../models/User.js');
const AIGradingService = require('./aiGradingService.js');
const emailService = require('./emailService.js');
const mongoose = require('mongoose');

class ExamAttemptService {

  // Start a new exam attempt
  static async startAttempt(examId, studentId) {
    try {
      console.log('ExamAttemptService: Starting exam attempt for exam:', examId, 'student:', studentId);

      if (!mongoose.Types.ObjectId.isValid(examId)) {
        throw new Error('Invalid exam ID format');
      }

      // Check if exam exists and is active
      const exam = await Exam.findById(examId).populate('assignedStudents assignedGroups questions');
      if (!exam) {
        throw new Error('Exam not found');
      }

      // Comprehensive exam validation
      if (exam.status !== 'active' && exam.status !== 'draft') {
        throw new Error('Exam is not currently available for attempts');
      }

      // Check if exam is within the allowed time window
      const now = new Date();
      if (now < exam.startDate) {
        const timeDiff = exam.startDate.getTime() - now.getTime();
        const hoursUntilStart = Math.ceil(timeDiff / (1000 * 60 * 60));
        throw new Error(`Exam has not started yet. It will begin in ${hoursUntilStart} hour(s).`);
      }
      
      if (now > exam.endDate) {
        throw new Error('Exam time has expired and is no longer available');
      }

      // Check if student is assigned to this exam (if assignment lists exist)
      // For now, we'll allow all students to attempt any active exam
      // TODO: Implement proper student assignment validation
      
      // Validate exam has questions assigned
      if (!exam.questions || exam.questions.length === 0) {
        throw new Error('This exam has no questions assigned and cannot be attempted');
      }

      // Check duration is valid
      if (!exam.duration || exam.duration <= 0) {
        throw new Error('Invalid exam duration. Please contact administrator');
      }

      console.log(`Exam validation passed for exam: ${exam.title}`);

      // Check if student already has any attempt for this exam
      const existingAttempts = await ExamAttempt.find({
        examId,
        studentId
      }).sort({ attemptNumber: 1 });

      // Check for active (in-progress) attempt
      const activeAttempt = existingAttempts.find(attempt => attempt.status === 'in-progress');
      if (activeAttempt) {
        console.log(`Student has existing active attempt: ${activeAttempt._id}`);
        
        // Calculate remaining time
        const startTime = new Date(activeAttempt.startTime);
        const now = new Date();
        const elapsedSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        const totalTimeSeconds = exam.duration * 60;
        const remainingTime = Math.max(0, totalTimeSeconds - elapsedSeconds);
        
        // Use the selected questions stored in the attempt
        // If no selectedQuestions stored (old attempts), use all exam questions
        let questionsToReturn;
        if (activeAttempt.selectedQuestions && activeAttempt.selectedQuestions.length > 0) {
          // Get the questions in the SAME ORDER they were originally selected
          // Create a map for quick lookup
          const questionMap = new Map(exam.questions.map(q => [q._id.toString(), q]));
          
          // Map the stored question IDs back to full question objects in original order
          questionsToReturn = activeAttempt.selectedQuestions
            .map(id => questionMap.get(id.toString()))
            .filter(q => q !== undefined); // Filter out any questions that no longer exist
        } else {
          // Fallback to all questions for backward compatibility
          questionsToReturn = exam.questions;
        }
        
        const questions = questionsToReturn.map(question => {
          const storedOrder = activeAttempt.optionOrders?.get(question._id.toString());
          return {
            _id: question._id,
            type: question.type,
            question: question.question,
            options: storedOrder || question.options || [],
            marks: question.marks
          };
        });
        
        return {
          attemptId: activeAttempt._id.toString(),
          questions: questions,
          videoRecording: exam.videoRecording,
          attemptNumber: activeAttempt.attemptNumber,
          maxAttempts: exam.maxAttempts,
          remainingTime: remainingTime
        };
      }

      // Check attempt limits (skip if unlimited attempts - maxAttempts === 0)
      const completedAttempts = existingAttempts.filter(attempt => 
        attempt.status === 'completed' || attempt.status === 'submitted'
      );
      
      if (exam.maxAttempts > 0 && completedAttempts.length >= exam.maxAttempts) {
        throw new Error(`You have exceeded the maximum number of attempts (${exam.maxAttempts}) for this exam.`);
      }

      // Calculate next attempt number
      const nextAttemptNumber = existingAttempts.length > 0 
        ? Math.max(...existingAttempts.map(a => a.attemptNumber)) + 1 
        : 1;
      
      console.log(`Creating attempt number ${nextAttemptNumber} for student ${studentId}`);

      // Validate attempt number doesn't exceed maximum (skip if unlimited attempts - maxAttempts === 0)
      if (exam.maxAttempts > 0 && nextAttemptNumber > exam.maxAttempts) {
        throw new Error(`Cannot create attempt ${nextAttemptNumber}. Maximum attempts allowed: ${exam.maxAttempts}`);
      }

      // Create new attempt
      const attempt = new ExamAttempt({
        examId,
        studentId,
        startTime: new Date(),
        status: 'in-progress',
        attemptNumber: nextAttemptNumber,
        videoRecording: {
          enabled: exam.videoRecording,
          recordingStatus: exam.videoRecording ? 'not_started' : undefined
        }
      });

      const savedAttempt = await attempt.save();

      // Get questions for this exam
      let selectedQuestions = [...exam.questions];
      
      // Step 1: If questionsPerExam is set, randomly select that many questions
      if (exam.questionsPerExam && exam.questionsPerExam > 0 && exam.questionsPerExam < exam.questions.length) {
        console.log(`Randomly selecting ${exam.questionsPerExam} questions from ${exam.questions.length} available questions`);
        
        // Shuffle array and take first N questions
        selectedQuestions = selectedQuestions.sort(() => Math.random() - 0.5).slice(0, exam.questionsPerExam);
      }
      
      // Step 2: If randomizeQuestions is enabled, shuffle the selected questions
      if (exam.randomizeQuestions) {
        console.log('Randomizing question order for exam attempt');
        selectedQuestions = selectedQuestions.sort(() => Math.random() - 0.5);
      }
      
      // Store the selected question IDs in their randomized order
      savedAttempt.selectedQuestions = selectedQuestions.map(q => q._id);

      // If randomizeOptions is enabled, shuffle and persist MCQ option order per question
      // (persisted, not recomputed per-fetch, so a page refresh mid-attempt doesn't reorder options)
      if (exam.randomizeOptions) {
        const optionOrders = new Map();
        selectedQuestions.forEach(question => {
          if (question.type === 'multiple-choice' && question.options && question.options.length > 0) {
            optionOrders.set(question._id.toString(), [...question.options].sort(() => Math.random() - 0.5));
          }
        });
        savedAttempt.optionOrders = optionOrders;
      }

      await savedAttempt.save();

      const questions = selectedQuestions.map(question => {
        const storedOrder = savedAttempt.optionOrders?.get(question._id.toString());
        return {
          _id: question._id,
          type: question.type,
          question: question.question,
          options: storedOrder || question.options || [],
          marks: question.marks
        };
      });

      // Calculate remaining time (full duration since it's a new attempt)
      const remainingTime = exam.duration * 60; // Convert minutes to seconds

      console.log('ExamAttemptService: Exam attempt started successfully with ID:', savedAttempt._id);
      console.log(`ExamAttemptService: Loaded ${questions.length} questions for exam attempt`);
      
      return {
        attemptId: savedAttempt._id.toString(),
        questions: questions,
        videoRecording: exam.videoRecording,
        attemptNumber: nextAttemptNumber,
        maxAttempts: exam.maxAttempts,
        remainingTime: remainingTime
      };
    } catch (error) {
      console.error('ExamAttemptService: Error starting exam attempt:', error.message);
      throw error;
    }
  }

  // Save answer for a question
  static async saveAnswer(attemptId, questionId, answer, studentId) {
    try {
      console.log('ExamAttemptService: Saving answer for attempt:', attemptId, 'question:', questionId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId);
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      // Verify the attempt belongs to the student
      if (attempt.studentId.toString() !== studentId.toString()) {
        throw new Error('You are not authorized to modify this exam attempt');
      }

      if (attempt.status !== 'in-progress') {
        throw new Error('Cannot save answer to a completed exam attempt');
      }

      // Save the answer
      attempt.answers.set(questionId, answer);
      await attempt.save();

      console.log('ExamAttemptService: Answer saved successfully');
      return { success: true };
    } catch (error) {
      console.error('ExamAttemptService: Error saving answer:', error.message);
      throw error;
    }
  }

  // Submit exam attempt
  static async submitAttempt(attemptId, studentId) {
    try {
      console.log('ExamAttemptService: Submitting exam attempt:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId).populate('examId');
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      // Verify the attempt belongs to the student
      if (attempt.studentId.toString() !== studentId.toString()) {
        throw new Error('You are not authorized to submit this exam attempt');
      }

      if (attempt.status !== 'in-progress') {
        throw new Error('Exam attempt is already completed');
      }

      // Calculate time spent
      const endTime = new Date();
      const timeSpentMinutes = Math.round((endTime - attempt.startTime) / (1000 * 60));

      // Calculate score based on actual questions
      let totalScore = 0;
      let theoryQuestions = [];
      const exam = await Exam.findById(attempt.examId).populate('questions');

      if (exam && exam.questions) {
        for (const question of exam.questions) {
          const studentAnswer = attempt.answers.get(question._id.toString());
          if (studentAnswer) {
            // Simple scoring logic - can be enhanced later for partial marks
            if (question.type === 'multiple-choice' || question.type === 'true-false') {
              const correctAnswers = question.correctAnswers || [];
              let isCorrect;
              if (Array.isArray(studentAnswer)) {
                // Multiple selection - check if arrays match
                isCorrect = correctAnswers.length === studentAnswer.length &&
                  correctAnswers.every(ans => studentAnswer.includes(ans));
              } else {
                // Single selection
                isCorrect = correctAnswers.includes(studentAnswer);
              }
              if (isCorrect) {
                totalScore += question.marks;
              } else if (exam.negativeMarking) {
                // negativeMarkingValue is a fraction of this question's own marks
                totalScore -= exam.negativeMarkingValue * question.marks;
              }
            } else if (question.type === 'theory' || question.type === 'short-answer') {
              // Collect theory questions for AI grading
              theoryQuestions.push({
                questionId: question._id.toString(),
                question: question.question,
                studentAnswer: studentAnswer,
                sampleAnswer: question.correctAnswers[0] || '',
                maxMarks: question.marks
              });
              console.log(`Theory question ${question._id} will be graded by AI`);
            }
          }
        }
      }

      // Grade theory questions using AI if any exist
      let aiGradingResults = null;
      if (theoryQuestions.length > 0) {
        console.log(`ExamAttemptService: Starting AI grading for ${theoryQuestions.length} theory questions`);
        try {
          aiGradingResults = await AIGradingService.gradeMultipleTheoryQuestions(theoryQuestions);
          if (aiGradingResults.success) {
            totalScore += aiGradingResults.totalScore;
            console.log(`ExamAttemptService: AI grading completed, added ${aiGradingResults.totalScore} marks from theory questions`);
          }
        } catch (error) {
          console.error('ExamAttemptService: AI grading failed:', error.message);
          // Continue without AI scores - they can be graded manually later
        }
      }

      // Negative marking can drive the score below 0 — floor it after all scoring (including AI-graded theory marks) is applied
      totalScore = Math.max(0, totalScore);

      const percentage = exam ? (totalScore / exam.totalMarks) * 100 : 0;

      // Update attempt with scores and AI grading results
      attempt.endTime = endTime;
      attempt.timeSpent = timeSpentMinutes;
      attempt.score = totalScore;
      attempt.percentage = Math.round(percentage * 100) / 100; // Round to 2 decimal places
      attempt.status = 'completed';

      // Store AI grading results in attempt metadata if available
      if (aiGradingResults && aiGradingResults.success) {
        attempt.aiGradingResults = {
          totalScore: aiGradingResults.totalScore,
          totalMaxScore: aiGradingResults.totalMaxScore,
          results: aiGradingResults.results,
          gradedAt: aiGradingResults.gradedAt
        };
      }

      await attempt.save();

      console.log('ExamAttemptService: Exam attempt submitted successfully with total score:', totalScore);

      // Send email results if "Show Results Immediately" is enabled
      if (exam && exam.showResultsImmediately) {
        console.log('ExamAttemptService: Sending email results as showResultsImmediately is enabled');
        try {
          // Get student details
          const student = await User.findById(studentId);
          if (student && student.email) {
            const passed = totalScore >= exam.passingMarks;

            await emailService.sendExamResults(
              student.email,
              student.name || student.email,
              exam.title,
              totalScore,
              attempt.percentage,
              exam.totalMarks,
              exam.passingMarks,
              passed
            );

            console.log(`ExamAttemptService: Email sent successfully to ${student.email}`);
          } else {
            console.log('ExamAttemptService: Student email not found, skipping email notification');
          }
        } catch (emailError) {
          console.error('ExamAttemptService: Error sending email results:', emailError.message);
          // Don't fail the exam submission if email fails
        }
      }

      return {
        success: true,
        score: totalScore,
        percentage: attempt.percentage,
        aiGradingCompleted: aiGradingResults ? aiGradingResults.success : false,
        theoryQuestionsCount: theoryQuestions.length,
        emailSent: exam && exam.showResultsImmediately
      };
    } catch (error) {
      console.error('ExamAttemptService: Error submitting exam attempt:', error.message);
      throw error;
    }
  }

  // Get student's exam attempts
  static async getStudentAttempts(studentId) {
    try {
      console.log('ExamAttemptService: Getting exam attempts for student:', studentId);

      const attempts = await ExamAttempt.find({ studentId })
        .populate('examId', 'title subject totalMarks')
        .sort({ createdAt: -1 });

      console.log(`ExamAttemptService: Found ${attempts.length} attempts for student`);
      return attempts;
    } catch (error) {
      console.error('ExamAttemptService: Error getting student attempts:', error.message);
      throw error;
    }
  }

  // Log activity (like tab switches)
  static async logActivity(attemptId, activity, studentId) {
    try {
      console.log('ExamAttemptService: Logging activity for attempt:', attemptId, 'activity:', activity);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId);
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      // Verify the attempt belongs to the student
      if (attempt.studentId.toString() !== studentId.toString()) {
        throw new Error('You are not authorized to modify this exam attempt');
      }

      // Log the activity
      attempt.activityLog.push({
        activity,
        timestamp: new Date()
      });

      // Increment tab switches if it's a tab switch activity
      if (activity === 'tab_switch') {
        attempt.tabSwitches += 1;
      }

      await attempt.save();

      console.log('ExamAttemptService: Activity logged successfully');
      return { success: true };
    } catch (error) {
      console.error('ExamAttemptService: Error logging activity:', error.message);
      throw error;
    }
  }

  // Start video recording for an exam attempt
  static async startVideoRecording(attemptId, studentId) {
    try {
      console.log('ExamAttemptService: Starting video recording for attempt:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId);
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      // Verify the attempt belongs to the student
      if (attempt.studentId.toString() !== studentId.toString()) {
        throw new Error('You are not authorized to modify this exam attempt');
      }

      if (attempt.status !== 'in-progress') {
        throw new Error('Cannot start recording for completed exam attempt');
      }

      if (!attempt.videoRecording.enabled) {
        throw new Error('Video recording is not enabled for this exam');
      }

      // Update recording status
      attempt.videoRecording.recordingStatus = 'recording';
      attempt.videoRecording.recordingStartTime = new Date();

      // Log the activity
      attempt.activityLog.push({
        activity: 'video_recording_started',
        timestamp: new Date()
      });

      await attempt.save();

      console.log('ExamAttemptService: Video recording started successfully');
      return { success: true, message: 'Video recording started' };
    } catch (error) {
      console.error('ExamAttemptService: Error starting video recording:', error.message);
      throw error;
    }
  }

  // Update video recording details
  static async updateVideoRecording(attemptId, videoUrl, fileSize, studentId) {
    try {
      console.log('ExamAttemptService: Updating video recording for attempt:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId);
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      // Verify the attempt belongs to the student
      if (attempt.studentId.toString() !== studentId.toString()) {
        throw new Error('You are not authorized to modify this exam attempt');
      }

      if (!attempt.videoRecording.enabled) {
        throw new Error('Video recording is not enabled for this exam');
      }

      // Update recording details
      attempt.videoRecording.videoUrl = videoUrl;
      attempt.videoRecording.fileSize = fileSize;
      attempt.videoRecording.recordingEndTime = new Date();
      attempt.videoRecording.recordingStatus = 'completed';

      // Log the activity
      attempt.activityLog.push({
        activity: 'video_recording_completed',
        timestamp: new Date()
      });

      await attempt.save();

      console.log('ExamAttemptService: Video recording updated successfully');
      return { success: true, message: 'Video recording completed' };
    } catch (error) {
      console.error('ExamAttemptService: Error updating video recording:', error.message);
      throw error;
    }
  }

  // Get exam attempt with video details for admin review
  static async getAttemptForReview(attemptId, adminId) {
    try {
      console.log('ExamAttemptService: Getting exam attempt for admin review:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId)
        .populate('studentId', 'name email')
        .populate('examId', 'title subject videoRecording createdBy');

      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      // Verify admin has access to this exam
      if (attempt.examId.createdBy.toString() !== adminId.toString()) {
        throw new Error('You are not authorized to review this exam attempt');
      }

      console.log('ExamAttemptService: Exam attempt retrieved for admin review');
      return attempt;
    } catch (error) {
      console.error('ExamAttemptService: Error getting exam attempt for review:', error.message);
      throw error;
    }
  }

  // Get all exam attempts for an exam (admin view)
  static async getExamAttempts(examId, adminId) {
    try {
      console.log('ExamAttemptService: Getting all attempts for exam:', examId);

      if (!mongoose.Types.ObjectId.isValid(examId)) {
        throw new Error('Invalid exam ID format');
      }

      // Verify admin owns this exam
      const Exam = require('../models/Exam.js');
      const exam = await Exam.findById(examId);
      if (!exam) {
        throw new Error('Exam not found');
      }

      if (exam.createdBy.toString() !== adminId.toString()) {
        throw new Error('You are not authorized to view attempts for this exam');
      }

      const attempts = await ExamAttempt.find({ examId })
        .populate('studentId', 'name email')
        .sort({ createdAt: -1 });

      console.log(`ExamAttemptService: Found ${attempts.length} attempts for exam`);
      return attempts;
    } catch (error) {
      console.error('ExamAttemptService: Error getting exam attempts:', error.message);
      throw error;
    }
  }

  // Get recent exam results for student dashboard (only show results for exams with showResultsImmediately enabled)
  static async getStudentRecentResults(studentId, limit = 3) {
    try {
      console.log('ExamAttemptService: Getting recent results for student:', studentId);

      const attempts = await ExamAttempt.find({
        studentId,
        status: 'completed'
      })
        .populate('examId', 'title subject showResultsImmediately')
        .sort({ endTime: -1 });

      // Filter to only include exams where showResultsImmediately is true
      const filteredAttempts = attempts.filter(attempt =>
        attempt.examId && attempt.examId.showResultsImmediately === true
      );

      const recentResults = filteredAttempts.slice(0, limit).map(attempt => ({
        _id: attempt._id,
        exam: attempt.examId.title,
        subject: attempt.examId.subject?.name || 'No Subject',
        score: attempt.score || 0,
        percentage: attempt.percentage || 0,
        date: attempt.endTime ? attempt.endTime.toISOString().split('T')[0] : 'N/A',
        timeSpent: attempt.timeSpent || 0
      }));

      console.log(`ExamAttemptService: Found ${recentResults.length} recent results for student (filtered by showResultsImmediately)`);
      return recentResults;
    } catch (error) {
      console.error('ExamAttemptService: Error getting student recent results:', error.message);
      throw error;
    }
  }

  // Get recent exam activities for admin dashboard
  static async getAdminRecentActivity(adminId, limit = 5) {
    try {
      console.log('ExamAttemptService: Getting recent activities for admin:', adminId);

      // First get exams created by this admin
      const Exam = require('../models/Exam.js');
      const adminExams = await Exam.find({ createdBy: adminId }).select('_id');
      const examIds = adminExams.map(exam => exam._id);

      if (examIds.length === 0) {
        console.log('ExamAttemptService: Admin has no exams, returning empty activities');
        return [];
      }

      // Get recent attempts for admin's exams
      const attempts = await ExamAttempt.find({ 
        examId: { $in: examIds }
      })
        .populate('studentId', 'name email')
        .populate('examId', 'title')
        .sort({ updatedAt: -1 })
        .limit(limit);

      const recentActivities = attempts.map(attempt => {
        let action = 'Unknown';
        let time = 'Unknown';
        
        // Determine action based on attempt status and timestamps
        if (attempt.status === 'completed') {
          action = 'Completed';
          time = attempt.endTime ? this.getTimeAgo(attempt.endTime) : 'N/A';
        } else if (attempt.status === 'in-progress') {
          action = 'Started';
          time = attempt.startTime ? this.getTimeAgo(attempt.startTime) : 'N/A';
        } else if (attempt.status === 'submitted') {
          action = 'Submitted';
          time = attempt.updatedAt ? this.getTimeAgo(attempt.updatedAt) : 'N/A';
        }

        return {
          _id: attempt._id,
          student: attempt.studentId.name || attempt.studentId.email,
          exam: attempt.examId.title,
          action: action,
          time: time,
          percentage: attempt.percentage || null,
          status: attempt.status
        };
      });

      console.log(`ExamAttemptService: Found ${recentActivities.length} recent activities for admin`);
      return recentActivities;
    } catch (error) {
      console.error('ExamAttemptService: Error getting admin recent activity:', error.message);
      throw error;
    }
  }

  // Helper method to calculate time ago
  // Grade theory questions for a specific exam attempt manually
  static async gradeTheoryQuestionsForAttempt(attemptId, adminId) {
    try {
      console.log('ExamAttemptService: Grading theory questions for attempt:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      // Get the exam attempt with populated exam and questions
      const attempt = await ExamAttempt.findById(attemptId).populate({
        path: 'examId',
        populate: {
          path: 'questions'
        }
      });

      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      // Validate that attempt is completed
      if (attempt.status !== 'completed') {
        throw new Error('Can only grade theory questions for completed exam attempts');
      }

      // Extract theory questions that need grading
      let theoryQuestions = [];
      if (attempt.examId && attempt.examId.questions) {
        for (const question of attempt.examId.questions) {
          if (question.type === 'theory') {
            const studentAnswer = attempt.answers.get(question._id.toString());
            if (studentAnswer) {
              theoryQuestions.push({
                questionId: question._id.toString(),
                question: question.question,
                studentAnswer: studentAnswer,
                sampleAnswer: question.correctAnswers[0] || '',
                maxMarks: question.marks
              });
            }
          }
        }
      }

      if (theoryQuestions.length === 0) {
        throw new Error('No theory questions found in this exam attempt');
      }

      console.log(`ExamAttemptService: Found ${theoryQuestions.length} theory questions to grade`);

      // Grade using AI service
      const aiGradingResults = await AIGradingService.gradeMultipleTheoryQuestions(theoryQuestions);

      if (!aiGradingResults.success) {
        throw new Error('AI grading failed');
      }

      // Calculate new total score
      let currentNonTheoryScore = attempt.score || 0;

      // Subtract any existing theory scores if this is a re-grading
      if (attempt.aiGradingResults && attempt.aiGradingResults.totalScore) {
        currentNonTheoryScore -= attempt.aiGradingResults.totalScore;
      }

      const newTotalScore = currentNonTheoryScore + aiGradingResults.totalScore;
      const newPercentage = attempt.examId ? (newTotalScore / attempt.examId.totalMarks) * 100 : 0;

      // Update the attempt with new AI grading results
      attempt.score = newTotalScore;
      attempt.percentage = Math.round(newPercentage * 100) / 100;
      attempt.aiGradingResults = {
        totalScore: aiGradingResults.totalScore,
        totalMaxScore: aiGradingResults.totalMaxScore,
        results: aiGradingResults.results,
        gradedAt: aiGradingResults.gradedAt
      };

      await attempt.save();

      console.log(`ExamAttemptService: Theory questions graded successfully. New total score: ${newTotalScore}`);

      return {
        success: true,
        aiGradingResults: aiGradingResults,
        totalScore: newTotalScore,
        updatedPercentage: attempt.percentage,
        theoryQuestionsGraded: theoryQuestions.length
      };

    } catch (error) {
      console.error('ExamAttemptService: Error grading theory questions:', error.message);
      throw error;
    }
  }

  // Helper method to format time ago
  static getTimeAgo(date) {
    const now = new Date();
    const diffInMs = now - new Date(date);
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  }

  static async getPendingGradingCount() {
    try {
      console.log('ExamAttemptService: Counting attempts pending manual grading...');

      const attempts = await ExamAttempt.find({
        status: 'completed',
        'aiGradingResults.gradedAt': { $exists: false }
      }).populate({
        path: 'examId',
        populate: {
          path: 'questions'
        }
      });

      let count = 0;
      for (const attempt of attempts) {
        if (!attempt.examId || !attempt.examId.questions) continue;
        const hasUngradedTheory = attempt.examId.questions.some(
          (q) => q.type === 'theory' && attempt.answers.get(q._id.toString())
        );
        if (hasUngradedTheory) count++;
      }

      console.log(`ExamAttemptService: ${count} attempts pending manual grading`);
      return count;
    } catch (error) {
      console.error('ExamAttemptService: Error counting pending grading:', error.message);
      throw error;
    }
  }

  static async markVideoReviewed(attemptId, adminId) {
    try {
      console.log('ExamAttemptService: Marking video review complete for attempt:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId).populate('examId', 'createdBy');
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      if (attempt.examId.createdBy.toString() !== adminId.toString()) {
        throw new Error('You are not authorized to review this exam attempt');
      }

      attempt.videoRecording.reviewed = true;
      attempt.videoRecording.reviewedAt = new Date();
      await attempt.save();

      console.log('ExamAttemptService: Video review marked complete');
      return attempt;
    } catch (error) {
      console.error('ExamAttemptService: Error marking video review complete:', error.message);
      throw error;
    }
  }

  static async getPendingVideoReviewsCount() {
    try {
      console.log('ExamAttemptService: Counting attempts pending video review...');
      const count = await ExamAttempt.countDocuments({
        'videoRecording.enabled': true,
        'videoRecording.recordingStatus': 'completed',
        'videoRecording.reviewed': { $ne: true }
      });
      console.log(`ExamAttemptService: ${count} attempts pending video review`);
      return count;
    } catch (error) {
      console.error('ExamAttemptService: Error counting pending video reviews:', error.message);
      throw error;
    }
  }
}

module.exports = ExamAttemptService;