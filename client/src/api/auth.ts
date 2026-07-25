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

// Description: Request a password reset email
// Endpoint: POST /api/auth/forgot-password
// Request: { email: string }
// Response: { success: boolean, message: string }
export const forgotPassword = async (email: string) => {
  try {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data;
  } catch (error: any) {
    console.error('Forgot password API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Reset password using a reset token
// Endpoint: POST /api/auth/reset-password
// Request: { token: string, password: string }
// Response: { success: boolean, message: string }
export const resetPassword = async (token: string, password: string) => {
  try {
    const response = await api.post('/api/auth/reset-password', { token, password });
    return response.data;
  } catch (error: any) {
    console.error('Reset password API error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
