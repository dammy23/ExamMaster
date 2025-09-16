const express = require('express');
const router = express.Router();
const AIPlatform = require('../models/AIPlatform');
const { requireUser, requireAdmin } = require('./middleware/auth');

console.log('Loading AI Platform Routes...');

// GET /api/ai-platforms - Get all AI platforms
router.get('/', requireUser, async (req, res) => {
  console.log('AI Platform Routes - GET /');
  
  try {
    const platforms = await AIPlatform.find({ isDeleted: { $ne: true } }).select('+configuration.apiKey');
    
    // For security, hide API keys from non-admin users
    const sanitizedPlatforms = platforms.map(platform => {
      const platformObj = platform.toObject();
      if (req.user.role !== 'admin') {
        delete platformObj.configuration.apiKey;
      }
      return platformObj;
    });
    
    console.log(`AI Platform Routes - Retrieved ${sanitizedPlatforms.length} platforms`);
    
    res.json({
      success: true,
      data: {
        platforms: sanitizedPlatforms
      }
    });
    
  } catch (error) {
    console.error('AI Platform Routes - Error getting platforms:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AI platforms'
    });
  }
});

// GET /api/ai-platforms/active - Get active AI platforms (for chat selection)
router.get('/active', requireUser, async (req, res) => {
  console.log('AI Platform Routes - GET /active');
  
  try {
    const platforms = await AIPlatform.findActive()
      .select('name displayName description configuration.model isDefault')
      .sort({ isDefault: -1, displayName: 1 });
    
    console.log(`AI Platform Routes - Retrieved ${platforms.length} active platforms`);
    
    res.json({
      success: true,
      data: {
        platforms
      }
    });
    
  } catch (error) {
    console.error('AI Platform Routes - Error getting active platforms:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get active AI platforms'
    });
  }
});

// GET /api/ai-platforms/:id - Get AI platform by ID
router.get('/:id', requireAdmin, async (req, res) => {
  console.log('AI Platform Routes - GET /:id');
  
  try {
    const platform = await AIPlatform.findById(req.params.id).select('+configuration.apiKey');
    
    if (!platform) {
      console.log(`AI Platform Routes - Platform not found: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        error: 'AI platform not found'
      });
    }
    
    console.log(`AI Platform Routes - Retrieved platform: ${platform.name}`);
    
    res.json({
      success: true,
      data: {
        platform
      }
    });
    
  } catch (error) {
    console.error('AI Platform Routes - Error getting platform:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AI platform'
    });
  }
});

// POST /api/ai-platforms - Create new AI platform
router.post('/', requireAdmin, async (req, res) => {
  console.log('AI Platform Routes - POST /');
  console.log('Request body:', { ...req.body, configuration: { ...req.body.configuration, apiKey: '[HIDDEN]' } });
  
  try {
    const { name, displayName, description, configuration, isActive, isDefault } = req.body;
    
    // Validation
    if (!name || !displayName || !configuration) {
      console.error('AI Platform Routes - Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Name, display name, and configuration are required'
      });
    }
    
    if (!['openai', 'anthropic', 'ollama'].includes(name)) {
      console.error('AI Platform Routes - Invalid platform name');
      return res.status(400).json({
        success: false,
        error: 'Platform name must be one of: openai, anthropic, ollama'
      });
    }
    
    const platform = new AIPlatform({
      name,
      displayName,
      description,
      configuration,
      isActive: isActive !== undefined ? isActive : true,
      isDefault: isDefault || false
    });
    
    await platform.save();
    
    console.log(`AI Platform Routes - Created platform: ${platform.name}`);
    
    res.status(201).json({
      success: true,
      data: {
        platform
      }
    });
    
  } catch (error) {
    console.error('AI Platform Routes - Error creating platform:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create AI platform'
    });
  }
});

// PUT /api/ai-platforms/:id - Update AI platform
router.put('/:id', requireAdmin, async (req, res) => {
  console.log('AI Platform Routes - PUT /:id');
  console.log('Request body:', { ...req.body, configuration: req.body.configuration ? { ...req.body.configuration, apiKey: '[HIDDEN]' } : undefined });
  
  try {
    const { displayName, description, configuration, isActive, isDefault } = req.body;
    
    const platform = await AIPlatform.findById(req.params.id);
    
    if (!platform) {
      console.log(`AI Platform Routes - Platform not found: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        error: 'AI platform not found'
      });
    }
    
    // Update fields
    if (displayName !== undefined) platform.displayName = displayName;
    if (description !== undefined) platform.description = description;
    if (configuration !== undefined) {
      platform.configuration = { ...platform.configuration, ...configuration };
    }
    if (isActive !== undefined) platform.isActive = isActive;
    if (isDefault !== undefined) platform.isDefault = isDefault;
    
    await platform.save();
    
    console.log(`AI Platform Routes - Updated platform: ${platform.name}`);
    
    res.json({
      success: true,
      data: {
        platform
      }
    });
    
  } catch (error) {
    console.error('AI Platform Routes - Error updating platform:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update AI platform'
    });
  }
});

