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

// Description: Get student groups
// Endpoint: GET /api/students/groups
// Request: {}
// Response: { success: boolean, data: { groups: StudentGroup[] } }
export const getStudentGroups = async () => {
  try {
    const response = await api.get('/api/students/groups');
    return response.data.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create student group
// Endpoint: POST /api/students/groups
// Request: { name: string, description: string }
// Response: { success: boolean, data: { group: StudentGroup } }
export const createStudentGroup = async (groupData: { name: string; description: string }) => {
  try {
    const response = await api.post('/api/students/groups', groupData);
    return response.data.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new student
// Endpoint: POST /api/users/students
// Request: { name: string, email: string, password: string, studentId?: string, group?: string }
// Response: { success: boolean, data: { student: Student } }
export const createStudent = async (studentData: { 
  name: string; 
  email: string; 
  password: string; 
  studentId?: string; 
  group?: string; 
}) => {
  try {
    const response = await api.post('/api/users/students', studentData);
    return response.data.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};