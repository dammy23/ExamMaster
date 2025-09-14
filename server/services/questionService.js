const Question = require('../models/Question');

class QuestionService {
  
  async getAllQuestions(filters = {}, pagination = {}) {
    try {
      console.log('QuestionService: Fetching questions with filters:', filters);
      
      const { page = 1, limit = 50, difficulty, search } = { ...filters, ...pagination };
      const skip = (page - 1) * limit;
      
      // Build query
      const query = {};
      
      if (difficulty && difficulty !== 'all') {
        query.difficulty = difficulty;
      }
      
      if (search) {
        query.$or = [
          { question: { $regex: search, $options: 'i' } }
        ];
      }
      
      const [questions, total] = await Promise.all([
        Question.find(query)
          .populate('createdBy', 'name email')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit)),
        Question.countDocuments(query)
      ]);
      
      console.log(`QuestionService: Found ${questions.length} questions out of ${total} total`);
      
      return {
        questions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      };
    } catch (error) {
      console.error('QuestionService: Error fetching questions:', error);
      throw new Error(`Failed to fetch questions: ${error.message}`);
    }
  }
  
  async getQuestionById(questionId) {
    try {
      console.log('QuestionService: Fetching question by ID:', questionId);
      
      const question = await Question.findById(questionId)
        .populate('createdBy', 'name email');
      
      if (!question) {
        throw new Error('Question not found');
      }
      
      console.log('QuestionService: Question found:', question.question.substring(0, 50) + '...');
      return question;
    } catch (error) {
      console.error('QuestionService: Error fetching question:', error);
      throw new Error(`Failed to fetch question: ${error.message}`);
    }
  }
  
  async createQuestion(questionData, createdBy) {
    try {
      console.log('QuestionService: Creating new question:', questionData.question?.substring(0, 50) + '...');
      
      const question = new Question({
        ...questionData,
        createdBy
      });
      
      await question.save();
      await question.populate('createdBy', 'name email');
      
      console.log('QuestionService: Question created successfully with ID:', question._id);
      return question;
    } catch (error) {
      console.error('QuestionService: Error creating question:', error);
      throw new Error(`Failed to create question: ${error.message}`);
    }
  }
  
  async updateQuestion(questionId, updateData, userId) {
    try {
      console.log('QuestionService: Updating question:', questionId);
      
      const question = await Question.findById(questionId);
      
      if (!question) {
        throw new Error('Question not found');
      }
      
      // Check if user is the creator (or is admin - you might want to add role check)
      if (question.createdBy.toString() !== userId.toString()) {
        throw new Error('Unauthorized to update this question');
      }
      
      Object.assign(question, updateData);
      await question.save();
      await question.populate('createdBy', 'name email');
      
      console.log('QuestionService: Question updated successfully');
      return question;
    } catch (error) {
      console.error('QuestionService: Error updating question:', error);
      throw new Error(`Failed to update question: ${error.message}`);
    }
  }
  
  async deleteQuestion(questionId, userId) {
    try {
      console.log('QuestionService: Deleting question:', questionId);
      
      const question = await Question.findById(questionId);
      
      if (!question) {
        throw new Error('Question not found');
      }
      
      // Check if user is the creator (or is admin - you might want to add role check)
      if (question.createdBy.toString() !== userId.toString()) {
        throw new Error('Unauthorized to delete this question');
      }
      
      await Question.findByIdAndDelete(questionId);
      
      console.log('QuestionService: Question deleted successfully');
      return { message: 'Question deleted successfully' };
    } catch (error) {
      console.error('QuestionService: Error deleting question:', error);
      throw new Error(`Failed to delete question: ${error.message}`);
    }
  }
  
  
  async bulkCreateQuestions(questionsData, createdBy) {
    try {
      console.log('QuestionService: Bulk creating questions, count:', questionsData.length);
      
      const questions = questionsData.map(data => ({
        ...data,
        createdBy
      }));
      
      const createdQuestions = await Question.insertMany(questions, { ordered: false });
      
      console.log('QuestionService: Bulk creation completed, created:', createdQuestions.length);
      return {
        imported: createdQuestions.length,
        questions: createdQuestions
      };
    } catch (error) {
      console.error('QuestionService: Error in bulk creation:', error);
      
      // Handle partial success in bulk operations
      if (error.writeErrors) {
        const successful = error.insertedDocs || [];
        const errors = error.writeErrors.map(err => `Row ${err.index + 1}: ${err.errmsg}`);
        
        return {
          imported: successful.length,
          errors,
          questions: successful
        };
      }
      
      throw new Error(`Failed to bulk create questions: ${error.message}`);
    }
  }
}

module.exports = new QuestionService();