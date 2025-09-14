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
      const exam = await Exam.findById(examId);
      if (!exam) {
        throw new Error('Exam not found');
      }

      if (exam.status !== 'active') {
        throw new Error('Exam is not currently active');
      }

      // Check if exam is within the allowed time window
      const now = new Date();
      if (now < exam.startDate || now > exam.endDate) {
        throw new Error('Exam is not available at this time');
      }

      // Check if student already has an active attempt
      const existingAttempt = await ExamAttempt.findOne({
        examId,
        studentId,
        status: 'in-progress'
      });

      if (existingAttempt) {
        // Return existing attempt with questions
        const questions = await Question.find({ _id: { $in: exam.questions || [] } })
          .select('_id type question options marks');
        
        return {
          attemptId: existingAttempt._id.toString(),
          questions: questions
        };
      }

      // Create new attempt
      const attempt = new ExamAttempt({
        examId,
        studentId,
        startTime: new Date(),
        status: 'in-progress'
      });

      const savedAttempt = await attempt.save();

      // Get questions for this exam (for now, we'll use mock questions since question assignment isn't implemented yet)
      // TODO: Replace with actual exam questions when question assignment is implemented
      const mockQuestions = [
        {
          _id: new mongoose.Types.ObjectId(),
          type: 'multiple-choice',
          question: 'What is the derivative of x²?',
          options: ['2x', 'x²', '2', 'x'],
          marks: 2
        },
        {
          _id: new mongoose.Types.ObjectId(),
          type: 'true-false',
          question: 'The speed of light is approximately 3 × 10⁸ m/s.',
          marks: 1
        },
        {
          _id: new mongoose.Types.ObjectId(),
          type: 'short-answer',
          question: 'Explain the concept of photosynthesis in plants.',
          marks: 5
        }
      ];

      console.log('ExamAttemptService: Exam attempt started successfully with ID:', savedAttempt._id);
      
      return {
        attemptId: savedAttempt._id.toString(),
        questions: mockQuestions
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

      // Calculate score (mock calculation for now)
      // TODO: Implement proper scoring based on correct answers when question system is complete
      const totalQuestions = 3; // Mock value
      const answeredQuestions = attempt.answers.size;
      const mockScore = Math.round((answeredQuestions / totalQuestions) * attempt.examId.totalMarks * 0.85);
      const percentage = (mockScore / attempt.examId.totalMarks) * 100;

      // Update attempt
      attempt.endTime = endTime;
      attempt.timeSpent = timeSpentMinutes;
      attempt.score = mockScore;
      attempt.percentage = Math.round(percentage * 100) / 100; // Round to 2 decimal places
      attempt.status = 'completed';

      await attempt.save();

      console.log('ExamAttemptService: Exam attempt submitted successfully with score:', mockScore);
      
      return {
        success: true,
        score: mockScore,
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
}

module.exports = ExamAttemptService;