const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Configure multer for video uploads
const videoStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadDir = path.join(__dirname, '../uploads/videos');
      
      // Create directory if it doesn't exist
      await fs.mkdir(uploadDir, { recursive: true });
      console.log('Video upload directory ensured:', uploadDir);
      
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creating video upload directory:', error);
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    try {
      // Generate unique filename with timestamp and random hash
      const timestamp = Date.now();
      const randomHash = crypto.randomBytes(8).toString('hex');
      const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${timestamp}_${randomHash}_${sanitizedOriginalName}`;
      
      console.log('Generated video filename:', filename);
      cb(null, filename);
    } catch (error) {
      console.error('Error generating video filename:', error);
      cb(error, null);
    }
  }
});

// File filter for video uploads
const videoFileFilter = (req, file, cb) => {
  try {
    console.log('Video file filter check:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // Accept video files
    const allowedMimeTypes = [
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/avi',
      'video/mov',
      'video/quicktime'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      console.log('Video file accepted:', file.originalname);
      cb(null, true);
    } else {
      console.log('Video file rejected - invalid type:', file.mimetype);
      cb(new Error('Invalid video file type. Allowed types: mp4, webm, ogg, avi, mov'), false);
    }
  } catch (error) {
    console.error('Error in video file filter:', error);
    cb(error, false);
  }
};

// Configure multer upload
const videoUpload = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for video files
    files: 1 // Only one file at a time
  }
});

/**
 * Generate a secure video URL for accessing uploaded videos
 * @param {string} filename - The video filename
 * @param {string} examId - The exam ID for security
 * @param {string} studentId - The student ID for security
 * @returns {string} Secure video URL
 */
const generateSecureVideoUrl = (filename, examId, studentId) => {
  try {
    if (!filename || !examId || !studentId) {
      throw new Error('Missing required parameters for video URL generation');
    }

    // Generate a secure token for video access
    const timestamp = Date.now();
    const token = crypto
      .createHash('sha256')
      .update(`${filename}_${examId}_${studentId}_${timestamp}`)
      .digest('hex');

    const videoUrl = `/api/exam-attempts/video/${examId}/${studentId}/${filename}?token=${token}&t=${timestamp}`;
    console.log('Generated secure video URL:', videoUrl);

    return videoUrl;
  } catch (error) {
    console.error('Error generating secure video URL:', error);
    throw new Error('Failed to generate secure video URL');
  }
};

/**
 * Validate video access token
 * @param {string} token - The access token to validate
 * @param {string} filename - The video filename
 * @param {string} examId - The exam ID
 * @param {string} studentId - The student ID
 * @param {string} timestamp - The timestamp from URL
 * @returns {boolean} True if token is valid
 */
const validateVideoAccessToken = (token, filename, examId, studentId, timestamp) => {
  try {
    if (!token || !filename || !examId || !studentId || !timestamp) {
      console.log('Video access validation failed - missing parameters');
      return false;
    }

    // Check if timestamp is not too old (24 hours)
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (tokenAge > maxAge) {
      console.log('Video access validation failed - token expired');
      return false;
    }

    // Regenerate expected token
    const expectedToken = crypto
      .createHash('sha256')
      .update(`${filename}_${examId}_${studentId}_${timestamp}`)
      .digest('hex');

    const isValid = token === expectedToken;
    console.log('Video access token validation result:', isValid);

    return isValid;
  } catch (error) {
    console.error('Error validating video access token:', error);
    return false;
  }
};

/**
 * Delete a video file from the filesystem
 * @param {string} filename - The video filename to delete
 * @returns {Promise<boolean>} True if deletion was successful
 */
const deleteVideoFile = async (filename) => {
  try {
    if (!filename) {
      throw new Error('Filename is required for video deletion');
    }

    const filePath = path.join(__dirname, '../uploads/videos', filename);
    
    // Check if file exists
    try {
      await fs.access(filePath);
      console.log('Video file found for deletion:', filePath);
    } catch (error) {
      console.log('Video file not found, skipping deletion:', filePath);
      return true; // Consider this successful as file doesn't exist
    }

    // Delete the file
    await fs.unlink(filePath);
    console.log('Video file deleted successfully:', filename);
    
    return true;
  } catch (error) {
    console.error('Error deleting video file:', error);
    return false;
  }
};

/**
 * Get video file information
 * @param {string} filename - The video filename
 * @returns {Promise<Object>} Video file information
 */
const getVideoFileInfo = async (filename) => {
  try {
    if (!filename) {
      throw new Error('Filename is required for video info');
    }

    const filePath = path.join(__dirname, '../uploads/videos', filename);
    const stats = await fs.stat(filePath);
    
    const fileInfo = {
      filename: filename,
      path: filePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      exists: true
    };

    console.log('Video file info retrieved:', fileInfo);
    return fileInfo;
  } catch (error) {
    console.error('Error getting video file info:', error);
    return {
      filename: filename,
      exists: false,
      error: error.message
    };
  }
};

module.exports = {
  videoUpload,
  generateSecureVideoUrl,
  validateVideoAccessToken,
  deleteVideoFile,
  getVideoFileInfo
};