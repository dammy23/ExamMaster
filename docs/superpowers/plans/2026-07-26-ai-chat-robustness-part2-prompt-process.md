# AI Chat Robustness — Part 2: Prompt & AI Process Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI Chat's prompts and request pipeline actually work as advertised — real conversation memory, real file-content reading, proper use of each provider's native system-prompt mechanism, and honest fallback-vs-real-AI signaling — while deleting a duplicated, drifting intent-guessing engine on the server.

**Architecture:** One cohesive rewrite of the request pipeline (`llmService.js` + `aiChatService.js`'s `sendMessage`/`processAIRequest`/`buildSystemPrompt`/`processOllamaRequest`, plus a new `extractFileText` method), landed as a single task since the caller/callee signature changes must move together. Three smaller, independent tasks around it: model schema support, fallback-response simplification, and client surfacing.

**Tech Stack:** Express + Mongoose (backend), OpenAI/Anthropic Node SDKs, React + TypeScript (client). No automated test framework exists in this repo.

## Global Constraints

- Backend verification: `node --check <file>` (no test framework exists).
- Client verification: `npx tsc --noEmit -p tsconfig.app.json` from `client/`, compared against the current baseline of **101** pre-existing errors — task changes must not increase this count.
- Conversation memory is the last 5 `AIChat` documents per user (10 messages: 5 user + 5 assistant turns) — no new session/thread concept.
- File text extraction is capped at 8,000 characters; unsupported mime types or parse failures fall back to filename-only context rather than failing the request.
- Ollama's request path stays on its existing `/api/generate` (single-prompt) endpoint — no switch to `/api/chat`.
- `generateExamAssistantResponse` is deleted entirely, not kept or partially reused.

---

### Task 1: `AIChat` model — `isFallback` field, recent-history query, history-response field

**Files:**
- Modify: `server/models/AIChat.js`
- Modify: `server/services/aiChatService.js:531-555` (`getChatHistory`'s response mapping only, in this task)

**Interfaces:**
- Produces: `AIChat.getRecentMessages(userId, limit = 5): Promise<Array<{message, response, ...}>>` (newest first, plain lean objects), consumed by Task 2's `sendMessage`. `AIChat` schema gains `isFallback: Boolean` (default `false`), consumed by Task 2's `sendMessage` (writes it) and this task's `getChatHistory` mapping (reads it).

- [ ] **Step 1: Add the `isFallback` schema field**

Replace:

```js
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});
```

with:

```js
  isDeleted: {
    type: Boolean,
    default: false
  },
  isFallback: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});
```

- [ ] **Step 2: Add the `getRecentMessages` static method**

Replace:

```js
// Static method to find active chats
aiChatSchema.statics.findActive = function(filter = {}) {
  console.log('Finding active AI chat messages with filter:', filter);
  return this.find({ ...filter, isDeleted: false });
};

// Static method to get chat history for a user with improved pagination
```

with:

```js
// Static method to find active chats
aiChatSchema.statics.findActive = function(filter = {}) {
  console.log('Finding active AI chat messages with filter:', filter);
  return this.find({ ...filter, isDeleted: false });
};

// Static method to get the most recent N messages for a user (newest first), for conversation memory
aiChatSchema.statics.getRecentMessages = function(userId, limit = 5) {
  console.log(`Getting ${limit} most recent messages for user ${userId}`);
  return this.find({ userId, isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to get chat history for a user with improved pagination
```

- [ ] **Step 3: Verify syntax**

Run: `node --check server/models/AIChat.js`
Expected: no output (exits 0)

- [ ] **Step 4: Add `isFallback` to `getChatHistory`'s response mapping**

Replace:

```js
        messages: result.messages.map(msg => ({
          _id: msg._id,
          message: msg.message,
          response: msg.response,
          timestamp: msg.createdAt,
          modelId: msg.modelId,
          agentId: msg.agentId,
          fileAttachment: msg.fileAttachment
        })),
```

with:

```js
        messages: result.messages.map(msg => ({
          _id: msg._id,
          message: msg.message,
          response: msg.response,
          timestamp: msg.createdAt,
          modelId: msg.modelId,
          agentId: msg.agentId,
          fileAttachment: msg.fileAttachment,
          isFallback: msg.isFallback
        })),
```

- [ ] **Step 5: Verify syntax**

Run: `node --check server/services/aiChatService.js`
Expected: no output (exits 0)

- [ ] **Step 6: Commit**

```bash
git add server/models/AIChat.js server/services/aiChatService.js
git commit -m "feat: add isFallback field and recent-message query to AIChat model"
```

---

### Task 2: Wire native system role, conversation memory, and real file content into the request pipeline

**Files:**
- Modify: `server/services/llmService.js` (full file)
- Modify: `server/services/aiChatService.js` (`sendMessage`, `processAIRequest`, `buildSystemPrompt`, `processOllamaRequest`; new `extractFileText` method)
- Modify: `server/routes/aiChatRoutes.js:118-126`

**Interfaces:**
- Consumes: `AIChat.getRecentMessages` and the `isFallback` schema field from Task 1; `DocumentParsingService.parseDocument(filePath, mimeType): Promise<string>` (existing, unchanged).
- Produces: `llmService.sendLLMRequest(provider, model, systemPrompt, history, message, apiKey, options): Promise<{content, usage}>` — signature changed (was `(provider, model, message, apiKey, options)`). `AIChatService.sendMessage(userId, messageData)`'s return gains `isFallback: boolean`. `AIChatService.extractFileText(fileAttachment): Promise<string | null>` — new method, consumed only within this task. The `/message` route's JSON response gains `isFallback`, consumed by Task 4's client code.

- [ ] **Step 1: Update `llmService.js` to accept and use a native system role**

Replace:

```js
async function sendRequestToOpenAI(model, message, apiKey,options = {}) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      console.log(`LLM Service - Sending OpenAI request (attempt ${i + 1}) with model: ${model}`);
      
      const openaiClient = getOpenAIClient(apiKey);
      const response = await openaiClient.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: message }],
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

async function sendRequestToAnthropic(model, message, apiKey, options = {}) {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      console.log(`LLM Service - Sending Anthropic request (attempt ${i + 1}) with model: ${model}`);
      
      const anthropicClient = getAnthropicClient(apiKey);
      const response = await anthropicClient.messages.create({
        model: model,
        messages: [{ role: 'user', content: message }],
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

async function sendLLMRequest(provider, model, message, apiKey,options = {}) {
  switch (provider.toLowerCase()) {
    case 'openai':
      return sendRequestToOpenAI(model, message, apiKey,options);
    case 'anthropic':
      return sendRequestToAnthropic(model, message, apiKey, options);
    default:
      throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
```

with:

```js
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
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server/services/llmService.js`
Expected: no output (exits 0)

- [ ] **Step 3: Rewrite `sendMessage` to fetch history, extract file text, and record `isFallback`**

Replace:

```js
  static async sendMessage(userId, messageData) {
    const { message, modelId, agentId, fileAttachment } = messageData;
    
    console.log(`AI Chat Service - Processing message for user ${userId}`);
    console.log(`AI Chat Service - Platform: ${modelId}, Agent: ${agentId}`);
    console.log(`AI Chat Service - Message length: ${message.length} characters`);
    
    try {
      // Validate platform and agent exist and are active
      const [platform, agent] = await Promise.all([
        AIPlatform.findById(modelId).select('+configuration.apiKey'),
        AIAgent.findOne({ agentId, isActive: true, isDeleted: false })
      ]);
      
      if (!platform || !platform.isActive || platform.isDeleted) {
        console.error(`AI Chat Service - Platform ${modelId} not found or inactive`);
        throw new Error(`AI platform not found or inactive`);
      }
      
      if (!agent) {
        console.error(`AI Chat Service - Agent ${agentId} not found or inactive`);
        throw new Error(`AI agent '${agentId}' not found or inactive`);
      }
      
      console.log(`AI Chat Service - Using platform: ${platform.displayName} (${platform.name})`);
      console.log(`AI Chat Service - Using agent: ${agent.name}`);
      
      const startTime = Date.now();
      
      // Process AI request using configured platform
      // In a real implementation, this would call the actual AI API
      const aiResponse = await this.processAIRequest(message, platform, agent, fileAttachment);
      
      // Update platform usage statistics
      await platform.updateUsage(aiResponse.tokenCount.input + aiResponse.tokenCount.output);
      
      const processingTime = Date.now() - startTime;
      console.log(`AI Chat Service - Processing completed in ${processingTime}ms`);
      
      // Save chat message to database
      const chatMessage = new AIChat({
        userId,
        message: message.trim(),
        response: aiResponse.response,
        modelId, // This is actually platformId now
        agentId,
        fileAttachment: fileAttachment ? {
          fileName: fileAttachment.fileName,
          fileUrl: fileAttachment.fileUrl,
          fileSize: fileAttachment.fileSize,
          mimeType: fileAttachment.mimeType
        } : undefined,
        metadata: {
          processingTime,
          tokenCount: aiResponse.tokenCount,
          cost: aiResponse.cost
        }
      });
      
      const savedMessage = await chatMessage.save();
      console.log(`AI Chat Service - Message saved with ID: ${savedMessage._id}`);
      
      return {
        response: aiResponse.response,
        messageId: savedMessage._id.toString(),
        processingTime,
        tokenCount: aiResponse.tokenCount
      };
      
    } catch (error) {
      console.error('AI Chat Service - Error processing message:', error);
      throw error;
    }
  }
```

with:

```js
  static async sendMessage(userId, messageData) {
    const { message, modelId, agentId, fileAttachment } = messageData;
    
    console.log(`AI Chat Service - Processing message for user ${userId}`);
    console.log(`AI Chat Service - Platform: ${modelId}, Agent: ${agentId}`);
    console.log(`AI Chat Service - Message length: ${message.length} characters`);
    
    try {
      // Validate platform and agent exist and are active
      const [platform, agent] = await Promise.all([
        AIPlatform.findById(modelId).select('+configuration.apiKey'),
        AIAgent.findOne({ agentId, isActive: true, isDeleted: false })
      ]);
      
      if (!platform || !platform.isActive || platform.isDeleted) {
        console.error(`AI Chat Service - Platform ${modelId} not found or inactive`);
        throw new Error(`AI platform not found or inactive`);
      }
      
      if (!agent) {
        console.error(`AI Chat Service - Agent ${agentId} not found or inactive`);
        throw new Error(`AI agent '${agentId}' not found or inactive`);
      }
      
      console.log(`AI Chat Service - Using platform: ${platform.displayName} (${platform.name})`);
      console.log(`AI Chat Service - Using agent: ${agent.name}`);
      
      const startTime = Date.now();
      
      // Fetch recent turns for conversation memory (newest first, so reverse to chronological order)
      const recentMessages = await AIChat.getRecentMessages(userId, 5);
      const history = [];
      recentMessages.reverse().forEach(msg => {
        history.push({ role: 'user', content: msg.message });
        history.push({ role: 'assistant', content: msg.response });
      });
      console.log(`AI Chat Service - Including ${recentMessages.length} prior turns as conversation history`);
      
      // Extract real file content if a supported document was attached
      const extractedFileText = fileAttachment ? await this.extractFileText(fileAttachment) : null;
      
      // Process AI request using configured platform
      const aiResponse = await this.processAIRequest(message, platform, agent, fileAttachment, history, extractedFileText);
      
      // Update platform usage statistics
      await platform.updateUsage(aiResponse.tokenCount.input + aiResponse.tokenCount.output);
      
      const processingTime = Date.now() - startTime;
      console.log(`AI Chat Service - Processing completed in ${processingTime}ms`);
      
      // Save chat message to database
      const chatMessage = new AIChat({
        userId,
        message: message.trim(),
        response: aiResponse.response,
        modelId, // This is actually platformId now
        agentId,
        fileAttachment: fileAttachment ? {
          fileName: fileAttachment.fileName,
          fileUrl: fileAttachment.fileUrl,
          fileSize: fileAttachment.fileSize,
          mimeType: fileAttachment.mimeType
        } : undefined,
        metadata: {
          processingTime,
          tokenCount: aiResponse.tokenCount,
          cost: aiResponse.cost
        },
        isFallback: aiResponse.isFallback
      });
      
      const savedMessage = await chatMessage.save();
      console.log(`AI Chat Service - Message saved with ID: ${savedMessage._id}`);
      
      return {
        response: aiResponse.response,
        messageId: savedMessage._id.toString(),
        processingTime,
        tokenCount: aiResponse.tokenCount,
        isFallback: aiResponse.isFallback
      };
      
    } catch (error) {
      console.error('AI Chat Service - Error processing message:', error);
      throw error;
    }
  }
```

- [ ] **Step 4: Rewrite `processAIRequest` to use system role, history, and record `isFallback`**

Replace:

```js
  // Process AI request using configured platform
  static async processAIRequest(message, platform, agent, fileAttachment) {
    console.log(`AI Chat Service - Processing AI request with ${platform.displayName} (${platform.configuration.model}) and ${agent.name}`);
    
    try {
      // Validate platform has required configuration
      if (!platform.configuration.apiKey && platform.name !== 'ollama') {
        throw new Error(`API key not configured for ${platform.displayName}`);
      }
      
      if (platform.name === 'ollama' && !platform.configuration.baseUrl) {
        throw new Error(`Base URL not configured for ${platform.displayName}`);
      }
      
      // Build system prompt using agent configuration
      const systemPrompt = this.buildSystemPrompt(agent, fileAttachment);
      
      // Combine system prompt with user message
      const fullMessage = `${systemPrompt}\n\nUser: ${message}`;
      
      console.log(`AI Chat Service - Sending request to ${platform.name} with model ${platform.configuration.model}`);
      console.log(`AI Chat Service - Message length: ${fullMessage.length} characters`);
      
      let response;
      let inputTokens = 0;
      let outputTokens = 0;
      
      if (platform.name === 'ollama') {
        // Handle Ollama separately as it uses different API
        response = await this.processOllamaRequest(message, platform, systemPrompt);
        // Estimate tokens for Ollama (no exact count available)
        inputTokens = Math.ceil(fullMessage.length / 4);
        outputTokens = Math.ceil(response.length / 4);
      } else {
        // Use existing LLM service for OpenAI and Anthropic
        const options = {
          maxTokens: platform.configuration.maxTokens || 4096,
          temperature: platform.configuration.temperature || 0.7,
          topP: platform.configuration.topP || 1.0,
          presencePenalty: platform.configuration.presencePenalty || 0,
          frequencyPenalty: platform.configuration.frequencyPenalty || 0
        };
        
        
        const llmResponse = await llmService.sendLLMRequest(
          platform.name,
          platform.configuration.model,
          fullMessage,
          platform.configuration.apiKey,
          options
        );
        
        response = llmResponse.content;
        
        // Use real token counts if available, otherwise estimate
        if (llmResponse.usage) {
          inputTokens = llmResponse.usage.prompt_tokens || llmResponse.usage.input_tokens || 0;
          outputTokens = llmResponse.usage.completion_tokens || llmResponse.usage.output_tokens || 0;
          console.log(`AI Chat Service - Real token usage from ${platform.name}: input=${inputTokens}, output=${outputTokens}`);
        } else {
          // Fallback to estimation if no usage data available
          inputTokens = Math.ceil(fullMessage.length / 4);
          outputTokens = Math.ceil(response.length / 4);
          console.log(`AI Chat Service - Estimated token usage: input=${inputTokens}, output=${outputTokens}`);
        }
      }
      
      // Calculate estimated cost based on platform pricing
      const cost = this.calculateCost(platform, inputTokens, outputTokens);
      
      console.log(`AI Chat Service - Response received from ${platform.name}`);
      console.log(`AI Chat Service - Tokens used - Input: ${inputTokens}, Output: ${outputTokens}, Cost: $${cost}`);
      
      return {
        response: response.trim(),
        tokenCount: {
          input: inputTokens,
          output: outputTokens
        },
        cost: Math.round(cost * 100) / 100 // round to 2 decimal places
      };
      
    } catch (error) {
      console.error(`AI Chat Service - Error processing request with ${platform.name}:`, error);
      
      // Provide fallback response if AI service fails
      const fallbackResponse = await this.generateFallbackResponse(agent.agentId, message, error.message);

      return {
        response: fallbackResponse,
        tokenCount: {
          input: Math.ceil(message.length / 4),
          output: Math.ceil(fallbackResponse.length / 4)
        },
        cost: 0 // No cost for fallback response
      };
    }
  }
```

with:

```js
  // Process AI request using configured platform
  static async processAIRequest(message, platform, agent, fileAttachment, history, extractedFileText) {
    console.log(`AI Chat Service - Processing AI request with ${platform.displayName} (${platform.configuration.model}) and ${agent.name}`);
    
    try {
      // Validate platform has required configuration
      if (!platform.configuration.apiKey && platform.name !== 'ollama') {
        throw new Error(`API key not configured for ${platform.displayName}`);
      }
      
      if (platform.name === 'ollama' && !platform.configuration.baseUrl) {
        throw new Error(`Base URL not configured for ${platform.displayName}`);
      }
      
      // Build system prompt using agent configuration
      const systemPrompt = this.buildSystemPrompt(agent, fileAttachment, extractedFileText);
      
      console.log(`AI Chat Service - Sending request to ${platform.name} with model ${platform.configuration.model}`);
      console.log(`AI Chat Service - System prompt length: ${systemPrompt.length} characters, history turns: ${history.length}`);
      
      let response;
      let inputTokens = 0;
      let outputTokens = 0;
      const estimatedInputLength = systemPrompt.length + message.length + history.reduce((sum, h) => sum + h.content.length, 0);
      
      if (platform.name === 'ollama') {
        // Handle Ollama separately as it uses different API
        response = await this.processOllamaRequest(message, platform, systemPrompt, history);
        // Estimate tokens for Ollama (no exact count available)
        inputTokens = Math.ceil(estimatedInputLength / 4);
        outputTokens = Math.ceil(response.length / 4);
      } else {
        // Use existing LLM service for OpenAI and Anthropic
        const options = {
          maxTokens: platform.configuration.maxTokens || 4096,
          temperature: platform.configuration.temperature || 0.7,
          topP: platform.configuration.topP || 1.0,
          presencePenalty: platform.configuration.presencePenalty || 0,
          frequencyPenalty: platform.configuration.frequencyPenalty || 0
        };
        
        
        const llmResponse = await llmService.sendLLMRequest(
          platform.name,
          platform.configuration.model,
          systemPrompt,
          history,
          message,
          platform.configuration.apiKey,
          options
        );
        
        response = llmResponse.content;
        
        // Use real token counts if available, otherwise estimate
        if (llmResponse.usage) {
          inputTokens = llmResponse.usage.prompt_tokens || llmResponse.usage.input_tokens || 0;
          outputTokens = llmResponse.usage.completion_tokens || llmResponse.usage.output_tokens || 0;
          console.log(`AI Chat Service - Real token usage from ${platform.name}: input=${inputTokens}, output=${outputTokens}`);
        } else {
          // Fallback to estimation if no usage data available
          inputTokens = Math.ceil(estimatedInputLength / 4);
          outputTokens = Math.ceil(response.length / 4);
          console.log(`AI Chat Service - Estimated token usage: input=${inputTokens}, output=${outputTokens}`);
        }
      }
      
      // Calculate estimated cost based on platform pricing
      const cost = this.calculateCost(platform, inputTokens, outputTokens);
      
      console.log(`AI Chat Service - Response received from ${platform.name}`);
      console.log(`AI Chat Service - Tokens used - Input: ${inputTokens}, Output: ${outputTokens}, Cost: $${cost}`);
      
      return {
        response: response.trim(),
        tokenCount: {
          input: inputTokens,
          output: outputTokens
        },
        cost: Math.round(cost * 100) / 100, // round to 2 decimal places
        isFallback: false
      };
      
    } catch (error) {
      console.error(`AI Chat Service - Error processing request with ${platform.name}:`, error);
      
      // Provide fallback response if AI service fails
      const fallbackResponse = await this.generateFallbackResponse(agent.agentId, message, error.message);

      return {
        response: fallbackResponse,
        tokenCount: {
          input: Math.ceil(message.length / 4),
          output: Math.ceil(fallbackResponse.length / 4)
        },
        cost: 0, // No cost for fallback response
        isFallback: true
      };
    }
  }
```

- [ ] **Step 5: Update `buildSystemPrompt` to use real extracted file text**

Replace:

```js
  // Build system prompt using agent configuration
  static buildSystemPrompt(agent, fileAttachment) {
    let systemPrompt = agent.systemPrompt || `You are ${agent.name}, ${agent.description}`;
    
    // Add ExamMaster context
    systemPrompt += `\n\nYou are working within ExamMaster, a comprehensive Computer-Based Examination (CBE) platform. The system includes:
- Exam creation and management
- Question banks with multiple question types (MCQ, True/False, Short Answer)
- Student management and group organization
- Automated grading and manual review for subjective questions
- Real-time monitoring and proctoring features
- Performance analytics and reporting
- AI-powered assistance for various tasks

Your capabilities include: ${agent.capabilities.join(', ')}.`;

    // Add file attachment context if present
    if (fileAttachment) {
      systemPrompt += `\n\nNote: The user has attached a file "${fileAttachment.fileName}" (${fileAttachment.mimeType}). Consider this file in your response if relevant to their question.`;
    }

    systemPrompt += `\n\nProvide helpful, accurate, and detailed responses. Format your responses clearly with markdown when appropriate.
```

with:

```js
  // Build system prompt using agent configuration
  static buildSystemPrompt(agent, fileAttachment, extractedFileText) {
    let systemPrompt = agent.systemPrompt || `You are ${agent.name}, ${agent.description}`;
    
    // Add ExamMaster context
    systemPrompt += `\n\nYou are working within ExamMaster, a comprehensive Computer-Based Examination (CBE) platform. The system includes:
- Exam creation and management
- Question banks with multiple question types (MCQ, True/False, Short Answer)
- Student management and group organization
- Automated grading and manual review for subjective questions
- Real-time monitoring and proctoring features
- Performance analytics and reporting
- AI-powered assistance for various tasks

Your capabilities include: ${agent.capabilities.join(', ')}.`;

    // Add file attachment context if present
    if (fileAttachment && extractedFileText) {
      systemPrompt += `\n\nThe user has attached a file "${fileAttachment.fileName}". Its content:\n\n${extractedFileText}\n\nConsider this content in your response.`;
    } else if (fileAttachment) {
      systemPrompt += `\n\nNote: The user has attached a file "${fileAttachment.fileName}" (${fileAttachment.mimeType}). Its content could not be read automatically; ask the user to paste relevant text if needed.`;
    }

    systemPrompt += `\n\nProvide helpful, accurate, and detailed responses. Format your responses clearly with markdown when appropriate.
```

- [ ] **Step 6: Update `processOllamaRequest` to render history text and add `extractFileText`**

Replace:

```js
  // Process Ollama request (different API structure)
  static async processOllamaRequest(message, platform, systemPrompt) {
    console.log(`AI Chat Service - Processing Ollama request to ${platform.configuration.baseUrl}`);
    
    try {
      const axios = require('axios');
      const response = await axios.post(`${platform.configuration.baseUrl}/api/generate`, {
        model: platform.configuration.model,
        prompt: `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`,
        stream: false,
        options: {
          temperature: platform.configuration.temperature || 0.7,
          top_p: platform.configuration.topP || 1.0,
          num_predict: platform.configuration.maxTokens || 4096
        }
      }, {
        timeout: 60000 // 60 second timeout
      });
      
      if (response.data && response.data.response) {
        console.log(`AI Chat Service - Received response from Ollama: ${response.data.response.length} characters`);
        return response.data.response;
      } else {
        throw new Error('Invalid response format from Ollama');
      }
    } catch (error) {
      console.error(`AI Chat Service - Ollama request failed:`, error);
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to Ollama server at ${platform.configuration.baseUrl}. Please ensure Ollama is running.`);
      }
      throw new Error(`Ollama request failed: ${error.message}`);
    }
  }
