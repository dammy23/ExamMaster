const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: [3, 'Title must be at least 3 characters long'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [20000000, 'Description cannot exceed 20000000 characters'] // Increased to support HTML content
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  duration: {
    type: Number,
    required: true,
    min: [1, 'Duration must be at least 1 minute'],
    max: [1440, 'Duration cannot exceed 1440 minutes (24 hours)']
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'archived'],
    default: 'draft'
  },
  totalQuestions: {
    type: Number,
    default: 0,
    min: [0, 'Total questions cannot be negative']
  },
  questionsPerExam: {
    type: Number,
    default: null,
    min: [1, 'Questions per exam must be at least 1'],
    validate: {
      validator: function(v) {
        return v === null || v === undefined || v >= 1;
      },
      message: 'Questions per exam must be at least 1 or null (use all questions)'
    }
  },
  totalMarks: {
    type: Number,
    required: true,
    min: [1, 'Total marks must be at least 1']
  },
  passingMarks: {
    type: Number,
    required: true,
    min: [0, 'Passing marks cannot be negative']
  },
  instructions: {
    type: String,
    trim: true,
    maxlength: [20000000, 'Description cannot exceed 20000000 characters'] // Increased to support HTML content
 },
  allowReview: {
    type: Boolean,
    default: true
  },
  showResultsImmediately: {
    type: Boolean,
    default: false
  },
  randomizeQuestions: {
    type: Boolean,
    default: true
  },
  randomizeOptions: {
    type: Boolean,
    default: true
  },
  negativeMarking: {
    type: Boolean,
    default: false
  },
  negativeMarkingValue: {
    type: Number,
    default: 0,
    min: [0, 'Negative marking value cannot be negative'],
    max: [1, 'Negative marking value cannot exceed 1']
  },
  assignedStudents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  assignedGroups: [{
    type: String,
    trim: true
  }],
  questions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  maxAttempts: {
    type: Number,
    default: 1,
    min: [0, 'Maximum attempts cannot be negative'], // 0 means unlimited
    max: [10, 'Maximum attempts cannot exceed 10'],
    validate: {
      validator: function(v) {
        return v === 0 || v >= 1;
      },
      message: 'Maximum attempts must be 0 (unlimited) or at least 1'
    }
  },
  videoRecording: {
    type: Boolean,
    default: false
  },
  screenRecording: {
    type: Boolean,
    default: false
  },
  mobileEnabled: {
    type: Boolean,
    default: false
  },
  gradingMethod: {
    type: String,
    enum: ['ai', 'manual'],
    default: 'ai'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Index for better query performance
examSchema.index({ status: 1, createdAt: -1 });
examSchema.index({ createdBy: 1 });

const Exam = mongoose.model('Exam', examSchema);

module.exports = Exam;