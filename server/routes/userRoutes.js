const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const { requireUser } = require('./middleware/auth.js');
const UserService = require('../services/userService.js');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/tmp/'); // Use /tmp for temporary file storage
  },
  filename: function (req, file, cb) {
    cb(null, `upload-${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

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

// Get all students
router.get('/students', requireUser, async (req, res) => {
  try {
    console.log('GET /api/users/students - User:', req.user?.email);
    
    // Only allow admin users to access this endpoint
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }
    
    const students = await UserService.getAllStudents();
    
    res.json({
      success: true,
      data: { students }
    });
  } catch (error) {
    console.error('GET /api/users/students error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk upload users from CSV
router.post('/bulk-upload', requireUser, upload.single('file'), async (req, res) => {
  try {
    console.log('POST /api/users/bulk-upload - User:', req.user?.email);
    
    // Only allow admin users to bulk upload
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    console.log('Processing CSV file:', req.file.originalname);
    
    const users = [];
    const filePath = req.file.path;
    
    // Parse CSV file
    const parseCSV = () => {
      return new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on('data', (data) => {
            // Normalize column names (convert to lowercase and remove spaces)
            const normalizedData = {};
            Object.keys(data).forEach(key => {
              const normalizedKey = key.toLowerCase().replace(/\s+/g, '');
              normalizedData[normalizedKey] = data[key].trim();
            });
            
            // Map CSV columns to user fields
            const userData = {
              name: normalizedData.name || normalizedData.fullname,
              email: normalizedData.email || normalizedData.emailaddress,
              password: normalizedData.password || normalizedData.defaultpassword || 'defaultpass123',
              role: normalizedData.role || 'student',
              studentId: normalizedData.studentid || normalizedData.id,
              group: normalizedData.group || normalizedData.class,
              enrollmentDate: normalizedData.enrollmentdate || normalizedData.joindate,
              status: normalizedData.status || 'active'
            };
            
            users.push(userData);
          })
          .on('end', () => {
            console.log(`Parsed ${users.length} users from CSV`);
            resolve();
          })
          .on('error', (error) => {
            console.error('Error parsing CSV:', error);
            reject(error);
          });
      });
    };

    await parseCSV();
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid user data found in CSV file'
      });
    }
    
    // Bulk create users
    const result = await UserService.bulkCreateUsers(users);
    
    res.status(201).json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('POST /api/users/bulk-upload error:', error);
    
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// Get all users (admin only)
router.get('/', requireUser, async (req, res) => {
  try {
    console.log('GET /api/users - User:', req.user?.email);
    
    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Admin role required.'
      });
    }
    
    const users = await UserService.getAllUsers();
    
    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    console.error('GET /api/users error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;