```

with:

```js
  // Process Ollama request (different API structure)
  static async processOllamaRequest(message, platform, systemPrompt, history) {
    console.log(`AI Chat Service - Processing Ollama request to ${platform.configuration.baseUrl}`);
    
    try {
      const axios = require('axios');

      let historyText = '';
      if (history && history.length > 0) {
        historyText += 'Previous conversation:\n';
        for (let i = 0; i < history.length; i += 2) {
          historyText += `User: ${history[i].content}\nAssistant: ${history[i + 1].content}\n`;
        }
        historyText += '\n';
      }

      const prompt = `${systemPrompt}\n\n${historyText}Current question:\nUser: ${message}\n\nAssistant:`;

      const response = await axios.post(`${platform.configuration.baseUrl}/api/generate`, {
        model: platform.configuration.model,
        prompt,
        stream: false,
        options: {
          temperature: platform.configuration.temperature || 0.7,
          top_p: platform.configuration.topP || 1.0,
          num_predict: platform.configuration.maxTokens || 4096
        }
      }, {
        timeout: 60000 // 60 second timeout
      });
      
      if (response.data && response.data.response) {
        console.log(`AI Chat Service - Received response from Ollama: ${response.data.response.length} characters`);
        return response.data.response;
      } else {
        throw new Error('Invalid response format from Ollama');
      }
    } catch (error) {
      console.error(`AI Chat Service - Ollama request failed:`, error);
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to Ollama server at ${platform.configuration.baseUrl}. Please ensure Ollama is running.`);
      }
      throw new Error(`Ollama request failed: ${error.message}`);
    }
  }

  // Extract real text content from a supported uploaded file for AI context
  static async extractFileText(fileAttachment) {
    const SUPPORTED_MIME_TYPES = [
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!SUPPORTED_MIME_TYPES.includes(fileAttachment.mimeType)) {
      console.log(`AI Chat Service - Skipping file text extraction, unsupported mime type: ${fileAttachment.mimeType}`);
      return null;
    }

    try {
      const path = require('path');
      const DocumentParsingService = require('./documentParsingService');
      const diskPath = path.join(__dirname, '..', fileAttachment.fileUrl);
      const text = await DocumentParsingService.parseDocument(diskPath, fileAttachment.mimeType);

      const MAX_LENGTH = 8000;
      if (text.length > MAX_LENGTH) {
        console.log(`AI Chat Service - Truncating extracted file text from ${text.length} to ${MAX_LENGTH} characters`);
        return `${text.substring(0, MAX_LENGTH)}\n...[truncated]`;
      }
      return text;
    } catch (error) {
      console.error(`AI Chat Service - Failed to extract file text for ${fileAttachment.fileName}:`, error.message);
      return null;
    }
  }
```

- [ ] **Step 7: Verify syntax**

Run: `node --check server/services/aiChatService.js`
Expected: no output (exits 0)

- [ ] **Step 8: Add `isFallback` to the `/message` route's response**

Replace:

```js
    res.json({
      success: true,
      data: {
        response: result.response,
        messageId: result.messageId,
        processingTime: result.processingTime,
        tokenCount: result.tokenCount
      }
    });
```

with:

```js
    res.json({
      success: true,
      data: {
        response: result.response,
        messageId: result.messageId,
        processingTime: result.processingTime,
        tokenCount: result.tokenCount,
        isFallback: result.isFallback
      }
    });
```

- [ ] **Step 9: Verify syntax**

Run: `node --check server/routes/aiChatRoutes.js`
Expected: no output (exits 0)

- [ ] **Step 10: Commit**

```bash
git add server/services/llmService.js server/services/aiChatService.js server/routes/aiChatRoutes.js
git commit -m "feat: use native system role, add conversation memory, wire real file content into AI requests"
```

---

### Task 3: Delete the duplicated server-side intent-guessing fallback

**Files:**
- Modify: `server/services/aiChatService.js` (`generateFallbackResponse`; delete `generateExamAssistantResponse`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `generateFallbackResponse(agentId, message, errorMessage)`'s behavior for `agentId === 'exam-assistant'` changes from keyword-guessing to the same static-message pattern used by the other 3 agents. No other method calls `generateExamAssistantResponse` after this task (confirmed: its only caller was `generateFallbackResponse`, removed in this same task).

- [ ] **Step 1: Simplify `generateFallbackResponse` and delete `generateExamAssistantResponse`**

Replace:

```js
  // Generate fallback response when AI service fails
  static async generateFallbackResponse(agentId, message, errorMessage) {
    console.log(`AI Chat Service - Generating fallback response for agent ${agentId}, error: ${errorMessage}`);

    // For Exam Assistant, provide intelligent responses based on user intent
    if (agentId === 'exam-assistant') {
      return await this.generateExamAssistantResponse(message, null);
    }

    // Determine if this is a configuration issue
    const isConfigIssue = errorMessage.includes('API key not configured') ||
                         errorMessage.includes('Base URL') ||
                         errorMessage.includes('not configured');

    if (isConfigIssue) {
      // Provide specific guidance for configuration issues
      const fallbackResponses = {
        'student-support': `I'm currently unavailable due to AI service configuration requirements. You can still access these features directly:\n\n• **Student Performance**: View reports in the Reports section\n• **Group Management**: Manage student groups in Student Management\n• **Data Export**: Use the available export options\n• **Analytics**: Check the Dashboard for basic statistics\n\nFor AI-powered insights, please ask your administrator to configure the AI platforms.`,

        'content-creator': `I'm currently unavailable because the AI service needs administrator configuration. You can still:\n\n• **Create Questions**: Use the Questions section for manual creation\n• **Import Content**: Upload questions via CSV/Excel templates\n• **Browse Question Banks**: Explore existing question collections\n• **Use Templates**: Access built-in question templates\n\nFor AI-assisted content creation, ask your administrator to set up AI platforms in Settings.`,

        'data-analyst': `I'm currently unavailable due to AI service configuration needs. You can still access:\n\n• **Standard Reports**: Use pre-built reports in the Reports section\n• **Raw Data**: Export data for external analysis\n• **Dashboard Statistics**: View basic metrics on the Dashboard\n• **Custom Reports**: Generate standard performance reports\n\nFor advanced AI-powered analytics, please have your administrator configure the AI platforms.`
      };

      return fallbackResponses[agentId] || `I apologize, but I'm currently unavailable due to AI service configuration requirements. Please ask your administrator to configure the AI platforms in Settings → AI Platforms to enable AI assistance.`;
    } else {
      // Generic temporary issue - but still provide helpful responses for exam assistant
      const fallbackResponses = {
        'student-support': `I'm temporarily unavailable due to technical difficulties. You can still:\n\n• **View Performance**: Check the Reports section\n• **Manage Groups**: Use Student Management\n• **Export Data**: Access available export options\n• **Contact Support**: For immediate assistance\n\nPlease try again shortly.`,

        'content-creator': `I'm currently experiencing technical difficulties. While I recover, you can:\n\n• **Create Questions**: Use the Questions section\n• **Import Content**: Upload via CSV/Excel templates\n• **Browse Questions**: Explore existing question banks\n• **Use Templates**: Access built-in templates\n\nPlease try again in a few moments.`,

        'data-analyst': `I'm temporarily unavailable due to technical difficulties. You can still:\n\n• **View Reports**: Access the Reports section\n• **Export Data**: Use export options for external analysis\n• **Dashboard**: Check basic statistics\n• **Standard Reports**: Generate performance reports\n\nPlease retry your request shortly.`
      };

      return fallbackResponses[agentId] || `I apologize, but I'm currently experiencing technical difficulties. Please try again in a few moments. If this issue persists, please contact support.`;
    }
  }
  
  static async generateExamAssistantResponse(message, fileAttachment) {
    const lowerMessage = message.toLowerCase();

    // Analyze message for specific intents
    if (lowerMessage.includes('create') && lowerMessage.includes('exam')) {
      return "I can help you create a new exam! Let's start with the basics:\n\n**Exam Creation Wizard:**\n1. **Title**: What would you like to call your exam?\n2. **Subject**: Which subject is this exam for? (I can help create one if needed)\n3. **Duration**: How long should students have to complete it?\n4. **Scheduling**: When should the exam be available?\n5. **Questions**: Would you like me to generate questions or use existing ones?\n\n💡 **Pro tip**: I can automatically generate questions from documents you upload!\n\nTo get started, just tell me: \"**Create an exam for [subject] called [title]**\" and I'll guide you through each step.";
    }

    if (lowerMessage.includes('question') && (lowerMessage.includes('generate') || lowerMessage.includes('create') || lowerMessage.includes('from'))) {
      if (fileAttachment) {
        return "Perfect! I can see you've uploaded a document. I'll help you generate questions from it.\n\n**Question Generation Options:**\n• **Question Count**: How many questions would you like? (default: 5)\n• **Difficulty**: Easy, Medium, or Hard?\n• **Question Types**: MCQ, True/False, Short Answer, or Mixed?\n• **Subject**: What subject area is this content for?\n\n🚀 **Ready to generate?** Just say: \"**Generate [number] [difficulty] questions from this document**\" and I'll create them instantly!\n\nExample: \"Generate 10 medium MCQ questions from this document\"";
      } else {
        return "I can help you create questions in several ways:\n\n📄 **From Documents**: Upload a PDF, Word doc, or text file and I'll automatically generate questions\n✍️ **From Text**: Paste content and I'll create questions from it\n🔧 **Manual Creation**: I'll guide you through creating questions step by step\n\n**Question Types Available:**\n• **Multiple Choice (MCQ)**: 4-6 options with explanations\n• **True/False**: Binary choice with reasoning\n• **Short Answer**: Open-ended responses with sample answers\n\n📎 **Upload a document** or tell me: \"**Create [number] [type] questions about [topic]**\"";
      }
    }

    if (lowerMessage.includes('subject') && (lowerMessage.includes('create') || lowerMessage.includes('add') || lowerMessage.includes('new'))) {
      return "I'll help you create a new subject! Subjects help organize your exams and questions.\n\n**Subject Information Needed:**\n• **Name**: Full subject name (e.g., \"Advanced Mathematics\")\n• **Code**: Short identifier (e.g., \"MATH101\")\n• **Description**: Brief overview (optional)\n\n📝 **Quick Creation**: Just tell me: \"**Create subject [name] with code [code]**\"\n\nExample: \"Create subject Biology with code BIO101\" or \"Create subject Advanced Physics with code PHYS201\"";
    }

    if (lowerMessage.includes('grade') || lowerMessage.includes('grading')) {
      return "ExamMaster's smart grading system:\n\n✅ **Automatic Grading:**\n• MCQ and True/False questions are instantly graded\n• Real-time score calculation\n• Immediate feedback to students (if enabled)\n\n📝 **Manual Review Queue:**\n• Short answer questions flagged for review\n• Partial credit scoring\n• Detailed feedback options\n\n⚙️ **Grading Configuration:**\n• Set passing marks and grade boundaries\n• Configure negative marking for wrong answers\n• Enable/disable immediate result display\n\nNeed help configuring grading for a specific exam?";
    }

    if (lowerMessage.match(/(\d+)\s+(question|mcq|true.?false|short.?answer)/i) || lowerMessage.includes('help me create') && lowerMessage.match(/\d+/)) {
      let count, type;

      // Extract number and type from different patterns
      if (lowerMessage.match(/(\d+)\s+(question|mcq|true.?false|short.?answer)/i)) {
        const matches = lowerMessage.match(/(\d+)\s+(question|mcq|true.?false|short.?answer)/i);
        count = matches[1];
        type = matches[2];
      } else if (lowerMessage.includes('help me create') && lowerMessage.match(/\d+/)) {
        const numberMatch = lowerMessage.match(/(\d+)/);
        count = numberMatch[1];
        type = lowerMessage.includes('mcq') ? 'MCQ' : 'questions';
      }

      return `Perfect! I can help you create ${count} ${type} questions. Here are your options:\n\n**🚀 Quick Generation Methods:**\n\n1️⃣ **Upload Document** 📄\n   • Upload a PDF, Word doc, or text file\n   • I'll automatically extract and create ${count} questions\n   • Just drag & drop your file above!\n\n2️⃣ **Specify Topic** 📝\n   • Tell me: \"Generate ${count} ${type} questions about [your topic]\"\n   • Example: \"Generate ${count} medium MCQ questions about Biology\"\n\n3️⃣ **Manual Creation** ✋\n   • Go to Questions → Add New Question\n   • Create each question step by step\n\n**🎯 Recommended Approach:**\nJust tell me: \"**Generate ${count} medium ${type} questions about [YOUR TOPIC]**\"\n\nWhat subject/topic should these questions cover?`;
    }

    // Check for topic-based question generation requests
    if (lowerMessage.includes('generate') && lowerMessage.includes('question') && (lowerMessage.includes('about') || lowerMessage.includes('on'))) {
      const numberMatch = lowerMessage.match(/(\d+)/);
      const count = numberMatch ? numberMatch[1] : '5';

      // Extract topic
      let topic = 'General';
      if (lowerMessage.includes('about')) {
        const aboutMatch = lowerMessage.split('about')[1];
        if (aboutMatch) {
          topic = aboutMatch.trim().split(/\s+/).slice(0, 3).join(' '); // Take first few words
          topic = topic.charAt(0).toUpperCase() + topic.slice(1); // Capitalize
        }
      } else if (lowerMessage.includes('on')) {
        const onMatch = lowerMessage.split('on')[1];
        if (onMatch) {
          topic = onMatch.trim().split(/\s+/).slice(0, 3).join(' '); // Take first few words
          topic = topic.charAt(0).toUpperCase() + topic.slice(1); // Capitalize
        }
      }

      return `Excellent! I'll help you generate ${count} questions about ${topic}.\n\n**🎯 Quick Generation Options:**\n\n**Option 1: Instant Generation** ⚡\nI can create ${count} sample questions about ${topic} right now using my built-in knowledge base.\n\n**Option 2: Document-Based** 📄\nUpload a document about ${topic} and I'll extract specific questions from your content.\n\n**Option 3: Manual Guidance** ✋\nI'll guide you through creating each question manually with best practices.\n\n**🚀 Ready to proceed?**\nJust say \"**Create ${count} sample questions about ${topic}**\" and I'll generate them instantly!\n\nOr upload a document for more specific content-based questions.`;
    }

    // Check for "create sample questions" requests - GENERATE ACTUAL QUESTIONS
    if ((lowerMessage.includes('create') && lowerMessage.includes('sample') && lowerMessage.includes('question')) ||
        (lowerMessage.includes('create') && lowerMessage.includes('question') && lowerMessage.includes('about'))) {

      const numberMatch = lowerMessage.match(/(\d+)/);
      const count = numberMatch ? parseInt(numberMatch[1]) : 5;

      // Extract topic
      let topic = 'General Knowledge';
      const aboutIndex = lowerMessage.indexOf('about');
      if (aboutIndex !== -1) {
        const topicPart = lowerMessage.substring(aboutIndex + 5).trim();
        if (topicPart) {
          topic = topicPart.split(/\s+/).slice(0, 3).join(' ');
          topic = topic.charAt(0).toUpperCase() + topic.slice(1);
        }
      }

      console.log(`AI Chat Service - Generating ${count} sample questions about ${topic}`);

      // Generate actual sample questions using the document parsing service
      try {
        const DocumentParsingService = require('./documentParsingService');
        const generatedQuestions = await DocumentParsingService.generateQuestionsFromText(
          `Generate questions about ${topic}`, // This will be handled by generateTopicContent in aiChatRoutes
          {
            questionCount: count,
            difficulty: 'medium',
            questionTypes: ['multiple-choice', 'true-false', 'short-answer'],
            subject: topic
          }
        );

        // Format the response with actual questions
        let response = `🎯 **Generated ${generatedQuestions.length} Questions About ${topic}**\n\n`;
        response += `Here are your questions:\n\n`;

        generatedQuestions.forEach((q, index) => {
          response += `**Question ${index + 1}:** ${q.question}\n`;

          if (q.type === 'multiple-choice' && q.options && q.options.length > 0) {
            response += `**Options:**\n`;
            q.options.forEach((option, optIndex) => {
              response += `${String.fromCharCode(97 + optIndex)}) ${option}\n`;
            });
          }

          if (q.correctAnswers && q.correctAnswers.length > 0) {
            response += `**Answer:** ${q.correctAnswers[0]}\n`;
          }

          if (q.explanation) {
            response += `**Explanation:** ${q.explanation}\n`;
          }

          response += `\n`;
        });

        response += `✅ **Questions are ready to save!** Use the "Save Questions" button below to add them to your question bank.\n\n`;
        response += `🎓 **Generated Questions Data:**\n\`\`\`json\n${JSON.stringify({ questions: generatedQuestions }, null, 2)}\n\`\`\``;

        return response;

      } catch (error) {
        console.error('AI Chat Service - Error generating sample questions:', error);
        return `❌ **Error generating questions about ${topic}**\n\nI encountered an issue while generating questions: ${error.message}\n\nPlease try again or upload a document for more specific content-based question generation.`;
      }
    }

    // Check for greeting/general help
    if (lowerMessage.match(/^(hi|hello|hey|help|what|how)/)) {
      return "Hello! I'm your AI Exam Assistant! 🎓 I'm here to make exam creation effortless.\n\n**I can help you:**\n\n🆕 **Create Complete Exams**\n• Guide you through exam setup\n• Generate questions automatically\n• Link subjects and questions\n\n📝 **Question Generation**\n• Upload documents → instant questions\n• Create custom question types\n• Bulk question import\n\n⚙️ **Exam Management**\n• Subject organization\n• Grading configuration\n• Student assignment\n\n💡 **Quick Starts:**\n• \"Create an exam for Biology\"\n• \"Generate 10 questions about Mathematics\"\n• \"Help me create a subject\"\n\nWhat would you like to work on first?";
    }

    return "I'm your AI Exam Assistant! I specialize in making exam creation fast and easy.\n\n**What I can do for you:**\n\n🎯 **Smart Exam Creation**: Guide you step-by-step through creating professional exams\n📄 **Document-to-Questions**: Upload any document and I'll generate questions instantly\n🏗️ **Subject Management**: Help organize your exam subjects and categories\n⚡ **Quick Setup**: Create complete exams in minutes, not hours\n\n**Popular Commands:**\n• \"Create an exam for [subject]\"\n• \"Generate questions from this document\" (with file upload)\n• \"Help me create [number] MCQ questions\"\n• \"Set up a new subject called [name]\"\n\n🚀 Ready to create something amazing? What type of exam are you working on?";
  }
