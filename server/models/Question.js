const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['multiple-choice', 'true-false', 'short-answer'],
    required: true
  },
  question: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 1000
  },
  options: [{
    type: String,
    trim: true
  }],
  correctAnswers: [{
    type: String,
    required: true
  }],
  explanation: {
    type: String,
    trim: true,
    maxlength: 500
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    required: true
  },
  marks: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Validation for multiple choice questions
questionSchema.pre('save', function(next) {
  if (this.type === 'multiple-choice') {
    if (!this.options || this.options.length < 4) {
      return next(new Error('Multiple choice questions must have at least 4 options'));
    }
    if (this.options.length > 6) {
      return next(new Error('Multiple choice questions can have at most 6 options'));
    }
    if (!this.correctAnswers || this.correctAnswers.length === 0) {
      return next(new Error('Multiple choice questions must have at least one correct answer'));
    }
    // Validate that correct answers exist in options
    for (let correctAnswer of this.correctAnswers) {
      if (!this.options.includes(correctAnswer)) {
        return next(new Error('Correct answers must be from the provided options'));
      }
    }
  }
  
  if (this.type === 'true-false') {
    if (!this.correctAnswers || this.correctAnswers.length !== 1) {
      return next(new Error('True/false questions must have exactly one correct answer'));
    }
    if (!['true', 'false'].includes(this.correctAnswers[0].toLowerCase())) {
      return next(new Error('True/false questions must have "true" or "false" as correct answer'));
    }
  }
  
  if (this.type === 'short-answer') {
    if (!this.correctAnswers || this.correctAnswers.length === 0) {
      return next(new Error('Short answer questions must have at least one sample answer'));
    }
  }
  
  next();
});

// Index for better query performance
questionSchema.index({ difficulty: 1 });
questionSchema.index({ createdBy: 1 });
questionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Question', questionSchema);