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
  totalMarks: number;
  passingMarks: number;
  instructions: string;
  allowReview: boolean;
  showResultsImmediately: boolean;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  negativeMarking: boolean;
  negativeMarkingValue: number;
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
    const response = await api.post('/api/exams', examData);
    return response.data;
  } catch (error: any) {
    throw new Error(error?.response?.data?.error || error.message);
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