```

with:

```js
  // Generate fallback response when AI service fails
  static async generateFallbackResponse(agentId, message, errorMessage) {
    console.log(`AI Chat Service - Generating fallback response for agent ${agentId}, error: ${errorMessage}`);

    // Determine if this is a configuration issue
    const isConfigIssue = errorMessage.includes('API key not configured') ||
                         errorMessage.includes('Base URL') ||
                         errorMessage.includes('not configured');

    if (isConfigIssue) {
      // Provide specific guidance for configuration issues
      const fallbackResponses = {
        'exam-assistant': `I'm currently unavailable due to AI service configuration requirements. You can still access these features directly:\n\n• **Create Exams**: Use the Create Exam page\n• **Manage Questions**: Add or import questions in the Questions section\n• **Organize Subjects**: Manage subjects in the Subjects section\n\nFor AI-powered exam and question assistance, please ask your administrator to configure the AI platforms.`,

        'student-support': `I'm currently unavailable due to AI service configuration requirements. You can still access these features directly:\n\n• **Student Performance**: View reports in the Reports section\n• **Group Management**: Manage student groups in Student Management\n• **Data Export**: Use the available export options\n• **Analytics**: Check the Dashboard for basic statistics\n\nFor AI-powered insights, please ask your administrator to configure the AI platforms.`,

        'content-creator': `I'm currently unavailable because the AI service needs administrator configuration. You can still:\n\n• **Create Questions**: Use the Questions section for manual creation\n• **Import Content**: Upload questions via CSV/Excel templates\n• **Browse Question Banks**: Explore existing question collections\n• **Use Templates**: Access built-in question templates\n\nFor AI-assisted content creation, ask your administrator to set up AI platforms in Settings.`,

        'data-analyst': `I'm currently unavailable due to AI service configuration needs. You can still access:\n\n• **Standard Reports**: Use pre-built reports in the Reports section\n• **Raw Data**: Export data for external analysis\n• **Dashboard Statistics**: View basic metrics on the Dashboard\n• **Custom Reports**: Generate standard performance reports\n\nFor advanced AI-powered analytics, please have your administrator configure the AI platforms.`
      };

      return fallbackResponses[agentId] || `I apologize, but I'm currently unavailable due to AI service configuration requirements. Please ask your administrator to configure the AI platforms in Settings → AI Platforms to enable AI assistance.`;
    } else {
      // Generic temporary issue
      const fallbackResponses = {
        'exam-assistant': `I'm temporarily unavailable due to technical difficulties. You can still:\n\n• **Create Exams**: Use the Create Exam page\n• **Manage Questions**: Add or import questions in the Questions section\n• **Organize Subjects**: Manage subjects in the Subjects section\n\nPlease try again shortly.`,

        'student-support': `I'm temporarily unavailable due to technical difficulties. You can still:\n\n• **View Performance**: Check the Reports section\n• **Manage Groups**: Use Student Management\n• **Export Data**: Access available export options\n• **Contact Support**: For immediate assistance\n\nPlease try again shortly.`,

        'content-creator': `I'm currently experiencing technical difficulties. While I recover, you can:\n\n• **Create Questions**: Use the Questions section\n• **Import Content**: Upload via CSV/Excel templates\n• **Browse Questions**: Explore existing question banks\n• **Use Templates**: Access built-in templates\n\nPlease try again in a few moments.`,

        'data-analyst': `I'm temporarily unavailable due to technical difficulties. You can still:\n\n• **View Reports**: Access the Reports section\n• **Export Data**: Use export options for external analysis\n• **Dashboard**: Check basic statistics\n• **Standard Reports**: Generate performance reports\n\nPlease retry your request shortly.`
      };

      return fallbackResponses[agentId] || `I apologize, but I'm currently experiencing technical difficulties. Please try again in a few moments. If this issue persists, please contact support.`;
    }
  }
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server/services/aiChatService.js`
Expected: no output (exits 0)

- [ ] **Step 3: Confirm the deleted method has no remaining references**

Run: `grep -rn "generateExamAssistantResponse" server/`
Expected: no output (no matches)

- [ ] **Step 4: Commit**

```bash
git add server/services/aiChatService.js
git commit -m "refactor: delete duplicated server-side intent-guessing fallback for exam-assistant"
```

---

### Task 4: Client — surface `isFallback` in the chat UI

**Files:**
- Modify: `client/src/pages/admin/AIChat.tsx`

**Interfaces:**
- Consumes: `isFallback` field on the `/message` response and on chat-history entries (both from Task 2).
- Produces: no new exports — same `AIChat` page component, extended.

- [ ] **Step 1: Add `isFallback` to the `ChatMessage` interface**

Replace:

```tsx
interface ChatMessage {
  _id: string
  message: string
  response: string
  timestamp: Date
  modelId: string
  agentId: string
  isUser?: boolean
  isBot?: boolean
  generatedQuestions?: any[]
  showAssignmentFlow?: boolean
}
```

with:

```tsx
interface ChatMessage {
  _id: string
  message: string
  response: string
  timestamp: Date
  modelId: string
  agentId: string
  isUser?: boolean
  isBot?: boolean
  isFallback?: boolean
  generatedQuestions?: any[]
  showAssignmentFlow?: boolean
}
```

- [ ] **Step 2: Carry `isFallback` onto the sent bot message and adjust the success toast**

Replace:

```tsx
      const responseData = response as any

      const generatedQuestions = parseGeneratedQuestions(responseData.response)

      // Add bot response to chat
      const botChatMessage: ChatMessage = {
        _id: responseData.messageId || `bot_${Date.now()}`,
        message: responseData.response,
        response: responseData.response,
        timestamp: new Date(),
        modelId: selectedPlatform,
        agentId: selectedAgent,
        isUser: false,
        isBot: true,
        generatedQuestions: generatedQuestions.length > 0 ? generatedQuestions : undefined
      }

      setMessages(prev => [...prev, botChatMessage])

      // Clear attached file after sending
      if (attachedFile) {
        removeAttachedFile()
      }

      toast({
        title: "Message Sent",
        description: "AI response received successfully"
      })
