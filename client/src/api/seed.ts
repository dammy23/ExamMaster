import api from './api';

// Description: Create admin user for seeding
// Endpoint: POST /api/seed/admin
// Request: {}
// Response: { success: boolean, message: string, user: object }
export const seedAdmin = async () => {
  console.log('API: Calling seed admin endpoint...');
  try {
    const response = await api.post('/api/seed/admin');
    console.log('API: Seed admin response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('API: Seed admin error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create sample student users for seeding
// Endpoint: POST /api/seed/students
// Request: {}
// Response: { success: boolean, message: string, users: array }
export const seedStudents = async () => {
  console.log('API: Calling seed students endpoint...');
  try {
    const response = await api.post('/api/seed/students');
    console.log('API: Seed students response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('API: Seed students error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};