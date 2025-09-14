import api from './api';

// Description: Get current user profile information
// Endpoint: GET /api/users/me
// Request: {}
// Response: { success: boolean, data: { _id: string, email: string, name: string, role: string, phone?: string, createdAt: string, lastLoginAt: string, isActive: boolean } }
export const getCurrentUser = async () => {
  try {
    const response = await api.get('/api/users/me');
    return response.data;
  } catch (error) {
    throw new Error(error?.response?.data?.message || error.message);
  }
};