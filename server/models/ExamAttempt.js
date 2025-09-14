const mongoose = require('mongoose');

const examAttemptSchema = new mongoose.Schema({
  examId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: {
    type: Map,
    of: mongoose.Schema.Types.Mixed, // Can store string or array of strings
    default: new Map()
  },
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  timeSpent: {
    type: Number, // in minutes
    default: 0
  },
  score: {
    type: Number,
    min: 0
  },
  percentage: {
    type: Number,
    min: 0,
    max: 100
  },
  status: {
    type: String,
    enum: ['in-progress', 'completed', 'submitted'],
    default: 'in-progress'
  },
  flaggedQuestions: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  tabSwitches: {
    type: Number,
    default: 0
  },
  activityLog: [{
    activity: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  versionKey: false
});

// Index for better query performance
examAttemptSchema.index({ examId: 1, studentId: 1 });
examAttemptSchema.index({ studentId: 1, createdAt: -1 });

// Ensure one active attempt per student per exam
examAttemptSchema.index(
  { examId: 1, studentId: 1, status: 1 },
  { 
    unique: true,
    partialFilterExpression: { status: 'in-progress' }
  }
);

const ExamAttempt = mongoose.model('ExamAttempt', examAttemptSchema);

module.exports = ExamAttempt;