const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Setting name is required'],
    unique: true,
    trim: true,
    maxlength: [100, 'Setting name cannot exceed 100 characters']
  },
  value: {
    type: String,
    required: [true, 'Setting value is required'],
    maxlength: [1000, 'Setting value cannot exceed 1000 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  }
}, {
  timestamps: true,
  versionKey: false
});

// Index for efficient querying (name already indexed via unique: true)

const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting;