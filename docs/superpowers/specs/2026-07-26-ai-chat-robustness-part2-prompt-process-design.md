# AI Chat Robustness — Part 2: Prompt & AI Process Overhaul — Design

**Status:** Approved
**Date:** 2026-07-26
**Scope:** `server/services/aiChatService.js`, `server/services/llmService.js`, `server/models/AIChat.js`, `server/routes/aiChatRoutes.js`, `client/src/api/aiChat.ts`, `client/src/pages/admin/AIChat.tsx`

## Context

Part 1 (Security & Correctness) is merged. This part covers the "make the prompts/process more efficient" half of the original request. Five issues, confirmed against the current (post-Part-1) code:

1. `aiChatService.js`'s `processAIRequest` builds `fullMessage = \`${systemPrompt}\n\nUser: ${message}\`` and sends it as a single `user`-role message (`llmService.js`'s `messages: [{ role: 'user', content: message }]`) — neither OpenAI's nor Anthropic's native `system` role/parameter is used, despite both SDKs supporting it.
2. Every call is a fully stateless single turn — `processAIRequest` never fetches or includes prior messages, so multi-turn refinement ("give me 3 more like that") is impossible.
3. `buildSystemPrompt` only ever includes `fileAttachment.fileName`/`fileAttachment.mimeType` in a one-line note — `DocumentParsingService.parseDocument(filePath, mimeType)` already exists and extracts real text from text/PDF/Word files, but is never called from the `/message` flow, so the "upload a doc, get questions from it" capability the UI advertises doesn't work.
4. When `processAIRequest`'s real AI call throws, `generateFallbackResponse` substitutes a scripted reply, but the response is returned with no flag distinguishing it from a real AI answer — the client's "AI response received successfully" toast fires either way.
5. `generateExamAssistantResponse` (~140 lines in `aiChatService.js`, invoked only from the fallback path) re-implements keyword-based intent detection independently from `client/src/utils/intentDetection.ts`, with different patterns, and also calls into the fake question-generator (`DocumentParsingService.generateQuestionsFromText`, flagged in the original research as non-AI regex/random-text generation, slated for Part 3 removal).

## Design decisions

**Conversation memory: last 5 exchanges, no new session/thread concept (confirmed with user).** There is no conversation/thread grouping anywhere in this app — `AIChat` stores one document per turn, and the UI shows one continuous history per user. Rather than introduce threading (a much larger change), the last 5 `AIChat` documents for the user are fetched and included as prior turns on every new request. This directly fixes the "no multi-turn memory" gap within the existing single-continuous-history model.

**Delete the server-side intent-guessing fallback rather than keep or reconcile it (confirmed with user).** `generateExamAssistantResponse` only ever fires after the real AI call has already failed — it's meant to be a "helpful message while AI is down," not a feature in its own right. Its ~140 lines of keyword matching duplicate (with different, drifting patterns) what `intentDetection.ts` already does *before* sending to the AI, and its "create sample questions" branch calls the fake generator Part 3 is set to remove anyway. Deleting it and replacing `exam-assistant`'s fallback with the same simple static message pattern already used for `student-support`/`content-creator`/`data-analyst` eliminates the duplication by removing one of the two guessers, rather than trying to keep two implementations in sync.

**File content is extracted and truncated to 8,000 characters (~2,000 tokens), with graceful fallback for unsupported types.** `parseDocument` only handles `text/plain`, `application/pdf`, and Word docs (not CSV/Excel/JSON, even though multer's `fileFilter` accepts those mime types for upload). When the mime type isn't parseable, or parsing throws, the code falls back to today's filename-only note rather than failing the whole chat request — a user uploading a spreadsheet still gets a response, just without its content read. The 8,000-character cap bounds cost on large documents; this is a fixed technical constant, not something requiring a design fork.

**Native `system` role applies to OpenAI and Anthropic only, not Ollama.** Ollama's `/api/generate` endpoint (used here, as opposed to its `/api/chat` endpoint) takes a single prompt string, not a role-separated messages array — its existing prompt template (`${systemPrompt}\n\nUser: ${message}\n\nAssistant:`) already keeps the system instructions and user turn conceptually separate within that string, which is the best fit for that endpoint without switching to a different Ollama API surface (out of scope — not requested, and Ollama already isn't the platform this fix is primarily about, since OpenAI/Anthropic are the ones with a dedicated system-role concept to exploit).

**Fallback transparency is a boolean flag through the whole pipeline, surfaced as a small UI indicator, not a modal or blocking warning.** `isFallback` flows: `processAIRequest`'s return → `sendMessage`'s return → the `/message` route's JSON response → a new `AIChat.isFallback` schema field (for history) → the client's `ChatMessage` type → a small label on the message bubble. This keeps the fix proportional to the problem (a transparency gap, not a broken feature) — no new dialogs or flows.

## Changes

### 1. `server/models/AIChat.js`

- Add `isFallback: { type: Boolean, default: false }` to the schema, alongside the existing `isDeleted` field.
- Add a new static method, `getRecentMessages(userId, limit = 5)`: `this.find({ userId, isDeleted: false }).sort({ createdAt: -1 }).limit(limit).lean()` — returns the most recent N turns, newest first (caller reverses for chronological order when building prompt history).

### 2. `server/services/llmService.js`

- `sendRequestToOpenAI` and `sendRequestToAnthropic` gain two new parameters each: `systemPrompt` and `history` (an array of `{ role: 'user' | 'assistant', content: string }`, already in chronological order, oldest first).
- OpenAI: `messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: message }]`.
- Anthropic: `system: systemPrompt` as a new top-level field in the `messages.create(...)` call (Anthropic's `system` is separate from its `messages` array, which becomes `[...history, { role: 'user', content: message }]`).
- `sendLLMRequest`'s signature becomes `(provider, model, systemPrompt, history, message, apiKey, options)`, passing through to whichever provider function.

### 3. `server/services/aiChatService.js`

- **`sendMessage`**: before calling `processAIRequest`, fetch recent history via `AIChat.getRecentMessages(userId, 5)`, reverse it to chronological order, and map each document to a `{ role: 'user', content: doc.message }` + `{ role: 'assistant', content: doc.response }` pair (flattened into one array, oldest first) — pass this as a new `history` argument to `processAIRequest`. Also extract file text (see below) before calling `processAIRequest`, and pass the extracted text alongside `fileAttachment`. The saved `AIChat` document gains `isFallback: aiResponse.isFallback` and the returned object from `sendMessage` gains `isFallback: aiResponse.isFallback`.
- **`processAIRequest(message, platform, agent, fileAttachment, history, extractedFileText)`**: builds `systemPrompt` via `buildSystemPrompt(agent, fileAttachment, extractedFileText)` (see below) and no longer concatenates it with the message into `fullMessage` — instead passes `systemPrompt`, `history`, and the raw `message` separately to `llmService.sendLLMRequest` (for OpenAI/Anthropic) or to `processOllamaRequest` (for Ollama, which still needs a single rendered string). On the catch path (AI call failed), the returned object gains `isFallback: true`; on the success path, `isFallback: false`.
- **`buildSystemPrompt(agent, fileAttachment, extractedFileText)`**: when `extractedFileText` is present, includes it directly (truncated to 8,000 characters, with a `...[truncated]` suffix if cut) instead of just the filename/mimetype note: `\n\nThe user has attached a file "${fileAttachment.fileName}". Its content:\n\n${truncatedText}\n\nConsider this content in your response.` When `extractedFileText` is absent but `fileAttachment` is present (unparseable type or parse failure), keep today's filename/mimetype-only note.
- **`processOllamaRequest(message, platform, systemPrompt, history)`**: prompt template becomes: if `history.length > 0`, prepend `Previous conversation:\n` followed by each history entry rendered as `User: <content>\nAssistant: <content>\n` (pairing them back up from the flattened array), then `\nCurrent question:\nUser: ${message}\n\nAssistant:`; if no history, keep today's `${systemPrompt}\n\nUser: ${message}\n\nAssistant:` template. `systemPrompt` is still prepended in both cases (Ollama has no separate system parameter on this endpoint).
- **New method `extractFileText(fileAttachment)`**: given a `fileAttachment` with `fileUrl` (e.g. `/uploads/ai-chat/<filename>`) and `mimeType`, resolves the real disk path (`path.join(__dirname, '..', fileAttachment.fileUrl)`) and calls `DocumentParsingService.parseDocument(diskPath, mimeType)` if the mime type is one of `text/plain`, `application/pdf`, `application/msword`, or the docx mime type; truncates the result to 8,000 characters; returns `null` (not throwing) for unsupported types or on any parse error, logging the reason.
- **Delete `generateExamAssistantResponse`** (all ~140 lines) and its call site in `generateFallbackResponse`. `generateFallbackResponse`'s `exam-assistant` branch is folded into the same config/generic-issue logic already used for the other 3 agents (add `'exam-assistant'` entries to both the `isConfigIssue` and generic `fallbackResponses` maps, following the existing pattern and tone).
- **`getChatHistory`**: its response-mapping object (`messages: result.messages.map(msg => ({...}))`) gains `isFallback: msg.isFallback` alongside the existing whitelisted fields, so history entries carry the flag through to the client.

### 4. `server/routes/aiChatRoutes.js`

- `/message`'s success response gains `isFallback: result.isFallback` in the `data` object.

### 5. Client — `client/src/api/aiChat.ts`

- No signature changes to `sendChatMessage`/`getChatHistory` — both already return whatever the backend sends via `response.data.data`, and the new `isFallback` field passes through untyped (this file doesn't declare response interfaces beyond doc comments, consistent with its existing style).

### 6. Client — `client/src/pages/admin/AIChat.tsx`

- `ChatMessage` interface gains `isFallback?: boolean`.
- `sendMessageToAI`: the constructed `botChatMessage` gains `isFallback: responseData.isFallback`; the toast on success becomes conditional — `isFallback: true` shows a neutral/warning-toned toast ("Response generated from a fallback — the AI service may be unavailable") instead of "AI response received successfully."
- The bot-message bubble JSX gains a small indicator (a muted-foreground line with an icon, e.g. "⚠ Fallback response") rendered when `message.isBot && message.isFallback`, placed directly after the existing timestamp line.
- History loading (`fetchInitialData` and `loadMoreMessages`) needs no changes — both already spread `...msg` from the raw history object onto the constructed `ChatMessage`, so `isFallback` flows through automatically once `AIChatService.getChatHistory`'s mapped response (Change 3, last bullet) includes it.

## Testing

No automated test framework exists in this repo. Verification: `node --check` for backend files, `npx tsc --noEmit -p tsconfig.app.json` for the client file (current baseline 101), then a manual walkthrough: send a multi-turn exchange (e.g., "generate 2 questions about photosynthesis" then "make the second one harder") and confirm the second response actually references the first exchange's content; upload a `.txt` file with distinctive content and ask a question that could only be answered from that content, confirming the AI's response reflects it; temporarily misconfigure a platform (or use one pointing at an unreachable endpoint) to trigger the fallback path and confirm the UI shows the fallback indicator instead of the normal success toast; confirm `exam-assistant`'s fallback message now matches the simple static pattern instead of the old keyword-driven one.
