# AI Chat Robustness — Part 3: Remove/Consolidate Dead Features — Design

**Status:** Approved
**Date:** 2026-07-26
**Scope:** `server/routes/aiChatRoutes.js`, `server/services/aiChatService.js`, `server/services/documentParsingService.js`, `client/src/api/aiChat.ts`

## Context

Parts 1 (Security & Correctness) and 2 (Prompt & AI Process Overhaul) are merged. This part covers the "remove irrelevant features" half of the original request. The original deep research pass found 7 client API exports with zero UI callers today, two of which are backed entirely by a fake, non-AI question generator (`DocumentParsingService.generateQuestionsFromText` builds a real AI prompt via `buildQuestionGenerationPrompt` but never calls a model — it calls `generateSampleQuestions`, pure regex/`Math.random()` sentence-mangling that produces placeholder junk like `"This is an incorrect alternative option A"`).

A prior "Phase 3e" cleanup pass (client-only hygiene, unrelated to this deeper audit) explicitly called these 7 exports "plausible future scaffolding" and left them alone. Re-confirmed this session: they are not scaffolding for something real — two are a parallel fake generator, two (`create-exam`/`create-subject`) are real but fully superseded by the existing intent-detection-triggered `CreateExamModal`/`SubjectForm` dialogs, one (`upload`) doesn't do anything the real attach flow doesn't already do better, one (`models`) is fully redundant with an endpoint already in use, and one (`conversation-context`) is the sole exception — real, valuable data with no fake logic behind it, just never wired to anything.

## Design decisions

