const ExamAttempt = require('../models/ExamAttempt.js');
const Exam = require('../models/Exam.js');
const Question = require('../models/Question.js');
const User = require('../models/User.js');
const AIGradingService = require('./aiGradingService.js');
const emailService = require('./emailService.js');
const mongoose = require('mongoose');
const socketManager = require('../sockets/socketManager.js');
const { isViolation } = require('../sockets/activityClassifier.js');

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
        return this.buildAttemptResponse(activeAttempt, exam);
      }

      // Check attempt limits (skip if unlimited attempts - maxAttempts === 0)
      // 'pending-review' counts too — that attempt already used up a slot while awaiting grading
      const completedAttempts = existingAttempts.filter(attempt =>
        attempt.status === 'completed' || attempt.status === 'submitted' || attempt.status === 'pending-review'
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

      let savedAttempt;
      try {
        savedAttempt = await attempt.save();
      } catch (error) {
        // Two near-simultaneous requests (e.g. React StrictMode's dev-only double-invoked
        // mount effect, or a duplicate tab) can both pass the "no active attempt" check above
        // before either commits. The partial unique index on {examId, studentId, status:
        // 'in-progress'} correctly rejects the loser with E11000 — recover by returning the
        // winning attempt instead of surfacing a raw DB error to the student.
        if (error.code === 11000) {
          console.log(`ExamAttemptService: Duplicate-key race creating attempt for exam ${examId}, student ${studentId} — recovering existing attempt`);
          const winningAttempt = await ExamAttempt.findOne({ examId, studentId, status: 'in-progress' });
          if (winningAttempt) {
            return this.buildAttemptResponse(winningAttempt, exam);
          }
        }
        throw error;
      }

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
          marks: question.marks,
          difficulty: question.difficulty
        };
      });

      // Calculate remaining time (full duration since it's a new attempt)
      const remainingTime = exam.duration * 60; // Convert minutes to seconds

      console.log('ExamAttemptService: Exam attempt started successfully with ID:', savedAttempt._id);
      console.log(`ExamAttemptService: Loaded ${questions.length} questions for exam attempt`);

      const student = await User.findById(studentId).select('name email');
      socketManager.emitToAdmin(exam.createdBy.toString(), 'attempt:started', {
        attemptId: savedAttempt._id.toString(),
        examId: exam._id.toString(),
        examTitle: exam.title,
        studentId: studentId.toString(),
        studentName: student?.name || student?.email,
        studentEmail: student?.email,
        startTime: savedAttempt.startTime,
        attemptNumber: nextAttemptNumber
      });

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

  // Build the startAttempt response shape (remainingTime + ordered questions) for an
  // already-existing in-progress attempt — shared by the "attempt already exists" check
  // and the duplicate-key race recovery path, both of which resolve to the same attempt.
  static buildAttemptResponse(activeAttempt, exam) {
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
        marks: question.marks,
        difficulty: question.difficulty
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
      let hasAnsweredTheoryQuestions = false;
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
              // Collect theory questions — graded by AI below (if this exam uses AI grading) or left for an admin to grade by hand
              hasAnsweredTheoryQuestions = true;
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

      // Grade theory questions using AI, unless this exam is configured for human grading
      let aiGradingResults = null;
      let aiGradingFailed = false;
      if (exam && exam.gradingMethod === 'ai' && theoryQuestions.length > 0) {
        console.log(`ExamAttemptService: Starting AI grading for ${theoryQuestions.length} theory questions`);
        try {
          aiGradingResults = await AIGradingService.gradeMultipleTheoryQuestions(theoryQuestions);
          if (aiGradingResults.success) {
            totalScore += aiGradingResults.totalScore;
            console.log(`ExamAttemptService: AI grading completed, added ${aiGradingResults.totalScore} marks from theory questions`);
          }
        } catch (error) {
          console.error('ExamAttemptService: AI grading failed:', error.message);
          // The attempt goes to pending-review below so an admin can retry AI grading or grade by hand — the score is no longer silently lost
          aiGradingFailed = true;
        }
      }

      // Negative marking can drive the score below 0 — floor it after all scoring (including AI-graded theory marks) is applied
      totalScore = Math.max(0, totalScore);

      const percentage = exam ? (totalScore / exam.totalMarks) * 100 : 0;

      // This attempt needs a human before it's final: either the exam is manual-grading and has answered
      // theory questions, or it's AI-grading and grading failed — either the whole call threw (aiGradingFailed)
      // or it resolved but recorded a per-question error (gradeMultipleTheoryQuestions catches those internally
      // and still returns success: true, e.g. when no AI platform is configured)
      const aiGradingHadErrors = !!(aiGradingResults && aiGradingResults.results &&
        aiGradingResults.results.some(result => result.error));
      const needsReview = hasAnsweredTheoryQuestions && (
        (exam && exam.gradingMethod === 'manual') || aiGradingFailed || aiGradingHadErrors
      );

      // Update attempt with scores and AI grading results
      attempt.endTime = endTime;
      attempt.timeSpent = timeSpentMinutes;
      attempt.score = totalScore;
      attempt.percentage = Math.round(percentage * 100) / 100; // Round to 2 decimal places
      attempt.status = needsReview ? 'pending-review' : 'completed';

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

      socketManager.emitToAdmin(attempt.examId.createdBy.toString(), 'attempt:ended', {
        attemptId: attempt._id.toString(),
        examId: attempt.examId._id.toString(),
        examTitle: attempt.examId.title,
        studentId: attempt.studentId.toString(),
        status: attempt.status,
        score: totalScore,
        percentage: attempt.percentage,
        endTime: attempt.endTime,
        timeSpent: attempt.timeSpent
      });

      // Send email results if "Show Results Immediately" is enabled — only once the score is actually final
      if (exam && exam.showResultsImmediately && !needsReview) {
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
        status: attempt.status,
        aiGradingCompleted: aiGradingResults ? aiGradingResults.success : false,
        theoryQuestionsCount: theoryQuestions.length,
        emailSent: exam && exam.showResultsImmediately && !needsReview
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
        .populate('examId', 'title subject totalMarks showResultsImmediately')
        .sort({ createdAt: -1 });

      // Hide scores for completed attempts where the exam has Show Results Immediately disabled
      // (in-progress attempts have no score yet, so they're never filtered)
      const visibleAttempts = attempts.filter(attempt =>
        attempt.status !== 'completed' || (attempt.examId && attempt.examId.showResultsImmediately === true)
      );

      console.log(`ExamAttemptService: Found ${visibleAttempts.length} visible attempts for student`);
      return visibleAttempts;
    } catch (error) {
      console.error('ExamAttemptService: Error getting student attempts:', error.message);
      throw error;
    }
  }

  // Get full detail (including theory question feedback) for a single completed attempt, student-owned
  static async getAttemptDetailForStudent(attemptId, studentId) {
    try {
      console.log('ExamAttemptService: Getting attempt detail for student:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId).populate({
        path: 'examId',
        select: 'title subject totalMarks showResultsImmediately',
        populate: {
          path: 'questions'
        }
      });

      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      if (attempt.studentId.toString() !== studentId.toString()) {
        throw new Error('You are not authorized to view this exam attempt');
      }

      if (attempt.status !== 'completed') {
        throw new Error('This exam attempt has not been fully graded yet');
      }

      if (!attempt.examId || !attempt.examId.showResultsImmediately) {
        throw new Error('Results for this exam are not available');
      }

      console.log('ExamAttemptService: Attempt detail retrieved for student');
      return attempt;
    } catch (error) {
      console.error('ExamAttemptService: Error getting attempt detail for student:', error.message);
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

      const attempt = await ExamAttempt.findById(attemptId).populate('examId', 'title createdBy');
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      // Verify the attempt belongs to the student
      if (attempt.studentId.toString() !== studentId.toString()) {
        throw new Error('You are not authorized to modify this exam attempt');
      }

      // Log the activity
      const logEntry = { activity, timestamp: new Date() };
      attempt.activityLog.push(logEntry);

      // Increment tab switches if it's a tab switch activity
      if (activity === 'tab_switch') {
        attempt.tabSwitches += 1;
      }

      await attempt.save();

      if (attempt.examId && attempt.examId.createdBy) {
        socketManager.emitToAdmin(attempt.examId.createdBy.toString(), 'attempt:activity', {
          attemptId: attempt._id.toString(),
          examId: attempt.examId._id.toString(),
          studentId: attempt.studentId.toString(),
          activity,
          timestamp: logEntry.timestamp,
          isViolation: isViolation(activity),
          tabSwitches: attempt.tabSwitches
        });
      }

      console.log('ExamAttemptService: Activity logged successfully');
      return { success: true };
    } catch (error) {
      console.error('ExamAttemptService: Error logging activity:', error.message);
      throw error;
    }
  }

  // Get all currently in-progress (live) exam attempts across every exam this admin owns
  static async getLiveAttempts(adminId) {
    try {
      console.log('ExamAttemptService: Getting live attempts for admin:', adminId);

      const adminExams = await Exam.find({ createdBy: adminId }).select('_id title');
      const examIds = adminExams.map(exam => exam._id);

      if (examIds.length === 0) {
        return [];
      }

      const attempts = await ExamAttempt.find({ examId: { $in: examIds }, status: 'in-progress' })
        .populate('studentId', 'name email')
        .populate('examId', 'title')
        .sort({ startTime: -1 });

      return attempts.map(attempt => ({
        _id: attempt._id.toString(),
        examId: attempt.examId._id.toString(),
        examTitle: attempt.examId.title,
        studentId: attempt.studentId._id.toString(),
        studentName: attempt.studentId.name,
        studentEmail: attempt.studentId.email,
        startTime: attempt.startTime,
        tabSwitches: attempt.tabSwitches,
        latestActivity: attempt.activityLog.length > 0
          ? attempt.activityLog[attempt.activityLog.length - 1]
          : null,
        updatedAt: attempt.updatedAt
      }));
    } catch (error) {
      console.error('ExamAttemptService: Error getting live attempts:', error.message);
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

      if (!attempt.examId || attempt.examId.createdBy.toString() !== adminId.toString()) {
        throw new Error('You are not authorized to grade this exam attempt');
      }

      // Validate that attempt is awaiting grading
      if (attempt.status !== 'pending-review') {
        throw new Error('Can only grade theory questions for attempts pending review');
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

      // If every question graded cleanly this time, the attempt is done; otherwise it stays pending-review
      const stillHasErrors = aiGradingResults.results.some(result => result.error);
      attempt.status = stillHasErrors ? 'pending-review' : 'completed';

      await attempt.save();

      console.log(`ExamAttemptService: Theory questions graded successfully. New total score: ${newTotalScore}`);

      return {
        success: true,
        aiGradingResults: aiGradingResults,
        totalScore: newTotalScore,
        updatedPercentage: attempt.percentage,
        status: attempt.status,
        theoryQuestionsGraded: theoryQuestions.length
      };

    } catch (error) {
      console.error('ExamAttemptService: Error grading theory questions:', error.message);
      throw error;
    }
  }

  // Submit manual grades for all theory questions in a pending-review attempt
  static async submitManualGrades(attemptId, adminId, grades) {
    try {
      console.log('ExamAttemptService: Submitting manual grades for attempt:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      if (!Array.isArray(grades) || grades.length === 0) {
        throw new Error('At least one grade is required');
      }

      const attempt = await ExamAttempt.findById(attemptId).populate({
        path: 'examId',
        populate: {
          path: 'questions'
        }
      });

      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      if (!attempt.examId || attempt.examId.createdBy.toString() !== adminId.toString()) {
        throw new Error('You are not authorized to grade this exam attempt');
      }

      if (attempt.status !== 'pending-review') {
        throw new Error('Can only submit manual grades for attempts pending review');
      }

      const questionsById = new Map(
        (attempt.examId.questions || []).map(question => [question._id.toString(), question])
      );

      const results = [];
      let totalScore = 0;
      let totalMaxScore = 0;

      for (const grade of grades) {
        const question = questionsById.get(grade.questionId);
        if (!question || question.type !== 'theory') {
          throw new Error(`Question ${grade.questionId} is not a theory question in this exam`);
        }

        const score = Number(grade.score);
        if (Number.isNaN(score) || score < 0 || score > question.marks) {
          throw new Error(`Score for question ${grade.questionId} must be between 0 and ${question.marks}`);
        }

        results.push({
          questionId: question._id,
          score: score,
          maxScore: question.marks,
          feedback: grade.feedback || '',
          gradedBy: adminId,
          gradedAt: new Date()
        });

        totalScore += score;
        totalMaxScore += question.marks;
      }

      // Recombine with the non-theory portion already scored at submission time
      let currentNonTheoryScore = attempt.score || 0;
      if (attempt.aiGradingResults && attempt.aiGradingResults.totalScore) {
        currentNonTheoryScore -= attempt.aiGradingResults.totalScore;
      }

      const newTotalScore = currentNonTheoryScore + totalScore;
      const newPercentage = attempt.examId.totalMarks ? (newTotalScore / attempt.examId.totalMarks) * 100 : 0;

      attempt.score = newTotalScore;
      attempt.percentage = Math.round(newPercentage * 100) / 100;
      attempt.manualGradingResults = {
        totalScore: totalScore,
        totalMaxScore: totalMaxScore,
        results: results,
        gradedAt: new Date()
      };
      attempt.status = 'completed';

      await attempt.save();

      console.log(`ExamAttemptService: Manual grades submitted successfully. New total score: ${newTotalScore}`);

      return {
        success: true,
        totalScore: newTotalScore,
        updatedPercentage: attempt.percentage,
        status: attempt.status
      };
    } catch (error) {
      console.error('ExamAttemptService: Error submitting manual grades:', error.message);
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

  static async getPendingGradingCount(adminId) {
    try {
      console.log('ExamAttemptService: Counting attempts pending grading for admin:', adminId);

      const adminExams = await Exam.find({ createdBy: adminId }).select('_id');
      const examIds = adminExams.map(exam => exam._id);

      if (examIds.length === 0) {
        return 0;
      }

      const count = await ExamAttempt.countDocuments({
        status: 'pending-review',
        examId: { $in: examIds }
      });

      console.log(`ExamAttemptService: ${count} attempts pending grading`);
      return count;
    } catch (error) {
      console.error('ExamAttemptService: Error counting pending grading:', error.message);
      throw error;
    }
  }

  // Get all attempts pending grading, across every exam this admin owns
  static async getPendingGradingAttempts(adminId) {
    try {
      console.log('ExamAttemptService: Getting attempts pending grading for admin:', adminId);

      const adminExams = await Exam.find({ createdBy: adminId }).select('_id');
      const examIds = adminExams.map(exam => exam._id);

      if (examIds.length === 0) {
        return [];
      }

      const attempts = await ExamAttempt.find({
        status: 'pending-review',
        examId: { $in: examIds }
      })
        .populate('studentId', 'name email')
        .populate('examId', 'title gradingMethod')
        .sort({ endTime: -1 });

      console.log(`ExamAttemptService: Found ${attempts.length} attempts pending grading`);
      return attempts;
    } catch (error) {
      console.error('ExamAttemptService: Error getting attempts pending grading:', error.message);
      throw error;
    }
  }

  // Get a single attempt with full exam/question detail for the grading form
  static async getAttemptForGrading(attemptId, adminId) {
    try {
      console.log('ExamAttemptService: Getting attempt for grading:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId)
        .populate('studentId', 'name email')
        .populate({
          path: 'examId',
          select: 'title subject totalMarks gradingMethod createdBy',
          populate: {
            path: 'questions'
          }
        });

      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      if (!attempt.examId || attempt.examId.createdBy.toString() !== adminId.toString()) {
        throw new Error('You are not authorized to grade this exam attempt');
      }

      console.log('ExamAttemptService: Attempt retrieved for grading');
      return attempt;
    } catch (error) {
      console.error('ExamAttemptService: Error getting attempt for grading:', error.message);
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