const express = require('express');
const { requireUser } = require('./middleware/auth.js');
const StudentGroupService = require('../services/studentGroupService.js');

const router = express.Router();

// Get all student groups
router.get('/', requireUser, async (req, res) => {
  try {
    console.log('GET /api/students/groups - User:', req.user?.email);
    
    // Only allow admin users to access this endpoint
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }
    
    const groups = await StudentGroupService.getAllGroups();
    
    res.json({
      success: true,
      data: { groups }
    });
  } catch (error) {
    console.error('GET /api/students/groups error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific student group by ID
router.get('/:groupId', requireUser, async (req, res) => {
  try {
    console.log('GET /api/students/groups/:groupId - User:', req.user?.email, 'GroupID:', req.params.groupId);
    
    // Only allow admin users to access this endpoint
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }
    
    const group = await StudentGroupService.getGroupById(req.params.groupId);
    
    res.json({
      success: true,
      data: { group }
    });
  } catch (error) {
    console.error('GET /api/students/groups/:groupId error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new student group
router.post('/', requireUser, async (req, res) => {
  try {
    console.log('POST /api/students/groups - User:', req.user?.email);
    console.log('POST /api/students/groups - Request body:', req.body);
    
    // Only allow admin users to create groups
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }

    const { name, description, status } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Group name is required'
      });
    }
    
    const groupData = {
      name: name.trim(),
      description: description ? description.trim() : '',
      status: status || 'active'
    };
    
    const group = await StudentGroupService.createGroup(groupData);
    
    res.status(201).json({
      success: true,
      data: { group }
    });
  } catch (error) {
    console.error('POST /api/students/groups error:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update student group
router.put('/:groupId', requireUser, async (req, res) => {
  try {
    console.log('PUT /api/students/groups/:groupId - User:', req.user?.email, 'GroupID:', req.params.groupId);
    console.log('PUT /api/students/groups/:groupId - Request body:', req.body);
    
    // Only allow admin users to update groups
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }
    
    const updateData = { ...req.body };
    if (updateData.name) {
      updateData.name = updateData.name.trim();
    }
    if (updateData.description) {
      updateData.description = updateData.description.trim();
    }
    
    const group = await StudentGroupService.updateGroup(req.params.groupId, updateData);
    
    res.json({
      success: true,
      data: { group }
    });
  } catch (error) {
    console.error('PUT /api/students/groups/:groupId error:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
});

// Delete student group
router.delete('/:groupId', requireUser, async (req, res) => {
  try {
    console.log('DELETE /api/students/groups/:groupId - User:', req.user?.email, 'GroupID:', req.params.groupId);
    
    // Only allow admin users to delete groups
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }
    
    const result = await StudentGroupService.deleteGroup(req.params.groupId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('DELETE /api/students/groups/:groupId error:', error);
    res.status(error.message.includes('not found') ? 404 : 400).json({
      success: false,
      error: error.message
    });
  }
});

// Get students in a specific group
router.get('/:groupId/students', requireUser, async (req, res) => {
  try {
    console.log('GET /api/students/groups/:groupId/students - User:', req.user?.email, 'GroupID:', req.params.groupId);
    
    // Only allow admin users to access this endpoint
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }
    
    // First get the group to validate it exists and get the name
    const group = await StudentGroupService.getGroupById(req.params.groupId);
    const students = await StudentGroupService.getStudentsInGroup(group.name);
    
    res.json({
      success: true,
      data: { students }
    });
  } catch (error) {
    console.error('GET /api/students/groups/:groupId/students error:', error);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;