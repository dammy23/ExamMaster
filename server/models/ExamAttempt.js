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
    enum: ['in-progress', 'completed', 'submitted', 'pending-review'],
    default: 'in-progress'
  },
  flaggedQuestions: [{
    type: mongoose.Schema.Types.ObjectId
  }],
  selectedQuestions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Question'
  }],
  optionOrders: {
    type: Map,
    of: [String],
    default: new Map()
  },
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
  }],
  attemptNumber: {
    type: Number,
    default: 1,
    min: [1, 'Attempt number must be at least 1']
  },
  videoRecording: {
    enabled: {
      type: Boolean,
      default: false
    },
    videoUrl: {
      type: String,
      trim: true
    },
    recordingStartTime: {
      type: Date
    },
    recordingEndTime: {
      type: Date
    },
    recordingStatus: {
      type: String,
      enum: ['not_started', 'recording', 'completed', 'failed'],
      default: 'not_started'
    },
    fileSize: {
      type: Number, // in bytes
      min: 0
    },
    reviewed: {
      type: Boolean,
      default: false
    },
    reviewedAt: {
      type: Date
    }
  },
  aiGradingResults: {
    totalScore: {
      type: Number,
      min: 0
    },
    totalMaxScore: {
      type: Number,
      min: 0
    },
    results: [{
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
      },
      score: {
        type: Number,
        min: 0
      },
      maxScore: {
        type: Number,
        min: 0
      },
      feedback: {
        type: String,
        trim: true
      },
      aiPlatform: {
        type: String,
        trim: true
      },
      error: {
        type: Boolean,
        default: false
      },
      gradedAt: {
        type: Date,
        default: Date.now
      }
    }],
    gradedAt: {
      type: Date
    }
  },
  manualGradingResults: {
    totalScore: {
      type: Number,
      min: 0
    },
    totalMaxScore: {
      type: Number,
      min: 0
    },
    results: [{
      questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
      },
      score: {
        type: Number,
        min: 0
      },
      maxScore: {
        type: Number,
        min: 0
      },
      feedback: {
        type: String,
        trim: true
      },
      gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      gradedAt: {
        type: Date,
        default: Date.now
      }
    }],
    gradedAt: {
      type: Date
    }
  }
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

// Ensure unique attempt number per student per exam
examAttemptSchema.index(
  { examId: 1, studentId: 1, attemptNumber: 1 },
  { unique: true }
);

const ExamAttempt = mongoose.model('ExamAttempt', examAttemptSchema);

module.exports = ExamAttempt;