```

with:

```tsx
      const responseData = response as any

      const generatedQuestions = parseGeneratedQuestions(responseData.response)

      // Add bot response to chat
      const botChatMessage: ChatMessage = {
        _id: responseData.messageId || `bot_${Date.now()}`,
        message: responseData.response,
        response: responseData.response,
        timestamp: new Date(),
        modelId: selectedPlatform,
        agentId: selectedAgent,
        isUser: false,
        isBot: true,
        isFallback: responseData.isFallback,
        generatedQuestions: generatedQuestions.length > 0 ? generatedQuestions : undefined
      }

      setMessages(prev => [...prev, botChatMessage])

      // Clear attached file after sending
      if (attachedFile) {
        removeAttachedFile()
      }

      if (responseData.isFallback) {
        toast({
          title: "Fallback Response",
          description: "The AI service may be unavailable — this response was generated from a fallback.",
          variant: "destructive"
        })
      } else {
        toast({
          title: "Message Sent",
          description: "AI response received successfully"
        })
      }
```

- [ ] **Step 3: Add a fallback indicator to the bot message bubble**

Replace:

```tsx
                            <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </p>

                            {/* Save Questions Button - Show for bot messages with generated questions (only if not in assignment flow) */}
```

with:

```tsx
                            <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </p>

                            {message.isBot && message.isFallback && (
                              <p className="text-xs mt-1 flex items-center gap-1 text-status-warning-foreground">
                                <AlertCircle className="h-3 w-3" />
                                Fallback response — AI service may be unavailable
                              </p>
                            )}

                            {/* Save Questions Button - Show for bot messages with generated questions (only if not in assignment flow) */}
