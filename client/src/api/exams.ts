import api from './api';

export interface Exam {
  _id: string;
  title: string;
  description: string;
  subject: {
    _id: string;
    name: string;
    code: string;
    description?: string;
  };
  duration: number;
  startDate: string;
  endDate: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  totalQuestions: number;
  questionsPerExam?: number | null;
  totalMarks: number;
  passingMarks: number;
  instructions: string;
  allowReview: boolean;
  showResultsImmediately: boolean;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  negativeMarking: boolean;
  negativeMarkingValue: number;
  maxAttempts: number; // 0 means unlimited
  videoRecording: boolean;
  screenRecording: boolean;
  mobileEnabled: boolean;
  gradingMethod: 'ai' | 'manual';
  assignedStudents: string[];
  assignedGroups: string[];
  questions: string[];
  createdAt: string;
  updatedAt: string;
}

// Description: Get all exams
// Endpoint: GET /api/exams
// Request: {}
// Response: { success: boolean, exams: Exam[] }
export const getExams = async () => {
  try {
    const response = await api.get('/api/exams');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Create a new exam
// Endpoint: POST /api/exams
// Request: { exam: Partial<Exam> }
// Response: { success: boolean, exam: Exam }
export const createExam = async (examData: Partial<Exam>) => {
  try {
    console.log('Creating exam with data:', examData);
    const response = await api.post('/api/exams', examData);
    console.log('Exam creation response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Error creating exam:', error);
    console.error('Error response:', error?.response);
    console.error('Error response data:', error?.response?.data);
    console.error('Error response status:', error?.response?.status);

    // Handle 413 Request Entity Too Large error specifically
    if (error?.response?.status === 413) {
      throw new Error(
        'The exam data is too large to upload (exceeds server limits). ' +
        'This is usually caused by large images in the description or instructions. ' +
        'Please reduce image sizes or remove some images and try again.'
      );
    }

    // If we get HTML instead of JSON, it's likely a server error (like 413 from reverse proxy)
    if (error?.response?.data && typeof error.response.data === 'string' && error.response.data.includes('<')) {
      // Check if it's specifically a 413 error based on HTML content
      if (error.response.data.includes('413') || error.response.data.includes('Request Entity Too Large')) {
        throw new Error(
          'The exam data is too large to upload (exceeds server limits). ' +
          'This is usually caused by large images in the description or instructions. ' +
          'Please reduce image sizes or remove some images and try again.'
        );
      }
      throw new Error('Server error occurred. Please check server logs and try again.');
    }

    throw new Error(error?.response?.data?.error || error?.response?.data?.message || error.message);
  }
};

// Description: Update an exam
// Endpoint: PUT /api/exams/:id
// Request: { exam: Partial<Exam> }
// Response: { success: boolean, exam: Exam }
export const updateExam = async (id: string, examData: Partial<Exam>) => {
  try {
    const response = await api.put(`/api/exams/${id}`, examData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Delete an exam
// Endpoint: DELETE /api/exams/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteExam = async (id: string) => {
  try {
    const response = await api.delete(`/api/exams/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get exam by ID
// Endpoint: GET /api/exams/:id
// Request: {}
// Response: { success: boolean, exam: Exam }
export const getExamById = async (id: string) => {
  try {
    const response = await api.get(`/api/exams/${id}`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get questions for an exam
// Endpoint: GET /api/exams/:id/questions
// Request: {}
// Response: { success: boolean, questions: Question[] }
export const getExamQuestions = async (examId: string) => {
  try {
    const response = await api.get(`/api/exams/${examId}/questions`);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Assign questions to an exam
// Endpoint: POST /api/exams/:id/questions
// Request: { questionIds: string[] }
// Response: { success: boolean, message: string, questionsCount: number }
export const assignQuestionsToExam = async (examId: string, questionIds: string[]) => {
  try {
    const response = await api.post(`/api/exams/${examId}/questions`, { questionIds });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Remove questions from an exam
// Endpoint: DELETE /api/exams/:id/questions
// Request: { questionIds: string[] }
// Response: { success: boolean, message: string, questionsCount: number }
export const removeQuestionsFromExam = async (examId: string, questionIds: string[]) => {
  try {
    const response = await api.delete(`/api/exams/${examId}/questions`, { data: { questionIds } });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get available exams for student dashboard
// Endpoint: GET /api/exams/student/available
// Request: {}
// Response: { success: boolean, exams: Exam[] }
export const getAvailableExamsForStudent = async () => {
  try {
    const response = await api.get('/api/exams/student/available');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};