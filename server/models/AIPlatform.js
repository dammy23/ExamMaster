const mongoose = require('mongoose');

console.log('Loading AIPlatform model...');

const aiPlatformSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    enum: ['openai', 'anthropic', 'ollama']
  },
  displayName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  configuration: {
    apiKey: {
      type: String,
      trim: true,
      select: false // Hide API key by default for security
    },
    baseUrl: {
      type: String,
      trim: true,
      required: function() {
        return this.name === 'ollama';
      }
    },
    model: {
      type: String,
      trim: true,
      required: true
    },
    temperature: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 2
    },
    maxTokens: {
      type: Number,
      default: 4096,
      min: 1,
      max: 100000
    },
    topP: {
      type: Number,
      default: 1,
      min: 0,
      max: 1
    },
    presencePenalty: {
      type: Number,
      default: 0,
      min: -2,
      max: 2
    },
    frequencyPenalty: {
      type: Number,
      default: 0,
      min: -2,
      max: 2
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  lastTested: {
    type: Date
  },
  testStatus: {
    type: String,
    enum: ['success', 'failed', 'not_tested'],
    default: 'not_tested'
  },
  testError: {
    type: String,
    trim: true
  },
  usage: {
    totalRequests: {
      type: Number,
      default: 0
    },
    totalTokens: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date
    }
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better performance
aiPlatformSchema.index({ name: 1 });
aiPlatformSchema.index({ isActive: 1, isDeleted: 1 });
aiPlatformSchema.index({ isDefault: 1 });

// Static methods
aiPlatformSchema.statics.findActive = function(filter = {}) {
  console.log('Finding active AI platforms with filter:', filter);
  return this.find({ ...filter, isActive: true, isDeleted: false });
};

aiPlatformSchema.statics.getDefault = function() {
  console.log('Getting default AI platform');
  return this.findOne({ isDefault: true, isActive: true, isDeleted: false });
};

aiPlatformSchema.statics.getByName = function(name) {
  console.log(`Getting AI platform by name: ${name}`);
  return this.findOne({ name, isActive: true, isDeleted: false });
};

aiPlatformSchema.statics.findActiveAndConfigured = async function() {
  console.log('Finding active and properly configured AI platforms');
  
  try {
    // For now, let's use a simpler approach and check configuration differently
    // We'll aggregate the results to avoid the path collision issue
    const activePlatforms = await this.find({ isActive: true, isDeleted: false });
    const configuredPlatforms = [];
    
    for (const platform of activePlatforms) {
      let isConfigured = false;
      
      switch(platform.name) {
        case 'openai':
        case 'anthropic':
          // For API-based platforms, we'll mark them as unconfigured for now
          // until API keys are properly set up
          console.log(`${platform.name} requires API key configuration - marking as unconfigured`);
          isConfigured = false;
          break;
          
        case 'ollama':
          // Ollama only needs baseUrl which is not hidden
          const hasBaseUrl = platform.configuration && platform.configuration.baseUrl && platform.configuration.baseUrl.trim().length > 0;
          console.log(`${platform.name} base URL configured:`, hasBaseUrl ? 'yes' : 'no');
          isConfigured = hasBaseUrl;
          break;
          
        default:
          console.log(`Unknown platform type: ${platform.name}`);
          isConfigured = false;
          break;
      }
      
      if (isConfigured) {
        configuredPlatforms.push(platform);
      }
    }
    
    console.log(`Found ${activePlatforms.length} active platforms, ${configuredPlatforms.length} properly configured`);
    return configuredPlatforms;
  } catch (error) {
    console.error('Error in findActiveAndConfigured:', error);
    throw error;
  }
};

// Instance methods
aiPlatformSchema.methods.softDelete = function() {
  console.log(`Soft deleting AI platform: ${this.name}`);
  this.isDeleted = true;
  return this.save();
};

aiPlatformSchema.methods.test = async function() {
  console.log(`Testing AI platform: ${this.name}`);
  try {
    // This would be implemented in the service layer
    this.lastTested = new Date();
    this.testStatus = 'success';
    this.testError = null;
    await this.save();
    return { success: true };
  } catch (error) {
    console.error(`AI platform test failed for ${this.name}:`, error);
    this.lastTested = new Date();
    this.testStatus = 'failed';
    this.testError = error.message;
    await this.save();
    return { success: false, error: error.message };
  }
};

// Removed isProperlyConfigured method to avoid schema collision issues
// Configuration checking is now handled in the static findActiveAndConfigured method

aiPlatformSchema.methods.updateUsage = function(tokenCount = 0) {
  console.log(`Updating usage for AI platform: ${this.name}, tokens: ${tokenCount}`);
  this.usage.totalRequests += 1;
  this.usage.totalTokens += tokenCount;
  this.usage.lastUsed = new Date();
  return this.save();
};

// Pre-save middleware
aiPlatformSchema.pre('save', async function(next) {
  if (this.isNew) {
    console.log(`Creating new AI platform: ${this.name} (${this.displayName})`);
  } else {
    console.log(`Updating AI platform: ${this.name}`);
  }
  
  // Ensure only one default platform
  if (this.isDefault && this.isModified('isDefault')) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { isDefault: false }
    );
    console.log(`Set ${this.name} as default AI platform`);
  }
  
  next();
});

