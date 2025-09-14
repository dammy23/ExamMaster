import api from './api';

export interface Subject {
  _id: string;
  name: string;
  description?: string;
  code: string;
  isActive: boolean;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubjectData {
  name: string;
  description?: string;
  code: string;
  isActive?: boolean;
}

// Description: Get all subjects
// Endpoint: GET /api/subjects
// Request: { isActive?: boolean, search?: string }
// Response: { success: boolean, subjects: Subject[] }
export const getSubjects = async (filters?: { isActive?: boolean; search?: string }) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        subjects: [
          {
            _id: '507f1f77bcf86cd799439011',
            name: 'Mathematics',
            description: 'Advanced mathematics including calculus and algebra',
            code: 'MATH',
            isActive: true,
            createdBy: {
              _id: '507f1f77bcf86cd799439012',
              name: 'Admin User',
              email: 'admin@example.com'
            },
            createdAt: '2024-01-15T10:00:00.000Z',
            updatedAt: '2024-01-15T10:00:00.000Z'
          },
          {
            _id: '507f1f77bcf86cd799439013',
            name: 'Computer Science',
            description: 'Programming, algorithms, and software development',
            code: 'CS',
            isActive: true,
            createdBy: {
              _id: '507f1f77bcf86cd799439012',
              name: 'Admin User',
              email: 'admin@example.com'
            },
            createdAt: '2024-01-16T10:00:00.000Z',
            updatedAt: '2024-01-16T10:00:00.000Z'
          },
          {
            _id: '507f1f77bcf86cd799439014',
            name: 'Physics',
            description: 'Classical and modern physics concepts',
            code: 'PHY',
            isActive: false,
            createdBy: {
              _id: '507f1f77bcf86cd799439012',
              name: 'Admin User',
              email: 'admin@example.com'
            },
            createdAt: '2024-01-17T10:00:00.000Z',
            updatedAt: '2024-01-17T10:00:00.000Z'
          }
        ]
      });
    }, 500);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   const params = new URLSearchParams();
  //   if (filters?.isActive !== undefined) {
  //     params.append('isActive', filters.isActive.toString());
  //   }
  //   if (filters?.search) {
  //     params.append('search', filters.search);
  //   }
  //   const response = await api.get(`/api/subjects?${params.toString()}`);
  //   return response.data;
  // } catch (error: any) {
  //   console.error(error);
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Get active subjects only (for dropdowns)
// Endpoint: GET /api/subjects/active
// Request: {}
// Response: { success: boolean, subjects: Partial<Subject>[] }
export const getActiveSubjects = async () => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        subjects: [
          {
            _id: '507f1f77bcf86cd799439011',
            name: 'Mathematics',
            code: 'MATH',
            description: 'Advanced mathematics including calculus and algebra'
          },
          {
            _id: '507f1f77bcf86cd799439013',
            name: 'Computer Science',
            code: 'CS',
            description: 'Programming, algorithms, and software development'
          }
        ]
      });
    }, 300);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.get('/api/subjects/active');
  //   return response.data;
  // } catch (error: any) {
  //   console.error(error);
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Get subject by ID
// Endpoint: GET /api/subjects/:id
// Request: {}
// Response: { success: boolean, subject: Subject }
export const getSubjectById = async (id: string) => {
  // Mocking the response
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id === '507f1f77bcf86cd799439011') {
        resolve({
          success: true,
          subject: {
            _id: '507f1f77bcf86cd799439011',
            name: 'Mathematics',
            description: 'Advanced mathematics including calculus and algebra',
            code: 'MATH',
            isActive: true,
            createdBy: {
              _id: '507f1f77bcf86cd799439012',
              name: 'Admin User',
              email: 'admin@example.com'
            },
            createdAt: '2024-01-15T10:00:00.000Z',
            updatedAt: '2024-01-15T10:00:00.000Z'
          }
        });
      } else {
        reject(new Error('Subject not found'));
      }
    }, 300);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.get(`/api/subjects/${id}`);
  //   return response.data;
  // } catch (error: any) {
  //   console.error(error);
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Create a new subject
// Endpoint: POST /api/subjects
// Request: CreateSubjectData
// Response: { success: boolean, subject: Subject, message: string }
export const createSubject = async (subjectData: CreateSubjectData) => {
  // Mocking the response
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        success: true,
        subject: {
          _id: '507f1f77bcf86cd799439015',
          ...subjectData,
          isActive: subjectData.isActive ?? true,
          createdBy: {
            _id: '507f1f77bcf86cd799439012',
            name: 'Admin User',
            email: 'admin@example.com'
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        message: 'Subject created successfully'
      });
    }, 800);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.post('/api/subjects', subjectData);
  //   return response.data;
  // } catch (error: any) {
  //   console.error(error);
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Update an existing subject
// Endpoint: PUT /api/subjects/:id
// Request: Partial<CreateSubjectData>
// Response: { success: boolean, subject: Subject, message: string }
export const updateSubject = async (id: string, subjectData: Partial<CreateSubjectData>) => {
  // Mocking the response
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id === '507f1f77bcf86cd799439011') {
        resolve({
          success: true,
          subject: {
            _id: id,
            name: subjectData.name || 'Mathematics',
            description: subjectData.description || 'Advanced mathematics including calculus and algebra',
            code: subjectData.code || 'MATH',
            isActive: subjectData.isActive ?? true,
            createdBy: {
              _id: '507f1f77bcf86cd799439012',
              name: 'Admin User',
              email: 'admin@example.com'
            },
            createdAt: '2024-01-15T10:00:00.000Z',
            updatedAt: new Date().toISOString()
          },
          message: 'Subject updated successfully'
        });
      } else {
        reject(new Error('Subject not found'));
      }
    }, 800);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.put(`/api/subjects/${id}`, subjectData);
  //   return response.data;
  // } catch (error: any) {
  //   console.error(error);
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};

// Description: Delete a subject
// Endpoint: DELETE /api/subjects/:id
// Request: {}
// Response: { success: boolean, message: string }
export const deleteSubject = async (id: string) => {
  // Mocking the response
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (id === '507f1f77bcf86cd799439011') {
        resolve({
          success: true,
          message: 'Subject deleted successfully'
        });
      } else {
        reject(new Error('Subject not found'));
      }
    }, 600);
  });
  // Uncomment the below lines to make an actual API call
  // try {
  //   const response = await api.delete(`/api/subjects/${id}`);
  //   return response.data;
  // } catch (error: any) {
  //   console.error(error);
  //   throw new Error(error?.response?.data?.error || error.message);
  // }
};