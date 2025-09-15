const Setting = require('../models/Setting.js');

class SettingService {
  // Get all settings
  static async getAllSettings() {
    try {
      console.log('SettingService: Getting all settings...');
      const settings = await Setting.find().sort({ name: 1 });
      console.log(`SettingService: Found ${settings.length} settings`);
      return settings;
    } catch (error) {
      console.error('SettingService: Error getting all settings:', error.message);
      console.error('SettingService: Full error:', error);
      throw new Error('Failed to retrieve settings');
    }
  }

  // Get setting by ID
  static async getSettingById(settingId) {
    try {
      console.log(`SettingService: Getting setting by ID: ${settingId}`);
      const setting = await Setting.findById(settingId);
      if (!setting) {
        console.log(`SettingService: Setting not found with ID: ${settingId}`);
        throw new Error('Setting not found');
      }
      console.log(`SettingService: Found setting: ${setting.name}`);
      return setting;
    } catch (error) {
      console.error(`SettingService: Error getting setting by ID ${settingId}:`, error.message);
      console.error('SettingService: Full error:', error);
      throw error;
    }
  }

  // Get setting by name
  static async getSettingByName(name) {
    try {
      console.log(`SettingService: Getting setting by name: ${name}`);
      const setting = await Setting.findOne({ name: name });
      if (setting) {
        console.log(`SettingService: Found setting: ${setting.name} = ${setting.value}`);
      } else {
        console.log(`SettingService: No setting found with name: ${name}`);
      }
      return setting;
    } catch (error) {
      console.error(`SettingService: Error getting setting by name ${name}:`, error.message);
      console.error('SettingService: Full error:', error);
      throw error;
    }
  }

  // Create new setting
  static async createSetting(settingData) {
    try {
      console.log(`SettingService: Creating setting with name: ${settingData.name}`);
      console.log(`SettingService: Setting data:`, settingData);

      // Check if setting already exists
      const existingSetting = await Setting.findOne({ name: settingData.name });
      if (existingSetting) {
        console.log(`SettingService: Setting already exists with name: ${settingData.name}`);
        throw new Error('Setting with this name already exists');
      }

      const setting = new Setting({
        name: settingData.name,
        value: settingData.value,
        description: settingData.description || ''
      });

      console.log(`SettingService: Saving setting to database: ${settingData.name}`);
      const savedSetting = await setting.save();
      console.log(`SettingService: Setting saved successfully with ID: ${savedSetting._id}`);

      console.log(`SettingService: Setting created successfully: ${savedSetting.name}`);
      return savedSetting;
    } catch (error) {
      console.error(`SettingService: Error creating setting ${settingData.name}:`, error.message);
      console.error(`SettingService: Full error:`, error);
      
      // Handle specific MongoDB errors
      if (error.code === 11000) {
        throw new Error('Setting with this name already exists');
      }
      
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw new Error(validationErrors.join(', '));
      }
      
      // Re-throw the original error to preserve validation details
      throw error;
    }
  }

  // Update setting
  static async updateSetting(settingId, updateData) {
    try {
      console.log(`SettingService: Updating setting with ID: ${settingId}`);
      console.log(`SettingService: Update data:`, updateData);
      
      // If updating name, check for duplicates
      if (updateData.name) {
        const existingSetting = await Setting.findOne({ 
          name: updateData.name, 
          _id: { $ne: settingId } 
        });
        if (existingSetting) {
          console.log(`SettingService: Setting name already exists: ${updateData.name}`);
          throw new Error('Setting with this name already exists');
        }
      }

      const updatedSetting = await Setting.findByIdAndUpdate(
        settingId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!updatedSetting) {
        console.log(`SettingService: Setting not found for update with ID: ${settingId}`);
        throw new Error('Setting not found');
      }

      console.log(`SettingService: Setting updated successfully: ${updatedSetting.name}`);
      return updatedSetting;
    } catch (error) {
      console.error(`SettingService: Error updating setting ${settingId}:`, error.message);
      console.error('SettingService: Full error:', error);
      
      // Handle specific MongoDB errors
      if (error.code === 11000) {
        throw new Error('Setting with this name already exists');
      }
      
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => err.message);
        throw new Error(validationErrors.join(', '));
      }
      
      throw error;
    }
  }

  // Delete setting
  static async deleteSetting(settingId) {
    try {
      console.log(`SettingService: Deleting setting with ID: ${settingId}`);
      
      const deletedSetting = await Setting.findByIdAndDelete(settingId);
      if (!deletedSetting) {
        console.log(`SettingService: Setting not found for deletion with ID: ${settingId}`);
        throw new Error('Setting not found');
      }

      console.log(`SettingService: Setting deleted successfully: ${deletedSetting.name}`);
      return { message: 'Setting deleted successfully', setting: deletedSetting };
    } catch (error) {
      console.error(`SettingService: Error deleting setting ${settingId}:`, error.message);
      console.error('SettingService: Full error:', error);
      throw error;
    }
  }

  // Bulk create or update settings
  static async bulkUpsertSettings(settingsData) {
    try {
      console.log(`SettingService: Bulk upserting settings, count: ${settingsData.length}`);
      
      const results = {
        created: 0,
        updated: 0,
        errors: [],
        settings: []
      };

      for (let i = 0; i < settingsData.length; i++) {
        const settingData = settingsData[i];
        try {
          console.log(`SettingService: Processing setting ${i + 1}/${settingsData.length}: ${settingData.name}`);
          
          // Check required fields
          if (!settingData.name || settingData.value === undefined) {
            results.errors.push(`Row ${i + 1}: Missing required fields (name, value)`);
            continue;
          }

          // Check if setting exists
          const existingSetting = await Setting.findOne({ name: settingData.name });
          
          let setting;
          if (existingSetting) {
            // Update existing setting
            setting = await Setting.findByIdAndUpdate(
              existingSetting._id,
              {
                value: settingData.value,
                description: settingData.description || existingSetting.description
              },
              { new: true, runValidators: true }
            );
            results.updated++;
            console.log(`SettingService: Setting ${i + 1} updated successfully: ${setting.name}`);
          } else {
            // Create new setting
            setting = new Setting({
              name: settingData.name,
              value: settingData.value,
              description: settingData.description || ''
            });
            setting = await setting.save();
            results.created++;
            console.log(`SettingService: Setting ${i + 1} created successfully: ${setting.name}`);
          }

          results.settings.push(setting);
        } catch (error) {
          console.error(`SettingService: Error processing setting ${i + 1}:`, error.message);
          
          if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            results.errors.push(`Row ${i + 1}: ${validationErrors.join(', ')}`);
          } else {
            results.errors.push(`Row ${i + 1}: ${error.message}`);
          }
        }
      }

      console.log(`SettingService: Bulk upsert completed. Created: ${results.created}, Updated: ${results.updated}, Errors: ${results.errors.length}`);
      return results;
    } catch (error) {
      console.error('SettingService: Error in bulk settings upsert:', error.message);
      console.error('SettingService: Full error:', error);
      throw new Error(`Failed to bulk upsert settings: ${error.message}`);
    }
  }
}

module.exports = SettingService;