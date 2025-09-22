const Exam = require('../models/Exam.js');
const Question = require('../models/Question.js');
const mongoose = require('mongoose');

class ExamService {
  
  // Get all exams with optional filtering
  static async getAll(filters = {}, userId = null) {
    try {
      console.log('ExamService: Getting all exams with filters:', filters);
      
      let query = {};
      
      // If userId is provided, filter by createdBy (for admin users)
      if (userId) {
        query.createdBy = userId;
      }
      
      // Add additional filters if provided
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.subject) {
        query.subject = new RegExp(filters.subject, 'i');
      }
      
      const exams = await Exam.find(query)
        .populate('createdBy', 'name email')
        .populate('subject', 'name code description')
        .sort({ createdAt: -1 });
      
      console.log(`ExamService: Found ${exams.length} exams`);
      return exams;
    } catch (error) {
      console.error('ExamService: Error getting all exams:', error.message);
      throw new Error('Failed to retrieve exams');
    }
  }
  
  // Get exam by ID
  static async getById(examId) {
    try {
      console.log('ExamService: Getting exam by ID:', examId);
      
      if (!mongoose.Types.ObjectId.isValid(examId)) {
        throw new Error('Invalid exam ID format');
      }
      
      const exam = await Exam.findById(examId)
        .populate('createdBy', 'name email')
        .populate('subject', 'name code description')
        .populate('assignedStudents', 'name email');
      
      if (!exam) {
        throw new Error('Exam not found');
      }
      
      console.log('ExamService: Found exam:', exam.title);
      return exam;
    } catch (error) {
      console.error('ExamService: Error getting exam by ID:', error.message);
      throw error;
    }
  }
  
  // Create new exam
  static async create(examData, userId) {
    try {
      console.log('ExamService: Creating new exam:', examData.title);
      
      // Validate required fields
      const requiredFields = ['title', 'subject', 'duration', 'startDate', 'endDate', 'totalMarks', 'passingMarks'];
      for (const field of requiredFields) {
        if (!examData[field]) {
          throw new Error(`${field} is required`);
        }
      }
      
      // Validate dates
      const startDate = new Date(examData.startDate);
      const endDate = new Date(examData.endDate);
      
      if (startDate >= endDate) {
        throw new Error('End date must be after start date');
      }
      
      // Validate passing marks
      if (examData.passingMarks > examData.totalMarks) {
        throw new Error('Passing marks cannot exceed total marks');
      }
      
      const examToCreate = {
        ...examData,
        createdBy: userId,
        startDate,
        endDate
      };
      
      const exam = new Exam(examToCreate);
      const savedExam = await exam.save();
      
      // Populate the created exam
      const populatedExam = await Exam.findById(savedExam._id)
        .populate('createdBy', 'name email')
        .populate('subject', 'name code description');
      
      console.log('ExamService: Exam created successfully with ID:', savedExam._id);
      return populatedExam;
    } catch (error) {
      console.error('ExamService: Error creating exam:', error.message);
      throw error;
    }
  }
  
  // Update exam
  static async update(examId, examData, userId) {
    try {
      console.log('ExamService: Updating exam:', examId);
      console.log('ExamService: Received exam data:', JSON.stringify(examData, null, 2));

      if (!mongoose.Types.ObjectId.isValid(examId)) {
        throw new Error('Invalid exam ID format');
      }

      const exam = await Exam.findById(examId);
      if (!exam) {
        throw new Error('Exam not found');
      }

      // Check if user is the creator of the exam
      if (exam.createdBy.toString() !== userId.toString()) {
        throw new Error('You are not authorized to update this exam');
      }

      // Validate dates if provided
      if (examData.startDate && examData.endDate) {
        const startDate = new Date(examData.startDate);
        const endDate = new Date(examData.endDate);
        
        console.log('ExamService: Start date string:', examData.startDate);
        console.log('ExamService: End date string:', examData.endDate);
        console.log('ExamService: Start date object:', startDate);
        console.log('ExamService: End date object:', endDate);
        console.log('ExamService: Start date >= End date?', startDate >= endDate);

        if (startDate >= endDate) {
          throw new Error('End date must be after start date');
        }
      }

      // Validate passing marks - need to check against both new and existing values
      const totalMarks = examData.totalMarks !== undefined ? examData.totalMarks : exam.totalMarks;
      const passingMarks = examData.passingMarks !== undefined ? examData.passingMarks : exam.passingMarks;

      console.log('ExamService: Final passing marks:', passingMarks, typeof passingMarks);
      console.log('ExamService: Final total marks:', totalMarks, typeof totalMarks);
      console.log('ExamService: Passing marks > Total marks?', passingMarks > totalMarks);
      
      if (passingMarks > totalMarks) {
        throw new Error('Passing marks cannot exceed total marks');
      }

      const updatedExam = await Exam.findByIdAndUpdate(
        examId,
        { ...examData, updatedAt: new Date() },
        { new: true, runValidators: true }
      ).populate('createdBy', 'name email')
       .populate('subject', 'name code description');

      console.log('ExamService: Exam updated successfully');
      return updatedExam;
    } catch (error) {
      console.error('ExamService: Error updating exam:', error.message);
      throw error;
    }
  }
  
  // Delete exam
  static async delete(examId, userId) {
    try {
      console.log('ExamService: Deleting exam:', examId);
      
      if (!mongoose.Types.ObjectId.isValid(examId)) {
        throw new Error('Invalid exam ID format');
      }
      
      const exam = await Exam.findById(examId);
      if (!exam) {
        throw new Error('Exam not found');
      }
      
      // Check if user is the creator of the exam
      if (exam.createdBy.toString() !== userId.toString()) {
        throw new Error('You are not authorized to delete this exam');
      }
      
      await Exam.findByIdAndDelete(examId);
      
      console.log('ExamService: Exam deleted successfully');
      return { message: 'Exam deleted successfully' };
    } catch (error) {
      console.error('ExamService: Error deleting exam:', error.message);
      throw error;
    }
  }

  // Get questions for an exam
  static async getExamQuestions(examId, userId) {
    try {
      console.log('ExamService: Getting questions for exam:', examId);

      if (!mongoose.Types.ObjectId.isValid(examId)) {
        throw new Error('Invalid exam ID format');
      }

      const exam = await Exam.findById(examId).populate('questions');
      if (!exam) {
        throw new Error('Exam not found');
      }

      // For admin users, check authorization
      if (userId && exam.createdBy.toString() !== userId.toString()) {
        throw new Error('You are not authorized to view questions for this exam');
      }

      console.log(`ExamService: Found ${exam.questions.length} questions for exam`);
      return exam.questions;
    } catch (error) {
      console.error('ExamService: Error getting exam questions:', error.message);
      throw error;
    }
  }

  // Assign questions to an exam
  static async assignQuestions(examId, questionIds, userId) {
    try {
      console.log('ExamService: Assigning questions to exam:', examId, 'questions:', questionIds);

      if (!mongoose.Types.ObjectId.isValid(examId)) {
        throw new Error('Invalid exam ID format');
      }

      // Validate question IDs
      for (const questionId of questionIds) {
        if (!mongoose.Types.ObjectId.isValid(questionId)) {
          throw new Error(`Invalid question ID format: ${questionId}`);
        }
      }

      const exam = await Exam.findById(examId);
      if (!exam) {
        throw new Error('Exam not found');
      }

      // Check authorization
      if (exam.createdBy.toString() !== userId.toString()) {
        throw new Error('You are not authorized to modify this exam');
      }

      // Verify all questions exist
      const questions = await Question.find({ _id: { $in: questionIds } });
      if (questions.length !== questionIds.length) {
        const foundIds = questions.map(q => q._id.toString());
        const missingIds = questionIds.filter(id => !foundIds.includes(id));
        throw new Error(`Questions not found: ${missingIds.join(', ')}`);
      }

      // Add questions to exam (avoid duplicates)
      const existingQuestionIds = exam.questions.map(id => id.toString());
      const newQuestionIds = questionIds.filter(id => !existingQuestionIds.includes(id));
      
      exam.questions.push(...newQuestionIds);
      
      // Update totalQuestions count
      exam.totalQuestions = exam.questions.length;
      
      await exam.save();

      console.log(`ExamService: Successfully assigned ${newQuestionIds.length} new questions to exam`);
      return {
        message: `Successfully assigned ${newQuestionIds.length} new questions to exam`,
        questionsCount: exam.questions.length
      };
    } catch (error) {
      console.error('ExamService: Error assigning questions to exam:', error.message);
      throw error;
    }
  }

  // Remove questions from an exam
  static async removeQuestions(examId, questionIds, userId) {
    try {
      console.log('ExamService: Removing questions from exam:', examId, 'questions:', questionIds);

      if (!mongoose.Types.ObjectId.isValid(examId)) {
        throw new Error('Invalid exam ID format');
      }

      // Validate question IDs
      for (const questionId of questionIds) {
        if (!mongoose.Types.ObjectId.isValid(questionId)) {
          throw new Error(`Invalid question ID format: ${questionId}`);
        }
      }

      const exam = await Exam.findById(examId);
      if (!exam) {
        throw new Error('Exam not found');
      }

      // Check authorization
      if (exam.createdBy.toString() !== userId.toString()) {
        throw new Error('You are not authorized to modify this exam');
      }

      // Remove questions from exam
      const questionIdsToRemove = questionIds.map(id => id.toString());
      exam.questions = exam.questions.filter(questionId => 
        !questionIdsToRemove.includes(questionId.toString())
      );

      // Update totalQuestions count
      exam.totalQuestions = exam.questions.length;
      
      await exam.save();

      console.log(`ExamService: Successfully removed ${questionIds.length} questions from exam`);
      return {
        message: `Successfully removed ${questionIds.length} questions from exam`,
        questionsCount: exam.questions.length
      };
    } catch (error) {
      console.error('ExamService: Error removing questions from exam:', error.message);
      throw error;
    }
  }

  // Get available exams for student dashboard
  static async getAvailableExamsForStudent(studentId) {
    try {
      console.log('ExamService: Getting available exams for student:', studentId);

      const now = new Date();

      const query = {
        $or: [
          { status: 'active' },
          { status: 'draft' }
        ],
        startDate: { $lte: now },
        endDate: { $gte: now }
      };

      const exams = await Exam.find(query)
        .populate('subject', 'name code description')
        .sort({ startDate: 1 });

      console.log(`ExamService: Found ${exams.length} available exams for student`);
      return exams;
    } catch (error) {
      console.error('ExamService: Error getting available exams for student:', error.message);
      throw new Error('Failed to retrieve available exams');
    }
  }
}

module.exports = ExamService;