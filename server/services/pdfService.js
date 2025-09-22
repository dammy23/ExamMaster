const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const puppeteer = require('puppeteer');
const htmlPdf = require('html-pdf-node');
const fs = require('fs').promises;
const path = require('path');
const { jsPDF } = require('jspdf');

class PDFService {
  constructor() {
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: 800,
      height: 600,
      backgroundColour: 'white'
    });
  }

  /**
   * Generate performance analysis PDF report
   * @param {Object} data - Performance data
   * @param {string} reportType - Type of report (student, group, exam)
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generatePerformanceReportPDF(data, reportType) {
    console.log(`PDFService - Generating ${reportType} performance report PDF`);

    try {
      const html = await this.generateReportHTML(data, reportType);

      // Launch puppeteer with additional args for containerized environments
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          bottom: '20px',
          left: '20px',
          right: '20px'
        }
      });

      await browser.close();

      console.log('PDFService - PDF report generated successfully');
      return pdfBuffer;

    } catch (error) {
      console.error('PDFService - Error generating PDF report:', error);

      // Check if it's a system dependency issue
      if (error.message.includes('Failed to launch the browser process') ||
          error.message.includes('libglib') ||
          error.message.includes('chrome: error while loading shared libraries')) {
        console.log('PDFService - System dependencies not available, using fallback PDF generator');

        try {
          // Use html-pdf-node as fallback first
          const html = await this.generateReportHTML(data, reportType);
          const options = {
            format: 'A4',
            printBackground: true,
            margin: {
              top: '20px',
              bottom: '20px',
              left: '20px',
              right: '20px'
            }
          };

          const file = { content: html };
          console.log('PDFService - Generating PDF using html-pdf-node fallback method');
          const pdfBuffer = await htmlPdf.generatePdf(file, options);
          console.log('PDFService - html-pdf-node fallback PDF generated successfully');
          return pdfBuffer;

        } catch (fallbackError) {
          console.error('PDFService - html-pdf-node fallback also failed:', fallbackError.message);

          // Try jsPDF as second fallback
          try {
            console.log('PDFService - Using jsPDF as final fallback method');
            const pdfBuffer = await this.generateSimplePDF(data, reportType);
            console.log('PDFService - jsPDF fallback PDF generated successfully');
            return pdfBuffer;
          } catch (jsPdfError) {
            console.error('PDFService - jsPDF fallback also failed:', jsPdfError.message);
            // As last resort, return HTML content as text with PDF extension
            const fallbackHtml = await this.generateReportHTML(data, reportType);
            console.log('PDFService - Using HTML content as final fallback');
            return Buffer.from(fallbackHtml, 'utf8');
          }
        }
      }

      throw new Error(`Failed to generate PDF report: ${error.message}`);
    }
  }

  /**
   * Generate HTML content for the report
   * @param {Object} data - Performance data
   * @param {string} reportType - Type of report
   * @returns {Promise<string>} HTML content
   */
  async generateReportHTML(data, reportType) {
    console.log(`PDFService - Generating HTML for ${reportType} report`);

    try {
      let charts = '';

      // Generate charts based on data
      if (data.scoreDistribution) {
        const scoreChart = await this.generateScoreDistributionChart(data.scoreDistribution);
        charts += `<div class="chart-container"><img src="data:image/png;base64,${scoreChart}" alt="Score Distribution Chart"></div>`;
      }

      if (data.performanceTrend) {
        const trendChart = await this.generatePerformanceTrendChart(data.performanceTrend);
        charts += `<div class="chart-container"><img src="data:image/png;base64,${trendChart}" alt="Performance Trend Chart"></div>`;
      }

      if (data.timeAnalysis) {
        const timeChart = await this.generateTimeAnalysisChart(data.timeAnalysis);
        charts += `<div class="chart-container"><img src="data:image/png;base64,${timeChart}" alt="Time Analysis Chart"></div>`;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Performance Analysis Report</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              margin: 0;
              padding: 20px;
              color: #333;
            }
            .header {
              text-align: center;
              border-bottom: 3px solid #2563eb;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .report-title {
              font-size: 28px;
              font-weight: bold;
              color: #1f2937;
              margin: 0;
            }
            .report-subtitle {
              font-size: 16px;
              color: #6b7280;
              margin-top: 10px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 20px;
              margin: 30px 0;
            }
            .summary-card {
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
            }
            .summary-value {
              font-size: 32px;
              font-weight: bold;
              color: #2563eb;
              margin: 0;
            }
            .summary-label {
              font-size: 14px;
              color: #6b7280;
              margin-top: 5px;
            }
            .chart-container {
              margin: 30px 0;
              text-align: center;
              page-break-inside: avoid;
            }
            .chart-container img {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .section {
              margin: 40px 0;
              page-break-inside: avoid;
            }
            .section-title {
              font-size: 20px;
              font-weight: bold;
              color: #1f2937;
              border-left: 4px solid #2563eb;
              padding-left: 16px;
              margin-bottom: 20px;
            }
            .data-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            .data-table th,
            .data-table td {
              border: 1px solid #e5e7eb;
              padding: 12px;
              text-align: left;
            }
            .data-table th {
              background-color: #f9fafb;
              font-weight: bold;
              color: #374151;
            }
            .data-table tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .insights {
              background: #eff6ff;
              border-left: 4px solid #3b82f6;
              padding: 20px;
              margin: 30px 0;
              border-radius: 0 8px 8px 0;
            }
            .insights h3 {
              color: #1e40af;
              margin-top: 0;
            }
            .footer {
              text-align: center;
              margin-top: 50px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 12px;
            }
            @media print {
              body { margin: 0; }
              .chart-container { page-break-inside: avoid; }
              .section { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="report-title">${this.getReportTitle(reportType)}</h1>
            <p class="report-subtitle">Generated on ${new Date().toLocaleDateString()}</p>
          </div>

          ${this.generateSummarySection(data, reportType)}
          ${charts}
          ${this.generateDataSection(data, reportType)}
          ${this.generateInsightsSection(data, reportType)}

          <div class="footer">
            <p>ExamMaster Performance Analysis Report - Generated by AI Assistant</p>
          </div>
        </body>
        </html>
      `;

      return html;

    } catch (error) {
      console.error('PDFService - Error generating HTML:', error);
      throw error;
    }
  }

  /**
   * Generate score distribution chart
   * @param {Array} distribution - Score distribution data
   * @returns {Promise<string>} Base64 encoded chart image
   */
  async generateScoreDistributionChart(distribution) {
    const configuration = {
      type: 'bar',
      data: {
        labels: distribution.map(d => d.range),
        datasets: [{
          label: 'Number of Students',
          data: distribution.map(d => d.count),
          backgroundColor: 'rgba(37, 99, 235, 0.8)',
          borderColor: 'rgba(37, 99, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Score Distribution',
            font: { size: 16 }
          },
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    };

    const imageBuffer = await this.chartJSNodeCanvas.renderToBuffer(configuration);
    return imageBuffer.toString('base64');
  }

  /**
   * Generate performance trend chart
   * @param {Array} trend - Performance trend data
   * @returns {Promise<string>} Base64 encoded chart image
   */
  async generatePerformanceTrendChart(trend) {
    const configuration = {
      type: 'line',
      data: {
        labels: trend.map(t => t.period),
        datasets: [{
          label: 'Average Score',
          data: trend.map(t => t.averageScore),
          borderColor: 'rgba(37, 99, 235, 1)',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderWidth: 2,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Performance Trend Over Time',
            font: { size: 16 }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        }
      }
    };

    const imageBuffer = await this.chartJSNodeCanvas.renderToBuffer(configuration);
    return imageBuffer.toString('base64');
  }

  /**
   * Generate time analysis chart
   * @param {Array} timeData - Time analysis data
   * @returns {Promise<string>} Base64 encoded chart image
   */
  async generateTimeAnalysisChart(timeData) {
    const configuration = {
      type: 'doughnut',
      data: {
        labels: timeData.map(t => t.category),
        datasets: [{
          data: timeData.map(t => t.percentage),
          backgroundColor: [
            'rgba(37, 99, 235, 0.8)',
            'rgba(16, 185, 129, 0.8)',
            'rgba(245, 158, 11, 0.8)',
            'rgba(239, 68, 68, 0.8)'
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Time Distribution Analysis',
            font: { size: 16 }
          },
          legend: {
            position: 'bottom'
          }
        }
      }
    };

    const imageBuffer = await this.chartJSNodeCanvas.renderToBuffer(configuration);
    return imageBuffer.toString('base64');
  }

  /**
   * Get report title based on type
   * @param {string} reportType - Report type
   * @returns {string} Report title
   */
  getReportTitle(reportType) {
    switch (reportType) {
      case 'student': return 'Student Performance Analysis';
      case 'group': return 'Student Group Performance Analysis';
      case 'exam': return 'Exam Performance Analysis';
      default: return 'Performance Analysis Report';
    }
  }

  /**
   * Generate summary section HTML
   * @param {Object} data - Performance data
   * @param {string} reportType - Report type
   * @returns {string} HTML content
   */
  generateSummarySection(data, reportType) {
    const summary = data.summary || {};

    return `
      <div class="section">
        <h2 class="section-title">Summary</h2>
        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-value">${summary.totalExams || 0}</div>
            <div class="summary-label">Total Exams</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${summary.averageScore || 0}%</div>
            <div class="summary-label">Average Score</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${summary.highestScore || 0}%</div>
            <div class="summary-label">Highest Score</div>
          </div>
          <div class="summary-card">
            <div class="summary-value">${summary.passRate || 0}%</div>
            <div class="summary-label">Pass Rate</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Generate data section HTML
   * @param {Object} data - Performance data
   * @param {string} reportType - Report type
   * @returns {string} HTML content
   */
  generateDataSection(data, reportType) {
    if (!data.details || !Array.isArray(data.details)) {
      return '';
    }

    let tableHeaders = '';
    let tableRows = '';

    if (reportType === 'student') {
      tableHeaders = '<th>Exam</th><th>Subject</th><th>Score</th><th>Time Spent</th><th>Date</th>';
      tableRows = data.details.map(item => `
        <tr>
          <td>${item.examTitle || 'N/A'}</td>
          <td>${item.subject || 'N/A'}</td>
          <td>${item.score || 0}%</td>
          <td>${item.timeSpent || 0} min</td>
          <td>${item.date || 'N/A'}</td>
        </tr>
      `).join('');
    } else if (reportType === 'group') {
      tableHeaders = '<th>Student</th><th>Average Score</th><th>Exams Completed</th><th>Total Time</th>';
      tableRows = data.details.map(item => `
        <tr>
          <td>${item.studentName || 'N/A'}</td>
          <td>${item.averageScore || 0}%</td>
          <td>${item.examsCompleted || 0}</td>
          <td>${item.totalTime || 0} min</td>
        </tr>
      `).join('');
    } else if (reportType === 'exam') {
      tableHeaders = '<th>Student</th><th>Score</th><th>Time Spent</th><th>Status</th><th>Submission Date</th>';
      tableRows = data.details.map(item => `
        <tr>
          <td>${item.studentName || 'N/A'}</td>
          <td>${item.score || 0}%</td>
          <td>${item.timeSpent || 0} min</td>
          <td>${item.status || 'N/A'}</td>
          <td>${item.submissionDate || 'N/A'}</td>
        </tr>
      `).join('');
    }

    return `
      <div class="section">
        <h2 class="section-title">Detailed Analysis</h2>
        <table class="data-table">
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Generate insights section HTML
   * @param {Object} data - Performance data
   * @param {string} reportType - Report type
   * @returns {string} HTML content
   */
  generateInsightsSection(data, reportType) {
    const insights = data.insights || [];

    if (insights.length === 0) {
      return '';
    }

    const insightsList = insights.map(insight => `<li>${insight}</li>`).join('');

    return `
      <div class="section">
        <div class="insights">
          <h3>Key Insights & Recommendations</h3>
          <ul>
            ${insightsList}
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Generate simple PDF using jsPDF (fallback method)
   * @param {Object} data - Performance data
   * @param {string} reportType - Type of report
   * @returns {Promise<Buffer>} PDF buffer
   */
  async generateSimplePDF(data, reportType) {
    try {
      console.log(`PDFService - Creating simple PDF for ${reportType} report`);

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let yPosition = 30;

      // Title
      doc.setFontSize(20);
      doc.text(this.getReportTitle(reportType), margin, yPosition);
      yPosition += 20;

      // Generated date
      doc.setFontSize(10);
      doc.text(`Generated on ${new Date().toLocaleDateString()}`, margin, yPosition);
      yPosition += 20;

      // Summary section
      if (data.summary) {
        doc.setFontSize(16);
        doc.text('Summary', margin, yPosition);
        yPosition += 15;

        doc.setFontSize(12);
        const summary = data.summary;

        if (summary.totalExams !== undefined) {
          doc.text(`Total Exams: ${summary.totalExams}`, margin, yPosition);
          yPosition += 10;
        }
        if (summary.averageScore !== undefined) {
          doc.text(`Average Score: ${summary.averageScore}%`, margin, yPosition);
          yPosition += 10;
        }
        if (summary.highestScore !== undefined) {
          doc.text(`Highest Score: ${summary.highestScore}%`, margin, yPosition);
          yPosition += 10;
        }
        if (summary.passRate !== undefined) {
          doc.text(`Pass Rate: ${summary.passRate}%`, margin, yPosition);
          yPosition += 15;
        }
      }

      // Details section
      if (data.details && Array.isArray(data.details) && data.details.length > 0) {
        doc.setFontSize(16);
        doc.text('Detailed Analysis', margin, yPosition);
        yPosition += 15;

        doc.setFontSize(10);

        // Add table headers based on report type
        if (reportType === 'exam') {
          doc.text('Student Name', margin, yPosition);
          doc.text('Score', margin + 60, yPosition);
          doc.text('Time Spent', margin + 100, yPosition);
          doc.text('Status', margin + 140, yPosition);
          yPosition += 10;

          // Add line under headers
          doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
          yPosition += 5;

          // Add data rows
          data.details.forEach((item, index) => {
            if (yPosition > 270) { // Add new page if needed
              doc.addPage();
              yPosition = 30;
            }

            doc.text(item.studentName || 'N/A', margin, yPosition);
            doc.text(`${item.score || 0}%`, margin + 60, yPosition);
            doc.text(`${item.timeSpent || 0} min`, margin + 100, yPosition);
            doc.text(item.status || 'N/A', margin + 140, yPosition);
            yPosition += 8;
          });
        }
      }

      // Insights section
      if (data.insights && Array.isArray(data.insights) && data.insights.length > 0) {
        yPosition += 10;
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 30;
        }

        doc.setFontSize(16);
        doc.text('Key Insights & Recommendations', margin, yPosition);
        yPosition += 15;

        doc.setFontSize(10);
        data.insights.forEach((insight, index) => {
          if (yPosition > 270) {
            doc.addPage();
            yPosition = 30;
          }

          doc.text(`• ${insight}`, margin, yPosition);
          yPosition += 8;
        });
      }

      // Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text('ExamMaster Performance Analysis Report - Generated by AI Assistant',
                margin, doc.internal.pageSize.getHeight() - 10);
        doc.text(`Page ${i} of ${totalPages}`,
                pageWidth - margin - 20, doc.internal.pageSize.getHeight() - 10);
      }

      // Convert to buffer
      const pdfArrayBuffer = doc.output('arraybuffer');
      const pdfBuffer = Buffer.from(pdfArrayBuffer);

      console.log(`PDFService - Simple PDF created successfully, size: ${pdfBuffer.length} bytes`);
      return pdfBuffer;

    } catch (error) {
      console.error('PDFService - Error generating simple PDF:', error);
      throw error;
    }
  }

  /**
   * Save PDF to file system
   * @param {Buffer} pdfBuffer - PDF buffer
   * @param {string} filename - Filename
   * @returns {Promise<string>} File path
   */
  async savePDFToFile(pdfBuffer, filename) {
    try {
      const reportsDir = path.join(__dirname, '../uploads/reports');
      await fs.mkdir(reportsDir, { recursive: true });

      const filePath = path.join(reportsDir, filename);
      await fs.writeFile(filePath, pdfBuffer);

      console.log(`PDFService - PDF saved to: ${filePath}`);
      return filePath;

    } catch (error) {
      console.error('PDFService - Error saving PDF:', error);
      throw error;
    }
  }
}

module.exports = new PDFService();