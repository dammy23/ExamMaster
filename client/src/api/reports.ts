import api from './api';

export interface ExamReport {
  examId: string;
  examTitle: string;
  totalStudents: number;
  completedAttempts: number;
  averageScore: number;
  passRate: number;
  highestScore: number;
  lowestScore: number;
  averageTimeSpent: number;
}

export interface StudentPerformance {
  studentId: string;
  studentName: string;
  totalExams: number;
  averageScore: number;
  bestScore: number;
  worstScore: number;
  totalTimeSpent: number;
  strengths: string[];
  weaknesses: string[];
}

export interface QuestionAnalysis {
  questionId: string;
  question: string;
  totalAttempts: number;
  correctAnswers: number;
  incorrectAnswers: number;
  difficultyRating: number;
  averageTimeSpent: number;
}

// Description: Get exam reports
// Endpoint: GET /api/reports/exams
// Request: {}
// Response: { reports: ExamReport[] }
export const getExamReports = async () => {
  try {
    const response = await api.get('/api/reports/exams');
    return response.data;
  } catch (error: any) {
    console.error('Get exam reports error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get student performance reports
// Endpoint: GET /api/reports/students
// Request: {}
// Response: { performances: StudentPerformance[] }
export const getStudentPerformanceReports = async () => {
  try {
    const response = await api.get('/api/reports/students');
    return response.data;
  } catch (error: any) {
    console.error('Get student performance reports error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get question analysis
// Endpoint: GET /api/reports/questions
// Request: { examId?: string }
// Response: { analysis: QuestionAnalysis[] }
export const getQuestionAnalysis = async (examId?: string) => {
  try {
    const response = await api.get('/api/reports/questions', {
      params: examId ? { examId } : {}
    });
    return response.data;
  } catch (error: any) {
    console.error('Get question analysis error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Export report as PDF
// Endpoint: POST /api/reports/export
// Request: { type: string, examId?: string, format: 'pdf' | 'csv' }
// Response: { success: boolean, downloadUrl: string }
export const exportReport = async (type: string, examId?: string, format: 'pdf' | 'csv' = 'pdf') => {
  try {
    const response = await api.post('/api/reports/export', {
      type,
      examId,
      format
    });
    return response.data;
  } catch (error: any) {
    console.error('Export report error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};