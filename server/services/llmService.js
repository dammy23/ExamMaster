const axios = require('axios');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const dotenv = require('dotenv');

dotenv.config();

function getOpenAIClient(apiKey) {
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
  }
  return new OpenAI({
    apiKey: apiKey,
    timeout: 60000,
  });
}

function getAnthropicClient(apiKey) {
  if (!apiKey) {
    throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
  }
  return new Anthropic({
    apiKey: apiKey,
    timeout: 60000,
  });
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendRequestToOpenAI(model, systemPrompt, history, message, apiKey, options = {}) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      console.log(`LLM Service - Sending OpenAI request (attempt ${i + 1}) with model: ${model}`);

      const openaiClient = getOpenAIClient(apiKey);
      const response = await openaiClient.chat.completions.create({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          { role: 'user', content: message }
        ],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1.0,
        presence_penalty: options.presencePenalty || 0,
        frequency_penalty: options.frequencyPenalty || 0,
      });

      const result = {
        content: response.choices[0].message.content,
        usage: response.usage || null
      };

      console.log(`LLM Service - OpenAI response received, tokens used:`, response.usage);
      return result;
    } catch (error) {
      console.error(`LLM Service - Error sending request to OpenAI (attempt ${i + 1}):`, error.message);
      if (error.response?.status === 429) {
        console.log('LLM Service - Rate limit hit, waiting longer before retry...');
        await sleep(RETRY_DELAY * (i + 1) * 2); // Exponential backoff
      } else if (i === MAX_RETRIES - 1) {
        throw new Error(`OpenAI API error: ${error.message}`);
      } else {
        await sleep(RETRY_DELAY);
      }
    }
  }
}

async function sendRequestToAnthropic(model, systemPrompt, history, message, apiKey, options = {}) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      console.log(`LLM Service - Sending Anthropic request (attempt ${i + 1}) with model: ${model}`);

      const anthropicClient = getAnthropicClient(apiKey);
      const response = await anthropicClient.messages.create({
        model: model,
        system: systemPrompt,
        messages: [
          ...history,
          { role: 'user', content: message }
        ],
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7,
        top_p: options.topP || 1.0,
      });

      const result = {
        content: response.content[0].text,
        usage: response.usage || null
      };

      console.log(`LLM Service - Anthropic response received, tokens used:`, response.usage);
      return result;
    } catch (error) {
      console.error(`LLM Service - Error sending request to Anthropic (attempt ${i + 1}):`, error.message);
      if (error.status === 429) {
        console.log('LLM Service - Rate limit hit, waiting longer before retry...');
        await sleep(RETRY_DELAY * (i + 1) * 2); // Exponential backoff
      } else if (i === MAX_RETRIES - 1) {
        throw new Error(`Anthropic API error: ${error.message}`);
      } else {
        await sleep(RETRY_DELAY);
      }
    }
  }
}

async function sendLLMRequest(provider, model, systemPrompt, history, message, apiKey, options = {}) {
  switch (provider.toLowerCase()) {
    case 'openai':
      return sendRequestToOpenAI(model, systemPrompt, history, message, apiKey, options);
    case 'anthropic':
      return sendRequestToAnthropic(model, systemPrompt, history, message, apiKey, options);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}

module.exports = {
  sendLLMRequest
};
