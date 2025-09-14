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
export const getExamReports = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        reports: [
          {
            examId: '1',
            examTitle: 'Mathematics Final Exam',
            totalStudents: 25,
            completedAttempts: 23,
            averageScore: 78.5,
            passRate: 87.0,
            highestScore: 98,
            lowestScore: 45,
            averageTimeSpent: 105
          },
          {
            examId: '2',
            examTitle: 'Physics Quiz',
            totalStudents: 18,
            completedAttempts: 18,
            averageScore: 82.3,
            passRate: 94.4,
            highestScore: 95,
            lowestScore: 60,
            averageTimeSpent: 45
          }
        ]
      });
    }, 500);
  });
};

// Description: Get student performance reports
// Endpoint: GET /api/reports/students
// Request: {}
// Response: { performances: StudentPerformance[] }
export const getStudentPerformanceReports = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        performances: [
          {
            studentId: 'student1',
            studentName: 'John Doe',
            totalExams: 5,
            averageScore: 85.2,
            bestScore: 98,
            worstScore: 72,
            totalTimeSpent: 450,
            strengths: ['Algebra', 'Geometry'],
            weaknesses: ['Calculus', 'Statistics']
          },
          {
            studentId: 'student2',
            studentName: 'Jane Smith',
            totalExams: 4,
            averageScore: 92.5,
            bestScore: 98,
            worstScore: 85,
            totalTimeSpent: 320,
            strengths: ['Physics', 'Mathematics'],
            weaknesses: ['Chemistry']
          }
        ]
      });
    }, 500);
  });
};

// Description: Get question analysis
// Endpoint: GET /api/reports/questions
// Request: { examId?: string }
// Response: { analysis: QuestionAnalysis[] }
export const getQuestionAnalysis = (examId?: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        analysis: [
          {
            questionId: '1',
            question: 'What is the derivative of x²?',
            totalAttempts: 25,
            correctAnswers: 22,
            incorrectAnswers: 3,
            difficultyRating: 2.1,
            averageTimeSpent: 45
          },
          {
            questionId: '2',
            question: 'The speed of light is approximately 3 × 10⁸ m/s.',
            totalAttempts: 25,
            correctAnswers: 24,
            incorrectAnswers: 1,
            difficultyRating: 1.2,
            averageTimeSpent: 20
          }
        ]
      });
    }, 500);
  });
};

// Description: Export report as PDF
// Endpoint: POST /api/reports/export
// Request: { type: string, examId?: string, format: 'pdf' | 'csv' }
// Response: { success: boolean, downloadUrl: string }
export const exportReport = (type: string, examId?: string, format: 'pdf' | 'csv' = 'pdf') => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        downloadUrl: '/api/downloads/report-' + Date.now() + '.' + format
      });
    }, 1000);
  });
};