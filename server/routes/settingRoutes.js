const express = require('express');
const { requireUser } = require('./middleware/auth.js');
const SettingService = require('../services/settingService.js');

const router = express.Router();

// Get all settings (admin only)
router.get('/', requireUser, async (req, res) => {
  try {
    console.log('GET /api/settings - User:', req.user?.email);
    
    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }
    
    const settings = await SettingService.getAllSettings();
    
    res.json({
      success: true,
      data: { settings }
    });
  } catch (error) {
    console.error('GET /api/settings error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get setting by ID (admin only)
router.get('/:id', requireUser, async (req, res) => {
  try {
    console.log('GET /api/settings/:id - User:', req.user?.email);
    console.log('GET /api/settings/:id - Setting ID:', req.params.id);
    
    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }

    const settingId = req.params.id;
    if (!settingId) {
      return res.status(400).json({
        success: false,
        error: 'Setting ID is required'
      });
    }
    
    const setting = await SettingService.getSettingById(settingId);
    
    res.json({
      success: true,
      data: { setting }
    });
  } catch (error) {
    console.error('GET /api/settings/:id error:', error);
    
    if (error.message === 'Setting not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new setting (admin only)
router.post('/', requireUser, async (req, res) => {
  try {
    console.log('POST /api/settings - User:', req.user?.email);
    console.log('POST /api/settings - Request body:', req.body);
    
    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }

    const { name, value, description } = req.body;

    if (!name || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Name and value are required'
      });
    }
    
    const settingData = {
      name: name.trim(),
      value: String(value),
      description: description ? description.trim() : ''
    };
    
    const setting = await SettingService.createSetting(settingData);
    
    res.status(201).json({
      success: true,
      data: { setting }
    });
  } catch (error) {
    console.error('POST /api/settings error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update setting (admin only)
router.put('/:id', requireUser, async (req, res) => {
  try {
    console.log('PUT /api/settings/:id - User:', req.user?.email);
    console.log('PUT /api/settings/:id - Request body:', req.body);
    console.log('PUT /api/settings/:id - Setting ID to update:', req.params.id);
    
    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }

    const settingId = req.params.id;
    const updateData = req.body;

    if (!settingId) {
      return res.status(400).json({
        success: false,
        error: 'Setting ID is required'
      });
    }

    // Sanitize update data - only allow certain fields to be updated
    const allowedFields = ['name', 'value', 'description'];
    const sanitizedData = {};
    
    allowedFields.forEach(field => {
      if (updateData[field] !== undefined) {
        if (field === 'value') {
          sanitizedData[field] = String(updateData[field]);
        } else {
          sanitizedData[field] = typeof updateData[field] === 'string' ? updateData[field].trim() : updateData[field];
        }
      }
    });

    console.log('Sanitized update data:', sanitizedData);

    if (Object.keys(sanitizedData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields provided for update'
      });
    }
    
    const updatedSetting = await SettingService.updateSetting(settingId, sanitizedData);
    
    console.log('Setting updated successfully:', updatedSetting.name);
    
    res.json({
      success: true,
      data: { setting: updatedSetting }
    });
  } catch (error) {
    console.error('PUT /api/settings/:id error:', error);
    
    if (error.message === 'Setting not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete setting (admin only)
router.delete('/:id', requireUser, async (req, res) => {
  try {
    console.log('DELETE /api/settings/:id - User:', req.user?.email);
    console.log('DELETE /api/settings/:id - Setting ID to delete:', req.params.id);
    
    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }

    const settingId = req.params.id;

    if (!settingId) {
      return res.status(400).json({
        success: false,
        error: 'Setting ID is required'
      });
    }
    
    const result = await SettingService.deleteSetting(settingId);
    
    console.log('Setting deleted successfully:', result.setting.name);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('DELETE /api/settings/:id error:', error);
    
    if (error.message === 'Setting not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get setting by name (public endpoint for application use)
router.get('/name/:name', async (req, res) => {
  try {
    console.log('GET /api/settings/name/:name - Setting name:', req.params.name);
    
    const settingName = req.params.name;
    if (!settingName) {
      return res.status(400).json({
        success: false,
        error: 'Setting name is required'
      });
    }
    
    const setting = await SettingService.getSettingByName(settingName);
    
    if (!setting) {
      return res.status(404).json({
        success: false,
        error: 'Setting not found'
      });
    }
    
    res.json({
      success: true,
      data: { setting }
    });
  } catch (error) {
    console.error('GET /api/settings/name/:name error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;