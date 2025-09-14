const mongoose = require('mongoose');

const studentGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Group name is required'],
    trim: true,
    unique: true,
    minlength: [2, 'Group name must be at least 2 characters long'],
    maxlength: [100, 'Group name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  studentCount: {
    type: Number,
    default: 0,
    min: [0, 'Student count cannot be negative']
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true,
  versionKey: false
});

// Pre-save middleware to calculate student count
studentGroupSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('name')) {
    try {
      const User = mongoose.model('User');
      const count = await User.countDocuments({ 
        group: this.name, 
        role: 'student' 
      });
      this.studentCount = count;
    } catch (error) {
      console.error('Error calculating student count:', error);
    }
  }
  next();
});

const StudentGroup = mongoose.model('StudentGroup', studentGroupSchema);

module.exports = StudentGroup;