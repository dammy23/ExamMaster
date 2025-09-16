import api from './api';

// Description: Get all AI platforms
// Endpoint: GET /api/ai-platforms
// Request: {}
// Response: { success: boolean, data: { platforms: Array<{ _id: string, name: string, displayName: string, description: string, configuration: object, isActive: boolean, isDefault: boolean, usage: object, createdAt: string, updatedAt: string }> } }
export const getAIPlatforms = async () => {
  try {
    const response = await api.get('/api/ai-platforms');
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get active AI platforms for chat selection
// Endpoint: GET /api/ai-platforms/active
// Request: {}
// Response: { success: boolean, data: { platforms: Array<{ _id: string, name: string, displayName: string, description: string, configuration: { model: string }, isDefault: boolean }> } }
export const getActiveAIPlatforms = async () => {
  try {
    const response = await api.get('/api/ai-platforms/active');
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get AI platform by ID
// Endpoint: GET /api/ai-platforms/:id
// Request: { id: string }
// Response: { success: boolean, data: { platform: { _id: string, name: string, displayName: string, description: string, configuration: object, isActive: boolean, isDefault: boolean, usage: object, createdAt: string, updatedAt: string } } }
export const getAIPlatformById = async (id: string) => {
  try {
    const response = await api.get(`/api/ai-platforms/${id}`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new AI platform
// Endpoint: POST /api/ai-platforms
// Request: { name: string, displayName: string, description?: string, configuration: object, isActive?: boolean, isDefault?: boolean }
// Response: { success: boolean, data: { platform: { _id: string, name: string, displayName: string, description: string, configuration: object, isActive: boolean, isDefault: boolean, createdAt: string, updatedAt: string } } }
export const createAIPlatform = async (data: { 
  name: string; 
  displayName: string; 
  description?: string; 
  configuration: object; 
  isActive?: boolean; 
  isDefault?: boolean; 
}) => {
  try {
    const response = await api.post('/api/ai-platforms', data);
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update an existing AI platform
// Endpoint: PUT /api/ai-platforms/:id
// Request: { id: string, displayName?: string, description?: string, configuration?: object, isActive?: boolean, isDefault?: boolean }
// Response: { success: boolean, data: { platform: { _id: string, name: string, displayName: string, description: string, configuration: object, isActive: boolean, isDefault: boolean, updatedAt: string } } }
export const updateAIPlatform = async (id: string, data: { 
  displayName?: string; 
  description?: string; 
  configuration?: object; 
  isActive?: boolean; 
  isDefault?: boolean; 
}) => {
  try {
    const response = await api.put(`/api/ai-platforms/${id}`, data);
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete an AI platform (soft delete)
// Endpoint: DELETE /api/ai-platforms/:id
// Request: { id: string }
// Response: { success: boolean, data: { message: string, platform: { _id: string, name: string, displayName: string } } }
export const deleteAIPlatform = async (id: string) => {
  try {
    const response = await api.delete(`/api/ai-platforms/${id}`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Test AI platform configuration
// Endpoint: POST /api/ai-platforms/:id/test
// Request: { id: string }
// Response: { success: boolean, data: { testResult: { success: boolean, error?: string }, platform: { _id: string, name: string, testStatus: string, lastTested: Date, testError?: string } } }
export const testAIPlatform = async (id: string) => {
  try {
    const response = await api.post(`/api/ai-platforms/${id}/test`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Set AI platform as default
// Endpoint: POST /api/ai-platforms/:id/set-default
// Request: { id: string }
// Response: { success: boolean, data: { message: string, platform: { _id: string, name: string, displayName: string, isDefault: boolean } } }
export const setDefaultAIPlatform = async (id: string) => {
  try {
    const response = await api.post(`/api/ai-platforms/${id}/set-default`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Initialize default AI platforms
// Endpoint: POST /api/ai-platforms/initialize
// Request: {}
// Response: { success: boolean, data: { message: string, platforms: number } }
export const initializeAIPlatforms = async () => {
  try {
    const response = await api.post('/api/ai-platforms/initialize');
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};