**Six of seven dead exports are deleted outright, not kept or repurposed:**
- `getAIModels` / `GET /models` — redundant with `getActiveAIPlatforms()`, already in use.
- `uploadChatFile` / `POST /upload` — redundant with the real attach flow (raw file through `/message`'s multipart body); its backing method doesn't store anything beyond what multer already wrote to disk.
- `generateQuestions` / `POST /generate-questions` and `generateSampleQuestions` / `POST /generate-sample-questions` — both backed by the fake generator.
- `createExamWithAI` / `POST /create-exam` and `createSubjectWithAI` / `POST /create-subject` — real, working code, but superseded: the intent-detection flow (`intentDetection.ts` → `IntentConfirmationDialog` → `CreationDialogManager`) already opens the real, validated `CreateExamModal`/`SubjectForm` when a user's message looks like a creation request. A parallel AI-driven creation path with no review step would be a worse UX than what already exists, not a complementary one.

**The fake generator is deleted in full, not partially kept.** `DocumentParsingService.generateQuestionsFromText`, `buildQuestionGenerationPrompt`, `generateSampleQuestions`, `generateMCQFromSentence`, `generateTrueFalseFromSentence`, `generateShortAnswerFromSentence`, and `validateGeneratedQuestions` are used only by the two routes being deleted — confirmed via grep, zero other call sites. `cleanupFile` is used only by `/generate-questions` and becomes unused too. This leaves `documentParsingService.js` holding only the four real parsing methods (`parseDocument`, `parseTextFile`, `parsePDF`, `parseWordDocument`) that Part 2's `extractFileText` already depends on — cutting the file from 351 lines to roughly 80.

**`getConversationContext` is consolidated into the live chat pipeline, not deleted (confirmed with user).** Its real exam/subject/question-count data is fetched inside `AIChatService.sendMessage` (alongside Part 2's history-fetch and file-extraction prep) and injected into `buildSystemPrompt` for the `exam-assistant` agent, replacing the generic "The system includes: Exam creation and management..." boilerplate with real numbers (e.g., "You currently have 4 exams and 1 subject with 12 questions in the question bank"). The standalone route, its client export, and the now-unused `generateContextualSuggestions` helper (which only ever fed that route's unused "suggestions" field) are removed once the data has a real consumer.

**`/create-questions`'s internal `examId`-driven auto-assign branch is also removed — a deferred item from Part 1, not a new finding.** Part 1's investigation confirmed the only live caller (`AIChatQuestionAssignment.tsx`) never sends `examId` to this route; it always does question-creation and exam-assignment as two separate client calls instead, and that second call already has correct error handling. The branch is unreachable from any UI today. Removing it simplifies the route to exactly what its one real caller does, and — combined with the other deletions in this part — leaves `ExamService` and `SubjectService` with zero remaining references in `aiChatRoutes.js`, so those imports (plus `DocumentParsingService` and the already-vestigial `requireUser`, unused since Part 1's `requireAdmin` migration) are dropped too.

## Changes

### 1. `server/routes/aiChatRoutes.js`

- Delete the `/models`, `/upload`, `/generate-questions`, `/generate-sample-questions`, `/create-exam`, `/create-subject`, and `/conversation-context` route handlers, plus the `generateTopicContent` and `generateContextualSuggestions` helper functions.
- Simplify `/create-questions`: remove the `examId`-driven auto-assign branch (the `let updatedExam = null` declaration, the `if (examId && ...)` block, and the `exam: updatedExam` field in the response) — it now only creates questions and returns `{questions, createdCount, errors, message}`.
- Drop the now-fully-unused imports: `DocumentParsingService`, `ExamService`, `SubjectService`, and `requireUser` (only `requireAdmin` remains needed, alongside `express`, `multer`, `path`, `fs`, `AIChatService`, and `QuestionService` — the last still used by `/create-questions`'s real `bulkCreateQuestions` call).

### 2. `server/services/aiChatService.js`

- **`sendMessage`**: alongside Part 2's history-fetch and file-extraction, fetch real platform counts for `exam-assistant` requests — `ExamService.getAll({}, userId)`, `SubjectService.getAllSubjects({isActive: true})`, `QuestionService.getAllQuestions({}, {page:1, limit:10})` (the exact calls the old `/conversation-context` route made) — and pass a small summary object through to `processAIRequest` → `buildSystemPrompt`.
- **`buildSystemPrompt`**: when the agent is `exam-assistant` and platform counts are available, replace the generic descriptive bullet list with a short real-data line (exam count, subject count, question count). Other agent types keep the existing generic description unchanged (the count data is exam/subject/question-specific, not relevant to `student-support`/`content-creator`/`data-analyst`).
- New imports: `ExamService` and `SubjectService` (moved here from `aiChatRoutes.js`, where neither has any other caller after Change 1) plus `QuestionService` (added here independently — `aiChatRoutes.js` keeps its own `QuestionService` import too, since `/create-questions`'s real `bulkCreateQuestions` call still needs it there; two files independently requiring the same service module is normal and not a duplication concern).

### 3. `server/services/documentParsingService.js`

- Delete `generateQuestionsFromText`, `buildQuestionGenerationPrompt`, `generateSampleQuestions`, `generateMCQFromSentence`, `generateTrueFalseFromSentence`, `generateShortAnswerFromSentence`, `validateGeneratedQuestions`, and `cleanupFile`. Keep `parseDocument`, `parseTextFile`, `parsePDF`, `parseWordDocument` unchanged (still used by Part 2's `extractFileText`).

### 4. Client — `client/src/api/aiChat.ts`

- Delete the `getAIModels`, `uploadChatFile`, `generateQuestions`, `createExamWithAI`, `createSubjectWithAI`, `getConversationContext`, and `generateSampleQuestions` exports. `sendChatMessage`, `getChatHistory`, `getAIAgents`, `createQuestionsWithAI` (used by `AIChatQuestionAssignment.tsx`) are untouched.

## Testing

No automated test framework exists in this repo. Verification: `node --check` for backend files, `npx tsc --noEmit -p tsconfig.app.json` for the client file (current baseline 101), `grep` sweeps confirming no remaining references to any deleted function/route/export anywhere in the codebase, then a manual walkthrough: confirm the existing AI Chat UI (message send, history, question-save flow) still works exactly as before, and confirm the `exam-assistant` agent's real AI responses now reflect real exam/subject/question counts in a fresh conversation (visible either directly if the model restates its context, or indirectly via server logs showing the constructed system prompt).
