const express = require('express');
const UserService = require('../services/userService.js');
const { generateAccessToken, generateRefreshToken } = require('../utils/auth.js');
const { requireUser } = require('./middleware/auth.js');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const emailService = require('../services/emailService.js');

const router = express.Router();

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`=== LOGIN ATTEMPT ===`);
    console.log(`Email: ${email}`);
    console.log(`Password provided: ${!!password}`);
    console.log(`Request body:`, { email, password: password ? '[PROVIDED]' : '[MISSING]' });

    if (!email || !password) {
      console.log('Login failed: Missing email or password');
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    console.log(`Attempting to find user with email: ${email}`);
    let user = await UserService.getUserByEmail(email);

    if (!user) {
       user = await UserService.getUserByStudentId(email);

      if (!user) {
        console.log(`Login failed: User not found for email: ${email}`);
        return res.status(400).json({
          success: false,
          error: 'Email/Student ID or password is incorrect.'
        });
      }
    }

    console.log(user);
        
    const isValidPassword = await UserService.validatePassword(password, user.password);
    console.log(`Password validation result: ${isValidPassword}`);

    if (!isValidPassword) {
      console.log(`Login failed: Invalid password for email: ${email}`);
      return res.status(400).json({
        success: false,
        error: 'Email or password is incorrect'
      });
    }

    console.log(`Generating tokens for user: ${email}`);
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    console.log(`Tokens generated successfully for user: ${email}`);
    console.log(`Access token length: ${accessToken.length}`);
    console.log(`Refresh token length: ${refreshToken.length}`);

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    console.log(`Login successful for user: ${email}`);
    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: userResponse
      }
    });
  } catch (error) {
    console.error(`Login error for email ${req.body.email}:`, error.message);
    console.error(`Login error stack:`, error.stack);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Register route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    console.log(`=== REGISTRATION ATTEMPT ===`);
    console.log(`Name: ${name}, Email: ${email}, Role: ${role}`);

    if (!name || !email || !password || !role) {
      console.log('Registration failed: Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'All fields are required'
      });
    }

    if (!['admin', 'student'].includes(role)) {
      console.log(`Registration failed: Invalid role: ${role}`);
      return res.status(400).json({
        success: false,
        error: 'Role must be either admin or student'
      });
    }

    console.log(`Checking if user exists with email: ${email}`);
    const existingUser = await UserService.getUserByEmail(email);
    if (existingUser) {
      console.log(`Registration failed: User already exists with email: ${email}`);
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    console.log(`Creating new user with email: ${email}`);
    const user = await UserService.createUser({ name, email, password, role });

    console.log(`Generating access token for new user: ${email}`);
    const accessToken = generateAccessToken(user._id);

    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    console.log(`Registration successful for user: ${email}`);
    return res.status(201).json({
      success: true,
      data: {
        accessToken,
        user: userResponse
      }
    });
  } catch (error) {
    console.error(`Registration error for email ${req.body.email}:`, error.message);
    console.error(`Registration error stack:`, error.stack);

    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: validationErrors.join(', ')
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Handle other known errors
    if (error.message.includes('User with this email already exists')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Forgot password route
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    console.log(`=== FORGOT PASSWORD REQUEST === Email: ${email}`);

    const genericResponse = {
      success: true,
      message: 'If that email exists, a password reset link has been sent.'
    };

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const user = await UserService.getUserByEmail(email);
    if (!user) {
      console.log(`Forgot password: no user found for ${email} (returning generic response)`);
      return res.status(200).json(genericResponse);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await UserService.updateUser(user._id, {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: expires
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetLink = `${clientUrl}/reset-password/${rawToken}`;
    console.log(`Forgot password: reset link for ${email}: ${resetLink}`);

    try {
      await emailService.sendPasswordReset(user.email, user.name, resetLink);
    } catch (emailError) {
      console.error(`Forgot password: email send failed (link is still valid, logged above):`, emailError.message);
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Reset password route
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    console.log(`=== RESET PASSWORD ATTEMPT ===`);

    if (!token || !password) {
      return res.status(400).json({ success: false, error: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await UserService.getUserByResetToken(hashedToken);

    if (!user) {
      return res.status(400).json({ success: false, error: 'Reset link is invalid or has expired' });
    }

    await UserService.updateUser(user._id, {
      password,
      resetPasswordToken: null,
      resetPasswordExpires: null
    });

    console.log(`Reset password: success for user ${user.email}`);
    return res.status(200).json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Refresh token route
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    console.log(`=== TOKEN REFRESH ATTEMPT ===`);
    console.log(`Refresh token provided: ${!!refreshToken}`);

    if (!refreshToken) {
      console.log('Token refresh failed: No refresh token provided');
      return res.status(401).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    console.log('Verifying refresh token...');
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    console.log(`Refresh token verified for user ID: ${decoded.userId}`);

    const user = await UserService.getUserById(decoded.userId);
    if (!user) {
      console.log(`Token refresh failed: User not found for ID: ${decoded.userId}`);
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log(`Generating new tokens for user: ${user.email}`);
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    console.log(`Token refresh successful for user: ${user.email}`);
    return res.status(200).json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error.message);
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired refresh token'
    });
  }
});

// Logout route
router.post('/logout', requireUser, async (req, res) => {
  try {
    console.log(`=== LOGOUT ATTEMPT ===`);
    console.log(`User: ${req.user.email}`);

    console.log(`Logout successful for user: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error(`Logout error for user ${req.user?.email}:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get current user
router.get('/me', requireUser, async (req, res) => {
  try {
    console.log(`=== GET CURRENT USER ===`);
    console.log(`User: ${req.user.email}`);

    const userResponse = {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role
    };

    console.log(`Current user retrieved: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      user: userResponse
    });
  } catch (error) {
    console.error(`Get current user error for user ${req.user?.email}:`, error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;