const jwt = require('jsonwebtoken');
const User = require('../../models/User');

const requireUser = async (req, res, next) => {
  try {
    console.log('Auth middleware - Headers received: Authorization header present');
    
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('Auth middleware - No valid authorization header');
      return res.status(401).json({ 
        success: false, 
        error: 'Access token required' 
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('Auth middleware - Token found, attempting to verify');

    if (!process.env.JWT_SECRET) {
      console.error('Auth middleware - JWT_SECRET not found in environment');
      return res.status(500).json({ 
        success: false, 
        error: 'Server configuration error' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Auth middleware - Token verified successfully for user ID:', decoded.userId);

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      console.log('Auth middleware - User not found for ID:', decoded.userId);
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    console.log('Auth middleware - User found:', user.email);
    req.user = user;
    next();
  } catch (error) {
    console.log('Auth middleware - Token verification failed:', error.message);
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    // First, check if user is authenticated
    await requireUser(req, res, () => {});
    
    if (!req.user) {
      console.log('Auth middleware - User not authenticated');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    // Check if user has admin role
    if (req.user.role !== 'admin') {
      console.log('Auth middleware - User is not admin. Role:', req.user.role);
      return res.status(403).json({ 
        success: false, 
        error: 'Admin access required' 
      });
    }

    console.log('Auth middleware - Admin access granted for user:', req.user.email);
    next();
  } catch (error) {
    console.error('Auth middleware - Admin check failed:', error.message);
    return res.status(403).json({ 
      success: false, 
      error: 'Admin access denied' 
    });
  }
};

module.exports = {
  requireUser,
  requireAdmin
};