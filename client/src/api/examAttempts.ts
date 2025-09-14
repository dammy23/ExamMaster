import api from './api';

export interface ExamAttempt {
  _id: string;
  examId: string;
  studentId: string;
  answers: { [questionId: string]: string | string[] };
  startTime: string;
  endTime?: string;
  timeSpent: number;
  score?: number;
  percentage?: number;
  status: 'in-progress' | 'completed' | 'submitted';
  flaggedQuestions: string[];
  tabSwitches: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExamQuestion {
  _id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  marks: number;
}

// Description: Start exam attempt
// Endpoint: POST /api/exam-attempts/start
// Request: { examId: string }
// Response: { success: boolean, attemptId: string, questions: ExamQuestion[] }
export const startExamAttempt = async (examId: string) => {
  try {
    const response = await api.post('/api/exam-attempts/start', { examId });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Save exam answer
// Endpoint: POST /api/exam-attempts/save-answer
// Request: { attemptId: string, questionId: string, answer: string | string[] }
// Response: { success: boolean }
export const saveExamAnswer = async (attemptId: string, questionId: string, answer: string | string[]) => {
  try {
    const response = await api.post('/api/exam-attempts/save-answer', { 
      attemptId, 
      questionId, 
      answer 
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Submit exam attempt
// Endpoint: POST /api/exam-attempts/submit
// Request: { attemptId: string }
// Response: { success: boolean, score: number, percentage: number }
export const submitExamAttempt = async (attemptId: string) => {
  try {
    const response = await api.post('/api/exam-attempts/submit', { attemptId });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get student exam attempts
// Endpoint: GET /api/exam-attempts/student
// Request: {}
// Response: { success: boolean, attempts: ExamAttempt[] }
export const getStudentExamAttempts = async () => {
  try {
    const response = await api.get('/api/exam-attempts/student');
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Log tab switch
// Endpoint: POST /api/exam-attempts/log-activity
// Request: { attemptId: string, activity: string }
// Response: { success: boolean }
export const logExamActivity = async (attemptId: string, activity: string) => {
  try {
    const response = await api.post('/api/exam-attempts/log-activity', { 
      attemptId, 
      activity 
    });
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
  }
};