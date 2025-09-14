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
    maxlength: [1000, 'Description cannot exceed 1000 characters']
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
    maxlength: [2000, 'Instructions cannot exceed 2000 characters']
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
  maxAttempts: {
    type: Number,
    default: 1,
    min: [1, 'Maximum attempts must be at least 1'],
    max: [10, 'Maximum attempts cannot exceed 10']
  },
  videoRecording: {
    type: Boolean,
    default: false
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