const nodemailer = require('nodemailer');
const settingService = require('./settingService');

class EmailService {
  constructor() {
    this.transporter = null;
  }

  async initializeTransporter() {
    try {
      console.log('Initializing email transporter...');

      // Get SMTP settings from the settings service
      const smtpSettings = await settingService.getSetting('smtp');

      if (!smtpSettings || !smtpSettings.value) {
        console.log('No SMTP settings found, email service not available');
        return null;
      }

      const { host, port, secure, username, password } = smtpSettings.value;

      if (!host || !port || !username || !password) {
        console.log('Incomplete SMTP settings, email service not available');
        return null;
      }

      this.transporter = nodemailer.createTransporter({
        host: host,
        port: parseInt(port),
        secure: secure || false, // true for 465, false for other ports
        auth: {
          user: username,
          pass: password,
        },
      });

      // Verify connection configuration
      await this.transporter.verify();
      console.log('Email transporter initialized successfully');
      return this.transporter;
    } catch (error) {
      console.error('Error initializing email transporter:', error.message);
      this.transporter = null;
      return null;
    }
  }

  async sendExamResults(studentEmail, studentName, examTitle, score, percentage, totalMarks, passingMarks, passed) {
    try {
      console.log(`Sending exam results email to: ${studentEmail}`);

      if (!this.transporter) {
        await this.initializeTransporter();
      }

      if (!this.transporter) {
        throw new Error('Email service is not configured');
      }

      // Get sender email from settings
      const senderSettings = await settingService.getSetting('email_sender');
      const senderEmail = senderSettings?.value?.email || 'noreply@exammaster.com';
      const senderName = senderSettings?.value?.name || 'ExamMaster System';

      const mailOptions = {
        from: `"${senderName}" <${senderEmail}>`,
        to: studentEmail,
        subject: `Exam Results: ${examTitle}`,
        html: this.generateExamResultsTemplate(studentName, examTitle, score, percentage, totalMarks, passingMarks, passed)
      };

      console.log(`Sending email from: ${mailOptions.from} to: ${mailOptions.to}`);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${studentEmail}. Message ID: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      console.error(`Error sending exam results email to ${studentEmail}:`, error.message);
      throw error;
    }
  }

  generateExamResultsTemplate(studentName, examTitle, score, percentage, totalMarks, passingMarks, passed) {
    const statusColor = passed ? '#10B981' : '#EF4444';
    const statusText = passed ? 'PASSED' : 'FAILED';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Exam Results</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background-color: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
          }
          .title {
            font-size: 20px;
            color: #1f2937;
            margin: 0;
          }
          .status-badge {
            display: inline-block;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 14px;
            color: white;
            background-color: ${statusColor};
            margin: 20px 0;
          }
          .results-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin: 25px 0;
          }
          .result-item {
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
          }
          .result-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            font-weight: 600;
            margin-bottom: 5px;
          }
          .result-value {
            font-size: 24px;
            font-weight: bold;
            color: #1f2937;
          }
          .percentage {
            color: ${statusColor};
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
          }
          .disclaimer {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin-top: 20px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">ExamMaster</div>
            <h1 class="title">Exam Results</h1>
          </div>

          <div style="text-align: center;">
            <p>Dear <strong>${studentName}</strong>,</p>
            <p>Your results for the exam "<strong>${examTitle}</strong>" are now available.</p>

            <div class="status-badge">${statusText}</div>
          </div>

          <div class="results-grid">
            <div class="result-item">
              <div class="result-label">Your Score</div>
              <div class="result-value">${score}/${totalMarks}</div>
            </div>
            <div class="result-item">
              <div class="result-label">Percentage</div>
              <div class="result-value percentage">${percentage}%</div>
            </div>
            <div class="result-item">
              <div class="result-label">Passing Score</div>
              <div class="result-value">${passingMarks}/${totalMarks}</div>
            </div>
            <div class="result-item">
              <div class="result-label">Required %</div>
              <div class="result-value">${Math.round((passingMarks / totalMarks) * 100)}%</div>
            </div>
          </div>

          <div class="disclaimer">
            <strong>Note:</strong> This is an automated email. Please do not reply to this message.
            If you have any questions about your results, please contact your instructor or system administrator.
          </div>

          <div class="footer">
            <p>Best regards,<br><strong>ExamMaster Team</strong></p>
            <p><em>This email was sent automatically by the ExamMaster system.</em></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generatePasswordResetTemplate(userName, resetLink) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            background-color: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #0f766e;
            margin-bottom: 10px;
          }
          .title {
            font-size: 20px;
            color: #1f2937;
            margin: 0;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 14px;
            color: white;
            background-color: #0f766e;
            text-decoration: none;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
          }
          .disclaimer {
            background-color: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin-top: 20px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">ExamMaster</div>
            <h1 class="title">Password Reset Request</h1>
          </div>

          <div style="text-align: center;">
            <p>Dear <strong>${userName}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to choose a new one.</p>
            <a href="${resetLink}" class="button">Reset Password</a>
            <p style="font-size: 13px; color: #6b7280;">This link expires in 1 hour.</p>
          </div>

          <div class="disclaimer">
            <strong>Note:</strong> If you didn't request this, you can safely ignore this email — your password will not be changed.
          </div>

          <div class="footer">
            <p>Best regards,<br><strong>ExamMaster Team</strong></p>
            <p><em>This email was sent automatically by the ExamMaster system.</em></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  async sendPasswordReset(userEmail, userName, resetLink) {
    try {
      console.log(`Sending password reset email to: ${userEmail}`);

      if (!this.transporter) {
        await this.initializeTransporter();
      }

      if (!this.transporter) {
        throw new Error('Email service is not configured');
      }

      const senderSettings = await settingService.getSetting('email_sender');
      const senderEmail = senderSettings?.value?.email || 'noreply@exammaster.com';
      const senderName = senderSettings?.value?.name || 'ExamMaster System';

      const mailOptions = {
        from: `"${senderName}" <${senderEmail}>`,
        to: userEmail,
        subject: 'Reset Your ExamMaster Password',
        html: this.generatePasswordResetTemplate(userName, resetLink)
      };

      console.log(`Sending email from: ${mailOptions.from} to: ${mailOptions.to}`);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`Password reset email sent successfully to ${userEmail}. Message ID: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId
      };
    } catch (error) {
      console.error(`Error sending password reset email to ${userEmail}:`, error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      if (!this.transporter) {
        return {
          success: false,
          error: 'Email service is not configured'
        };
      }

      await this.transporter.verify();
      return {
        success: true,
        message: 'Email service is working properly'
      };
    } catch (error) {
      console.error('Email connection test failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new EmailService();