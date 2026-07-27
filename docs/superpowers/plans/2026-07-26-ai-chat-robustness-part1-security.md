# AI Chat Robustness — Part 1: Security & Correctness Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close a real cost/abuse gap (any authenticated student can currently trigger paid AI Chat API calls and directly create exams/questions), stop leaking API keys to server logs, fix a stale-client-caching bug, add a request timeout, restore a broken "is this platform configured" check, and fix stale error copy — all in the existing AI Chat backend/client, no new features.

**Architecture:** Four independent, single-file (or single-concern) fixes: route auth guards, a model-layer configuration check, the shared LLM client wrapper, and one client-side copy fix. None depend on each other.

**Tech Stack:** Express + Mongoose (backend), OpenAI/Anthropic Node SDKs, React + TypeScript (client). No automated test framework exists in this repo.

## Global Constraints

- Backend verification: `node --check <file>` (no test framework exists).
- Client verification: `npx tsc --noEmit -p tsconfig.app.json` from `client/`, compared against the current baseline of **101** pre-existing errors — task changes must not increase this count.
- Do not touch the `/create-questions` route's internal `examId`-driven assignment branch (its error handling is a separate, currently-dead-code concern deferred to a later cleanup pass) — only its auth guard changes in this plan.
- Do not add markdown rendering, conversation memory, or any other feature-level change — this plan is fixes only.

---

### Task 1: Route auth — `requireAdmin` on all AI Chat routes

**Files:**
- Modify: `server/routes/aiChatRoutes.js:11` (import) and 11 route declarations (lines 62, 141, 187, 210, 233, 282, 374, 423, 474, 546, 635)

**Interfaces:**
- Consumes: `requireAdmin` from `server/routes/middleware/auth.js` (already exported alongside `requireUser`, signature `(req, res, next)`, checks `req.user.role !== 'admin'` and responds 403 if not admin).
- Produces: every `/api/ai-chat/*` route now returns 403 for any non-admin authenticated request. No other task depends on this change.

- [ ] **Step 1: Import `requireAdmin`**

Replace:

```js
const { requireUser } = require('./middleware/auth');
```

with:

```js
const { requireUser, requireAdmin } = require('./middleware/auth');
```

- [ ] **Step 2: Swap the guard on all 11 routes**

The exact substring `, requireUser,` appears only in the 11 route declarations in this file (not in the import line, which reads `{ requireUser }` with no leading comma). Replace all occurrences:

Replace (`replace_all`):

```js
, requireUser,
```

with:

```js
, requireAdmin,
```

- [ ] **Step 3: Verify syntax**

Run: `node --check server/routes/aiChatRoutes.js`
Expected: no output (exits 0)

- [ ] **Step 4: Verify all 11 routes were updated**

Run: `grep -c "requireAdmin" server/routes/aiChatRoutes.js`
Expected: `12` (1 import + 11 route declarations)

