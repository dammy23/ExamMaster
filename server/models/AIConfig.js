const mongoose = require('mongoose');

console.log('Loading AIConfig model...');

const aiModelSchema = new mongoose.Schema({
  modelId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  provider: {
    type: String,
    required: true,
    enum: ['openai', 'anthropic', 'google', 'custom'],
    default: 'openai'
  },
  configuration: {
    apiKey: {
      type: String,
      trim: true
    },
    baseUrl: {
      type: String,
      trim: true
    },
    maxTokens: {
      type: Number,
      default: 4096
    },
    temperature: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 2
    },
    topP: {
      type: Number,
      default: 1,
      min: 0,
      max: 1
    }
  },
  pricing: {
    inputTokenPrice: {
      type: Number, // price per 1000 tokens
      default: 0
    },
    outputTokenPrice: {
      type: Number, // price per 1000 tokens
      default: 0
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const aiAgentSchema = new mongoose.Schema({
  agentId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  capabilities: [{
    type: String,
    trim: true
  }],
  systemPrompt: {
    type: String,
    required: true,
    trim: true
  },
  welcomeMessage: {
    type: String,
    trim: true,
    default: "Hello! How can I assist you today?"
  },
  category: {
    type: String,
    enum: ['exam-management', 'student-support', 'content-creation', 'data-analysis', 'general'],
    default: 'general'
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better performance
aiModelSchema.index({ modelId: 1 });
aiModelSchema.index({ provider: 1 });
aiModelSchema.index({ isActive: 1, isDeleted: 1 });

aiAgentSchema.index({ agentId: 1 });
aiAgentSchema.index({ category: 1 });
aiAgentSchema.index({ isActive: 1, isDeleted: 1 });
aiAgentSchema.index({ priority: -1 });

// Static methods for AIModel
aiModelSchema.statics.findActive = function(filter = {}) {
  console.log('Finding active AI models with filter:', filter);
  return this.find({ ...filter, isActive: true, isDeleted: false });
};

aiModelSchema.statics.getByProvider = function(provider) {
  console.log(`Getting AI models for provider: ${provider}`);
  return this.findActive({ provider });
};

// Static methods for AIAgent
aiAgentSchema.statics.findActive = function(filter = {}) {
  console.log('Finding active AI agents with filter:', filter);
  return this.find({ ...filter, isActive: true, isDeleted: false })
    .sort({ priority: -1, name: 1 });
};

aiAgentSchema.statics.getByCategory = function(category) {
  console.log(`Getting AI agents for category: ${category}`);
  return this.findActive({ category });
};

// Instance method for soft delete
aiModelSchema.methods.softDelete = function() {
  console.log(`Soft deleting AI model: ${this.modelId}`);
  this.isDeleted = true;
  return this.save();
};

aiAgentSchema.methods.softDelete = function() {
  console.log(`Soft deleting AI agent: ${this.agentId}`);
  this.isDeleted = true;
  return this.save();
};

// Pre-save middleware for logging
aiModelSchema.pre('save', function(next) {
  if (this.isNew) {
    console.log(`Creating new AI model: ${this.modelId} (${this.name})`);
  } else {
    console.log(`Updating AI model: ${this.modelId}`);
  }
  next();
});

aiAgentSchema.pre('save', function(next) {
  if (this.isNew) {
    console.log(`Creating new AI agent: ${this.agentId} (${this.name})`);
  } else {
    console.log(`Updating AI agent: ${this.agentId}`);
  }
  next();
});

// Error handling middleware
aiModelSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('Error saving AI model:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      error.message = messages.join(', ');
    }
  }
  next(error);
});

aiAgentSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('Error saving AI agent:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      error.message = messages.join(', ');
    }
  }
  next(error);
});

const AIModel = mongoose.model('AIModel', aiModelSchema);
const AIAgent = mongoose.model('AIAgent', aiAgentSchema);

console.log('AIConfig models (AIModel, AIAgent) loaded successfully');

module.exports = {
  AIModel,
  AIAgent
};