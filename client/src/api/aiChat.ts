import api from './api';

// Description: Send message to AI Chat and get response
// Endpoint: POST /api/ai-chat/message
// Request: { message: string, modelId: string, agentId: string, fileAttachment?: File }
// Response: { response: string, messageId: string }
export const sendChatMessage = async (data: { message: string; modelId: string; agentId: string; fileAttachment?: File }) => {
  try {
    const formData = new FormData();
    formData.append('message', data.message);
    formData.append('modelId', data.modelId);
    formData.append('agentId', data.agentId);
    if (data.fileAttachment) {
      formData.append('fileAttachment', data.fileAttachment);
    }
    const response = await api.post('/api/ai-chat/message', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get chat history for current user
// Endpoint: GET /api/ai-chat/history
// Request: { page?: number, limit?: number }
// Response: { messages: Array<{ _id: string, message: string, response: string, timestamp: Date, modelId: string, agentId: string }> }
export const getChatHistory = async (params?: { page?: number; limit?: number }) => {
  try {
    const response = await api.get('/api/ai-chat/history', { params });
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get available AI models
// Endpoint: GET /api/ai-chat/models
// Request: {}
// Response: { models: Array<{ _id: string, name: string, description: string, isActive: boolean }> }
export const getAIModels = async () => {
  try {
    const response = await api.get('/api/ai-chat/models');
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get available AI agents
// Endpoint: GET /api/ai-chat/agents
// Request: {}
// Response: { agents: Array<{ _id: string, name: string, description: string, capabilities: string[], isActive: boolean }> }
export const getAIAgents = async () => {
  try {
    const response = await api.get('/api/ai-chat/agents');
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Upload file for AI chat context
// Endpoint: POST /api/ai-chat/upload
// Request: { file: File, description?: string }
// Response: { fileId: string, fileName: string, fileUrl: string }
export const uploadChatFile = async (data: { file: File; description?: string }) => {
  try {
    const formData = new FormData();
    formData.append('file', data.file);
    if (data.description) {
      formData.append('description', data.description);
    }
    const response = await api.post('/api/ai-chat/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};