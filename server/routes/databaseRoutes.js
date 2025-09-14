const express = require('express');
const DatabaseService = require('../services/databaseService.js');

const router = express.Router();

// Get database status - NO AUTH REQUIRED (for debugging)
router.get('/status', async (req, res) => {
  try {
    console.log('=== DATABASE STATUS REQUEST ===');
    console.log('Request received at:', new Date().toISOString());

    const status = await DatabaseService.checkDatabaseStatus();

    console.log('Database status retrieved successfully');
    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting database status:', error.message);
    console.error('Error stack:', error.stack);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clean up database - NO AUTH REQUIRED (for debugging/development)
router.post('/cleanup', async (req, res) => {
  try {
    console.log('=== DATABASE CLEANUP REQUEST ===');
    console.log('Request received at:', new Date().toISOString());

    const result = await DatabaseService.cleanupDatabase();

    console.log('Database cleanup completed successfully:', result);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error during database cleanup:', error.message);
    console.error('Error stack:', error.stack);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reset database - NO AUTH REQUIRED (for debugging/development)
router.post('/reset', async (req, res) => {
  try {
    console.log('=== DATABASE RESET REQUEST ===');
    console.log('Request received at:', new Date().toISOString());

    const result = await DatabaseService.resetDatabase();

    console.log('Database reset completed successfully:', result);
    return res.status(200).json({
      success: true,
      message: result.message,
      data: result
    });
  } catch (error) {
    console.error('Error during database reset:', error.message);
    console.error('Error stack:', error.stack);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;