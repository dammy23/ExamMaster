/**
 * CSV Export Utility for Reports
 * Handles extracting table data and converting to CSV format
 */

export interface CSVExportData {
  headers: string[];
  rows: (string | number)[][];
  filename: string;
}

/**
 * Generate CSV content for exam overview report
 */
export const generateExamOverviewCSV = (examReports: any[]): CSVExportData => {
  const headers = [
    'Exam Title',
    'Total Students',
    'Completed Attempts',
    'Average Score (%)',
    'Pass Rate (%)',
    'Highest Score (%)',
    'Lowest Score (%)',
    'Average Time (minutes)'
  ];

  const rows = examReports.map(report => [
    report.examTitle || '',
    report.totalStudents || 0,
    report.completedAttempts || 0,
    Number(report.averageScore || 0).toFixed(1),
    Number(report.passRate || 0).toFixed(1),
    report.highestScore || 0,
    report.lowestScore || 0,
    report.averageTimeSpent || 0
  ]);

  return {
    headers,
    rows,
    filename: `exam-overview-${Date.now()}.csv`
  };
};

/**
 * Generate CSV content for question analysis report
 */
export const generateQuestionAnalysisCSV = (questionAnalysis: any[]): CSVExportData => {
  const headers = [
    'Question',
    'Total Attempts',
    'Correct Answers',
    'Incorrect Answers',
    'Success Rate (%)',
    'Difficulty Rating (/5)',
    'Average Time (seconds)'
  ];

  const rows = questionAnalysis.map(analysis => [
    analysis.question || '',
    analysis.totalAttempts || 0,
    analysis.correctAnswers || 0,
    analysis.incorrectAnswers || 0,
    analysis.totalAttempts > 0
      ? ((analysis.correctAnswers / analysis.totalAttempts) * 100).toFixed(1)
      : '0.0',
    analysis.difficultyRating ? Number(analysis.difficultyRating).toFixed(1) : 'N/A',
    analysis.averageTimeSpent || 0
  ]);

  return {
    headers,
    rows,
    filename: `question-analysis-${Date.now()}.csv`
  };
};

/**
 * Generate CSV content for student scores report
 */
export const generateStudentScoresCSV = (examStudentReport: any): CSVExportData => {
  const headers = [
    'Student Name',
    'Student ID',
    'Group',
    'Email',
    'Score',
    'Percentage (%)',
    'Time Spent (minutes)',
    'Status',
    'Tab Switches',
    'Result'
  ];

  const rows = examStudentReport.studentScores.map((student: any) => [
    student.studentName || '',
    student.studentIdNumber || 'N/A',
    student.studentGroup || 'N/A',
    student.studentEmail || '',
    student.score || 0,
    Number(student.percentage || 0).toFixed(1),
    student.timeSpent || 0,
    student.status || '',
    student.tabSwitches || 0,
    student.isPassed ? 'Passed' : 'Failed'
  ]);

  return {
    headers,
    rows,
    filename: `student-scores-${examStudentReport.exam.title.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.csv`
  };
};

/**
 * Generate CSV content for performance analysis report
 */