// DELETE /api/ai-platforms/:id - Delete AI platform (soft delete)
router.delete('/:id', requireAdmin, async (req, res) => {
  console.log('AI Platform Routes - DELETE /:id');
  
  try {
    const platform = await AIPlatform.findById(req.params.id);
    
    if (!platform) {
      console.log(`AI Platform Routes - Platform not found: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        error: 'AI platform not found'
      });
    }
    
    // Prevent deletion of the last active platform
    const activePlatforms = await AIPlatform.findActive();
    if (activePlatforms.length === 1 && activePlatforms[0]._id.toString() === platform._id.toString()) {
      console.error('AI Platform Routes - Cannot delete the last active platform');
      return res.status(400).json({
        success: false,
        error: 'Cannot delete the last active AI platform'
      });
    }
    
    await platform.softDelete();
    
    // If this was the default platform, set another one as default
    if (platform.isDefault) {
      const newDefault = await AIPlatform.findOne({ isActive: true, isDeleted: false });
      if (newDefault) {
        newDefault.isDefault = true;
        await newDefault.save();
        console.log(`AI Platform Routes - Set new default platform: ${newDefault.name}`);
      }
    }
    
    console.log(`AI Platform Routes - Deleted platform: ${platform.name}`);
    
    res.json({
      success: true,
      data: {
        message: 'AI platform deleted successfully',
        platform: {
          _id: platform._id,
          name: platform.name,
          displayName: platform.displayName
        }
      }
    });
    
  } catch (error) {
    console.error('AI Platform Routes - Error deleting platform:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete AI platform'
    });
  }
});

// POST /api/ai-platforms/:id/test - Test AI platform configuration
router.post('/:id/test', requireAdmin, async (req, res) => {
  console.log('AI Platform Routes - POST /:id/test');
  
  try {
    const platform = await AIPlatform.findById(req.params.id).select('+configuration.apiKey');
    
    if (!platform) {
      console.log(`AI Platform Routes - Platform not found: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        error: 'AI platform not found'
      });
    }
    
    const testResult = await platform.test();
    
    console.log(`AI Platform Routes - Test result for ${platform.name}:`, testResult);
    
    res.json({
      success: true,
      data: {
        testResult,
        platform: {
          _id: platform._id,
          name: platform.name,
          testStatus: platform.testStatus,
          lastTested: platform.lastTested,
          testError: platform.testError
        }
      }
    });
    
  } catch (error) {
    console.error('AI Platform Routes - Error testing platform:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to test AI platform'
    });
  }
});

// POST /api/ai-platforms/:id/set-default - Set platform as default
router.post('/:id/set-default', requireAdmin, async (req, res) => {
  console.log('AI Platform Routes - POST /:id/set-default');
  
  try {
    const platform = await AIPlatform.findById(req.params.id);
    
    if (!platform) {
      console.log(`AI Platform Routes - Platform not found: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        error: 'AI platform not found'
      });
    }
    
    if (!platform.isActive) {
      console.error('AI Platform Routes - Cannot set inactive platform as default');
      return res.status(400).json({
        success: false,
        error: 'Cannot set inactive platform as default'
      });
    }
    
    platform.isDefault = true;
    await platform.save();
    
    console.log(`AI Platform Routes - Set default platform: ${platform.name}`);
    
    res.json({
      success: true,
      data: {
        message: 'Default platform updated successfully',
        platform: {
          _id: platform._id,
          name: platform.name,
          displayName: platform.displayName,
          isDefault: platform.isDefault
        }
      }
    });
    
  } catch (error) {
    console.error('AI Platform Routes - Error setting default platform:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set default platform'
    });
  }
});

// POST /api/ai-platforms/initialize - Initialize default platforms
router.post('/initialize', requireAdmin, async (req, res) => {
  console.log('AI Platform Routes - POST /initialize');
  
  try {
    await AIPlatform.createDefaults();
    
    const platforms = await AIPlatform.findActive();
    
    console.log(`AI Platform Routes - Initialized ${platforms.length} default platforms`);
    
    res.json({
      success: true,
      data: {
        message: 'Default AI platforms initialized successfully',
        platforms: platforms.length
      }
    });
    
  } catch (error) {
    console.error('AI Platform Routes - Error initializing platforms:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize default platforms'
    });
  }
});

console.log('AI Platform Routes loaded successfully');

module.exports = router;