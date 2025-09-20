// Load environment variables
require("dotenv").config();

console.log("Starting server...");
console.log("Environment variables loaded:");
console.log("- DATABASE_URL:", process.env.DATABASE_URL ? "Present" : "Missing");
console.log("- PORT:", process.env.PORT || "Not set (will use 3000)");
console.log("- JWT_SECRET:", process.env.JWT_SECRET ? "Present" : "Missing");

if (!process.env.JWT_SECRET) {
  console.error("Error: JWT_SECRET is missing from .env file");
  process.exit(-1);
}

const mongoose = require("mongoose");
const express = require("express");
const session = require("express-session");
const MongoStore = require('connect-mongo');
const basicRoutes = require("./routes/index");
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const { connectDB } = require("./config/database");
const cors = require("cors");
const path = require("path");

if (!process.env.DATABASE_URL) {
  console.error("Error: DATABASE_URL variables in .env missing.");
  process.exit(-1);
}

const app = express();
const PORT = process.env.PORT || 3000;

console.log("Connecting to database...");

// Connect to database
connectDB().then(() => {
  console.log("Database connection successful, setting up middleware...");

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Add request logging middleware
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });

  console.log("Setting up routes...");

  // Routes
  app.use('/api/auth', require('./routes/authRoutes.js'));
  app.use('/api/users', require('./routes/userRoutes.js'));
  app.use('/api/students/groups', require('./routes/studentGroupRoutes.js'));
  app.use('/api/subjects', require('./routes/subjectRoutes.js'));
  app.use('/api/seed', require('./routes/seedRoutes.js'));
  app.use('/api/database', require('./routes/databaseRoutes.js'));
  app.use('/api/exams', require('./routes/examRoutes.js'));
  app.use('/api/questions', require('./routes/questionRoutes.js'));
  app.use('/api/exam-attempts', require('./routes/examAttemptRoutes.js'));
  app.use('/api/reports', require('./routes/reportRoutes.js'));
  app.use('/api/settings', require('./routes/settingRoutes.js'));
  app.use('/api/ai-platforms', require('./routes/aiPlatformRoutes.js'));
  app.use('/api/ai-chat', require('./routes/aiChatRoutes.js'));
  app.use('/api/upload', require('./routes/uploadRoutes.js'));

  // Serve static files
  const publicPath = path.join(__dirname, "public");
  app.use(express.static(publicPath));

  // Serve uploaded files (images)
  const uploadsPath = path.join(__dirname, "uploads");
  app.use('/uploads', express.static(uploadsPath));

  // Catch-all to return React's index.html for non-API routes
  app.get("*", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
  });

  console.log("Starting server on port", PORT);

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log("To create initial users, visit: http://localhost:5173/seeding");
  });
}).catch((error) => {
  console.error("Failed to connect to database:", error);
  console.error("Error details:", error.message);
  process.exit(-1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});