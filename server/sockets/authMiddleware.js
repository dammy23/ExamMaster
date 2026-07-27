const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function socketAuthMiddleware(socket, next) {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user._id.toString();
    socket.userRole = user.role;
    next();
  } catch (error) {
    next(new Error('Invalid or expired token'));
  }
};
