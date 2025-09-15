import api from './api';

// Description: Get all settings
// Endpoint: GET /api/settings
// Request: {}
// Response: { success: boolean, data: { settings: Array<{ _id: string, name: string, value: string, description?: string, createdAt: string, updatedAt: string }> } }
export const getSettings = async () => {
  try {
    const response = await api.get('/api/settings');
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get setting by ID
// Endpoint: GET /api/settings/:id
// Request: { id: string }
// Response: { success: boolean, data: { setting: { _id: string, name: string, value: string, description?: string, createdAt: string, updatedAt: string } } }
export const getSettingById = async (id: string) => {
  try {
    const response = await api.get(`/api/settings/${id}`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new setting
// Endpoint: POST /api/settings
// Request: { name: string, value: string, description?: string }
// Response: { success: boolean, data: { setting: { _id: string, name: string, value: string, description?: string, createdAt: string, updatedAt: string } } }
export const createSetting = async (data: { name: string; value: string; description?: string }) => {
  try {
    const response = await api.post('/api/settings', data);
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update an existing setting
// Endpoint: PUT /api/settings/:id
// Request: { id: string, name?: string, value?: string, description?: string }
// Response: { success: boolean, data: { setting: { _id: string, name: string, value: string, description?: string, createdAt: string, updatedAt: string } } }
export const updateSetting = async (id: string, data: { name?: string; value?: string; description?: string }) => {
  try {
    const response = await api.put(`/api/settings/${id}`, data);
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete a setting
// Endpoint: DELETE /api/settings/:id
// Request: { id: string }
// Response: { success: boolean, data: { message: string, setting: { _id: string, name: string, value: string, description?: string } } }
export const deleteSetting = async (id: string) => {
  try {
    const response = await api.delete(`/api/settings/${id}`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get setting by name (public endpoint)
// Endpoint: GET /api/settings/name/:name
// Request: { name: string }
// Response: { success: boolean, data: { setting: { _id: string, name: string, value: string, description?: string, createdAt: string, updatedAt: string } } }
export const getSettingByName = async (name: string) => {
  try {
    const response = await api.get(`/api/settings/name/${name}`);
    return response.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};