Run: `grep -c "requireUser" server/routes/aiChatRoutes.js`
Expected: `1` (only the now-unused-but-still-imported name in the import statement — `requireUser` is imported but no longer called anywhere in this file; leaving the import is harmless and avoids an unrelated diff, since removing it entirely isn't necessary for this fix)

- [ ] **Step 5: Commit**

```bash
git add server/routes/aiChatRoutes.js
git commit -m "fix: require admin role on all AI Chat routes"
```

---

### Task 2: Fix `AIPlatform.isConfigured` hardcoded-true bug

**Files:**
- Modify: `server/models/AIPlatform.js:144-155`

**Interfaces:**
- Consumes: `platform.configuration.apiKey`, `platform.configuration.baseUrl` (existing schema fields, unchanged).
- Produces: `AIPlatform.findActiveWithStatus()`'s returned `isConfigured`/`configurationStatus`/`configurationMessage` per platform now reflect real configuration state, consumed by `client/src/pages/admin/AIChat.tsx`'s platform-badge rendering (no code change needed there — it already reads these fields correctly, it was just always receiving `true`).

- [ ] **Step 1: Restore the real configuration check**

Replace:

```js
        case 'openai':
        case 'anthropic':
        case 'ollama':
          // Ollama only needs baseUrl which is not hidden
          //const hasBaseUrl = (platform.configuration && platform.configuration.baseUrl && platform.configuration.baseUrl.trim().length > 0) || (platform.configuration && platform.configuration.apiKey && platform.configuration.apiKey.trim().length > 0);
          const hasBaseUrl=true;
          console.log(`${platform.name} base URL configured:`, hasBaseUrl ? 'yes' : 'no'+platform.configuration.apiKey);
          isConfigured = hasBaseUrl;
          configurationStatus = hasBaseUrl ? 'configured' : 'missing_base_url';
          configurationMessage = hasBaseUrl ? 'Ready to use' : 'Please configure base URL in Settings → AI Platforms';
          break;
```

with:

```js
        case 'openai':
        case 'anthropic':
        case 'ollama':
          // Ollama only needs baseUrl which is not hidden
          const hasBaseUrl = (platform.configuration && platform.configuration.baseUrl && platform.configuration.baseUrl.trim().length > 0) || (platform.configuration && platform.configuration.apiKey && platform.configuration.apiKey.trim().length > 0);
          isConfigured = hasBaseUrl;
          configurationStatus = hasBaseUrl ? 'configured' : 'missing_base_url';
          configurationMessage = hasBaseUrl ? 'Ready to use' : 'Please configure base URL in Settings → AI Platforms';
          break;
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server/models/AIPlatform.js`
Expected: no output (exits 0)

- [ ] **Step 3: Commit**

```bash
git add server/models/AIPlatform.js
git commit -m "fix: restore real isConfigured check instead of hardcoded true"
```

---

### Task 3: Fix `llmService.js` — remove API-key logging, stop stale client caching, add timeout

**Files:**
- Modify: `server/services/llmService.js` (full file, 132 lines)

**Interfaces:**
- Consumes: `openai`/`@anthropic-ai/sdk` packages (already installed, unchanged).
- Produces: `sendLLMRequest(provider, model, message, apiKey, options)` — same signature and return shape as before (`{content, usage}`), consumed unchanged by `server/services/aiChatService.js`. Internal helper functions `getOpenAIClient`/`getAnthropicClient` no longer cache; both now accept a `timeout` via the SDK client's own `timeout` option.

- [ ] **Step 1: Remove client caching, API-key logging, and add a 60s timeout**

Replace:

```js
// Initialize clients only when needed to avoid startup errors
let openai = null;
let anthropic = null;

function getOpenAIClient(apiKey) {
  console.log("Dami "+apiKey);
  if (!openai) {
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.');
    }
    openai = new OpenAI({
      apiKey: apiKey,
    });
  }
  return openai;
}

function getAnthropicClient(apiKey) {
  if (!anthropic) {
    if (!apiKey) {
      throw new Error('Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.');
    }
    anthropic = new Anthropic({
      apiKey: apiKey,
    });
  }
  return anthropic;
}
```

with:

```js
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
```

- [ ] **Step 2: Remove the remaining API-key log line in `sendLLMRequest`**

Replace:

```js
async function sendLLMRequest(provider, model, message, apiKey,options = {}) {
  console.log(`LLM Service - Processing ${apiKey}request for provider: ${provider}, model: ${model}`);
  
  switch (provider.toLowerCase()) {
```

with:

```js
async function sendLLMRequest(provider, model, message, apiKey,options = {}) {
  switch (provider.toLowerCase()) {
```

- [ ] **Step 3: Verify syntax**

Run: `node --check server/services/llmService.js`
Expected: no output (exits 0)

- [ ] **Step 4: Confirm no API-key logging remains**

Run: `grep -n "apiKey" server/services/llmService.js`
Expected: only the parameter names and the two client-constructor `apiKey: apiKey,` lines — no `console.log` line containing `apiKey` in its output.

- [ ] **Step 5: Commit**

```bash
git add server/services/llmService.js
git commit -m "fix: stop caching stale LLM clients, remove API key logging, add 60s timeout"
```

---

### Task 4: Fix stale file-size error copy

**Files:**
- Modify: `client/src/api/aiChat.ts` (4 occurrences)

**Interfaces:**
- Consumes: nothing new.
- Produces: no signature changes — only user-facing error message text changes.

- [ ] **Step 1: Fix the error copy**

The exact string `File too large. Please select a file smaller than 2MB.` appears at 4 call sites (lines 25, 33, 145, 153) with identical text each time. Replace all occurrences:

Replace (`replace_all`):

```ts
File too large. Please select a file smaller than 2MB.
```

with:

```ts
File too large. Please select a file smaller than 20MB.
```

- [ ] **Step 2: Verify**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `101` (unchanged baseline)

- [ ] **Step 3: Commit**

```bash
git add client/src/api/aiChat.ts
git commit -m "fix: correct stale 2MB file-size error copy to match the real 20MB limit"
```

---

### Task 5: Manual verification

No automated test framework exists in this repo — this task is a manual walkthrough covering all 4 fixes above.

**Files:** none (verification only)

- [ ] **Step 1: Start both servers**

Backend (`server/`): `npm run dev`
Client (`client/`): `npm run dev` — confirm it serves at `http://127.0.0.1:5173`

- [ ] **Step 2: Confirm a student token is rejected by AI Chat routes**

Log in as a student via `curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"student1@example.com","password":"password123"}'` and extract `accessToken`. Then:

```bash
curl -s -X POST http://localhost:3000/api/ai-chat/message -H "Authorization: Bearer <student-token>" -H "Content-Type: application/json" -d '{"message":"test","modelId":"x","agentId":"y"}'
```

Expected: `{"success":false,"error":"Admin access required"}` with HTTP 403 (check via `-i` flag for the status line), not a 200 or a 500.

- [ ] **Step 3: Confirm an admin token still works**

Repeat with an admin token (`admin@yahoo.com` / `password123`) against `GET /api/ai-chat/history` — expect a normal 200 response.

- [ ] **Step 4: Confirm no API keys appear in server logs**

Tail the backend dev server's stdout while sending one chat message as admin through the UI (`/admin/ai-chat`, pick a configured platform, send any message). Confirm no line in the log output contains the platform's API key value.

- [ ] **Step 5: Confirm the platform "configured" badge now reflects reality**

In the admin AI Chat UI's platform dropdown/config panel, check a platform that has no API key set in Settings → AI Platforms — confirm it now shows "Needs Setup" (or equivalent not-configured styling) instead of always showing "Ready to use". Then check one with a real key configured — confirm it shows as configured.

- [ ] **Step 6: Confirm a real chat round-trip still works**

As admin, with a properly configured platform, send a chat message and confirm a real AI response comes back successfully — proving the client-caching removal and the added timeout didn't break normal operation.

- [ ] **Step 7: Report results**

Summarize pass/fail for each step above before moving to `finishing-a-development-branch`.
