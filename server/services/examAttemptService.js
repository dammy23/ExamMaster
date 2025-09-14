const ExamAttempt = require('../models/ExamAttempt.js');
const Exam = require('../models/Exam.js');
const Question = require('../models/Question.js');
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
        // Return existing attempt with questions (already populated from the exam query above)
        const questions = exam.questions.map(question => ({
          _id: question._id,
          type: question.type,
          question: question.question,
          options: question.options || [],
          marks: question.marks
        }));
        
        return {
          attemptId: activeAttempt._id.toString(),
          questions: questions,
          videoRecording: exam.videoRecording,
          attemptNumber: activeAttempt.attemptNumber,
          maxAttempts: exam.maxAttempts
        };
      }

      // Check attempt limits
      const completedAttempts = existingAttempts.filter(attempt => 
        attempt.status === 'completed' || attempt.status === 'submitted'
      );
      
      if (completedAttempts.length >= exam.maxAttempts) {
        throw new Error(`You have exceeded the maximum number of attempts (${exam.maxAttempts}) for this exam.`);
      }

      // Calculate next attempt number
      const nextAttemptNumber = existingAttempts.length > 0 
        ? Math.max(...existingAttempts.map(a => a.attemptNumber)) + 1 
        : 1;
      
      console.log(`Creating attempt number ${nextAttemptNumber} for student ${studentId}`);

      // Validate attempt number doesn't exceed maximum
      if (nextAttemptNumber > exam.maxAttempts) {
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

      // Get questions for this exam (already populated from the exam query above)
      const questions = exam.questions.map(question => ({
        _id: question._id,
        type: question.type,
        question: question.question,
        options: question.options || [],
        marks: question.marks
      }));

      console.log('ExamAttemptService: Exam attempt started successfully with ID:', savedAttempt._id);
      console.log(`ExamAttemptService: Loaded ${questions.length} questions for exam attempt`);
      
      return {
        attemptId: savedAttempt._id.toString(),
        questions: questions,
        videoRecording: exam.videoRecording,
        attemptNumber: nextAttemptNumber,
        maxAttempts: exam.maxAttempts
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
      const exam = await Exam.findById(attempt.examId).populate('questions');
      
      if (exam && exam.questions) {
        for (const question of exam.questions) {
          const studentAnswer = attempt.answers.get(question._id.toString());
          if (studentAnswer) {
            // Simple scoring logic - can be enhanced later for partial marks
            if (question.type === 'multiple-choice' || question.type === 'true-false') {
              const correctAnswers = question.correctAnswers || [];
              if (Array.isArray(studentAnswer)) {
                // Multiple selection - check if arrays match
                const isCorrect = correctAnswers.length === studentAnswer.length &&
                  correctAnswers.every(ans => studentAnswer.includes(ans));
                if (isCorrect) totalScore += question.marks;
              } else {
                // Single selection
                if (correctAnswers.includes(studentAnswer)) {
                  totalScore += question.marks;
                }
              }
            } else if (question.type === 'short-answer') {
              // For short answers, award half marks for any attempt (manual review needed)
              totalScore += question.marks * 0.5;
            }
          }
        }
      }
      
      const percentage = exam ? (totalScore / exam.totalMarks) * 100 : 0;

      // Update attempt
      attempt.endTime = endTime;
      attempt.timeSpent = timeSpentMinutes;
      attempt.score = totalScore;
      attempt.percentage = Math.round(percentage * 100) / 100; // Round to 2 decimal places
      attempt.status = 'completed';

      await attempt.save();

      console.log('ExamAttemptService: Exam attempt submitted successfully with score:', totalScore);
      
      return {
        success: true,
        score: totalScore,
        percentage: attempt.percentage
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
}

module.exports = ExamAttemptService;