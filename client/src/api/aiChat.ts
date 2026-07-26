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

    // Handle HTML error responses (like 413 Request Entity Too Large)
    if (error?.response?.status === 413) {
      throw new Error('File too large. Please select a file smaller than 20MB.');
    }

    // Try to parse error message from different response formats
    let errorMessage = 'Failed to send message';

    if (error?.response?.data) {
      if (typeof error.response.data === 'string' && error.response.data.includes('413 Request Entity Too Large')) {
        errorMessage = 'File too large. Please select a file smaller than 20MB.';
      } else if (error.response.data.error) {
        errorMessage = error.response.data.error;
      } else if (error.response.data.message) {
        errorMessage = error.response.data.message;
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
};

// Description: Get chat history with pagination for current user
// Endpoint: GET /api/ai-chat/history
// Request: { page?: number, limit?: number }
// Response: { messages: Array<{ _id: string, message: string, response: string, timestamp: Date, modelId: string, agentId: string }>, pagination: { currentPage: number, totalPages: number, totalCount: number, hasMore: boolean, limit: number } }
export const getChatHistory = async (params?: { page?: number; limit?: number }) => {
  try {
    const response = await api.get('/api/ai-chat/history', { params });
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

// Description: Create questions through AI assistant
// Endpoint: POST /api/ai-chat/create-questions
// Request: { questions: Array<Question> }
// Response: { questions: Array<Question>, createdCount: number, errors: Array<string>, message: string }
export const createQuestionsWithAI = async (data: { questions: any[] }) => {
  try {
    const response = await api.post('/api/ai-chat/create-questions', data);
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

