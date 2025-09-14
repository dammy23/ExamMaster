import api from './api';

// Description: Get database status
// Endpoint: GET /api/database/status
// Request: {}
// Response: { success: boolean, data: object }
export const getDatabaseStatus = async () => {
  console.log('API: Getting database status...');
  try {
    const response = await api.get('/api/database/status');
    console.log('API: Database status response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('API: Database status error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Clean up database (drop all collections)
// Endpoint: POST /api/database/cleanup
// Request: {}
// Response: { success: boolean, message: string, data: object }
export const cleanupDatabase = async () => {
  console.log('API: Cleaning up database...');
  try {
    const response = await api.post('/api/database/cleanup');
    console.log('API: Database cleanup response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('API: Database cleanup error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Reset database to initial state
// Endpoint: POST /api/database/reset
// Request: {}
// Response: { success: boolean, message: string, data: object }
export const resetDatabase = async () => {
  console.log('API: Resetting database...');
  try {
    const response = await api.post('/api/database/reset');
    console.log('API: Database reset response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('API: Database reset error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};