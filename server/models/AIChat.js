const mongoose = require('mongoose');

console.log('Loading AIChat model...');

const aiChatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxLength: 5000
  },
  response: {
    type: String,
    required: true,
    trim: true
  },
  modelId: {
    type: String,
    required: true,
    trim: true
  },
  agentId: {
    type: String,
    required: true,
    trim: true
  },
  fileAttachment: {
    fileName: {
      type: String,
      trim: true
    },
    fileUrl: {
      type: String,
      trim: true
    },
    fileSize: {
      type: Number
    },
    mimeType: {
      type: String,
      trim: true
    }
  },
  metadata: {
    processingTime: {
      type: Number // milliseconds
    },
    tokenCount: {
      input: Number,
      output: Number
    },
    cost: {
      type: Number // in cents or currency unit
    }
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
aiChatSchema.index({ userId: 1, createdAt: -1 });
aiChatSchema.index({ modelId: 1 });
aiChatSchema.index({ agentId: 1 });
aiChatSchema.index({ isDeleted: 1 });

// Virtual for response time
aiChatSchema.virtual('responseTimeFormatted').get(function() {
  if (this.metadata?.processingTime) {
    return `${(this.metadata.processingTime / 1000).toFixed(2)}s`;
  }
  return 'N/A';
});

// Instance method to mark as deleted (soft delete)
aiChatSchema.methods.softDelete = function() {
  console.log(`Soft deleting AI chat message: ${this._id}`);
  this.isDeleted = true;
  return this.save();
};

// Static method to find active chats
aiChatSchema.statics.findActive = function(filter = {}) {
  console.log('Finding active AI chat messages with filter:', filter);
  return this.find({ ...filter, isDeleted: false });
};

// Static method to get chat history for a user
aiChatSchema.statics.getChatHistory = function(userId, options = {}) {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;
  
  console.log(`Getting chat history for user ${userId}, page ${page}, limit ${limit}`);
  
  return this.findActive({ userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('userId', 'email name role')
    .lean();
};

// Pre-save middleware for logging
aiChatSchema.pre('save', function(next) {
  if (this.isNew) {
    console.log(`Creating new AI chat message for user: ${this.userId}, model: ${this.modelId}, agent: ${this.agentId}`);
  } else {
    console.log(`Updating AI chat message: ${this._id}`);
  }
  next();
});

// Pre-remove middleware for logging
aiChatSchema.pre('remove', function(next) {
  console.log(`Removing AI chat message: ${this._id}`);
  next();
});

// Error handling middleware
aiChatSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('Error saving AI chat message:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      error.message = messages.join(', ');
    }
  }
  next(error);
});

const AIChat = mongoose.model('AIChat', aiChatSchema);

console.log('AIChat model loaded successfully');

module.exports = AIChat;