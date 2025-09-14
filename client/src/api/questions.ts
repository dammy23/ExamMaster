import api from './api';

export interface Question {
  _id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswers: string[];
  explanation: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  marks: number;
  createdAt: string;
  updatedAt: string;
}

// Description: Get all questions
// Endpoint: GET /api/questions
// Request: { page?: number, limit?: number, subject?: string, difficulty?: string, search?: string }
// Response: { success: boolean, data: { questions: Question[], pagination: { currentPage: number, totalPages: number, totalItems: number, itemsPerPage: number } } }
export const getQuestions = async (filters?: { page?: number; limit?: number; subject?: string; difficulty?: string; search?: string }) => {
  try {
    const params = new URLSearchParams();
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.subject) params.append('subject', filters.subject);
    if (filters?.difficulty) params.append('difficulty', filters.difficulty);
    if (filters?.search) params.append('search', filters.search);
    
    const response = await api.get(`/api/questions?${params.toString()}`);
    return response.data.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get single question by ID
// Endpoint: GET /api/questions/:id
// Request: {}
// Response: { success: boolean, data: { question: Question } }
export const getQuestionById = async (id: string) => {
  try {
    const response = await api.get(`/api/questions/${id}`);
    return response.data.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new question
// Endpoint: POST /api/questions
// Request: { question: Partial<Question> }
// Response: { success: boolean, data: { question: Question } }
export const createQuestion = async (questionData: Partial<Question>) => {
  try {
    const response = await api.post('/api/questions', questionData);
    return response.data.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Update a question
// Endpoint: PUT /api/questions/:id
// Request: { question: Partial<Question> }
// Response: { success: boolean, data: { question: Question } }
export const updateQuestion = async (id: string, questionData: Partial<Question>) => {
  try {
    const response = await api.put(`/api/questions/${id}`, questionData);
    return response.data.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete a question
// Endpoint: DELETE /api/questions/:id
// Request: {}
// Response: { success: boolean, data: { message: string } }
export const deleteQuestion = async (id: string) => {
  try {
    const response = await api.delete(`/api/questions/${id}`);
    return response.data.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Bulk upload questions
// Endpoint: POST /api/questions/bulk-upload
// Request: { questions: Question[] }
// Response: { success: boolean, data: { imported: number, errors?: string[] } }
export const bulkUploadQuestions = async (file: File) => {
  // For now, we'll simulate parsing the file and sending the data
  // In a real implementation, you'd parse the CSV/Excel file here
  try {
    // This is a simplified version - you'd need to implement actual file parsing
    const mockQuestions = [
      {
        type: 'multiple-choice',
        question: 'Sample question from file',
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
        correctAnswers: ['Option 1'],
        explanation: 'Sample explanation',
        subject: 'mathematics',
        difficulty: 'easy',
        marks: 2
      }
    ];
    
    const response = await api.post('/api/questions/bulk-upload', { questions: mockQuestions });
    return response.data.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};