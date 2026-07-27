# AI Chat Robustness — Part 4: UI Friendliness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI Chat admin UI more user-friendly: render the AI's markdown-formatted responses properly, surface per-message processing time/token count (including on reloaded history), add a "Regenerate" affordance on the latest response, add a bulk "Clear History" action, and close two accessibility gaps.

**Architecture:** Five independent, additive changes layered onto the existing `AIChat.tsx` page and its `aiChat.ts`/`aiChatService.js` API surface. No existing route, model field, or function signature is removed or renamed — this part only adds fields, adds one new route/model-static/service-method/client-function, and swaps one render expression. Backend changes (clear-history plumbing, metadata mapping) land first since the client tasks consume them; client tasks are then layered in dependency order (data plumbing → rendering → interactive features → accessibility polish).

**Tech Stack:** Node/Express/Mongoose (backend), React 18 + TypeScript + Vite + Tailwind + shadcn/radix components (frontend), new dependency `react-markdown` (client only).

## Global Constraints

- No automated test framework exists in this repo. Verify backend changes with `node --check <file>`. Verify frontend changes with `npx tsc --noEmit -p tsconfig.app.json` from `client/` — current baseline is **79** errors; task changes must not increase this count.
- New client dependency: `react-markdown` (latest is `10.1.0` at plan-writing time; install with `npm install react-markdown@^10.1.0` from `client/`). It is ESM-only, which is fine — this project has `"type": "module"` and uses Vite 5.
- Client API functions that wrap a service-layer method of the same name get a disambiguating prefix, per existing convention in `client/src/api/aiChat.ts` (`sendChatMessage` vs. service `sendMessage`, `getAIAgents` vs. service `getAgents`). The new client function is `clearChatHistory()`, wrapping the service's `AIChatService.clearHistory()`.
- Match existing code style exactly: `console.log`/`console.error` statements at the start/end of each backend method (this file's established pattern), doc-comment blocks above each `client/src/api/aiChat.ts` export, and the existing `AlertDialog` destructive-confirmation pattern already used in `client/src/pages/admin/ExamManagement.tsx`.

---

### Task 1: Backend — Clear History route + chat history metadata mapping fix

**Files:**
- Modify: `server/models/AIChat.js:101-108` (insert new static after `getRecentMessages`)
- Modify: `server/services/aiChatService.js:472-497` (insert new method after `getChatHistory`, and fix `getChatHistory`'s response mapping in the same edit — both changes sit in the same method body)
- Modify: `server/routes/aiChatRoutes.js:182-184` (insert new route between `/history` GET and `/agents` GET)

**Interfaces:**
- Produces: `AIChat.clearHistory(userId)` (Mongoose static, returns the `updateMany` promise); `AIChatService.clearHistory(userId)` (returns `Promise<{ success: true }>`); route `DELETE /api/ai-chat/history` (requires admin auth, returns `{ success: true, data: { success: true } }` on success); `AIChatService.getChatHistory`'s per-message objects now also carry `processingTime?: number` and `tokenCount?: { input: number, output: number }` (read by Task 4).
- Consumes: nothing new — uses the existing `AIChat` model, `requireAdmin` middleware, and `AIChatService` class already imported in `aiChatRoutes.js`.

- [ ] **Step 1: Add the `clearHistory` static method to the AIChat model**

In `server/models/AIChat.js`, insert immediately after the `getRecentMessages` static (after line 108, before the `// Static method to get chat history for a user with improved pagination` comment on line 110):

Replace:
```js
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

With:
```js
// Static method to get the most recent N messages for a user (newest first), for conversation memory
aiChatSchema.statics.getRecentMessages = function(userId, limit = 5) {
  console.log(`Getting ${limit} most recent messages for user ${userId}`);
  return this.find({ userId, isDeleted: false })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// Static method to bulk soft-delete all messages for a user (Clear History action)
aiChatSchema.statics.clearHistory = function(userId) {
  console.log(`Clearing all AI chat history for user ${userId}`);
  return this.updateMany({ userId, isDeleted: false }, { isDeleted: true });
};

// Static method to get chat history for a user with improved pagination
```

- [ ] **Step 2: Verify the model file is syntactically valid**

Run: `node --check server/models/AIChat.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Add the `clearHistory` method to AIChatService**

In `server/services/aiChatService.js`, insert immediately after the `getChatHistory` method closes (after line 497), before the `// Get available AI platforms (for backwards compatibility)` comment on line 499:

Replace:
```js
      return {
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
        pagination: result.pagination
      };
    } catch (error) {
      console.error('AI Chat Service - Error getting chat history:', error);
      throw error;
    }
  }
  
  // Get available AI platforms (for backwards compatibility)
```

With:
```js
      return {
        messages: result.messages.map(msg => ({
          _id: msg._id,
          message: msg.message,
          response: msg.response,
          timestamp: msg.createdAt,
          modelId: msg.modelId,
          agentId: msg.agentId,
          fileAttachment: msg.fileAttachment,
          isFallback: msg.isFallback,
          processingTime: msg.metadata?.processingTime,
          tokenCount: msg.metadata?.tokenCount
        })),
        pagination: result.pagination
      };
    } catch (error) {
      console.error('AI Chat Service - Error getting chat history:', error);
      throw error;
    }
  }

  // Bulk clear (soft-delete) all chat history for a user
  static async clearHistory(userId) {
    console.log(`AI Chat Service - Clearing chat history for user ${userId}`);

    try {
      await AIChat.clearHistory(userId);
      console.log(`AI Chat Service - Chat history cleared for user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error('AI Chat Service - Error clearing chat history:', error);
      throw error;
    }
  }
  
  // Get available AI platforms (for backwards compatibility)
```

Note: this single replace block does two things at once — it adds `processingTime`/`tokenCount` to the response mapping (the metadata-mapping fix), and it inserts the new `clearHistory` method right after. Both land together because the mapping lines are part of the anchor text needed to place `clearHistory` correctly after `getChatHistory` ends.

- [ ] **Step 4: Verify the service file is syntactically valid**

Run: `node --check server/services/aiChatService.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Add the DELETE /history route**

In `server/routes/aiChatRoutes.js`, insert immediately after the `/history` GET route closes (after line 182), before the `// GET /api/ai-chat/agents - Get available AI agents` comment on line 184:

Replace:
```js
    res.json({
      success: true,
      data: {
        messages: result.messages,
        pagination: result.pagination
      }
    });

  } catch (error) {
    console.error('AI Chat Routes - Error getting chat history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get chat history'
    });
  }
});

// GET /api/ai-chat/agents - Get available AI agents
```

With:
```js
    res.json({
      success: true,
      data: {
        messages: result.messages,
        pagination: result.pagination
      }
    });

  } catch (error) {
    console.error('AI Chat Routes - Error getting chat history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get chat history'
    });
  }
});

// Description: Clear all chat history for the current user (bulk soft-delete)
// Endpoint: DELETE /api/ai-chat/history
// Request: {}
// Response: { success: boolean }
router.delete('/history', requireAdmin, async (req, res) => {
  console.log('AI Chat Routes - DELETE /history');

  try {
    const userId = req.user._id;
    const result = await AIChatService.clearHistory(userId);

    console.log(`AI Chat Routes - Chat history cleared for user ${userId}`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('AI Chat Routes - Error clearing chat history:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to clear chat history'
    });
  }
});

// GET /api/ai-chat/agents - Get available AI agents
```

- [ ] **Step 6: Verify the routes file is syntactically valid**

Run: `node --check server/routes/aiChatRoutes.js`
Expected: no output, exit code 0.

- [ ] **Step 7: Manually verify the route end-to-end against the running dev server**

Start the backend dev server if not already running, then:

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@yahoo.com","password":"password123"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.accessToken))")
curl -s http://localhost:5000/api/ai-chat/history -H "Authorization: Bearer $TOKEN" | head -c 300
curl -s -X DELETE http://localhost:5000/api/ai-chat/history -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:5000/api/ai-chat/history -H "Authorization: Bearer $TOKEN"
```

Expected: the first `history` call shows existing messages (if any), the `DELETE` call returns `{"success":true,"data":{"success":true}}`, and the final `history` call returns an empty `messages` array with `totalCount: 0`.

- [ ] **Step 8: Commit**

```bash
git add server/models/AIChat.js server/services/aiChatService.js server/routes/aiChatRoutes.js
git commit -m "feat(ai-chat): add clear-history route and processingTime/tokenCount to chat history mapping"
```

---

### Task 2: Client API — `clearChatHistory()`

**Files:**
- Modify: `client/src/api/aiChat.ts:47-59` (doc comment update on `getChatHistory`, plus insert the new `clearChatHistory` export immediately after it)

**Interfaces:**
- Consumes: `DELETE /api/ai-chat/history` (Task 1).
- Produces: `clearChatHistory(): Promise<{ success: boolean }>` — used by Task 7.

- [ ] **Step 1: Update the `getChatHistory` doc comment and add `clearChatHistory`**

In `client/src/api/aiChat.ts`, replace:

```ts
// Description: Get chat history with pagination for current user
// Endpoint: GET /api/ai-chat/history
// Request: { page?: number, limit?: number }
// Response: { messages: Array<{ _id: string, message: string, response: string, timestamp: Date, modelId: string, agentId: string }>, pagination: { currentPage: number, totalPages: number, totalCount: number, hasMore: boolean, limit: number } }
export const getChatHistory = async (params?: { page?: number; limit?: number }) => {
  try {
    const response = await api.get('/api/ai-chat/history', { params });
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
```

With:

```ts
// Description: Get chat history with pagination for current user
// Endpoint: GET /api/ai-chat/history
// Request: { page?: number, limit?: number }
// Response: { messages: Array<{ _id: string, message: string, response: string, timestamp: Date, modelId: string, agentId: string, isFallback: boolean, processingTime?: number, tokenCount?: { input: number, output: number } }>, pagination: { currentPage: number, totalPages: number, totalCount: number, hasMore: boolean, limit: number } }
export const getChatHistory = async (params?: { page?: number; limit?: number }) => {
  try {
    const response = await api.get('/api/ai-chat/history', { params });
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Clear all chat history for current user
// Endpoint: DELETE /api/ai-chat/history
// Request: {}
// Response: { success: boolean }
export const clearChatHistory = async () => {
  try {
    const response = await api.delete('/api/ai-chat/history');
    return response.data.data;
  } catch (error) {
    console.error(error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
```

- [ ] **Step 2: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `79` (unchanged from baseline — this is a pure addition).

- [ ] **Step 3: Commit**

```bash
git add client/src/api/aiChat.ts
git commit -m "feat(ai-chat): add clearChatHistory client API function"
```

---

### Task 3: Client — `react-markdown` dependency + bot message markdown rendering

**Files:**
- Modify: `client/package.json` (via `npm install`)
- Modify: `client/src/pages/admin/AIChat.tsx:1-77` (import + new `MARKDOWN_COMPONENTS` constant)
- Modify: `client/src/pages/admin/AIChat.tsx:707` (render swap)

**Interfaces:**
- Produces: module-level `MARKDOWN_COMPONENTS` object (react-markdown `components` prop value), reused by no other task but kept as a named constant so it isn't rebuilt on every render.
- Consumes: nothing new from other tasks.

- [ ] **Step 1: Install react-markdown**

Run (from `client/`): `npm install react-markdown@^10.1.0`
Expected: `client/package.json`'s `dependencies` gains `"react-markdown": "^10.1.0"` (or the resolved version), `client/package-lock.json` updates.

- [ ] **Step 2: Add the import**

In `client/src/pages/admin/AIChat.tsx`, replace:

```tsx
import { IntentConfirmationDialog, CreationDialogManager } from "@/components/IntentConfirmationDialog"
```

With:

```tsx
import { IntentConfirmationDialog, CreationDialogManager } from "@/components/IntentConfirmationDialog"
import ReactMarkdown from "react-markdown"
```

- [ ] **Step 3: Add the `MARKDOWN_COMPONENTS` constant**

In the same file, replace:

```tsx
interface AIAgent {
  _id: string
  name: string
  description: string
  capabilities: string[]
  isActive: boolean
}

export function AIChat() {
```

With:

```tsx
interface AIAgent {
  _id: string
  name: string
  description: string
  capabilities: string[]
  isActive: boolean
}

// Minimal element styling for AI-generated markdown — Tailwind's preflight reset strips
// default list/heading spacing, so react-markdown's output needs explicit classNames here.
const MARKDOWN_COMPONENTS = {
  p: ({ children }: any) => <p className="text-sm whitespace-pre-wrap mb-2 last:mb-0">{children}</p>,
  ul: ({ children }: any) => <ul className="text-sm list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }: any) => <ol className="text-sm list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  li: ({ children }: any) => <li>{children}</li>,
  strong: ({ children }: any) => <strong className="font-semibold">{children}</strong>,
  em: ({ children }: any) => <em className="italic">{children}</em>,
  code: ({ children }: any) => <code className="text-xs bg-background/50 rounded px-1 py-0.5 font-mono">{children}</code>,
  pre: ({ children }: any) => <pre className="text-xs bg-background/50 rounded p-2 overflow-x-auto mb-2">{children}</pre>,
  a: ({ children, href }: any) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
      {children}
    </a>
  )
}

export function AIChat() {
```

- [ ] **Step 4: Render bot messages through `ReactMarkdown`, keep user messages as plain text**

In the same file, replace:

```tsx
                            <p className="text-sm whitespace-pre-wrap">{message.message}</p>
```

With:

```tsx
                            {message.isBot ? (
                              <ReactMarkdown components={MARKDOWN_COMPONENTS}>{message.message}</ReactMarkdown>
                            ) : (
                              <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                            )}
```

- [ ] **Step 5: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `79` (unchanged from baseline).

- [ ] **Step 6: Manually verify rendering in the browser**

Start the client dev server if not already running, log in as `admin@yahoo.com` / `password123`, navigate to AI Chat, send a message that will produce a bulleted/bold AI response (e.g. "List 3 tips for writing good exam questions, using bold and a bullet list"). Confirm the bot's reply renders actual bullets and bold text, not literal `*`/`**` characters. Given the local Ollama model can take 60-90+ seconds per response (established in Parts 2-3), budget accordingly, or inspect an already-stored message in Mongo/via `GET /api/ai-chat/history` that already contains markdown syntax and confirm it renders correctly on page load instead of waiting on a fresh generation.

- [ ] **Step 7: Commit**

```bash
git add client/package.json client/package-lock.json client/src/pages/admin/AIChat.tsx
git commit -m "feat(ai-chat): render bot messages as markdown via react-markdown"
```

---

### Task 4: Client — metadata (`processingTime`/`tokenCount`) and `originalMessage` plumbing + display

**Files:**
- Modify: `client/src/pages/admin/AIChat.tsx:34-46` (`ChatMessage` interface)
- Modify: `client/src/pages/admin/AIChat.tsx` (three message-construction sites: `loadMoreMessages`, `fetchInitialData`, `sendMessageToAI`)
- Modify: `client/src/pages/admin/AIChat.tsx:708-710` (timestamp line)

**Interfaces:**
- Consumes: `getChatHistory`'s response now includes `processingTime`/`tokenCount` per message (Task 1); `sendChatMessage`'s response already includes `processingTime`/`tokenCount` (pre-existing, `server/routes/aiChatRoutes.js:118-123`, unchanged this part).
- Produces: `ChatMessage.processingTime?: number`, `ChatMessage.tokenCount?: { input: number; output: number }`, `ChatMessage.originalMessage?: string` — the last one is consumed by Task 5's Regenerate button.

- [ ] **Step 1: Extend the `ChatMessage` interface**

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
  isFallback?: boolean
  generatedQuestions?: any[]
  showAssignmentFlow?: boolean
}
```

With:

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
  processingTime?: number
  tokenCount?: { input: number; output: number }
  originalMessage?: string
}
```

- [ ] **Step 2: Populate `originalMessage` in `loadMoreMessages`'s history transform**

Replace:

```tsx
      // Transform and prepend older messages to current list
      const transformedMessages: ChatMessage[] = []
      historyData?.forEach((msg: ChatMessage) => {
        transformedMessages.push({
          ...msg,
          isUser: true,
          isBot: false
        })
        transformedMessages.push({
          ...msg,
          _id: msg._id + '_response',
          message: msg.response,
          isUser: false,
          isBot: true
        })
      })
```

With:

```tsx
      // Transform and prepend older messages to current list
      const transformedMessages: ChatMessage[] = []
      historyData?.forEach((msg: ChatMessage) => {
        transformedMessages.push({
          ...msg,
          isUser: true,
          isBot: false
        })
        transformedMessages.push({
          ...msg,
          _id: msg._id + '_response',
          message: msg.response,
          isUser: false,
          isBot: true,
          originalMessage: msg.message
        })
      })
```

(`processingTime`/`tokenCount` already carry over automatically via the `...msg` spread, since `getChatHistory`'s response — after Task 1 — includes them on the raw `msg` object. Only `originalMessage` needs an explicit assignment, because the spread's `message` field gets overwritten by `message: msg.response` on the next line, discarding the original question text unless captured here.)

- [ ] **Step 3: Populate `originalMessage` in `fetchInitialData`'s history transform**

Replace:

```tsx
        // Transform history to display format - messages come sorted oldest first from backend
        const transformedMessages: ChatMessage[] = []
        historyData?.forEach((msg: ChatMessage) => {
          // User message first
          transformedMessages.push({
            ...msg,
            isUser: true,
            isBot: false
          })
          // Then bot response
          transformedMessages.push({
            ...msg,
            _id: msg._id + '_response',
            message: msg.response,
            isUser: false,
            isBot: true
          })
        })
```

With:

```tsx
        // Transform history to display format - messages come sorted oldest first from backend
        const transformedMessages: ChatMessage[] = []
        historyData?.forEach((msg: ChatMessage) => {
          // User message first
          transformedMessages.push({
            ...msg,
            isUser: true,
            isBot: false
          })
          // Then bot response
          transformedMessages.push({
            ...msg,
            _id: msg._id + '_response',
            message: msg.response,
            isUser: false,
            isBot: true,
            originalMessage: msg.message
          })
        })
```

- [ ] **Step 4: Populate `processingTime`/`tokenCount`/`originalMessage` on the live-send bot message**

Replace:

```tsx
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
```

With:

```tsx
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
        generatedQuestions: generatedQuestions.length > 0 ? generatedQuestions : undefined,
        processingTime: responseData.processingTime,
        tokenCount: responseData.tokenCount,
        originalMessage: userMessage
      }
```

- [ ] **Step 5: Show processing time / token count on the timestamp line**

Replace:

```tsx
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </p>
```

With:

```tsx
                            <p className="text-xs mt-1 opacity-70">
                              {new Date(message.timestamp).toLocaleTimeString()}
                              {message.isBot && message.processingTime != null && (
                                <> · {(message.processingTime / 1000).toFixed(1)}s</>
                              )}
                              {message.isBot && message.tokenCount != null && (
                                <> · {message.tokenCount.input + message.tokenCount.output} tokens</>
                              )}
                            </p>
```

- [ ] **Step 6: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `79` (unchanged from baseline).

- [ ] **Step 7: Manually verify metadata on both a fresh-sent and a reloaded message**

With both dev servers running, send a message and confirm the freshly-added bot bubble shows something like "10:32 AM · 1.2s · 340 tokens". Then reload the page (forcing a `GET /api/ai-chat/history` fetch) and confirm that same message — now loaded from history, not the live-send path — still shows its processing time and token count. This second check is the one that actually proves Task 1's backend mapping fix works; the live-send path alone would pass even without it, since the `/message` response already carried this data before this part.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/admin/AIChat.tsx
git commit -m "feat(ai-chat): surface processingTime/tokenCount and thread originalMessage through chat messages"
```

---

### Task 5: Client — Regenerate button on the latest response

**Files:**
- Modify: `client/src/pages/admin/AIChat.tsx` (message-list `.map` call, add `RefreshCw` import)

**Interfaces:**
- Consumes: `ChatMessage.originalMessage` (Task 4); existing `sendMessageToAI(userMessage: string): Promise<void>` (unchanged signature).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Import the `RefreshCw` icon**

Replace:

```tsx
import {
  MessageSquare,
  Send,
  Paperclip,
  Bot,
  User,
  Loader2,
  FileText,
  X,
  Zap,
  Brain,
  Settings,
  CheckCircle,
  AlertCircle,
  Save,
  Download
} from "lucide-react"
```

With:

```tsx
import {
  MessageSquare,
  Send,
  Paperclip,
  Bot,
  User,
  Loader2,
  FileText,
  X,
  Zap,
  Brain,
  Settings,
  CheckCircle,
  AlertCircle,
  Save,
  Download,
  RefreshCw
} from "lucide-react"
```

- [ ] **Step 2: Track the index in the message list and add the Regenerate button**

Replace:

```tsx
                    messages.map((message) => (
                      <div
                        key={message._id}
                        className={`flex gap-3 ${message.isUser ? "justify-end" : "justify-start"}`}
                      >
```

With:

```tsx
                    messages.map((message, messageIndex) => (
                      <div
                        key={message._id}
                        className={`flex gap-3 ${message.isUser ? "justify-end" : "justify-start"}`}
                      >
```

Then replace:

```tsx
                            {message.isBot && message.isFallback && (
                              <p className="text-xs mt-1 flex items-center gap-1 text-status-warning-foreground">
                                <AlertCircle className="h-3 w-3" />
                                Fallback response — AI service may be unavailable
                              </p>
                            )}

                            {/* Save Questions Button - Show for bot messages with generated questions (only if not in assignment flow) */}
```

With:

```tsx
                            {message.isBot && message.isFallback && (
                              <p className="text-xs mt-1 flex items-center gap-1 text-status-warning-foreground">
                                <AlertCircle className="h-3 w-3" />
                                Fallback response — AI service may be unavailable
                              </p>
                            )}

                            {/* Regenerate - only on the latest bot message */}
                            {message.isBot && messageIndex === messages.length - 1 && message.originalMessage && (
                              <div className="mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => sendMessageToAI(message.originalMessage!)}
                                  disabled={isLoading}
                                  className="flex items-center gap-1 h-7 text-xs"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  Regenerate
                                </Button>
                              </div>
                            )}

                            {/* Save Questions Button - Show for bot messages with generated questions (only if not in assignment flow) */}
```

- [ ] **Step 3: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `79` (unchanged from baseline).

- [ ] **Step 4: Manually verify Regenerate**

Send a message, wait for the response, click "Regenerate" on it, and confirm a brand-new user+bot exchange is appended at the bottom using the exact same original question text — not an edit of the previous exchange, and not a duplicate of the previous exchange's `_id`. Confirm the Regenerate button then only appears on this newest response, not the previous one.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/AIChat.tsx
git commit -m "feat(ai-chat): add regenerate button to the latest bot response"
```

---

### Task 6: Client — Clear History UI

**Files:**
- Modify: `client/src/pages/admin/AIChat.tsx` (imports, new `handleClearHistory` function, Chat `CardHeader`)

**Interfaces:**
- Consumes: `clearChatHistory()` (Task 2).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add imports** — `Trash2` icon, `AlertDialog` family, and `clearChatHistory`

Replace:

```tsx
import { sendChatMessage, getChatHistory, getAIAgents } from "@/api/aiChat"
```

With:

```tsx
import { sendChatMessage, getChatHistory, getAIAgents, clearChatHistory } from "@/api/aiChat"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog"
```

Then replace (this is the same import block Task 5 modified — apply on top of that result):

```tsx
  Save,
  Download,
  RefreshCw
} from "lucide-react"
```

With:

```tsx
  Save,
  Download,
  RefreshCw,
  Trash2
} from "lucide-react"
```

- [ ] **Step 2: Add `handleClearHistory`**

Replace:

```tsx
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  const selectedPlatformInfo = platforms.find(p => p._id === selectedPlatform)
```

With:

```tsx
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSendMessage()
    }
  }

  const handleClearHistory = async () => {
    try {
      await clearChatHistory()
      setMessages([])
      setPagination(null)
      toast({
        title: "History Cleared",
        description: "Your chat history has been deleted"
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: (error as any)?.message || "Failed to clear chat history"
      })
    }
  }

  const selectedPlatformInfo = platforms.find(p => p._id === selectedPlatform)
```

- [ ] **Step 3: Add the trash-icon button + confirmation dialog to the Chat card header**

Replace:

```tsx
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </CardTitle>
            <CardDescription>Ask questions and get AI assistance</CardDescription>
          </CardHeader>
```

With:

```tsx
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Chat
                </CardTitle>
                <CardDescription>Ask questions and get AI assistance</CardDescription>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" disabled={messages.length === 0} className="shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear chat history?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your entire AI chat history. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearHistory} className="bg-red-600 hover:bg-red-700">
                      Clear History
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardHeader>
```

- [ ] **Step 4: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `79` (unchanged from baseline).

- [ ] **Step 5: Manually verify Clear History**

Click the trash icon in the Chat card header, confirm the `AlertDialog` appears with the "Clear chat history?" copy, click "Clear History", confirm the message list empties immediately and a toast confirms deletion. Reload the page and confirm no history loads back (an empty-state "Welcome to AI Chat!" message shows instead). Confirm the trash button is disabled when `messages` is empty.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/AIChat.tsx
git commit -m "feat(ai-chat): add clear history UI with confirmation dialog"
```

---

### Task 7: Client — Accessibility (`aria-label`s and `aria-live` region)

**Files:**
- Modify: `client/src/pages/admin/AIChat.tsx` (attach button, remove-file button, `ScrollArea` container)

**Interfaces:**
- Consumes/Produces: none — pure attribute additions, no new state or functions.

- [ ] **Step 1: Add `aria-live`/`aria-atomic` to the message list container**

Replace:

```tsx
            <ScrollArea ref={messagesContainerRef} className="h-full p-4 [scrollbar-gutter:stable] overscroll-y-contain">
```

With:

```tsx
            <ScrollArea
              ref={messagesContainerRef}
              className="h-full p-4 [scrollbar-gutter:stable] overscroll-y-contain"
              aria-live="polite"
              aria-atomic="false"
            >
```

- [ ] **Step 2: Add `aria-label` to the remove-attached-file button**

Replace:

```tsx
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeAttachedFile}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-3 w-3" />
                  </Button>
```

With:

```tsx
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={removeAttachedFile}
                    className="h-6 w-6 p-0"
                    aria-label="Remove attached file"
                  >
                    <X className="h-3 w-3" />
                  </Button>
```

- [ ] **Step 3: Add `aria-label` to the attach-file button**

Replace:

```tsx
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="shrink-0"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
```

With:

```tsx
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="shrink-0"
                  aria-label="Attach file"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
```

- [ ] **Step 4: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `79` (unchanged from baseline).

- [ ] **Step 5: Manually verify the accessibility attributes**

Open the browser's accessibility tree inspector (or tab through the controls with a screen reader active) and confirm the attach button announces "Attach file", the remove-file button (visible only once a file is attached) announces "Remove attached file", and the message-list container element has `aria-live="polite"` and `aria-atomic="false"` set — inspect via the browser DevTools Elements panel if a screen reader isn't available.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/admin/AIChat.tsx
git commit -m "feat(ai-chat): add aria-labels and aria-live region for accessibility"
```

---

### Task 8: Final full walkthrough

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend syntax check**

Run: `node --check server/models/AIChat.js && node --check server/services/aiChatService.js && node --check server/routes/aiChatRoutes.js`
Expected: no output, exit code 0.

- [ ] **Step 2: Run the full frontend type check**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `79`.

- [ ] **Step 3: End-to-end manual walkthrough**

With both dev servers running and logged in as `admin@yahoo.com` / `password123` on the AI Chat page:
1. Send a message that produces bold/bulleted AI output; confirm it renders formatted (Task 3).
2. Confirm a freshly-sent message's bubble shows processing time/token count, then reload the page and confirm an older (history-loaded) message also shows them (Task 4).
3. Click "Regenerate" on the latest response; confirm a new exchange appends using the same original question, and the button moves to the new latest response (Task 5).
4. Click the trash icon, confirm the dialog, confirm the list empties, reload and confirm history is gone (Task 6).
5. Inspect the attach/remove-file buttons' accessible names and the message list's `aria-live` attribute (Task 7).

- [ ] **Step 4: Report results**

Summarize which of the 5 walkthrough items passed, and note any that could only be partially verified due to the local Ollama model's slow response time (60-90+ seconds), along with what was verified instead (stored-message inspection, direct API calls) as a substitute.

---

## Finishing

Once all 8 tasks are complete and verified, invoke `superpowers:finishing-a-development-branch` to merge this branch to `main`. This is the final part of the 4-part AI Chat Robustness initiative — after merging, update the `exammaster-ai-chat-robustness-progress.md` memory file (and `MEMORY.md`'s pointer) to mark the entire initiative complete.
