const express = require('express');
const { requireUser } = require('./middleware/auth.js');

const router = express.Router();

// Get current user profile
router.get('/me', requireUser, async (req, res) => {
  try {
    console.log(`Getting profile for user: ${req.user.email}`);
    console.log('User profile endpoint - Returning user data');
    return res.status(200).json({
      success: true,
      data: req.user
    });
  } catch (error) {
    console.error(`Error getting user profile: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

module.exports = router;