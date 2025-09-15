const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const AIChatService = require('../services/aiChatService');
const { requireUser } = require('./middleware/auth');

console.log('Loading AI Chat Routes...');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/ai-chat');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'text/plain',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/json'
  ];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.log(`File type ${file.mimetype} not allowed`);
    cb(new Error('File type not allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// POST /api/ai-chat/message - Send message to AI
router.post('/message', requireUser, upload.single('fileAttachment'), async (req, res) => {
  console.log('AI Chat Routes - POST /message');
  console.log('Request body:', req.body);
  console.log('Uploaded file:', req.file ? req.file.filename : 'None');
  
  try {
    const { message, modelId, agentId } = req.body;
    const userId = req.user._id;
    
    // Validation
    if (!message || !message.trim()) {
      console.error('AI Chat Routes - Message is required');
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }
    
    if (!modelId || !agentId) {
      console.error('AI Chat Routes - Model ID and Agent ID are required');
      return res.status(400).json({
        success: false,
        error: 'Model ID and Agent ID are required'
      });
    }
    
    if (message.length > 5000) {
      console.error('AI Chat Routes - Message too long');
      return res.status(400).json({
        success: false,
        error: 'Message must be less than 5000 characters'
      });
    }
    
    // Prepare file attachment data if present
    let fileAttachment = null;
    if (req.file) {
      fileAttachment = {
        fileName: req.file.originalname,
        fileUrl: `/uploads/ai-chat/${req.file.filename}`,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      };
      console.log('AI Chat Routes - File attachment prepared:', fileAttachment);
    }
    
    // Process message through AI service
    const result = await AIChatService.sendMessage(userId, {
      message: message.trim(),
      modelId,
      agentId,
      fileAttachment
    });
    
    console.log('AI Chat Routes - Message processed successfully');
    
    res.json({
      success: true,
      data: {
        response: result.response,
        messageId: result.messageId,
        processingTime: result.processingTime,
        tokenCount: result.tokenCount
      }
    });
    
  } catch (error) {
    console.error('AI Chat Routes - Error processing message:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process AI chat message'
    });
  }
});

// GET /api/ai-chat/history - Get chat history
router.get('/history', requireUser, async (req, res) => {
  console.log('AI Chat Routes - GET /history');
  
  try {
    const userId = req.user._id;
    const { page = 1, limit = 50 } = req.query;
    
    console.log(`AI Chat Routes - Getting history for user ${userId}, page ${page}, limit ${limit}`);
    
    // Validate pagination parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    
    if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
      console.error('AI Chat Routes - Invalid pagination parameters');
      return res.status(400).json({
        success: false,
        error: 'Invalid pagination parameters'
      });
    }
    
    const result = await AIChatService.getChatHistory(userId, {
      page: pageNum,
      limit: limitNum
    });
    
    console.log(`AI Chat Routes - Retrieved ${result.messages.length} messages`);
    
    res.json({
      success: true,
      data: {
        messages: result.messages,
        page: pageNum,
        limit: limitNum
      }
    });
    
  } catch (error) {
    console.error('AI Chat Routes - Error getting chat history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get chat history'
    });
  }
});

// GET /api/ai-chat/models - Get available AI models
router.get('/models', requireUser, async (req, res) => {
  console.log('AI Chat Routes - GET /models');
  
  try {
    const result = await AIChatService.getModels();
    
    console.log(`AI Chat Routes - Retrieved ${result.models.length} AI models`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('AI Chat Routes - Error getting AI models:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AI models'
    });
  }
});

// GET /api/ai-chat/agents - Get available AI agents
router.get('/agents', requireUser, async (req, res) => {
  console.log('AI Chat Routes - GET /agents');
  
  try {
    const result = await AIChatService.getAgents();
    
    console.log(`AI Chat Routes - Retrieved ${result.agents.length} AI agents`);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('AI Chat Routes - Error getting AI agents:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AI agents'
    });
  }
});

// POST /api/ai-chat/upload - Upload file for AI context
router.post('/upload', requireUser, upload.single('file'), async (req, res) => {
  console.log('AI Chat Routes - POST /upload');
  console.log('Uploaded file:', req.file ? req.file.filename : 'None');
  
  try {
    if (!req.file) {
      console.error('AI Chat Routes - No file uploaded');
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }
    
    const userId = req.user._id;
    const { description } = req.body;
    
    const result = await AIChatService.uploadFile(userId, {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      filePath: req.file.path,
      description
    });
    
    console.log('AI Chat Routes - File uploaded successfully');
    
    res.json({
      success: true,
      data: {
        fileId: result.fileId,
        fileName: result.fileName,
        fileUrl: result.fileUrl
      }
    });
    
  } catch (error) {
    console.error('AI Chat Routes - Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
});

// Error handling middleware for multer errors
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 5MB.'
      });
    }
    
    return res.status(400).json({
      success: false,
      error: 'File upload error'
    });
  }
  
  if (error.message === 'File type not allowed') {
    return res.status(400).json({
      success: false,
      error: 'File type not allowed. Supported formats: TXT, PDF, DOC, DOCX, CSV, XLS, XLSX, JSON'
    });
  }
  
  next(error);
});

console.log('AI Chat Routes loaded successfully');

module.exports = router;