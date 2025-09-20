const express = require('express');
const multer = require('multer');
const path = require('path');
const { requireUser } = require('./middleware/auth');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/images/'));
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random number
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    cb(null, 'image-' + uniqueSuffix + fileExtension);
  }
});

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, JPG, PNG, GIF, and WebP images are allowed.'), false);
  }
};

// Configure multer with file size limit (5MB)
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Description: Upload an image file for use in WYSIWYG editor
// Endpoint: POST /api/upload/image
// Request: FormData with 'image' field containing the image file
// Response: { success: boolean, imageUrl: string, message: string }
router.post('/image', requireUser, upload.single('image'), async (req, res) => {
  try {
    console.log('Image upload request received from user:', req.user.email);

    if (!req.file) {
      console.log('No file received in upload request');
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    console.log('Image uploaded successfully:', {
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Generate the image URL
    const imageUrl = `/uploads/images/${req.file.filename}`;

    res.status(200).json({
      success: true,
      imageUrl: imageUrl,
      message: 'Image uploaded successfully'
    });

  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload image'
    });
  }
});

// Handle multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error);

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size allowed is 5MB.'
      });
    }

    return res.status(400).json({
      success: false,
      message: 'File upload error: ' + error.message
    });
  }

  if (error) {
    console.error('Upload error:', error);
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }

  next();
});

module.exports = router;