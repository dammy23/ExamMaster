const jwt = require('jsonwebtoken');

const generateAccessToken = (userId) => {
  console.log('Generating access token for user:', userId);
  console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
  
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: '1h' }
  );
};

const generateRefreshToken = (userId) => {
  console.log('Generating refresh token for user:', userId);
  console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
  
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET, 
    { expiresIn: '7d' }
  );
};

module.exports = {
  generateAccessToken,
  generateRefreshToken
};