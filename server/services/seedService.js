const UserService = require('./userService.js');

class SeedService {
  static async createAdminUser() {
    try {
      console.log('SeedService: Creating admin user...');
      
      const adminData = {
        name: 'Admin User',
        email: 'admin@yahoo.com',
        password: 'admin123',
        role: 'admin'
      };

      console.log('SeedService: Admin data prepared:', { ...adminData, password: '[HIDDEN]' });

      // Check if admin already exists
      const existingAdmin = await UserService.getUserByEmail(adminData.email);
      if (existingAdmin) {
        console.log('SeedService: Admin user already exists');
        throw new Error('Admin user already exists');
      }

      console.log('SeedService: Creating new admin user...');
      const admin = await UserService.createUser(adminData);
      
      console.log('SeedService: Admin user created successfully with ID:', admin._id);
      
      return {
        message: 'Admin user created successfully',
        user: {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          role: admin.role
        }
      };
    } catch (error) {
      console.error('SeedService: Error creating admin user:', error.message);
      throw error;
    }
  }

  static async createSampleStudents() {
    try {
      console.log('SeedService: Creating sample students...');
      
      const studentsData = [
        {
          name: 'Student One',
          email: 'student1@example.com',
          password: 'student123',
          role: 'student'
        },
        {
          name: 'Student Two',
          email: 'student2@example.com',
          password: 'student123',
          role: 'student'
        },
        {
          name: 'Student Three',
          email: 'student3@example.com',
          password: 'student123',
          role: 'student'
        }
      ];

      console.log('SeedService: Student data prepared for', studentsData.length, 'students');

      const createdStudents = [];

      for (const studentData of studentsData) {
        try {
          console.log('SeedService: Checking if student exists:', studentData.email);
          
          const existingStudent = await UserService.getUserByEmail(studentData.email);
          if (existingStudent) {
            console.log('SeedService: Student already exists:', studentData.email);
            continue;
          }

          console.log('SeedService: Creating student:', studentData.email);
          const student = await UserService.createUser(studentData);
          
          console.log('SeedService: Student created successfully:', student.email);
          createdStudents.push({
            _id: student._id,
            name: student.name,
            email: student.email,
            role: student.role
          });
        } catch (error) {
          console.error('SeedService: Error creating student:', studentData.email, error.message);
        }
      }

      if (createdStudents.length === 0 && studentsData.length > 0) {
        console.log('SeedService: All students already exist');
        throw new Error('Sample students already exist');
      }

      console.log('SeedService: Created', createdStudents.length, 'students successfully');
      
      return {
        message: `${createdStudents.length} sample students created successfully`,
        users: createdStudents
      };
    } catch (error) {
      console.error('SeedService: Error creating sample students:', error.message);
      throw error;
    }
  }
}

module.exports = SeedService;