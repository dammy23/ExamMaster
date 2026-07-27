import api from './api';

export interface ExamAttempt {
  _id: string;
  examId: string | {
    _id: string;
    title: string;
    subject?: string;
    totalMarks: number;
    showResultsImmediately?: boolean;
  };
  studentId: string;
  answers: { [questionId: string]: string | string[] };
  startTime: string;
  endTime?: string;
  timeSpent: number;
  score?: number;
  percentage?: number;
  status: 'in-progress' | 'completed' | 'submitted' | 'pending-review';
  flaggedQuestions: string[];
  tabSwitches: number;
  attemptNumber: number;
  videoRecording: {
    enabled: boolean;
    videoUrl?: string;
    recordingStartTime?: string;
    recordingEndTime?: string;
    recordingStatus: 'not_started' | 'recording' | 'completed' | 'failed';
    fileSize?: number;
    reviewed?: boolean;
    reviewedAt?: string;
  };
  aiGradingResults?: {
    totalScore: number;
    totalMaxScore: number;
    results: Array<{
      questionId: string;
      score: number;
      maxScore: number;
      feedback: string;
      aiPlatform?: string;
      error?: boolean;
      gradedAt: string;
    }>;
    gradedAt: string;
  };
  manualGradingResults?: {
    totalScore: number;
    totalMaxScore: number;
    results: Array<{
      questionId: string;
      score: number;
      maxScore: number;
      feedback: string;
      gradedBy?: string;
      gradedAt: string;
    }>;
    gradedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ExamQuestion {
  _id: string;
  type: 'multiple-choice' | 'true-false' | 'theory'| 'short-answer';
  question: string;
  options?: string[];
  marks: number;
  difficulty: 'easy' | 'medium' | 'hard';
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
// Response: { success: boolean, score: number, percentage: number, status: string, aiGradingCompleted: boolean, theoryQuestionsCount: number }
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

// Description: Start video recording for exam attempt
// Endpoint: POST /api/exam-attempts/video/start
// Request: { attemptId: string }
// Response: { success: boolean, message: string }
export const startVideoRecording = async (attemptId: string) => {
  try {
    const response = await api.post('/api/exam-attempts/video/start', { attemptId });
    return response.data;
  } catch (error: any) {
    console.error('Start video recording error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Upload video recording for exam attempt
// Endpoint: POST /api/exam-attempts/video/upload
// Request: FormData with video file and attemptId
// Response: { success: boolean, message: string, videoUrl: string }
export const uploadVideoRecording = async (attemptId: string, videoBlob: Blob) => {
  try {
    const formData = new FormData();
    formData.append('video', videoBlob, 'exam-recording.webm');
    formData.append('attemptId', attemptId);

    const response = await api.post('/api/exam-attempts/video/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.videoUrl;
  } catch (error: any) {
    console.error('Upload video recording error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get exam attempts for admin review
// Endpoint: GET /api/exam-attempts/admin/exam/:examId/attempts
// Request: {}
// Response: { success: boolean, attempts: ExamAttempt[] }
export const getExamAttemptsForReview = async (examId: string) => {
  try {
    const response = await api.get(`/api/exam-attempts/admin/exam/${examId}/attempts`);
    return response.data;
  } catch (error: any) {
    console.error('Get exam attempts for review error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get specific exam attempt for admin review
// Endpoint: GET /api/exam-attempts/admin/attempt/:attemptId
// Request: {}
// Response: { success: boolean, attempt: ExamAttempt }
export const getAttemptForReview = async (attemptId: string) => {
  try {
    const response = await api.get(`/api/exam-attempts/admin/attempt/${attemptId}`);
    return response.data;
  } catch (error: any) {
    console.error('Get attempt for review error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get recent exam results for student dashboard
// Endpoint: GET /api/exam-attempts/student/recent-results
// Request: {}
// Response: { success: boolean, recentResults: Array<{ _id: string, exam: string, subject: string, score: number, percentage: number, date: string, timeSpent: number }> }
export const getStudentRecentResults = async () => {
  try {
    const response = await api.get('/api/exam-attempts/student/recent-results');
    return response.data;
  } catch (error: any) {
    console.error('Get student recent results error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get recent exam activity for admin dashboard
// Endpoint: GET /api/exam-attempts/admin/recent-activity
// Request: {}
// Response: { success: boolean, recentActivity: Array<{ _id: string, student: string, exam: string, action: string, time: string, percentage: number | null, status: string }> }
export const getAdminRecentActivity = async () => {
  try {
    const response = await api.get('/api/exam-attempts/admin/recent-activity');
    return response.data;
  } catch (error: any) {
    console.error('Get admin recent activity error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get the count of exam attempts pending manual grading
// Endpoint: GET /api/exam-attempts/admin/pending-grading-count
// Request: {}
// Response: { success: boolean, count: number }
export const getPendingGradingCount = async () => {
  try {
    const response = await api.get('/api/exam-attempts/admin/pending-grading-count');
    return response.data;
  } catch (error: any) {
    console.error('Get pending grading count error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Mark an exam attempt's video recording as reviewed
// Endpoint: POST /api/exam-attempts/mark-reviewed/:attemptId
// Request: {}
// Response: { success: boolean, attempt: ExamAttempt }
export const markAttemptReviewed = async (attemptId: string) => {
  try {
    const response = await api.post(`/api/exam-attempts/mark-reviewed/${attemptId}`);
    return response.data;
  } catch (error: any) {
    console.error('Mark attempt reviewed error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get the count of exam attempts pending video review
// Endpoint: GET /api/exam-attempts/admin/pending-video-reviews-count
// Request: {}
// Response: { success: boolean, count: number }
export const getPendingVideoReviewsCount = async () => {
  try {
    const response = await api.get('/api/exam-attempts/admin/pending-video-reviews-count');
    return response.data;
  } catch (error: any) {
    console.error('Get pending video reviews count error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Grade theory questions for a specific exam attempt using AI
// Endpoint: POST /api/exam-attempts/grade-theory/:attemptId
// Request: {}
// Response: { success: boolean, aiGradingResults: Object, totalScore: number, updatedPercentage: number, theoryQuestionsGraded: number }
export const gradeTheoryQuestions = async (attemptId: string) => {
  try {
    const response = await api.post(`/api/exam-attempts/grade-theory/${attemptId}`);
    return response.data;
  } catch (error: any) {
    console.error('Grade theory questions error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get all exam attempts pending grading, across every exam this admin owns
// Endpoint: GET /api/exam-attempts/admin/pending-grading
// Request: {}
// Response: { success: boolean, attempts: ExamAttempt[] }
export const getPendingGradingAttempts = async () => {
  try {
    const response = await api.get('/api/exam-attempts/admin/pending-grading');
    return response.data;
  } catch (error: any) {
    console.error('Get pending grading attempts error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get a single exam attempt with full question detail for grading
// Endpoint: GET /api/exam-attempts/admin/grading/:attemptId
// Request: {}
// Response: { success: boolean, attempt: ExamAttempt }
export const getAttemptForGrading = async (attemptId: string) => {
  try {
    const response = await api.get(`/api/exam-attempts/admin/grading/${attemptId}`);
    return response.data;
  } catch (error: any) {
    console.error('Get attempt for grading error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Submit manual grades for all theory questions in a pending-review attempt
// Endpoint: POST /api/exam-attempts/manual-grade/:attemptId
// Request: { grades: Array<{ questionId: string, score: number, feedback: string }> }
// Response: { success: boolean, totalScore: number, updatedPercentage: number, status: string }
export const submitManualGrades = async (
  attemptId: string,
  grades: Array<{ questionId: string; score: number; feedback: string }>
) => {
  try {
    const response = await api.post(`/api/exam-attempts/manual-grade/${attemptId}`, { grades });
    return response.data;
  } catch (error: any) {
    console.error('Submit manual grades error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get full detail (including theory question feedback) for a single completed attempt
// Endpoint: GET /api/exam-attempts/student/attempt/:attemptId
// Request: {}
// Response: { success: boolean, attempt: ExamAttempt }
export const getAttemptDetail = async (attemptId: string) => {
  try {
    const response = await api.get(`/api/exam-attempts/student/attempt/${attemptId}`);
    return response.data;
  } catch (error: any) {
    console.error('Get attempt detail error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

export interface LiveAttempt {
  _id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  startTime: string;
  tabSwitches: number;
  latestActivity: { activity: string; timestamp: string } | null;
  updatedAt: string;
}

// Description: Get all currently in-progress exam attempts across every exam this admin owns
// Endpoint: GET /api/exam-attempts/admin/live
// Request: {}
// Response: { success: boolean, attempts: LiveAttempt[] }
export const getLiveAttempts = async () => {
  try {
    const response = await api.get('/api/exam-attempts/admin/live');
    return response.data;
  } catch (error: any) {
    console.error('Get live attempts error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};