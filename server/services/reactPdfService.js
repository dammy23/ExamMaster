const React = require('react');
const fs = require('fs').promises;
const path = require('path');

class ReactPdfService {
  constructor() {
    console.log('ReactPdfService - Initializing React PDF service');
  }

  /**
   * Generate PDF from React PDF component data
   * @param {Object} reportData - Report data to render
   * @param {string} reportType - Type of report
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generatePDFFromReactData(reportData, reportType) {
    try {
      console.log(`ReactPdfService - Generating PDF for ${reportType} report`);

      // Dynamically import @react-pdf/renderer
      const { renderToBuffer, Document, Page, Text, View, StyleSheet } = await import('@react-pdf/renderer');

      // Create the PDF document
      const pdfDocument = this.createPDFDocument(reportData, { Document, Page, Text, View, StyleSheet });

      // Render PDF to buffer
      console.log('ReactPdfService - Rendering PDF document to buffer');
      const pdfBuffer = await renderToBuffer(pdfDocument);

      console.log(`ReactPdfService - PDF generated successfully, size: ${pdfBuffer.length} bytes`);
      return pdfBuffer;

    } catch (error) {
      console.error('ReactPdfService - Error generating PDF:', error.message);
      console.log('ReactPdfService - Full error stack:', error.stack);

      // Fallback PDF generation
      console.log('ReactPdfService - Attempting fallback PDF generation');
      return this.generateFallbackPDF(reportData, reportType);
    }
  }

  /**
   * Create React PDF document structure
   * @param {Object} reportData - Report data
   * @param {Object} PDFComponents - Dynamically imported PDF components
   * @returns {React.Element} PDF document
   */
  createPDFDocument(reportData, PDFComponents) {
    const { Document, Page, Text, View, StyleSheet } = PDFComponents;

    // Define styles
    const styles = StyleSheet.create({
      page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 20, fontFamily: 'Helvetica' },
      title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, color: '#1F2937' },
      subtitle: { fontSize: 14, textAlign: 'center', marginBottom: 20, color: '#6B7280' },
      section: { marginVertical: 10 },
      sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#1F2937' },
      table: { marginVertical: 10 },
      tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingVertical: 8 },
      tableHeader: { flexDirection: 'row', backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingVertical: 8 },
      tableCell: { flex: 1, fontSize: 10, paddingHorizontal: 4 },
      tableCellHeader: { flex: 1, fontSize: 10, fontWeight: 'bold', paddingHorizontal: 4 },
      summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 15 },
      summaryCard: { width: '48%', backgroundColor: '#F9FAFB', padding: 10, margin: '1%', alignItems: 'center', border: '1px solid #E5E7EB' },
      summaryValue: { fontSize: 18, fontWeight: 'bold', color: '#2563EB' },
      summaryLabel: { fontSize: 10, color: '#6B7280' },
    });

    const getReportTitle = () => {
      switch (reportData.selectedReport) {
        case 'exam-overview': return 'Exam Performance Overview';
        case 'question-analysis': return 'Question Difficulty Analysis';
        case 'exam-students': return reportData.examStudentReport ? `Student Scores - ${reportData.examStudentReport.exam.title}` : 'Student Scores';
        case 'exam-analysis': return reportData.performanceAnalysis ? `Performance Analysis - ${reportData.performanceAnalysis.examInfo.title}` : 'Performance Analysis';
        default: return 'Reports & Analytics';
      }
    };

    const totalExams = reportData.examReports ? reportData.examReports.length : 0;
    const avgPassRate = reportData.examReports && reportData.examReports.length > 0
      ? reportData.examReports.reduce((sum, report) => sum + report.passRate, 0) / reportData.examReports.length
      : 0;
    const totalQuestions = reportData.questionAnalysis ? reportData.questionAnalysis.length : 0;
    const avgScore = reportData.examReports && reportData.examReports.length > 0
      ? reportData.examReports.reduce((sum, report) => sum + report.averageScore, 0) / reportData.examReports.length
      : 0;

    return React.createElement(Document, null,
      React.createElement(Page, { size: "A4", style: styles.page },
        React.createElement(View, null,
          React.createElement(Text, { style: styles.title }, getReportTitle()),
          React.createElement(Text, { style: styles.subtitle }, 'Comprehensive insights into exam performance and student progress'),
          React.createElement(Text, { style: styles.subtitle }, `Generated on ${new Date(reportData.generatedAt).toLocaleDateString()} at ${new Date(reportData.generatedAt).toLocaleTimeString()}`)
        ),
        React.createElement(View, { style: styles.summaryGrid },
          React.createElement(View, { style: styles.summaryCard },
            React.createElement(Text, { style: styles.summaryValue }, totalExams.toString()),
            React.createElement(Text, { style: styles.summaryLabel }, 'Total Exams')
          ),
          React.createElement(View, { style: styles.summaryCard },
            React.createElement(Text, { style: styles.summaryValue }, avgPassRate.toFixed(1) + '%'),
            React.createElement(Text, { style: styles.summaryLabel }, 'Average Pass Rate')
          ),
          React.createElement(View, { style: styles.summaryCard },
            React.createElement(Text, { style: styles.summaryValue }, totalQuestions.toString()),
            React.createElement(Text, { style: styles.summaryLabel }, 'Total Questions')
          ),
          React.createElement(View, { style: styles.summaryCard },
            React.createElement(Text, { style: styles.summaryValue }, avgScore.toFixed(1) + '%'),
            React.createElement(Text, { style: styles.summaryLabel }, 'Avg Score')
          )
        ),
        this.renderReportContent(reportData, styles, { Text, View })
      )
    );
  }

  /**
   * Render specific report content
   */
  renderReportContent(reportData, styles, PDFComponents) {
    const { View, Text } = PDFComponents;

    switch (reportData.selectedReport) {
      case 'exam-overview': return this.renderExamOverview(reportData.examReports || [], styles, PDFComponents);
      case 'question-analysis': return this.renderQuestionAnalysis(reportData.questionAnalysis || [], styles, PDFComponents);
      case 'exam-students': return this.renderStudentScores(reportData.examStudentReport, styles, PDFComponents);
      case 'exam-analysis': return this.renderPerformanceAnalysis(reportData.performanceAnalysis, styles, PDFComponents);
      default:
        return React.createElement(View, null,
          React.createElement(Text, { style: styles.sectionTitle }, 'Report data not available')
        );
    }
  }

  // --- Render functions (exam overview, question analysis, student scores, performance analysis) ---
  renderExamOverview(examReports, styles, { View, Text }) {
    return React.createElement(View, { style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, 'Exam Performance Overview'),
      React.createElement(View, { style: styles.table },
        React.createElement(View, { style: styles.tableHeader },
          React.createElement(Text, { style: styles.tableCellHeader }, 'Exam'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Students'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Completed'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Avg Score'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Pass Rate')
        ),
        ...examReports.slice(0, 20).map((report, index) =>
          React.createElement(View, { key: index, style: styles.tableRow },
            React.createElement(Text, { style: styles.tableCell }, report.examTitle || ''),
            React.createElement(Text, { style: styles.tableCell }, (report.totalStudents || 0).toString()),
            React.createElement(Text, { style: styles.tableCell }, (report.completedAttempts || 0).toString()),
            React.createElement(Text, { style: styles.tableCell }, (report.averageScore || 0).toFixed(1) + '%'),
            React.createElement(Text, { style: styles.tableCell }, (report.passRate || 0).toFixed(1) + '%')
          )
        )
      )
    );
  }

  renderQuestionAnalysis(questionAnalysis, styles, { View, Text }) {
    return React.createElement(View, { style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, 'Question Difficulty Analysis'),
      React.createElement(View, { style: styles.table },
        React.createElement(View, { style: styles.tableHeader },
          React.createElement(Text, { style: styles.tableCellHeader }, 'Question'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Attempts'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Correct'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Success Rate'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Difficulty')
        ),
        ...questionAnalysis.slice(0, 20).map((analysis, index) => {
          const successRate = analysis.totalAttempts > 0
            ? ((analysis.correctAnswers / analysis.totalAttempts) * 100).toFixed(1)
            : '0.0';
          return React.createElement(View, { key: index, style: styles.tableRow },
            React.createElement(Text, { style: styles.tableCell }, analysis.question?.substring(0, 40) || ''),
            React.createElement(Text, { style: styles.tableCell }, (analysis.totalAttempts || 0).toString()),
            React.createElement(Text, { style: styles.tableCell }, (analysis.correctAnswers || 0).toString()),
            React.createElement(Text, { style: styles.tableCell }, successRate + '%'),
            React.createElement(Text, { style: styles.tableCell }, analysis.difficultyRating?.toFixed(1) + '/5' || 'N/A')
          );
        })
      )
    );
  }

  renderStudentScores(examStudentReport, styles, { View, Text }) {
    if (!examStudentReport) {
      return React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Student scores data not available')
      );
    }

    return React.createElement(View, { style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, `Student Scores - ${examStudentReport.exam.title}`),
      React.createElement(View, { style: styles.table },
        React.createElement(View, { style: styles.tableHeader },
          React.createElement(Text, { style: styles.tableCellHeader }, 'Student'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Score'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Percentage'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Time'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Result')
        ),
        ...examStudentReport.studentScores.slice(0, 25).map((student, index) =>
          React.createElement(View, { key: index, style: styles.tableRow },
            React.createElement(Text, { style: styles.tableCell }, student.studentName || ''),
            React.createElement(Text, { style: styles.tableCell }, (student.score || 0).toString()),
            React.createElement(Text, { style: styles.tableCell }, (student.percentage || 0).toFixed(1) + '%'),
            React.createElement(Text, { style: styles.tableCell }, (student.timeSpent || 0) + 'm'),
            React.createElement(Text, { style: styles.tableCell }, student.isPassed ? 'Passed' : 'Failed')
          )
        )
      )
    );
  }

  renderPerformanceAnalysis(performanceAnalysis, styles, { View, Text }) {
    if (!performanceAnalysis) {
      return React.createElement(View, { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Performance analysis data not available')
      );
    }

    return React.createElement(View, { style: styles.section },
      React.createElement(Text, { style: styles.sectionTitle }, `Performance Analysis - ${performanceAnalysis.examInfo.title}`),
      React.createElement(View, { style: styles.table },
        React.createElement(View, { style: styles.tableHeader },
          React.createElement(Text, { style: styles.tableCellHeader }, 'Question'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Type'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Success Rate'),
          React.createElement(Text, { style: styles.tableCellHeader }, 'Difficulty')
        ),
        ...performanceAnalysis.questionAnalysis.slice(0, 20).map((question, index) =>
          React.createElement(View, { key: index, style: styles.tableRow },
            React.createElement(Text, { style: styles.tableCell }, question.questionText?.substring(0, 30) || ''),
            React.createElement(Text, { style: styles.tableCell }, question.type || ''),
            React.createElement(Text, { style: styles.tableCell }, (question.successRate || 0).toFixed(1) + '%'),
            React.createElement(Text, { style: styles.tableCell }, question.difficultyRating?.toFixed(1) + '/5' || 'N/A')
          )
        )
      )
    );
  }

  async generateFallbackPDF(reportData, reportType) {
    console.log('ReactPdfService - Generating fallback PDF using simple text format');
    try {
      const pdfService = require('./pdfService');
      const fallbackData = {
        title: `${reportType} Report`,
        summary: {
          totalExams: reportData.examReports?.length || 0,
          averageScore: reportData.examReports?.reduce((sum, r) => sum + r.averageScore, 0) / (reportData.examReports?.length || 1) || 0,
          highestScore: Math.max(...(reportData.examReports?.map(r => r.averageScore) || [0])),
          passRate: reportData.examReports?.reduce((sum, r) => sum + r.passRate, 0) / (reportData.examReports?.length || 1) || 0
        },
        details: reportData.examReports || [],
        insights: [
          `Report generated on ${new Date().toLocaleDateString()}`,
          `Contains data for ${reportData.examReports?.length || 0} exams`,
          'Generated using fallback PDF method due to React PDF rendering issues'
        ]
      };
      return await pdfService.generateSimplePDF(fallbackData, 'exam');
    } catch (fallbackError) {
      console.error('ReactPdfService - Fallback PDF generation also failed:', fallbackError.message);
      const simpleText = `
        ${reportType.toUpperCase()} REPORT
        Generated: ${new Date().toLocaleDateString()}
        This report could not be generated in PDF format.
        Please try exporting as CSV instead.
      `;
      return Buffer.from(simpleText, 'utf8');
    }
  }

  async savePDFToFile(pdfBuffer, filename) {
    try {
      const reportsDir = path.join(__dirname, '../uploads/reports');
      await fs.mkdir(reportsDir, { recursive: true });
      const filePath = path.join(reportsDir, filename);
      await fs.writeFile(filePath, pdfBuffer);
      console.log(`ReactPdfService - PDF saved to: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('ReactPdfService - Error saving PDF:', error);
      throw error;
    }
  }
}

module.exports = new ReactPdfService();
