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

export interface QuestionAnalysis {
  questionId: string;
  question: string;
  totalAttempts: number;
  correctAnswers: number;
  incorrectAnswers: number;
  difficultyRating: number;
  averageTimeSpent: number;
}

export interface StudentScore {
  studentId: string;
  studentName: string;
  studentIdNumber: string;
  studentGroup: string;
  studentEmail: string;
  score: number;
  percentage: number;
  timeSpent: number;
  startTime: Date;
  endTime: Date;
  status: string;
  tabSwitches: number;
  attemptNumber: number;
  isPassed: boolean;
}

export interface ExamStatistics {
  totalStudents: number;
  passedStudents: number;
  failedStudents: number;
  passRate: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  averageTimeSpent: number;
}

export interface ExamStudentReport {
  exam: {
    id: string;
    title: string;
    subject: string;
    totalMarks: number;
    passingMarks: number;
    duration: number;
  };
  statistics: ExamStatistics;
  studentScores: StudentScore[];
}

export interface PerformanceAnalysis {
  examInfo: {
    id: string;
    title: string;
    subject: string;
    totalMarks: number;
    passingMarks: number;
    duration: number;
    totalQuestions: number;
  };
  overallStats: {
    totalAttempts: number;
    averageScore: number;
    highestScore: number;
    lowestScore: number;
    passRate: number;
    averageTimeSpent: number;
  };
  scoreDistribution: Record<string, number>;
  questionAnalysis: Array<{
    questionId: string;
    questionText: string;
    type: string;
    marks: number;
    totalAttempts: number;
    correctAnswers: number;
    incorrectAnswers: number;
    successRate: number;
    difficultyRating: number;
    averageTimeSpent: number;
  }>;
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

// Description: Get student scores for specific exam
// Endpoint: GET /api/reports/exam/:examId/students
// Request: { examId: string }
// Response: ExamStudentReport
export const getExamStudentScores = async (examId: string) => {
  try {
    const response = await api.get(`/api/reports/exam/${examId}/students`);
    return response.data;
  } catch (error: any) {
    console.error('Get exam student scores error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get performance analysis for specific exam
// Endpoint: GET /api/reports/exam/:examId/analysis
// Request: { examId: string }
// Response: { analysis: PerformanceAnalysis }
export const getExamPerformanceAnalysis = async (examId: string) => {
  try {
    const response = await api.get(`/api/reports/exam/${examId}/analysis`);
    return response.data;
  } catch (error: any) {
    console.error('Get exam performance analysis error:', error);
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

// Description: Download report file with authentication
// Endpoint: GET /api/reports/download/:filename
// Request: { filename: string, token?: string }
// Response: File blob or error
export const downloadReportFile = async (filename: string, token?: string) => {
  try {
    let url = `/api/reports/download/${filename}`;

    // If token is provided, add it as query parameter for direct browser downloads
    if (token) {
      url += `?token=${token}`;
    }

    // For API calls with authentication headers, use the api instance
    if (!token) {
      const response = await api.get(url, {
        responseType: 'blob'
      });
      return response.data;
    } else {
      // For direct browser downloads with token, just return the URL
      return url;
    }
  } catch (error: any) {
    console.error('Download report file error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Trigger file download in browser with authentication
// This function handles the actual file download by creating a temporary link
export const triggerFileDownload = (downloadUrl: string, filename: string) => {
  try {
    console.log(`Triggering download for file: ${filename}`);

    // Create a temporary anchor element to trigger the download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.target = '_blank';

    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log(`Download triggered successfully for file: ${filename}`);
  } catch (error) {
    console.error('Error triggering file download:', error);
    throw new Error('Failed to download file');
  }
};