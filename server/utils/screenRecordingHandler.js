const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Configure multer for screen recording uploads
const screenStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadDir = path.join(__dirname, '../uploads/screen-recordings');
      await fs.mkdir(uploadDir, { recursive: true });
      console.log('Screen recording upload directory ensured:', uploadDir);
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creating screen recording upload directory:', error);
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    try {
      const timestamp = Date.now();
      const randomHash = crypto.randomBytes(8).toString('hex');
      const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${timestamp}_${randomHash}_${sanitizedOriginalName}`;
      console.log('Generated screen recording filename:', filename);
      cb(null, filename);
    } catch (error) {
      console.error('Error generating screen recording filename:', error);
      cb(error, null);
    }
  }
});

const screenFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/avi',
    'video/mov',
    'video/quicktime'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.log('Screen recording file rejected - invalid type:', file.mimetype);
    cb(new Error('Invalid video file type. Allowed types: mp4, webm, ogg, avi, mov'), false);
  }
};

// Screen recordings are typically larger/longer than webcam clips, so this cap
// is higher than videoHandler.js's 500MB webcam limit.
const screenUpload = multer({
  storage: screenStorage,
  fileFilter: screenFileFilter,
  limits: {
    fileSize: 1.5 * 1024 * 1024 * 1024, // 1.5GB limit for screen recordings
    files: 1
  }
});

const generateSecureScreenUrl = (filename, examId, studentId) => {
  if (!filename || !examId || !studentId) {
    throw new Error('Missing required parameters for screen recording URL generation');
  }

  const timestamp = Date.now();
  const token = crypto
    .createHash('sha256')
    .update(`${filename}_${examId}_${studentId}_${timestamp}`)
    .digest('hex');

  const url = `/api/exam-attempts/screen/${examId}/${studentId}/${filename}?token=${token}&t=${timestamp}`;
  console.log('Generated secure screen recording URL:', url);
  return url;
};

const validateScreenAccessToken = (token, filename, examId, studentId, timestamp) => {
  if (!token || !filename || !examId || !studentId || !timestamp) {
    console.log('Screen recording access validation failed - missing parameters');
    return false;
  }

  const tokenAge = Date.now() - parseInt(timestamp);
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  if (tokenAge > maxAge) {
    console.log('Screen recording access validation failed - token expired');
    return false;
  }

  const expectedToken = crypto
    .createHash('sha256')
    .update(`${filename}_${examId}_${studentId}_${timestamp}`)
    .digest('hex');

  return token === expectedToken;
};

const getScreenRecordingFileInfo = async (filename) => {
  try {
    if (!filename) {
      throw new Error('Filename is required for screen recording info');
    }

    const filePath = path.join(__dirname, '../uploads/screen-recordings', filename);
    const stats = await fs.stat(filePath);

    return {
      filename,
      path: filePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      exists: true
    };
  } catch (error) {
    console.error('Error getting screen recording file info:', error);
    return {
      filename,
      exists: false,
      error: error.message
    };
  }
};

module.exports = {
  screenUpload,
  generateSecureScreenUrl,
  validateScreenAccessToken,
  getScreenRecordingFileInfo
};
