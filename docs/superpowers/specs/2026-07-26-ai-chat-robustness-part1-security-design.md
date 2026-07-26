# AI Chat Robustness — Part 1: Security & Correctness Fixes — Design

**Status:** Approved
**Date:** 2026-07-26
**Scope:** `server/routes/aiChatRoutes.js`, `server/models/AIPlatform.js`, `server/services/llmService.js`, `client/src/api/aiChat.ts`

## Context

A deep research pass over the entire AI Chat feature (admin-only chat UI, its backend routes/service, and prompt construction) surfaced 16 concrete bugs across correctness, security, and prompt/UX quality. Given the size, the work was split into 4 independent parts: **Part 1 (this spec) — Security & Correctness**, Part 2 — Prompt & AI Process Overhaul, Part 3 — Remove/Consolidate Dead Features, Part 4 — UI Friendliness. This spec covers only Part 1: the smallest, lowest-risk, highest-severity fixes, none of which require new features or UI work (except one one-line copy fix).

A prior "Phase 3e AI Chat" sub-phase already ran earlier this session — it was a pure client-side hygiene pass (dead imports/state, console.log removal, color tokens, `LoadingState` adoption) and touched none of the backend files or bugs covered here.

## Design decisions

**All `/api/ai-chat/*` routes move from `requireUser` to `requireAdmin` (confirmed with user).** The AI Chat feature exists only in the admin nav (`client/src/lib/nav-config.ts`'s `adminNavItems`, absent from `studentNavItems`) — there is no student-facing AI chat surface anywhere in the app. Today every route (11 of them) uses `requireUser`, which only checks authentication, not role — meaning any logged-in student can call `POST /message` (spending the admin's configured, real OpenAI/Anthropic API budget), `POST /create-exam`, `POST /create-subject`, and `POST /create-questions` directly, bypassing the UI entirely. This matches the existing `aiPlatformRoutes.js` pattern, which already gates its routes with `requireAdmin`.

**Stop caching LLM SDK clients as module-level singletons.** `llmService.js` currently does `if (!openai) { openai = new OpenAI({apiKey}) }` — the client is built once, on the first call, with whatever `apiKey` happened to be passed then, and every subsequent call (even with a different platform's key, or after an admin rotates a key in Settings) silently reuses that first client. SDK client construction does no network I/O — it's just object setup — so there is no meaningful performance cost to constructing a fresh client per request, and doing so eliminates the stale-key bug entirely.

**Add a 60-second timeout to OpenAI/Anthropic requests, matching Ollama's existing timeout.** Right now only the raw Ollama `axios.post` call has a timeout (60s); the OpenAI and Anthropic SDK calls have none, so a hung upstream call hangs the Express request indefinitely. Both SDKs accept a `timeout` option at client-construction time.

**`AIPlatform.isConfigured` is restored to a real check, not deleted or redesigned.** The original logic (still present, commented out) checked for a non-empty `apiKey` or (for Ollama) a non-empty `baseUrl`. It was replaced with a hardcoded `const hasBaseUrl = true`, making every active platform always report "Ready to use" regardless of whether it actually has credentials. Un-commenting the real check is sufficient — no new design needed, this is a straight revert of an accidental regression.

**API-key `console.log` calls are deleted outright, not redacted/masked.** Two call sites in `llmService.js` print the raw API key to server stdout on every client init and every LLM request; a third (inside the `AIPlatform.isConfigured` bug above) would concatenate a raw key into a log line if it were ever hit with `hasBaseUrl` false. None of these logs serve an ongoing debugging purpose that justifies the exposure — delete them rather than trying to mask/truncate the key, which would just be more code to get subtly wrong later.

**The `/create-questions` route's internal `examId`-driven auto-assignment branch is left untouched here, not fixed.** Initial research flagged its swallowed-error handling (assignment failure gets appended to a message string instead of surfaced as a real error) as a live bug. Re-checking the actual client call site (`AIChatQuestionAssignment.tsx`) shows the current UI never passes `examId` to `createQuestionsWithAI` — it always does question-creation and exam-assignment as two separate client calls, and that second call's error handling is already correct (a failure there produces a real error toast, not a false success). The route's internal branch is dead code from the UI's perspective today, so fixing its error handling has no user-visible effect — it's better addressed by Part 3's dead-code cleanup (decide whether to delete the unused `examId` parameter/branch entirely, alongside the route's other unused pieces) than patched here.

**Stale file-size error copy is corrected to match the real 20MB limit.** `client/src/api/aiChat.ts` has four call sites whose 413-handling catch blocks say "smaller than 2MB" while the actual configured limit (both client-side pre-check in `AIChat.tsx` and server-side multer config in `aiChatRoutes.js`) is 20MB — a leftover from an earlier, smaller limit. Fix the copy; the limit itself is correct and unchanged.

## Changes

### 1. `server/routes/aiChatRoutes.js`

- Import `requireAdmin` alongside the existing `requireUser` import (line 11).
- Replace `requireUser` with `requireAdmin` on all 11 routes: `POST /message` (62), `GET /history` (141), `GET /models` (187), `GET /agents` (210), `POST /upload` (233), `POST /generate-questions` (282), `POST /create-exam` (374), `POST /create-subject` (423), `POST /create-questions` (474), `POST /generate-sample-questions` (546), `GET /conversation-context` (635).

### 2. `server/models/AIPlatform.js`

- In `findActiveWithStatus` (around line 149-151), restore the real configuration check (non-empty `apiKey`, or non-empty `baseUrl` for Ollama) in place of the hardcoded `const hasBaseUrl = true`, and remove the `console.log` that would concatenate a raw API key into the log line.

### 3. `server/services/llmService.js`

- `getOpenAIClient(apiKey)`: remove the `if (!openai)` caching guard and the `console.log("Dami "+apiKey)` line; always construct and return a fresh `OpenAI` client for the given key. Add `timeout: 60000` to the client constructor options.
- `getAnthropicClient(apiKey)`: same change — remove the `if (!anthropic)` caching guard, always construct fresh, add `timeout: 60000`.
- `sendLLMRequest`: remove the `console.log(\`LLM Service - Processing ${apiKey}request...\`)` line that prints the raw key.
- The now-unused module-level `let openai = null; let anthropic = null;` declarations are removed along with the caching guards.

### 4. `client/src/api/aiChat.ts`

- Update the four 413-error-handling call sites' message text from "smaller than 2MB" to "smaller than 20MB" (or equivalent phrasing matching the real limit).

## Testing

No automated test framework exists in this repo. Verification: `node --check` for backend files, `npx tsc --noEmit -p tsconfig.app.json` for the client file (current baseline 101), then a manual walkthrough: confirm a student-role login gets a 403 from `POST /api/ai-chat/message` (and the other 10 routes) via direct API calls; confirm the admin UI's platform badges now correctly show "Needs Setup" for a platform with no API key configured (previously always showed "Ready"); confirm server logs no longer contain any API key text after a chat message send; confirm a real chat round-trip still works end-to-end as an admin (proving the client-caching removal and timeout addition didn't break normal operation).
