const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Subject name is required'],
    trim: true,
    minlength: [2, 'Subject name must be at least 2 characters long'],
    maxlength: [100, 'Subject name cannot exceed 100 characters'],
    unique: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  code: {
    type: String,
    required: [true, 'Subject code is required'],
    trim: true,
    minlength: [2, 'Subject code must be at least 2 characters long'],
    maxlength: [20, 'Subject code cannot exceed 20 characters'],
    unique: true,
    uppercase: true
  },
  isActive: {
    type: Boolean,
    default: true
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
subjectSchema.index({ name: 1 });
subjectSchema.index({ code: 1 });
subjectSchema.index({ isActive: 1 });
subjectSchema.index({ createdBy: 1 });

// Pre-save middleware to convert code to uppercase
subjectSchema.pre('save', function(next) {
  if (this.code) {
    this.code = this.code.toUpperCase();
  }
  next();
});

const Subject = mongoose.model('Subject', subjectSchema);

module.exports = Subject;