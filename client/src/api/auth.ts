import api from './api';

// Description: Login user
// Endpoint: POST /api/auth/login
// Request: { email: string, password: string }
// Response: { success: boolean, data: { accessToken: string, refreshToken: string, user: object } }
export const login = async (email: string, password: string) => {
  try {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  } catch (error: any) {
    console.error('Login API error:', error);
    console.error('Error response:', error.response?.data);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Register user
// Endpoint: POST /api/auth/register
// Request: { name: string, email: string, password: string, role: string }
// Response: { success: boolean, data: { accessToken: string, user: object } }
export const register = async (name: string, email: string, password: string, role: string) => {
  try {
    const response = await api.post('/api/auth/register', { name, email, password, role });
    return response.data;
  } catch (error: any) {
    console.error('Register API error:', error);
    console.error('Error response:', error.response?.data);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Logout user
// Endpoint: POST /api/auth/logout
// Request: {}
// Response: { success: boolean, message: string }
export const logout = async () => {
  try {
    const response = await api.post('/api/auth/logout');
    return response.data;
  } catch (error: any) {
    console.error('Logout API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};