export const generatePerformanceAnalysisCSV = (performanceAnalysis: any): CSVExportData => {
  // First section: Overall Statistics
  const overallHeaders = ['Metric', 'Value'];
  const overallRows = [
    ['Exam Title', performanceAnalysis.examInfo.title],
    ['Subject', performanceAnalysis.examInfo.subject],
    ['Total Questions', performanceAnalysis.examInfo.totalQuestions],
    ['Total Marks', performanceAnalysis.examInfo.totalMarks],
    ['Passing Marks', performanceAnalysis.examInfo.passingMarks],
    ['Duration (minutes)', performanceAnalysis.examInfo.duration],
    ['Total Attempts', performanceAnalysis.overallStats.totalAttempts],
    ['Average Score (%)', Number(performanceAnalysis.overallStats.averageScore).toFixed(1)],
    ['Highest Score (%)', performanceAnalysis.overallStats.highestScore],
    ['Lowest Score (%)', performanceAnalysis.overallStats.lowestScore],
    ['Pass Rate (%)', Number(performanceAnalysis.overallStats.passRate).toFixed(1)],
    ['Average Time Spent (minutes)', performanceAnalysis.overallStats.averageTimeSpent]
  ];

  // Second section: Score Distribution
  const scoreDistHeaders = ['Score Range', 'Number of Students'];
  const scoreDistRows = Object.entries(performanceAnalysis.scoreDistribution).map(([range, count]) => [
    range,
    count as number
  ]);

  // Third section: Question Analysis
  const questionHeaders = [
    'Question',
    'Type',
    'Marks',
    'Total Attempts',
    'Correct Answers',
    'Incorrect Answers',
    'Success Rate (%)',
    'Difficulty Rating (/5)',
    'Average Time (seconds)'
  ];

  const questionRows = performanceAnalysis.questionAnalysis.map((question: any) => [
    question.questionText || '',
    question.type || '',
    question.marks || 0,
    question.totalAttempts || 0,
    question.correctAnswers || 0,
    question.incorrectAnswers || 0,
    Number(question.successRate || 0).toFixed(1),
    question.difficultyRating ? Number(question.difficultyRating).toFixed(1) : 'N/A',
    question.averageTimeSpent || 0
  ]);

  // Combine all sections
  const allRows = [
    // Overall Statistics section
    ['OVERALL STATISTICS'],
    ...overallRows,
    [''], // Empty row separator
    // Score Distribution section
    ['SCORE DISTRIBUTION'],
    ...scoreDistHeaders.map(h => [h, '']).slice(0, 1).concat(scoreDistRows),
    [''], // Empty row separator
    // Question Analysis section
    ['QUESTION ANALYSIS'],
    questionHeaders,
    ...questionRows
  ];

  return {
    headers: ['Data', 'Value'], // Generic headers for combined data
    rows: allRows,
    filename: `performance-analysis-${performanceAnalysis.examInfo.title.replace(/[^a-zA-Z0-9]/g, '_')}-${Date.now()}.csv`
  };
};

/**
 * Convert CSV data to downloadable blob
 */
export const convertToCSV = (data: CSVExportData): Blob => {
  let csvContent = '';

  // Add headers
  csvContent += data.headers.map(header => `"${header}"`).join(',') + '\n';

  // Add rows
  data.rows.forEach(row => {
    const csvRow = row.map(cell => {
      // Handle different data types and escape quotes
      const cellValue = cell === null || cell === undefined ? '' : String(cell);
      return `"${cellValue.replace(/"/g, '""')}"`;
    }).join(',');
    csvContent += csvRow + '\n';
  });

  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
};

/**
 * Download CSV file
 */
export const downloadCSV = (csvData: CSVExportData): void => {
  console.log(`Generating CSV export for: ${csvData.filename}`);

  const blob = convertToCSV(csvData);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = csvData.filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the blob URL
  window.URL.revokeObjectURL(url);

  console.log(`CSV file ${csvData.filename} downloaded successfully`);
};

/**
 * Generate and download CSV based on report type
 */
export const exportReportAsCSV = (
  reportType: string,
  reportData: {
    examReports?: any[];
    questionAnalysis?: any[];
    examStudentReport?: any;
    performanceAnalysis?: any;
  }
): void => {
  console.log(`Exporting ${reportType} report as CSV`);

  try {
    let csvData: CSVExportData;

    switch (reportType) {
      case 'exam-overview':
        if (!reportData.examReports) {
          throw new Error('Exam reports data is required for exam overview export');
        }
        csvData = generateExamOverviewCSV(reportData.examReports);
        break;

      case 'question-analysis':
        if (!reportData.questionAnalysis) {
          throw new Error('Question analysis data is required for question analysis export');
        }
        csvData = generateQuestionAnalysisCSV(reportData.questionAnalysis);
        break;

      case 'exam-students':
        if (!reportData.examStudentReport) {
          throw new Error('Student report data is required for student scores export');
        }
        csvData = generateStudentScoresCSV(reportData.examStudentReport);
        break;

      case 'exam-analysis':
        if (!reportData.performanceAnalysis) {
          throw new Error('Performance analysis data is required for performance analysis export');
        }
        csvData = generatePerformanceAnalysisCSV(reportData.performanceAnalysis);
        break;

      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }

    downloadCSV(csvData);
    console.log(`CSV export completed for ${reportType}`);
  } catch (error) {
    console.error(`Error exporting ${reportType} as CSV:`, error);
    throw error;
  }
};