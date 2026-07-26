# AI Chat Robustness — Part 4: UI Friendliness — Design

**Status:** Approved
**Date:** 2026-07-26
**Scope:** `client/src/pages/admin/AIChat.tsx`, `client/src/api/aiChat.ts`, `server/models/AIChat.js`, `server/services/aiChatService.js`, `server/routes/aiChatRoutes.js`

## Context

Parts 1-3 (Security & Correctness, Prompt & AI Process Overhaul, Remove/Consolidate Dead Features) are merged. This is the final part of the initiative, covering "make the chat UI more user-friendly." Re-reading the current full state of `AIChat.tsx` (904 lines, last touched by Part 2's `isFallback` indicator and Part 3 indirectly) confirmed five gaps from the original research still stand:

1. The AI's system prompt explicitly instructs markdown formatting (bold, bullet lists, a structured `**GENERATED QUESTIONS:**` block), but every message renders through a single `<p className="whitespace-pre-wrap">` — all of that markdown shows up as literal asterisks. Confirmed via `parseGeneratedQuestions.ts` that it only *extracts* questions into a separate array; it never strips the raw markdown block from the displayed text, so the duplication (raw block + "Save Questions" UI) is visible today.
2. `processingTime`/`tokenCount` are computed by `processAIRequest`, returned in `/message`'s response, and stored in `AIChat.metadata` — but `AIChatService.getChatHistory`'s response mapping never includes them (confirmed by reading the method), so even if the client rendered them, reloaded history would show nothing. Nowhere in `AIChat.tsx` reads or displays them today.
3. No regenerate/retry — confirmed no such button or handler exists.
4. No clear-history UI — confirmed `AIChat.js`'s `softDelete()` is a real, working per-document instance method with zero callers anywhere in the codebase.
5. No `aria-label` on the icon-only attach (`Paperclip`) or remove-file (`X`) buttons, and no `aria-live` region — confirmed by reading the full JSX.

## Design decisions

**Markdown via `react-markdown` (confirmed with user).** A new client dependency, chosen over a lightweight custom regex renderer for full CommonMark correctness (nested lists, code fences like the `\`\`\`json\`\`\`` blocks `parseGeneratedQuestions` already scans for, etc.) rather than betting on the AI's output always matching a narrower hand-rolled pattern set. Applied only to bot messages (`message.isBot`) — user messages are plain typed text, never AI-formatted, and stay in a `<p>`.

**Regenerate appends a fresh exchange; it does not edit history in place.** The last bot message gets a "Regenerate" button that re-invokes the exact same send flow (`sendMessageToAI`) with the same original user text, producing a new stored `AIChat` document rather than mutating or replacing the old one. This needs zero backend changes and avoids any ambiguity about which response is "the real one" — both stay in history, visibly. To make the original text available without new backend work, each bot `ChatMessage` gains an `originalMessage` field populated from the same source data already being read (`msg.message` when transforming history, `userMessage` when transforming a fresh send) — today that value is simply discarded when the bot message object is built.

**Clear history is a single bulk action, not per-message deletion.** `softDelete()` is a per-document instance method; rather than loop-calling it once per message, a new `AIChatService.clearHistory(userId)` bulk-soft-deletes everything for that user in one `updateMany`, exposed as `DELETE /api/ai-chat/history`. The button lives in the Chat card header (trash icon) behind an `AlertDialog` confirmation, matching the existing destructive-action pattern already used in this app (e.g. `ExamManagement.tsx`'s delete-exam confirmation) — clearing potentially months of chat history deserves the same "are you sure" gate as deleting an exam.

**Metadata folds into the existing timestamp line, not a new UI element.** E.g. "10:32 AM · 1.2s · 340 tokens" appended to the same `<p className="text-xs mt-1 opacity-70">` already showing the time — proportional to how minor this data is, not a dashboard.

**Accessibility scope stays to the concretely-flagged gaps** — `aria-label`s on the two icon-only buttons, and one `aria-live="polite"` region wrapping the message list (covers both new message announcements and the "AI is thinking..." loading state, since both already render inside the same scrollable container). Not attempting a full WCAG audit of the page — that's a different-sized project than "UI friendliness" as scoped here.

## Changes

### 1. `server/models/AIChat.js`

- New static method `clearHistory(userId)`: `this.updateMany({ userId, isDeleted: false }, { isDeleted: true })`.

### 2. `server/services/aiChatService.js`

- `getChatHistory`'s response mapping gains `processingTime: msg.metadata?.processingTime` and `tokenCount: msg.metadata?.tokenCount`, alongside the existing `isFallback`.
- New method `clearHistory(userId)`: calls `AIChat.clearHistory(userId)`, returns `{success: true}`.

### 3. `server/routes/aiChatRoutes.js`

- New route `DELETE /api/ai-chat/history` (`requireAdmin`) → `AIChatService.clearHistory(req.user._id)`.

### 4. Client — `client/src/api/aiChat.ts`

- `getChatHistory`'s doc comment updated to include `processingTime`/`tokenCount` in the documented message shape (matching actual server behavior after Change 2).
- New function `clearChatHistory()` — thin `api.delete('/api/ai-chat/history')` wrapper, following this file's existing pattern.

### 5. Client — `AIChat.tsx`

- Add `react-markdown` as a new dependency.
- `ChatMessage` interface gains `processingTime?: number`, `tokenCount?: {input: number, output: number}`, and `originalMessage?: string`.
- Both history-transform sites (`fetchInitialData`, `loadMoreMessages`) and the live-send site (`sendMessageToAI`) populate the three new fields on constructed bot messages (`processingTime`/`tokenCount` from the source `msg`/`responseData`; `originalMessage` from `msg.message` / the live `userMessage` respectively).
- The bot-message bubble's text render (`<p className="text-sm whitespace-pre-wrap">{message.message}</p>`) is replaced with a `<ReactMarkdown>` wrapper for bot messages only; user messages keep the existing `<p>`.
- The timestamp `<p>` gains the processing-time/token-count suffix when present.
- A "Regenerate" button (only rendered when the message is the last item in `messages` and `message.isBot`) calls `sendMessageToAI(message.originalMessage)`.
- A "Clear History" trash-icon button in the Chat `CardHeader`, wrapped in an `AlertDialog`, calls the new `clearChatHistory()` API function on confirm, then resets `messages` to `[]` and `pagination` to `null`.
- `aria-label` added to the attach (`Paperclip`) and remove-file (`X`) icon-only buttons; the message-list container gains `aria-live="polite"` and `aria-atomic="false"`.

## Testing

No automated test framework exists in this repo. Verification: `node --check` for backend files, `npx tsc --noEmit -p tsconfig.app.json` for the client file (current baseline **79**, per Part 3's incidental drop from 101 — task changes must not increase from 79). Manual walkthrough: send a message that produces bold/bulleted AI output and confirm it renders formatted, not as raw asterisks; confirm a freshly-sent message's bubble shows processing time/token count, and confirm a *reloaded* (history-fetched) older message also shows them (proving the backend mapping fix works, not just the live-send path); click "Regenerate" on the latest response and confirm a new exchange appends using the same original question; click "Clear History", confirm the dialog, and confirm the message list empties and a page reload shows no history; tab through the attach/remove-file buttons with a screen reader (or inspect the accessibility tree) to confirm labels are announced. Given the local Ollama model's slow generation time (established in Parts 2-3, sometimes 60-90+ seconds for a full round trip), budget accordingly for the live AI-response checks, or verify the non-AI-dependent pieces (clear history, metadata display of already-stored messages, accessibility attributes) independently of a live generation.
