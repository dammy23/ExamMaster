import api from './api';

// Description: Generate PDF from React PDF component
// Endpoint: POST /api/reports/generate-pdf
// Request: { reportData: object, reportType: string }
// Response: { success: boolean, downloadUrl: string, filename: string }
export const generateReactPDF = async (reportData: any, reportType: string) => {
  try {
    console.log('Generating React PDF for report type:', reportType);

    const response = await api.post('/api/reports/generate-pdf', {
      reportData,
      reportType
    });

    return response.data;
  } catch (error: any) {
    console.error('Generate React PDF error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};