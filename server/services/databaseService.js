const mongoose = require('mongoose');
const User = require('../models/User.js');

class DatabaseService {
  // Clean up database by dropping collections
  static async cleanupDatabase() {
    try {
      console.log('DatabaseService: Starting database cleanup...');
      
      // Check if we're connected to database
      if (mongoose.connection.readyState !== 1) {
        console.log('DatabaseService: Not connected to database, skipping cleanup');
        return { message: 'Not connected to database' };
      }
      
      const db = mongoose.connection.db;
      const collections = await db.collections();
      
      console.log(`DatabaseService: Found ${collections.length} collections`);
      
      if (collections.length === 0) {
        console.log('DatabaseService: No collections found, nothing to clean');
        return { message: 'No collections to clean' };
      }
      
      // Drop all collections
      for (const collection of collections) {
        console.log(`DatabaseService: Dropping collection: ${collection.collectionName}`);
        await collection.drop();
        console.log(`DatabaseService: Collection dropped: ${collection.collectionName}`);
      }
      
      console.log('DatabaseService: Database cleanup completed successfully');
      return { 
        message: 'Database cleaned up successfully',
        collectionsDropped: collections.length
      };
    } catch (error) {
      console.error('DatabaseService: Error during cleanup:', error.message);
      console.error('DatabaseService: Full cleanup error:', error);
      throw error;
    }
  }
  
  // Reset database to initial state
  static async resetDatabase() {
    try {
      console.log('DatabaseService: Starting database reset...');
      
      // First cleanup existing data
      await this.cleanupDatabase();
      
      console.log('DatabaseService: Database reset completed successfully');
      return { message: 'Database reset completed' };
    } catch (error) {
      console.error('DatabaseService: Error during reset:', error.message);
      console.error('DatabaseService: Full reset error:', error);
      throw error;
    }
  }
  
  // Check database connection and status
  static async checkDatabaseStatus() {
    try {
      console.log('DatabaseService: Checking database status...');
      
      const status = {
        connected: mongoose.connection.readyState === 1,
        readyState: mongoose.connection.readyState,
        readyStates: {
          0: 'disconnected',
          1: 'connected',
          2: 'connecting',
          3: 'disconnecting'
        },
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      };
      
      if (status.connected) {
        const db = mongoose.connection.db;
        const collections = await db.collections();
        status.collections = collections.map(col => col.collectionName);
        status.collectionsCount = collections.length;
        
        // Count users if users collection exists
        try {
          const userCount = await User.countDocuments();
          status.userCount = userCount;
        } catch (error) {
          console.log('DatabaseService: Could not count users:', error.message);
          status.userCount = 0;
        }
      }
      
      console.log('DatabaseService: Database status:', status);
      return status;
    } catch (error) {
      console.error('DatabaseService: Error checking status:', error.message);
      throw error;
    }
  }
}

module.exports = DatabaseService;