const express = require('express');
const SeedService = require('../services/seedService.js');

const router = express.Router();

// Create initial admin user - NO AUTH REQUIRED
router.post('/admin', async (req, res) => {
  try {
    console.log('=== SEEDING ADMIN USER REQUEST ===');
    console.log('Request received at:', new Date().toISOString());

    const result = await SeedService.createAdminUser();

    console.log('Admin user seeded successfully:', result);
    return res.status(201).json({
      success: true,
      message: result.message,
      user: result.user
    });
  } catch (error) {
    console.error('Error seeding admin user:', error.message);
    console.error('Error stack:', error.stack);

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create sample student users - NO AUTH REQUIRED
router.post('/students', async (req, res) => {
  try {
    console.log('=== SEEDING STUDENT USERS REQUEST ===');
    console.log('Request received at:', new Date().toISOString());

    const result = await SeedService.createSampleStudents();

    console.log('Student users seeded successfully:', result);
    return res.status(201).json({
      success: true,
      message: result.message,
      users: result.users
    });
  } catch (error) {
    console.error('Error seeding student users:', error.message);
    console.error('Error stack:', error.stack);

    if (error.message.includes('already exist')) {
      return res.status(409).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;