const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

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

      // Launch puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
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