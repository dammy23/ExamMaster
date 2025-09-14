import api from './api';

export interface Student {
  _id: string;
  name: string;
  email: string;
  role: string;
  studentId?: string;
  group?: string;
  enrollmentDate?: string;
  status: 'active' | 'inactive';
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
// Endpoint: GET /api/users/students
// Request: {}
// Response: { success: boolean, data: { students: Student[] } }
export const getStudents = async () => {
  try {
    const response = await api.get('/api/users/students');
    return response.data.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all users (admin only)
// Endpoint: GET /api/users
// Request: {}
// Response: { success: boolean, data: { users: Student[] } }
export const getAllUsers = async () => {
  try {
    const response = await api.get('/api/users');
    return response.data.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Bulk upload students from CSV file
// Endpoint: POST /api/users/bulk-upload
// Request: FormData with CSV file
// Response: { success: boolean, data: { imported: number, errors?: string[] } }
export const bulkUploadStudents = async (file: File) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/users/bulk-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get student groups (mock data for now)
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

// Description: Create student group (mock data for now)
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