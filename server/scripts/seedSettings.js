// Load environment variables
require("dotenv").config();

const mongoose = require("mongoose");
const { connectDB } = require("../config/database");
const Setting = require("../models/Setting");

const seedSettings = async () => {
  try {
    console.log("Starting settings seeding...");
    
    // Connect to database
    await connectDB();
    console.log("Connected to database");

    // Clear existing settings
    await Setting.deleteMany({});
    console.log("Cleared existing settings");

    // Define initial settings
    const initialSettings = [
      {
        name: "APP_NAME",
        value: "ExamMaster",
        description: "Application name displayed in the header"
      },
      {
        name: "MAX_EXAM_DURATION",
        value: "180",
        description: "Maximum exam duration in minutes"
      },
      {
        name: "DEFAULT_PASSING_GRADE",
        value: "60",
        description: "Default passing grade percentage for new exams"
      },
      {
        name: "EXAM_AUTO_SUBMIT",
        value: "true",
        description: "Automatically submit exams when time expires"
      },
      {
        name: "ALLOW_QUESTION_REVIEW",
        value: "true",
        description: "Allow students to review questions after submission"
      },
      {
        name: "PROCTORING_ENABLED",
        value: "false",
        description: "Enable proctoring features during exams"
      },
      {
        name: "MAX_LOGIN_ATTEMPTS",
        value: "5",
        description: "Maximum login attempts before account lockout"
      },
      {
        name: "SESSION_TIMEOUT",
        value: "30",
        description: "Session timeout in minutes"
      }
    ];

    // Create settings
    for (const settingData of initialSettings) {
      const setting = new Setting(settingData);
      await setting.save();
      console.log(`Created setting: ${setting.name} = ${setting.value}`);
    }

    console.log(`Successfully seeded ${initialSettings.length} settings`);
    process.exit(0);

  } catch (error) {
    console.error("Error seeding settings:", error.message);
    console.error("Stack trace:", error.stack);
    process.exit(1);
  }
};

// Run if called directly
if (require.main === module) {
  seedSettings();
}

module.exports = seedSettings;