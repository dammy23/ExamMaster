const express = require('express');
const SubjectService = require('../services/subjectService.js');
const { requireUser } = require('./middleware/auth.js');

const router = express.Router();

// Get all subjects
router.get('/', requireUser, async (req, res) => {
  try {
    console.log(`Getting all subjects for user: ${req.user.email}, role: ${req.user.role}`);

    const filters = {};
    
    if (req.query.isActive !== undefined) {
      filters.isActive = req.query.isActive === 'true';
    }
    
    if (req.query.search) {
      filters.search = req.query.search;
    }

    const subjects = await SubjectService.getAllSubjects(filters);

    console.log(`Found ${subjects.length} subjects for user: ${req.user.email}`);
    
    return res.status(200).json({
      success: true,
      subjects: subjects
    });
  } catch (error) {
    console.error(`Error getting subjects for user ${req.user.email}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get active subjects (for dropdowns)
router.get('/active', requireUser, async (req, res) => {
  try {
    console.log(`Getting active subjects for user: ${req.user.email}`);

    const subjects = await SubjectService.getActiveSubjects();

    console.log(`Found ${subjects.length} active subjects`);
    
    return res.status(200).json({
      success: true,
      subjects: subjects
    });
  } catch (error) {
    console.error(`Error getting active subjects for user ${req.user.email}:`, error.message);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get subject by ID
router.get('/:id', requireUser, async (req, res) => {
  try {
    console.log(`Getting subject by ID: ${req.params.id} for user: ${req.user.email}`);
    
    const subject = await SubjectService.getSubjectById(req.params.id);
    
    console.log(`Subject found: ${subject.name} (ID: ${subject._id})`);
    
    return res.status(200).json({
      success: true,
      subject: subject
    });
  } catch (error) {
    console.error(`Error getting subject by ID ${req.params.id} for user ${req.user.email}:`, error.message);
    
    const statusCode = error.message.includes('not found') || error.message.includes('Invalid') ? 404 : 500;
    
    return res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

// Create new subject (admin only)
router.post('/', requireUser, async (req, res) => {
  try {
    console.log(`Creating new subject for user: ${req.user.email}, role: ${req.user.role}`);
    console.log('Subject data:', req.body);

    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log(`User ${req.user.email} attempted to create subject without admin role`);
      return res.status(403).json({
        success: false,
        error: 'Only administrators can create subjects'
      });
    }
    
    const subject = await SubjectService.createSubject(req.body, req.user._id);
    
    console.log(`Subject created successfully: ${subject.name} (ID: ${subject._id})`);
    
    return res.status(201).json({
      success: true,
      subject: subject,
      message: 'Subject created successfully'
    });
  } catch (error) {
    console.error(`Error creating subject for user ${req.user.email}:`, error.message);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Update subject (admin only)
router.put('/:id', requireUser, async (req, res) => {
  try {
    console.log(`Updating subject ID: ${req.params.id} for user: ${req.user.email}, role: ${req.user.role}`);
    console.log('Update data:', req.body);

    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log(`User ${req.user.email} attempted to update subject without admin role`);
      return res.status(403).json({
        success: false,
        error: 'Only administrators can update subjects'
      });
    }
    
    const subject = await SubjectService.updateSubject(req.params.id, req.body, req.user._id);
    
    console.log(`Subject updated successfully: ${subject.name} (ID: ${subject._id})`);
    
    return res.status(200).json({
      success: true,
      subject: subject,
      message: 'Subject updated successfully'
    });
  } catch (error) {
    console.error(`Error updating subject ID ${req.params.id} for user ${req.user.email}:`, error.message);
    
    const statusCode = error.message.includes('not found') || error.message.includes('Invalid') ? 404 : 400;
    
    return res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

// Delete subject (admin only)
router.delete('/:id', requireUser, async (req, res) => {
  try {
    console.log(`Deleting subject ID: ${req.params.id} for user: ${req.user.email}, role: ${req.user.role}`);

    // Check if user is admin
    if (req.user.role !== 'admin') {
      console.log(`User ${req.user.email} attempted to delete subject without admin role`);
      return res.status(403).json({
        success: false,
        error: 'Only administrators can delete subjects'
      });
    }
    
    const result = await SubjectService.deleteSubject(req.params.id, req.user._id);
    
    console.log(`Subject deleted successfully: ID ${req.params.id}`);
    
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error(`Error deleting subject ID ${req.params.id} for user ${req.user.email}:`, error.message);
    
    const statusCode = error.message.includes('not found') || error.message.includes('Invalid') ? 404 : 500;
    
    return res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;