import api from './api';

export interface Student {
  _id: string;
  name: string;
  email: string;
  studentId: string;
  group: string;
  enrollmentDate: string;
  status: 'active' | 'inactive';
  totalExamsAttempted: number;
  averageScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudentGroup {
  _id: string;
  name: string;
  description: string;
  studentCount: number;
  createdAt: string;
}

// Description: Get all students
// Endpoint: GET /api/students
// Request: {}
// Response: { students: Student[] }
export const getStudents = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        students: [
          {
            _id: 'student1',
            name: 'John Doe',
            email: 'john.doe@example.com',
            studentId: 'STU001',
            group: 'Computer Science A',
            enrollmentDate: '2024-01-01',
            status: 'active',
            totalExamsAttempted: 5,
            averageScore: 85.2,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          },
          {
            _id: 'student2',
            name: 'Jane Smith',
            email: 'jane.smith@example.com',
            studentId: 'STU002',
            group: 'Computer Science A',
            enrollmentDate: '2024-01-01',
            status: 'active',
            totalExamsAttempted: 4,
            averageScore: 92.5,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          },
          {
            _id: 'student3',
            name: 'Mike Johnson',
            email: 'mike.johnson@example.com',
            studentId: 'STU003',
            group: 'Mathematics B',
            enrollmentDate: '2024-01-02',
            status: 'inactive',
            totalExamsAttempted: 2,
            averageScore: 78.0,
            createdAt: '2024-01-02T00:00:00Z',
            updatedAt: '2024-01-02T00:00:00Z'
          }
        ]
      });
    }, 500);
  });
};

// Description: Get student groups
// Endpoint: GET /api/students/groups
// Request: {}
// Response: { groups: StudentGroup[] }
export const getStudentGroups = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        groups: [
          {
            _id: '1',
            name: 'Computer Science A',
            description: 'First year computer science students',
            studentCount: 25,
            createdAt: '2024-01-01T00:00:00Z'
          },
          {
            _id: '2',
            name: 'Mathematics B',
            description: 'Advanced mathematics students',
            studentCount: 18,
            createdAt: '2024-01-01T00:00:00Z'
          }
        ]
      });
    }, 500);
  });
};

// Description: Create student group
// Endpoint: POST /api/students/groups
// Request: { name: string, description: string }
// Response: { success: boolean, group: StudentGroup }
export const createStudentGroup = (groupData: { name: string; description: string }) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        group: {
          _id: Date.now().toString(),
          ...groupData,
          studentCount: 0,
          createdAt: new Date().toISOString()
        }
      });
    }, 500);
  });
};