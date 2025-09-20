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

  // Generate questions from parsed text using AI
  static async generateQuestionsFromText(text, options = {}) {
    console.log(`Document Parsing Service - Generating questions from ${text.length} characters of text`);

    const {
      questionCount = 5,
      difficulty = 'medium',
      questionTypes = ['multiple-choice', 'true-false', 'short-answer'],
      subject = 'General'
    } = options;

    try {
      // Create comprehensive prompt for question generation
      const prompt = this.buildQuestionGenerationPrompt(text, {
        questionCount,
        difficulty,
        questionTypes,
        subject
      });

      console.log(`Document Parsing Service - Generated prompt length: ${prompt.length} characters`);

      // In a real implementation, this would call an AI service
      // For now, we'll generate sample questions based on content analysis
      const questions = this.generateSampleQuestions(text, {
        questionCount,
        difficulty,
        questionTypes,
        subject
      });

      console.log(`Document Parsing Service - Generated ${questions.length} questions`);
      return questions;

    } catch (error) {
      console.error(`Document Parsing Service - Error generating questions:`, error);
      throw new Error(`Failed to generate questions: ${error.message}`);
    }
  }

  // Build comprehensive prompt for AI question generation
  static buildQuestionGenerationPrompt(text, options) {
    const { questionCount, difficulty, questionTypes, subject } = options;

    return `Generate ${questionCount} educational questions based on the following text content.

REQUIREMENTS:
- Question Types: ${questionTypes.join(', ')}
- Difficulty Level: ${difficulty}
- Subject Area: ${subject}
- Each question must be valid according to ExamMaster schema requirements

FORMAT REQUIREMENTS:
For Multiple Choice Questions:
- Must have 4-6 options
- At least one correct answer
- Include explanation
- Question length: 10-1000 characters

For True/False Questions:
- Must have exactly one correct answer ("true" or "false")
- Include explanation
- Question length: 10-1000 characters

For Short Answer Questions:
- Provide sample correct answers
- Include explanation
- Question length: 10-1000 characters

CONTENT TO ANALYZE:
${text.substring(0, 4000)}${text.length > 4000 ? '...[truncated]' : ''}

Return questions in JSON format with the following structure:
{
  "questions": [
    {
      "type": "multiple-choice|true-false|short-answer",
      "question": "Question text here",
      "options": ["option1", "option2", "option3", "option4"], // Only for MCQ
      "correctAnswers": ["correct answer(s)"],
      "explanation": "Explanation of the answer",
      "difficulty": "${difficulty}",
      "marks": 1-5 // Assign marks based on difficulty
    }
  ]
}`;
  }

  // Generate sample questions based on text analysis (fallback method)
  static generateSampleQuestions(text, options) {
    const { questionCount, difficulty, questionTypes, subject } = options;

    console.log(`Document Parsing Service - Generating ${questionCount} sample questions`);

    const questions = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);

    for (let i = 0; i < questionCount && i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      const questionType = questionTypes[i % questionTypes.length];

      let question;

      switch (questionType) {
        case 'multiple-choice':
          question = this.generateMCQFromSentence(sentence, difficulty);
          break;
        case 'true-false':
          question = this.generateTrueFalseFromSentence(sentence, difficulty);
          break;
        case 'short-answer':
          question = this.generateShortAnswerFromSentence(sentence, difficulty);
          break;
        default:
          question = this.generateMCQFromSentence(sentence, difficulty);
      }

      if (question) {
        questions.push(question);
      }
    }

    return questions;
  }

  // Generate MCQ from sentence
  static generateMCQFromSentence(sentence, difficulty) {
    const marks = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3;

    // Extract key terms and create question
    const words = sentence.split(' ').filter(word => word.length > 4);
    const keyWord = words[Math.floor(Math.random() * words.length)];

    return {
      type: 'multiple-choice',
      question: `Based on the content, which statement is most accurate regarding ${keyWord}?`,
      options: [
        sentence.substring(0, 100) + '...',
        'This is an incorrect alternative option A',
        'This is an incorrect alternative option B',
        'This is an incorrect alternative option C'
      ],
      correctAnswers: [sentence.substring(0, 100) + '...'],
      explanation: `This question tests comprehension of the key concept about ${keyWord} mentioned in the source material.`,
      difficulty,
      marks
    };
  }

  // Generate True/False from sentence
  static generateTrueFalseFromSentence(sentence, difficulty) {
    const marks = difficulty === 'easy' ? 1 : difficulty === 'medium' ? 1 : 2;

    const isTrue = Math.random() > 0.5;
    const questionText = isTrue ? sentence : sentence.replace(/is|are|was|were/, 'is not');

    return {
      type: 'true-false',
      question: `True or False: ${questionText.substring(0, 200)}`,
      correctAnswers: [isTrue ? 'true' : 'false'],
      explanation: `This statement is ${isTrue ? 'true' : 'false'} according to the source material.`,
      difficulty,
      marks
    };
  }

  // Generate Short Answer from sentence
  static generateShortAnswerFromSentence(sentence, difficulty) {
    const marks = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 5;

    const words = sentence.split(' ').filter(word => word.length > 4);
    const keyWord = words[0] || 'concept';

    return {
      type: 'short-answer',
      question: `Explain the significance of ${keyWord} as mentioned in the content. Provide a brief explanation with supporting details.`,
      correctAnswers: [
        sentence.substring(0, 200),
        `Key points about ${keyWord} include the information provided in the source material.`
      ],
      explanation: `This question assesses understanding of ${keyWord} and requires students to demonstrate comprehension through written explanation.`,
      difficulty,
      marks
    };
  }

  // Validate generated questions against schema
  static validateGeneratedQuestions(questions) {
    console.log(`Document Parsing Service - Validating ${questions.length} generated questions`);

    const validQuestions = [];
    const errors = [];

    questions.forEach((question, index) => {
      try {
        // Basic validation
        if (!question.question || question.question.length < 10 || question.question.length > 1000) {
          throw new Error(`Question text must be between 10-1000 characters`);
        }

        if (!question.type || !['multiple-choice', 'true-false', 'short-answer'].includes(question.type)) {
          throw new Error(`Invalid question type: ${question.type}`);
        }

        if (!question.correctAnswers || question.correctAnswers.length === 0) {
          throw new Error(`Question must have at least one correct answer`);
        }

        if (!question.difficulty || !['easy', 'medium', 'hard'].includes(question.difficulty)) {
          throw new Error(`Invalid difficulty level: ${question.difficulty}`);
        }

        if (!question.marks || question.marks < 1 || question.marks > 100) {
          throw new Error(`Marks must be between 1-100`);
        }

        // Type-specific validation
        if (question.type === 'multiple-choice') {
          if (!question.options || question.options.length < 4 || question.options.length > 6) {
            throw new Error(`MCQ must have 4-6 options`);
          }

          // Verify correct answers exist in options
          for (const correctAnswer of question.correctAnswers) {
            if (!question.options.includes(correctAnswer)) {
              throw new Error(`Correct answer "${correctAnswer}" not found in options`);
            }
          }
        }

        if (question.type === 'true-false') {
          if (question.correctAnswers.length !== 1) {
            throw new Error(`True/false questions must have exactly one correct answer`);
          }

          if (!['true', 'false'].includes(question.correctAnswers[0].toLowerCase())) {
            throw new Error(`True/false answer must be "true" or "false"`);
          }
        }

        validQuestions.push(question);

      } catch (error) {
        console.error(`Document Parsing Service - Question ${index + 1} validation error:`, error.message);
        errors.push(`Question ${index + 1}: ${error.message}`);
      }
    });

    console.log(`Document Parsing Service - Validated ${validQuestions.length}/${questions.length} questions`);

    return {
      validQuestions,
      errors,
      totalGenerated: questions.length,
      totalValid: validQuestions.length
    };
  }

  // Clean up uploaded files after processing
  static async cleanupFile(filePath) {
    try {
      console.log(`Document Parsing Service - Cleaning up file: ${filePath}`);
      await fs.unlink(filePath);
      console.log(`Document Parsing Service - File cleaned up successfully`);
    } catch (error) {
      console.error(`Document Parsing Service - Error cleaning up file:`, error);
      // Don't throw error for cleanup failures
    }
  }
}

console.log('Document Parsing Service loaded successfully');

module.exports = DocumentParsingService;