const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User.js');
const Subject = require('../models/Subject.js');
const Exam = require('../models/Exam.js');

async function seedDatabase() {
  try {
    console.log('Starting database seeding...');
    
    // Use MongoDB URL directly since system env is different
    const mongoUrl = 'mongodb://localhost:27017/ExamMaster';
    console.log('Using MongoDB URL:', mongoUrl);
    
    // Connect to database
    await mongoose.connect(mongoUrl);
    
    console.log('Connected to database');

    // Find or create admin user first
    let adminUser = await User.findOne({ email: 'admin@example.com' });
    if (!adminUser) {
      console.log('Creating admin user...');
      adminUser = new User({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'password123', // This will be hashed by the model
        role: 'admin'
      });
      await adminUser.save();
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }

    // Create subjects if they don't exist
    console.log('Creating subjects...');
    const mathSubject = await Subject.findOneAndUpdate(
      { code: 'MATH101' },
      {
        name: 'Mathematics',
        code: 'MATH101',
        description: 'Basic Mathematics Course',
        createdBy: adminUser._id
      },
      { upsert: true, new: true }
    );

    const physicsSubject = await Subject.findOneAndUpdate(
      { code: 'PHYS101' },
      {
        name: 'Physics',
        code: 'PHYS101',
        description: 'Basic Physics Course',
        createdBy: adminUser._id
      },
      { upsert: true, new: true }
    );

    console.log('Subjects created:', mathSubject.name, physicsSubject.name);

    // Create sample exams
    console.log('Creating sample exams...');
    
    // Check if exams already exist
    const existingExams = await Exam.find({ createdBy: adminUser._id });
    if (existingExams.length === 0) {
      const exam1 = new Exam({
        title: 'Mathematics Final Exam',
        description: 'Comprehensive mathematics examination covering algebra, calculus, and geometry.',
        subject: mathSubject._id,
        duration: 120, // 2 hours
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Started yesterday
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Ends in a week
        status: 'active',
        totalMarks: 100,
        passingMarks: 60,
        instructions: 'Read all questions carefully. Show your work for partial credit.',
        allowReview: true,
        showResultsImmediately: false,
        randomizeQuestions: true,
        randomizeOptions: true,
        negativeMarking: false,
        maxAttempts: 2,
        videoRecording: false,
        createdBy: adminUser._id
      });

      const exam2 = new Exam({
        title: 'Physics Quiz',
        description: 'Short physics quiz on motion and forces.',
        subject: physicsSubject._id,
        duration: 45, // 45 minutes
        startDate: new Date(Date.now() - 12 * 60 * 60 * 1000), // Started 12 hours ago
        endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // Ends in 3 days
        status: 'active',
        totalMarks: 50,
        passingMarks: 30,
        instructions: 'Choose the best answer for each multiple-choice question.',
        allowReview: true,
        showResultsImmediately: true,
        randomizeQuestions: true,
        randomizeOptions: true,
        negativeMarking: true,
        negativeMarkingValue: 0.25,
        maxAttempts: 1,
        videoRecording: true,
        createdBy: adminUser._id
      });

      const exam3 = new Exam({
        title: 'Advanced Mathematics Test',
        description: 'Test covering advanced topics in calculus and linear algebra.',
        subject: mathSubject._id,
        duration: 90, // 1.5 hours
        startDate: new Date(Date.now() + 2 * 60 * 60 * 1000), // Starts in 2 hours
        endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Ends in 5 days
        status: 'active',
        totalMarks: 75,
        passingMarks: 45,
        instructions: 'This is an advanced test. Take your time and show all calculations.',
        allowReview: false,
        showResultsImmediately: false,
        randomizeQuestions: false,
        randomizeOptions: false,
        negativeMarking: false,
        maxAttempts: 3,
        videoRecording: false,
        createdBy: adminUser._id
      });

      await Promise.all([exam1.save(), exam2.save(), exam3.save()]);
      console.log('Sample exams created successfully');
    } else {
      console.log('Exams already exist, skipping creation');
    }

    console.log('Database seeding completed successfully!');
    console.log('\nTest Data Created:');
    console.log('- Admin User: admin@example.com (password: password123)');
    console.log('- Subjects: Mathematics, Physics');
    console.log('- 3 Sample Exams with different configurations');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

// Run the seeding function if this script is called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;