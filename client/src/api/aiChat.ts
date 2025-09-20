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
      throw new Error('File too large. Please select a file smaller than 2MB.');
    }

    // Try to parse error message from different response formats
    let errorMessage = 'Failed to send message';

    if (error?.response?.data) {
      if (typeof error.response.data === 'string' && error.response.data.includes('413 Request Entity Too Large')) {
        errorMessage = 'File too large. Please select a file smaller than 2MB.';
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

// Description: Generate questions from document or text using AI
// Endpoint: POST /api/ai-chat/generate-questions
// Request: { document?: File, text?: string, questionCount?: number, difficulty?: string, questionTypes?: string, subject?: string }
// Response: { questions: Array<Question>, validationResults: { validQuestions: number, totalGenerated: number, errors: Array<string> }, sourceTextLength: number }
export const generateQuestions = async (data: { document?: File; text?: string; questionCount?: number; difficulty?: string; questionTypes?: string; subject?: string }) => {
  try {
    const formData = new FormData();
    if (data.document) {
      formData.append('document', data.document);
    }
    if (data.text) {
      formData.append('text', data.text);
    }
    if (data.questionCount) {
      formData.append('questionCount', data.questionCount.toString());
    }
    if (data.difficulty) {
      formData.append('difficulty', data.difficulty);
    }
    if (data.questionTypes) {
      formData.append('questionTypes', data.questionTypes);
    }
    if (data.subject) {
      formData.append('subject', data.subject);
    }

    const response = await api.post('/api/ai-chat/generate-questions', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data.data;
  } catch (error) {
    console.error(error);

    // Handle HTML error responses (like 413 Request Entity Too Large)
    if (error?.response?.status === 413) {
      throw new Error('File too large. Please select a file smaller than 2MB.');
    }

    // Try to parse error message from different response formats
    let errorMessage = 'Failed to generate questions';

    if (error?.response?.data) {
      if (typeof error.response.data === 'string' && error.response.data.includes('413 Request Entity Too Large')) {
        errorMessage = 'File too large. Please select a file smaller than 2MB.';
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

// Description: Create exam through AI assistant
// Endpoint: POST /api/ai-chat/create-exam
// Request: { title: string, subject: string, duration: number, startDate: Date, endDate: Date, totalMarks: number, passingMarks: number, instructions?: string, questions?: Array<string> }
// Response: { exam: Exam, message: string }
export const createExamWithAI = async (data: { title: string; subject: string; duration: number; startDate: Date; endDate: Date; totalMarks: number; passingMarks: number; instructions?: string; questions?: string[] }) => {
  try {
    const response = await api.post('/api/ai-chat/create-exam', data);
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create subject through AI assistant
// Endpoint: POST /api/ai-chat/create-subject
// Request: { name: string, code: string, description?: string, isActive?: boolean }
// Response: { subject: Subject, message: string }
export const createSubjectWithAI = async (data: { name: string; code: string; description?: string; isActive?: boolean }) => {
  try {
    const response = await api.post('/api/ai-chat/create-subject', data);
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create questions through AI assistant
// Endpoint: POST /api/ai-chat/create-questions
// Request: { questions: Array<Question>, examId?: string }
// Response: { questions: Array<Question>, exam?: Exam, createdCount: number, errors: Array<string>, message: string }
export const createQuestionsWithAI = async (data: { questions: any[]; examId?: string }) => {
  try {
    const response = await api.post('/api/ai-chat/create-questions', data);
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get conversation context and available options
// Endpoint: GET /api/ai-chat/conversation-context
// Request: { agentId?: string }
// Response: { exams: Array<Exam>, subjects: Array<Subject>, questions: Array<Question>, suggestions: Array<string>, counts: { totalExams: number, totalSubjects: number, totalQuestions: number } }
export const getConversationContext = async (agentId?: string) => {
  try {
    const response = await api.get('/api/ai-chat/conversation-context', {
      params: agentId ? { agentId } : {}
    });
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};