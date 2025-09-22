const llmService = require('./llmService');
const AIPlatform = require('../models/AIPlatform');

class AIGradingService {

  /**
   * Grade a theory question using AI
   * @param {string} question - The question text
   * @param {string} studentAnswer - The student's answer
   * @param {string} sampleAnswer - The expected/sample answer
   * @param {number} maxMarks - Maximum marks for this question
   * @returns {Promise<Object>} - Grading result with score and feedback
   */
  static async gradeTheoryQuestion(question, studentAnswer, sampleAnswer, maxMarks) {
    try {
      console.log('AIGradingService: Starting theory question grading');
      console.log(`Question: ${question.substring(0, 100)}...`);
      console.log(`Student answer: ${studentAnswer.substring(0, 100)}...`);
      console.log(`Sample answer: ${sampleAnswer.substring(0, 100)}...`);
      console.log(`Max marks: ${maxMarks}`);

      // Get default AI platform
      const aiPlatform = await AIPlatform.getDefault();
      if (!aiPlatform) {
        throw new Error('No default AI platform configured. Please configure an AI platform in settings.');
      }

      // Validate that the platform has required configuration
      if (!aiPlatform.configuration || !aiPlatform.configuration.model) {
        throw new Error('AI platform configuration is incomplete. Please check settings.');
      }

      // Create the grading prompt
      const gradingPrompt = this.createGradingPrompt(question, studentAnswer, sampleAnswer, maxMarks);

      // Get API key for the platform
      let apiKey = null;
      if (aiPlatform.name === 'openai' || aiPlatform.name === 'anthropic') {
        // For security, get API key from platform configuration
        const platformWithKey = await AIPlatform.findById(aiPlatform._id).select('+configuration.apiKey');
        apiKey = platformWithKey.configuration.apiKey;

        if (!apiKey) {
          throw new Error(`API key not configured for ${aiPlatform.displayName}. Please configure it in settings.`);
        }
      }

      // Send request to LLM service
      console.log(`AIGradingService: Sending grading request to ${aiPlatform.name}`);
      const response = await llmService.sendLLMRequest(
        aiPlatform.name,
        aiPlatform.configuration.model,
        gradingPrompt,
        apiKey,
        {
          temperature: 0.3, // Low temperature for consistent grading
          maxTokens: 1000,
          topP: 1.0
        }
      );

      console.log('AIGradingService: Received response from AI platform');

      // Parse the AI response
      const gradingResult = this.parseAIGradingResponse(response.content, maxMarks);

      // Update platform usage statistics
      if (response.usage && response.usage.total_tokens) {
        await aiPlatform.updateUsage(response.usage.total_tokens);
      }

      console.log(`AIGradingService: Grading completed - Score: ${gradingResult.score}/${maxMarks}`);

      return {
        score: gradingResult.score,
        maxScore: maxMarks,
        feedback: gradingResult.feedback,
        aiPlatform: aiPlatform.displayName,
        gradedAt: new Date()
      };

    } catch (error) {
      console.error('AIGradingService: Error grading theory question:', error.message);
      throw new Error(`AI grading failed: ${error.message}`);
    }
  }