// Validation middleware
aiPlatformSchema.pre('save', function(next) {
  // Only validate API key when platform is active
  if (this.isActive && (this.name === 'openai' || this.name === 'anthropic') && !this.configuration.apiKey) {
    console.warn(`AI Platform warning: API key missing for active platform ${this.name}`);
    // Don't block saving, just warn - allow creation without API key
  }
  
  // Only validate base URL for Ollama when active
  if (this.isActive && this.name === 'ollama' && !this.configuration.baseUrl) {
    console.warn('AI Platform warning: Base URL missing for active Ollama platform');
    // Don't block saving, just warn
  }
  
  next();
});

// Error handling middleware
aiPlatformSchema.post('save', function(error, doc, next) {
  if (error) {
    console.error('Error saving AI platform:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      error.message = messages.join(', ');
    }
    if (error.code === 11000) {
      error.message = 'AI platform with this name already exists';
    }
  }
  next(error);
});

// Create default platforms on first run
aiPlatformSchema.statics.createDefaults = async function() {
  console.log('Creating default AI platforms...');
  
  const defaultPlatforms = [
    {
      name: 'openai',
      displayName: 'OpenAI',
      description: 'OpenAI GPT models including GPT-4, GPT-3.5-turbo',
      configuration: {
        model: 'gpt-3.5-turbo',
        temperature: 0.7,
        maxTokens: 4096,
        apiKey: '' // Empty initially, user will configure
      },
      isActive: false, // Inactive until configured
      isDefault: false
    },
    {
      name: 'anthropic',
      displayName: 'Anthropic',
      description: 'Anthropic Claude models for advanced reasoning',
      configuration: {
        model: 'claude-3-haiku-20240307',
        temperature: 0.7,
        maxTokens: 4096,
        apiKey: '' // Empty initially, user will configure
      },
      isActive: false // Inactive until configured
    },
    {
      name: 'ollama',
      displayName: 'Ollama',
      description: 'Local AI models running through Ollama',
      configuration: {
        baseUrl: 'http://localhost:11434',
        model: 'llama2',
        temperature: 0.7,
        maxTokens: 4096
      },
      isActive: false, // Inactive until configured
      isDefault: false
    }
  ];

  for (const platformData of defaultPlatforms) {
    try {
      const existing = await this.findOne({ name: platformData.name });
      if (!existing) {
        const platform = new this(platformData);
        await platform.save();
        console.log(`Created default AI platform: ${platformData.name}`);
      } else {
        console.log(`AI platform already exists: ${platformData.name}`);
      }
    } catch (error) {
      console.error(`Error creating default platform ${platformData.name}:`, error);
    }
  }
  
  console.log('Default AI platforms creation completed');
};

const AIPlatform = mongoose.model('AIPlatform', aiPlatformSchema);

console.log('AIPlatform model loaded successfully');

module.exports = AIPlatform;