const { randomUUID } = require('crypto');

const User = require('../models/User.js');
const { hashPassword, comparePassword } = require('../utils/password.js');

class UserService {
  // Get all users
  static async getAllUsers() {
    try {
      console.log('UserService: Getting all users...');
      const users = await User.find().select('-password');
      console.log(`UserService: Found ${users.length} users`);
      return users;
    } catch (error) {
      console.error('UserService: Error getting all users:', error.message);
      throw new Error('Failed to retrieve users');
    }
  }

  // Get user by ID
  static async getUserById(userId) {
    try {
      console.log(`UserService: Getting user by ID: ${userId}`);
      const user = await User.findById(userId).select('-password');
      if (!user) {
        console.log(`UserService: User not found with ID: ${userId}`);
        throw new Error('User not found');
      }
      console.log(`UserService: Found user: ${user.email}`);
      return user;
    } catch (error) {
      console.error(`UserService: Error getting user by ID ${userId}:`, error.message);
      throw error;
    }
  }

  // Get user by email
  static async getUserByEmail(email) {
    try {
      console.log(`UserService: Getting user by email: ${email}`);
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        console.log(`UserService: Found user: ${user.email}, ID: ${user._id}, Role: ${user.role}`);
        console.log(`UserService: User has password: ${!!user.password}`);
      } else {
        console.log(`UserService: No user found with email: ${email}`);
      }
      return user;
    } catch (error) {
      console.error(`UserService: Error getting user by email ${email}:`, error.message);
      throw error;
    }
  }

  // Create new user
  static async createUser(userData) {
    try {
      console.log(`UserService: Creating user with email: ${userData.email}`);
      console.log(`UserService: User data:`, { ...userData, password: '[HIDDEN]' });

      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email.toLowerCase() });
      if (existingUser) {
        console.log(`UserService: User already exists with email: ${userData.email}`);
        throw new Error('User with this email already exists');
      }

      console.log(`UserService: Hashing password for user: ${userData.email}`);
      const hashedPassword = await hashPassword(userData.password);
      console.log(`UserService: Password hashed successfully, length: ${hashedPassword.length}`);

      const user = new User({
        name: userData.name,
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        role: userData.role
      });

      console.log(`UserService: Saving user to database: ${userData.email}`);
      const savedUser = await user.save();
      console.log(`UserService: User saved successfully with ID: ${savedUser._id}`);

      // Return user without password
      const userResponse = {
        _id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        role: savedUser.role,
        createdAt: savedUser.createdAt,
        updatedAt: savedUser.updatedAt
      };

      console.log(`UserService: User created successfully: ${userResponse.email}`);
      return userResponse;
    } catch (error) {
      console.error(`UserService: Error creating user ${userData.email}:`, error.message);
      console.error(`UserService: Full error:`, error);
      
      // Handle specific MongoDB errors
      if (error.code === 11000) {
        throw new Error('User with this email already exists');
      }
      
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw new Error(validationErrors.join(', '));
      }
      
      // Handle database connection errors
      if (error.message && error.message.includes('db already exists with different case')) {
        console.error('UserService: Database case mismatch error detected');
        throw new Error('Database configuration error. Please check database name casing.');
      }
      
      // Re-throw the original error to preserve validation details
      throw error;
    }
  }

  // Update user
  static async updateUser(userId, updateData) {
    try {
      console.log(`UserService: Updating user with ID: ${userId}`);
      
      if (updateData.password) {
        console.log(`UserService: Hashing new password for user: ${userId}`);
        updateData.password = await hashPassword(updateData.password);
      }

      if (updateData.email) {
        updateData.email = updateData.email.toLowerCase();
      }

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');

      if (!updatedUser) {
        console.log(`UserService: User not found for update with ID: ${userId}`);
        throw new Error('User not found');
      }

      console.log(`UserService: User updated successfully: ${updatedUser.email}`);
      return updatedUser;
    } catch (error) {
      console.error(`UserService: Error updating user ${userId}:`, error.message);
      throw error;
    }
  }

  // Delete user
  static async deleteUser(userId) {
    try {
      console.log(`UserService: Deleting user with ID: ${userId}`);
      
      const deletedUser = await User.findByIdAndDelete(userId);
      if (!deletedUser) {
        console.log(`UserService: User not found for deletion with ID: ${userId}`);
        throw new Error('User not found');
      }

      console.log(`UserService: User deleted successfully: ${deletedUser.email}`);
      return { message: 'User deleted successfully' };
    } catch (error) {
      console.error(`UserService: Error deleting user ${userId}:`, error.message);
      throw error;
    }
  }

  // Validate password
  static async validatePassword(plainPassword, hashedPassword) {
    try {
      console.log(`UserService: Validating password...`);
      console.log(`UserService: Plain password provided: ${!!plainPassword}`);
      console.log(`UserService: Hashed password provided: ${!!hashedPassword}`);
      console.log(`UserService: Hashed password length: ${hashedPassword ? hashedPassword.length : 0}`);
      
      const isValid = await comparePassword(plainPassword, hashedPassword);
      console.log(`UserService: Password validation result: ${isValid}`);
      return isValid;
    } catch (error) {
      console.error('UserService: Error validating password:', error.message);
      return false;
    }
  }
}

module.exports = UserService;