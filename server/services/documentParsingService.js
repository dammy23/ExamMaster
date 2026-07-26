const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');

console.log('Loading Document Parsing Service...');

class DocumentParsingService {

  // Parse uploaded document and extract text
  static async parseDocument(filePath, mimeType) {
    console.log(`Document Parsing Service - Parsing document: ${filePath} (${mimeType})`);

    try {
      let text = '';

      switch (mimeType) {
        case 'text/plain':
          text = await this.parseTextFile(filePath);
          break;
        case 'application/pdf':
          text = await this.parsePDF(filePath);
          break;
        case 'application/msword':
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          text = await this.parseWordDocument(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${mimeType}`);
      }

      console.log(`Document Parsing Service - Extracted ${text.length} characters of text`);
      return text.trim();

    } catch (error) {
      console.error(`Document Parsing Service - Error parsing document:`, error);
      throw new Error(`Failed to parse document: ${error.message}`);
    }
  }

  // Parse plain text file
  static async parseTextFile(filePath) {
    try {
      console.log(`Document Parsing Service - Reading text file: ${filePath}`);
      const content = await fs.readFile(filePath, 'utf8');
      return content;
    } catch (error) {
      console.error(`Document Parsing Service - Error reading text file:`, error);
      throw new Error(`Failed to read text file: ${error.message}`);
    }
  }

  // Parse PDF file
  static async parsePDF(filePath) {
    try {
      console.log(`Document Parsing Service - Parsing PDF: ${filePath}`);
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdf(dataBuffer);
      return data.text;
    } catch (error) {
      console.error(`Document Parsing Service - Error parsing PDF:`, error);
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
  }

  // Parse Word document (.doc/.docx)
  static async parseWordDocument(filePath) {
    try {
      console.log(`Document Parsing Service - Parsing Word document: ${filePath}`);
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch (error) {
      console.error(`Document Parsing Service - Error parsing Word document:`, error);
      throw new Error(`Failed to parse Word document: ${error.message}`);
    }
  }

}

console.log('Document Parsing Service loaded successfully');

module.exports = DocumentParsingService;