```

(`AlertCircle` is already imported in this file — no import change needed.)

- [ ] **Step 4: Verify**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `101` (unchanged baseline)

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/AIChat.tsx
git commit -m "feat: surface fallback-response indicator in AI Chat UI"
```

---

### Task 5: Manual verification

No automated test framework exists in this repo — this task is a manual walkthrough.

**Files:** none (verification only)

- [ ] **Step 1: Start both servers**

Backend (`server/`): `npm run dev`
Client (`client/`): `npm run dev` — confirm it serves at `http://127.0.0.1:5173`

- [ ] **Step 2: Test conversation memory**

As admin, in AI Chat, send "Generate 2 short questions about photosynthesis," wait for a response, then send "Make the second one harder." Confirm the second response engages with "the second one" from the first exchange rather than asking what topic you mean — this proves history is actually reaching the model.

- [ ] **Step 3: Test real file content**

Create a small `.txt` file with a distinctive, made-up fact (e.g., "The fictional element Bexonite has an atomic weight of 512."). Upload it and ask "What is the atomic weight of Bexonite according to the attached file?" Confirm the response correctly answers from the file's actual content (not a generic "I can't access the file" reply) — this proves `extractFileText` is wired in and read by the model.

- [ ] **Step 4: Test fallback transparency**

Temporarily misconfigure the active platform (e.g., point Ollama's base URL at an unreachable port, or clear an OpenAI/Anthropic key) and send a message. Confirm: the response still renders, the bubble shows the new "Fallback response — AI service may be unavailable" indicator, and the toast reads "Fallback Response" instead of "Message Sent." Restore the platform's real configuration afterward.

- [ ] **Step 5: Confirm the exam-assistant fallback text changed**

While still in the misconfigured state from Step 4 (or by re-triggering it), confirm the `exam-assistant` agent's fallback message is now the plain "temporarily unavailable ... Create Exams / Manage Questions / Organize Subjects" static message, not the old keyword-driven multi-branch text.

- [ ] **Step 6: Confirm system-role usage via server logs**

Tail the backend log during a message send to a real (non-Ollama) platform if one is configured; confirm no errors from the OpenAI/Anthropic SDK about message format (a wrong `system`/`messages` shape would surface as a 400-type API error here).

- [ ] **Step 7: Report results**

Summarize pass/fail for each step above before moving to `finishing-a-development-branch`.
