const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User.js');
const Exam = require('../models/Exam.js');
const ExamAttempt = require('../models/ExamAttempt.js');

async function seedTestStudents() {
  try {
    console.log('Starting test student and attempt seeding...');

    // Use MongoDB URL directly since system env is different
    const mongoUrl = 'mongodb://localhost:27017/ExamMaster';
    console.log('Using MongoDB URL:', mongoUrl);

    // Connect to database
    await mongoose.connect(mongoUrl);

    console.log('Connected to database');

    // Create student users
    console.log('Creating test students...');

    const students = [
      {
        name: 'John Smith',
        email: 'john.smith@example.com',
        password: 'password123',
        role: 'student',
        studentId: 'STU001',
        group: 'Group A'
      },
      {
        name: 'Jane Doe',
        email: 'jane.doe@example.com',
        password: 'password123',
        role: 'student',
        studentId: 'STU002',
        group: 'Group B'
      },
      {
        name: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        password: 'password123',
        role: 'student',
        studentId: 'STU003',
        group: 'Group A'
      },
      {
        name: 'Alice Brown',
        email: 'alice.brown@example.com',
        password: 'password123',
        role: 'student',
        studentId: 'STU004',
        group: 'Group C'
      },
      // Add an admin user to test filtering
      {
        name: 'Test Admin',
        email: 'test.admin@example.com',
        password: 'password123',
        role: 'admin'
      }
    ];

    for (const studentData of students) {
      let existingUser = await User.findOne({ email: studentData.email });
      if (!existingUser) {
        const user = new User(studentData);
        await user.save();
        console.log(`Created user: ${studentData.name} (${studentData.role})`);
      } else {
        console.log(`User already exists: ${studentData.name}`);
      }
    }

    // Get all users for creating attempts
    const allUsers = await User.find({});
    const studentUsers = allUsers.filter(user => user.role === 'student');
    const adminUsers = allUsers.filter(user => user.role === 'admin');

    console.log(`Found ${studentUsers.length} students and ${adminUsers.length} admins`);

    // Get exams
    const exams = await Exam.find({});
    console.log(`Found ${exams.length} exams`);

    if (exams.length > 0) {
      // Create exam attempts for both students and admins to test filtering
      console.log('Creating test exam attempts...');

      const allUsersForAttempts = [...studentUsers, ...adminUsers.slice(0, 2)]; // Include 2 admins to test filtering

      for (const exam of exams.slice(0, 2)) { // Only first 2 exams
        for (const user of allUsersForAttempts) {
          const existingAttempt = await ExamAttempt.findOne({
            examId: exam._id,
            studentId: user._id
          });

          if (!existingAttempt) {
            const attempt = new ExamAttempt({
              examId: exam._id,
              studentId: user._id,
              answers: {},
              score: Math.floor(Math.random() * 100), // Random score between 0-100
              percentage: Math.floor(Math.random() * 100),
              timeSpent: Math.floor(Math.random() * exam.duration * 60), // Random time up to exam duration
              status: 'completed',
              startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
              endTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + Math.random() * exam.duration * 60 * 1000),
              tabSwitches: Math.floor(Math.random() * 5),
              attemptNumber: 1
            });

            await attempt.save();
            console.log(`Created attempt for ${user.name} (${user.role}) on exam: ${exam.title}`);
          }
        }
      }
    }

    console.log('Test student and attempt seeding completed successfully!');
    console.log('\nCreated test data:');
    console.log('- 4 Student users with various groups');
    console.log('- 1 Additional admin user');
    console.log('- Exam attempts for both students and admins (to test filtering)');

  } catch (error) {
    console.error('Error seeding test data:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Database connection closed');
  }
}

// Run the seeding function if this script is called directly
if (require.main === module) {
  seedTestStudents();
}

module.exports = seedTestStudents;