  /**
   * Grade multiple theory questions for an exam attempt
   * @param {Array} theoryQuestions - Array of theory questions with student answers
   * @returns {Promise<Object>} - Results for all theory questions
   */
  static async gradeMultipleTheoryQuestions(theoryQuestions) {
    try {
      console.log(`AIGradingService: Grading ${theoryQuestions.length} theory questions`);

      const results = [];
      let totalScore = 0;
      let totalMaxScore = 0;

      for (const questionData of theoryQuestions) {
        try {
          const gradingResult = await this.gradeTheoryQuestion(
            questionData.question,
            questionData.studentAnswer,
            questionData.sampleAnswer,
            questionData.maxMarks
          );

          results.push({
            questionId: questionData.questionId,
            ...gradingResult
          });

          totalScore += gradingResult.score;
          totalMaxScore += gradingResult.maxScore;

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`AIGradingService: Error grading question ${questionData.questionId}:`, error.message);

          // Add failed result
          results.push({
            questionId: questionData.questionId,
            score: 0,
            maxScore: questionData.maxMarks,
            feedback: `Grading failed: ${error.message}`,
            error: true,
            gradedAt: new Date()
          });

          totalMaxScore += questionData.maxMarks;
        }
      }

      console.log(`AIGradingService: Completed grading all questions - Total: ${totalScore}/${totalMaxScore}`);

      return {
        success: true,
        totalScore,
        totalMaxScore,
        results,
        gradedAt: new Date()
      };

    } catch (error) {
      console.error('AIGradingService: Error grading multiple questions:', error.message);
      throw error;
    }
  }

  /**
   * Create a structured prompt for AI grading
   * @param {string} question - The question text
   * @param {string} studentAnswer - Student's answer
   * @param {string} sampleAnswer - Expected answer
   * @param {number} maxMarks - Maximum marks
   * @returns {string} - Formatted prompt
   */
  static createGradingPrompt(question, studentAnswer, sampleAnswer, maxMarks) {
    return `You are an experienced examiner tasked with grading a theory question. Please evaluate the student's answer and provide a fair, objective score.

QUESTION:
${question}

SAMPLE/EXPECTED ANSWER:
${sampleAnswer}

STUDENT'S ANSWER:
${studentAnswer}

GRADING CRITERIA:
- Maximum marks available: ${maxMarks}
- Award marks based on correctness, completeness, and understanding demonstrated
- Consider partial credit for partially correct answers
- Be fair but maintain academic standards

Please provide your evaluation in this exact format:

SCORE: [number between 0 and ${maxMarks}]
FEEDBACK: [Brief explanation of the score, highlighting what was correct, what was missing, or what was incorrect. Keep it constructive and specific.]

Example format:
SCORE: 3
FEEDBACK: Good understanding of the main concept. The answer covers the key points but lacks specific examples that were mentioned in the sample answer. Minor factual errors in the second paragraph.`;
  }

  /**
   * Parse AI response to extract score and feedback
   * @param {string} aiResponse - Raw AI response
   * @param {number} maxMarks - Maximum possible marks
   * @returns {Object} - Parsed score and feedback
   */
  static parseAIGradingResponse(aiResponse, maxMarks) {
    try {
      console.log('AIGradingService: Parsing AI response');

      // Extract score using regex
      const scoreMatch = aiResponse.match(/SCORE:\s*(\d+(?:\.\d+)?)/i);
      let score = 0;

      if (scoreMatch) {
        score = parseFloat(scoreMatch[1]);

        // Ensure score is within valid range
        if (score < 0) score = 0;
        if (score > maxMarks) score = maxMarks;
      } else {
        console.warn('AIGradingService: Could not parse score from AI response, defaulting to 0');
      }

      // Extract feedback
      const feedbackMatch = aiResponse.match(/FEEDBACK:\s*(.*)/is);
      let feedback = 'AI grading completed';

      if (feedbackMatch) {
        feedback = feedbackMatch[1].trim();
      } else {
        // If structured format not found, use the entire response as feedback
        feedback = aiResponse.trim();
        console.warn('AIGradingService: Could not parse structured feedback, using full response');
      }

      // Clean up feedback (remove extra whitespace, limit length)
      feedback = feedback.replace(/\s+/g, ' ').trim();
      if (feedback.length > 500) {
        feedback = feedback.substring(0, 497) + '...';
      }

      console.log(`AIGradingService: Parsed score: ${score}/${maxMarks}`);

      return {
        score: Math.round(score * 100) / 100, // Round to 2 decimal places
        feedback
      };

    } catch (error) {
      console.error('AIGradingService: Error parsing AI response:', error.message);
      return {
        score: 0,
        feedback: 'Error parsing AI grading response. Please review manually.'
      };
    }
  }

  /**
   * Check if AI grading is available
   * @returns {Promise<boolean>} - Whether AI grading is available
   */
  static async isAIGradingAvailable() {
    try {
      const aiPlatform = await AIPlatform.getDefault();
      return aiPlatform && aiPlatform.isActive;
    } catch (error) {
      console.error('AIGradingService: Error checking AI availability:', error.message);
      return false;
    }
  }
}

module.exports = AIGradingService;