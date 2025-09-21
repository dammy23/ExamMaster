const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Utility functions for generating and verifying secure download tokens
 */

// Generate a secure download token that expires after a short time
const generateDownloadToken = (userId, filename, expiresInMinutes = 10) => {
  try {
    console.log(`Generating download token for user ${userId}, file: ${filename}`);

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not found in environment variables');
    }

    const payload = {
      userId,
      filename,
      type: 'download',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (expiresInMinutes * 60) // Token expires in specified minutes
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET);
    console.log(`Download token generated successfully for user ${userId}`);

    return token;
  } catch (error) {
    console.error('Error generating download token:', error.message);
    throw new Error('Failed to generate download token');
  }
};

// Verify and decode a download token
const verifyDownloadToken = (token) => {
  try {
    console.log('Verifying download token');

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET not found in environment variables');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Additional validation for download tokens
    if (decoded.type !== 'download') {
      throw new Error('Invalid token type');
    }

    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      throw new Error('Token has expired');
    }

    console.log(`Download token verified successfully for user ${decoded.userId}, file: ${decoded.filename}`);
    return decoded;
  } catch (error) {
    console.error('Download token verification failed:', error.message);
    throw new Error('Invalid or expired download token');
  }
};

// Generate a secure one-time download URL
const generateSecureDownloadUrl = (userId, filename, baseUrl = '') => {
  try {
    const token = generateDownloadToken(userId, filename);
    const downloadUrl = `${baseUrl}/api/reports/download/${filename}?token=${token}`;

    console.log(`Secure download URL generated for file: ${filename}`);
    return downloadUrl;
  } catch (error) {
    console.error('Error generating secure download URL:', error.message);
    throw error;
  }
};

module.exports = {
  generateDownloadToken,
  verifyDownloadToken,
  generateSecureDownloadUrl
};