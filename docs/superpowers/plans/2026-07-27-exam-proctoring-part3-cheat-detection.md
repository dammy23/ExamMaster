# Exam Proctoring Suite — Part 3: Browser-Based Cheat-Detection Heuristics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four browser-based cheat-detection heuristics (multi-monitor, VM indicators, suspicious extension probing, DevTools-open) to the student exam-attempt flow, feeding severity-tagged alerts into the existing Part 1/2 real-time monitoring pipeline.

**Architecture:** A new isolated `client/src/lib/cheatDetection.ts` module exports four pure/self-contained detection functions. `ExamAttempt.tsx`'s existing security-monitoring effect calls them and logs positives through the same `logExamActivity()` path every existing violation already uses — no new socket event, no new DB field, no new route. `server/sockets/activityClassifier.js` gains a severity tier (`'high'` | `'medium'`) alongside its existing `isViolation` boolean, and `LiveMonitoring.tsx`'s Recent Alerts panel renders it as a badge.

**Tech Stack:** React 18 + TypeScript (client), Express + Mongoose (server), Socket.IO (existing real-time channel from Part 1) — no new dependencies.

## Global Constraints

- tsc baseline is **81 errors** (`cd client && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`). No task may increase this count.
- No automated test framework exists in this repo. Verification is `node --check` (backend), the tsc baseline check (frontend), one-off throwaway `node -e` scripts for backend logic, and live Playwright/`browser_evaluate` runs for anything browser-only — never skipped, never replaced with "trust the code."
- New activity strings, used identically everywhere they appear: `multi_monitor_detected`, `vm_indicator_detected`, `suspicious_extension_detected`, `devtools_open_detected`.
- Severity is exactly the two-value union `'high' | 'medium'` — no other tiers.
- `client/src/pages/student/MobileExamAttempt.tsx` is not touched by this plan.
- Any detection function must return "not detected" (never throw, never a false positive) when its underlying browser API is unsupported or errors.

---

### Task 1: Cheat-detection module

**Files:**
- Create: `client/src/lib/cheatDetection.ts`
- Test: manual — `tsc` baseline check (no test framework in this repo; see Global Constraints)

**Interfaces:**
- Produces: `detectMultiMonitor(): boolean`, `detectVmIndicator(): boolean`, `probeSuspiciousExtensions(): Promise<boolean>`, `createDevToolsWatcher(onOpen: () => void, thresholdPx?: number, intervalMs?: number): () => void`

- [ ] **Step 1: Create the detection module**

```typescript
// client/src/lib/cheatDetection.ts

const VM_RENDERER_SUBSTRINGS = [
  'SwiftShader',
  'llvmpipe',
  'VMware',
  'VirtualBox',
  'Microsoft Basic Render Driver',
  'Parallels',
]

// Sourced from a publicly documented extension-detection example
// (https://www.codestudy.net/blog/check-whether-user-has-a-chrome-extension-installed/).
// Confirm this resource path against a real Grammarly install before relying on it in
// production — extension IDs and web-accessible resources can change between versions.
const EXTENSION_PROBES: { name: string; url: string }[] = [
  {
    name: 'Grammarly',
    url: 'chrome-extension://kbfnbcaeplbcioakkpcpgfkobkghlhen/src/css/Grammarly.styles.css',
  },
]

export function detectMultiMonitor(): boolean {
  return Boolean((window.screen as any).isExtended)
}

export function detectVmIndicator(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return false

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    if (!debugInfo) return false

    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    if (typeof renderer !== 'string') return false

    const lowerRenderer = renderer.toLowerCase()
    return VM_RENDERER_SUBSTRINGS.some(substring =>
      lowerRenderer.includes(substring.toLowerCase())
    )
  } catch {
    return false
  }
}

export async function probeSuspiciousExtensions(): Promise<boolean> {
  const results = await Promise.all(
    EXTENSION_PROBES.map(async ({ url }) => {
      try {
        await fetch(url)
        return true
      } catch {
        return false
      }
    })
  )
  return results.some(Boolean)
}

export function createDevToolsWatcher(
  onOpen: () => void,
  thresholdPx = 160,
  intervalMs = 1500
): () => void {
  let wasOpen = false

  const check = () => {
    const widthDelta = window.outerWidth - window.innerWidth
    const heightDelta = window.outerHeight - window.innerHeight
    const isOpen = widthDelta > thresholdPx || heightDelta > thresholdPx

    if (isOpen && !wasOpen) {
      onOpen()
    }
    wasOpen = isOpen
  }

  const interval = setInterval(check, intervalMs)
  return () => clearInterval(interval)
}
```

- [ ] **Step 2: Verify no new TypeScript errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `81` (unchanged from baseline — this file is additive and not yet imported anywhere, so it must not shift the count on its own).

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/cheatDetection.ts
git commit -m "Add browser-based cheat-detection heuristic functions"
```

---

### Task 2: Severity classification on the backend

**Files:**
- Modify: `server/sockets/activityClassifier.js`
- Modify: `server/services/examAttemptService.js:9,572-582`

**Interfaces:**
- Consumes: nothing from Task 1 (backend-only, independent).
- Produces: `classifyActivity(activity: string): { isViolation: boolean, severity?: 'high' | 'medium' }`, replacing the old `isViolation(activity): boolean` export. The `attempt:activity` socket payload gains a `severity` field (Task 4 consumes this).

- [ ] **Step 1: Replace `isViolation` with `classifyActivity`**

Current content of `server/sockets/activityClassifier.js`:

```js
const VIOLATION_ACTIVITIES = new Set([
  'tab_switch',
  'focus_lost',
  'right_click_attempt',
  'f12_attempt',
  'alt_tab_attempt',
  'print_screen_attempt',
  'fullscreen_exit',
  'fullscreen_failed'
]);

function isViolation(activity) {
  if (VIOLATION_ACTIVITIES.has(activity)) {
    return true;
  }
  return typeof activity === 'string' && activity.startsWith('blocked_shortcut_');
}

module.exports = { isViolation };
```

Replace the entire file with:

```js
const HIGH_SEVERITY_ACTIVITIES = new Set([
  'tab_switch',
  'focus_lost',
  'right_click_attempt',
  'f12_attempt',
  'alt_tab_attempt',
  'print_screen_attempt',
  'fullscreen_exit',
  'fullscreen_failed',
  'multi_monitor_detected',
  'devtools_open_detected'
]);

const MEDIUM_SEVERITY_ACTIVITIES = new Set([
  'vm_indicator_detected',
  'suspicious_extension_detected'
]);

function classifyActivity(activity) {
  const isBlockedShortcut = typeof activity === 'string' && activity.startsWith('blocked_shortcut_');

  if (HIGH_SEVERITY_ACTIVITIES.has(activity) || isBlockedShortcut) {
    return { isViolation: true, severity: 'high' };
  }
  if (MEDIUM_SEVERITY_ACTIVITIES.has(activity)) {
    return { isViolation: true, severity: 'medium' };
  }
  return { isViolation: false, severity: undefined };
}

module.exports = { classifyActivity };
```

- [ ] **Step 2: Verify classification with a throwaway script**

Run (from `server/`):
```bash
node -e "
const { classifyActivity } = require('./sockets/activityClassifier.js');
console.log(JSON.stringify(classifyActivity('tab_switch')));
console.log(JSON.stringify(classifyActivity('multi_monitor_detected')));
console.log(JSON.stringify(classifyActivity('devtools_open_detected')));
console.log(JSON.stringify(classifyActivity('vm_indicator_detected')));
console.log(JSON.stringify(classifyActivity('suspicious_extension_detected')));
console.log(JSON.stringify(classifyActivity('blocked_shortcut_c')));
console.log(JSON.stringify(classifyActivity('answer_saved')));
"
```
Expected output (one JSON object per line, in order):
```
{"isViolation":true,"severity":"high"}
{"isViolation":true,"severity":"high"}
{"isViolation":true,"severity":"high"}
{"isViolation":true,"severity":"medium"}
{"isViolation":true,"severity":"medium"}
{"isViolation":true,"severity":"high"}
{"isViolation":false}
```
(The last line omits `severity` because `JSON.stringify` drops `undefined`-valued keys — expected, not a bug.)

- [ ] **Step 3: Syntax-check the file**

Run: `node --check server/sockets/activityClassifier.js`
Expected: no output (success).

- [ ] **Step 4: Update `examAttemptService.js`'s import and emission**

Current content at line 9:
```js
const { isViolation } = require('../sockets/activityClassifier.js');
```
Replace with:
```js
const { classifyActivity } = require('../sockets/activityClassifier.js');
```

Current content at lines 572-582:
```js
      if (attempt.examId && attempt.examId.createdBy) {
        socketManager.emitToAdmin(attempt.examId.createdBy.toString(), 'attempt:activity', {
          attemptId: attempt._id.toString(),
          examId: attempt.examId._id.toString(),
          studentId: attempt.studentId.toString(),
          activity,
          timestamp: logEntry.timestamp,
          isViolation: isViolation(activity),
          tabSwitches: attempt.tabSwitches
        });
      }
```
Replace with:
```js
      if (attempt.examId && attempt.examId.createdBy) {
        const classification = classifyActivity(activity);
        socketManager.emitToAdmin(attempt.examId.createdBy.toString(), 'attempt:activity', {
          attemptId: attempt._id.toString(),
          examId: attempt.examId._id.toString(),
          studentId: attempt.studentId.toString(),
          activity,
          timestamp: logEntry.timestamp,
          isViolation: classification.isViolation,
          severity: classification.severity,
          tabSwitches: attempt.tabSwitches
        });
      }
```

- [ ] **Step 5: Syntax-check the file**

Run: `node --check server/services/examAttemptService.js`
Expected: no output (success).

- [ ] **Step 6: Commit**

```bash
git add server/sockets/activityClassifier.js server/services/examAttemptService.js
git commit -m "Add severity tier to activity classification"
```

---

### Task 3: Wire detection into the student exam-attempt flow

**Files:**
- Modify: `client/src/pages/student/ExamAttempt.tsx:1-44` (imports), `:121-293` (security-monitoring effect)

**Interfaces:**
- Consumes: `detectMultiMonitor`, `detectVmIndicator`, `probeSuspiciousExtensions`, `createDevToolsWatcher` from Task 1's `client/src/lib/cheatDetection.ts`.
- Produces: nothing new for later tasks — this is a leaf wiring task.

- [ ] **Step 1: Import the detection module**

In the import block at the top of `client/src/pages/student/ExamAttempt.tsx` (after the existing `import { ScreenRecorder } from "@/components/ScreenRecorder"` at line 44), add:

```typescript
import {
  detectMultiMonitor,
  detectVmIndicator,
  probeSuspiciousExtensions,
  createDevToolsWatcher,
} from "@/lib/cheatDetection"
```

- [ ] **Step 2: Run the one-time checks after `enterFullScreen()`, and start the DevTools watcher**

Current content immediately after the `enterFullScreen()` call (line 140):
```typescript
    enterFullScreen()

    // Handle visibility change (tab switching detection)
```
Replace with:
```typescript
    enterFullScreen()

    // One-time environment heuristics (checked once at start, not expected to
    // change mid-exam)
    if (detectMultiMonitor()) {
      logExamActivity(attemptId, 'multi_monitor_detected')
    }
    if (detectVmIndicator()) {
      logExamActivity(attemptId, 'vm_indicator_detected')
    }
    probeSuspiciousExtensions().then(detected => {
      if (detected) {
        logExamActivity(attemptId, 'suspicious_extension_detected')
      }
    })

    // Continuous DevTools-open detection (edge-triggered — only fires on the
    // closed-to-open transition)
    const stopDevToolsWatcher = createDevToolsWatcher(() => {
      logExamActivity(attemptId, 'devtools_open_detected')
    })

    // Handle visibility change (tab switching detection)
```

- [ ] **Step 3: Stop the DevTools watcher in the effect's cleanup**

Current cleanup function (lines 279-292):
```typescript
    // Cleanup function
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleFocusLoss)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('selectstart', handleSelectStart)
      document.removeEventListener('dragstart', handleDragStart)
      
      // Re-enable selection
      document.body.style.userSelect = ''
      document.body.style.webkitUserSelect = ''
    }
```
Replace with:
```typescript
    // Cleanup function
    return () => {
      stopDevToolsWatcher()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleFocusLoss)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('selectstart', handleSelectStart)
      document.removeEventListener('dragstart', handleDragStart)
      
      // Re-enable selection
      document.body.style.userSelect = ''
      document.body.style.webkitUserSelect = ''
    }
```

- [ ] **Step 4: Verify no new TypeScript errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `81` (unchanged).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/student/ExamAttempt.tsx
git commit -m "Wire cheat-detection heuristics into exam attempt monitoring"
```

---

### Task 4: Severity display in Live Monitoring's Recent Alerts panel

**Files:**
- Modify: `client/src/pages/admin/LiveMonitoring.tsx:20-24` (`AlertEntry` interface), `:104-109` (`handleActivity`), `:249-257` (alert rendering)

**Interfaces:**
- Consumes: `severity` field on the `attempt:activity` socket payload, produced by Task 2.
- Produces: nothing for later tasks.

- [ ] **Step 1: Add `severity` to the `AlertEntry` interface**

Current content (lines 20-24):
```typescript
interface AlertEntry {
  attemptId: string
  activity: string
  timestamp: string
}
```
Replace with:
```typescript
interface AlertEntry {
  attemptId: string
  activity: string
  timestamp: string
  severity: 'high' | 'medium'
}
```

- [ ] **Step 2: Carry `severity` through when an alert is recorded**

Current content (lines 104-109):
```typescript
      if (payload.isViolation) {
        setAlerts(prev => [
          { attemptId: payload.attemptId, activity: payload.activity, timestamp: payload.timestamp },
          ...prev
        ].slice(0, 20))
      }
```
Replace with:
```typescript
      if (payload.isViolation) {
        setAlerts(prev => [
          { attemptId: payload.attemptId, activity: payload.activity, timestamp: payload.timestamp, severity: payload.severity },
          ...prev
        ].slice(0, 20))
      }
```

- [ ] **Step 3: Render a severity badge on each alert**

Current content (lines 249-257):
```typescript
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0">
                  <span>{alert.activity.replace(/_/g, ' ')}</span>
                  <span className="text-muted-foreground">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          ) : (
```
Replace with:
```typescript
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={alert.severity === 'high' ? 'destructive' : 'secondary'}>
                      {alert.severity === 'high' ? 'High' : 'Medium'}
                    </Badge>
                    <span>{alert.activity.replace(/_/g, ' ')}</span>
                  </div>
                  <span className="text-muted-foreground">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          ) : (
```

`Badge` is already imported at line 3 — no new import needed.

- [ ] **Step 4: Verify no new TypeScript errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `81` (unchanged).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/LiveMonitoring.tsx
git commit -m "Show severity badge on Live Monitoring alert entries"
```

---

### Task 5: End-to-end live verification

**Files:** none (verification only)

**Interfaces:** none — this task exercises the full path Tasks 1-4 built.

- [ ] **Step 1: Full syntax/type sweep**

```bash
node --check server/sockets/activityClassifier.js
node --check server/services/examAttemptService.js
cd client && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```
Expected: both `node --check` calls produce no output; tsc count is `81`.

- [ ] **Step 2: Live two-session run**

Start the dev server (`npm run dev` or the project's existing dev script) and open two Playwright browser contexts: one logged in as a student, one as the admin who owns the exam, with the admin's Live Monitoring page open. Start an attempt as the student.

- [ ] **Step 3: Verify the high-confidence, environment-dependent signals**

VM indicator: check the browser console/network for the `log-activity` call — this session's Chromium sandbox commonly reports a software renderer (e.g. `SwiftShader`), so `vm_indicator_detected` may fire naturally without any stubbing. Confirm it appears in the admin's Recent Alerts panel with a `Medium` badge if it does.

- [ ] **Step 4: Verify multi-monitor and DevTools detection via stubbing**

These can't be triggered for real in a single-monitor automated session. In the student's browser context, before the security-monitoring effect would run its one-time checks (i.e., early in the page lifecycle), stub the API via `browser_evaluate`:
```javascript
Object.defineProperty(window.screen, 'isExtended', { value: true, configurable: true })
```
Reload/re-enter the attempt and confirm `multi_monitor_detected` reaches the admin's Recent Alerts panel with a `High` badge. Separately, confirm the DevTools watcher's baseline is silent (no `devtools_open_detected` under normal conditions), then simulate the delta directly:
```javascript
Object.defineProperty(window, 'outerWidth', { value: window.innerWidth + 300, configurable: true })
```
and wait slightly over 1.5s (the watcher's poll interval) — confirm `devtools_open_detected` reaches the admin panel with a `High` badge, and confirm it does **not** re-fire on subsequent polls while the stubbed delta remains (edge-triggered behavior).

- [ ] **Step 5: Verify the extension-probe mechanism**

Installing a real Grammarly extension isn't practical in this environment. In the student's browser context, stub `fetch` via `browser_evaluate` to resolve for the probe's exact URL and confirm `suspicious_extension_detected` reaches the admin panel with a `Medium` badge:
```javascript
const originalFetch = window.fetch
window.fetch = (url, ...args) => {
  if (String(url).startsWith('chrome-extension://kbfnbcaeplbcioakkpcpgfkobkghlhen/')) {
    return Promise.resolve(new Response())
  }
  return originalFetch(url, ...args)
}
```
Also confirm the un-stubbed baseline (real environment, no matching extension) resolves to no alert — the probe must fail closed.

- [ ] **Step 6: Confirm `MobileExamAttempt.tsx` is unaffected**

```bash
git diff main -- client/src/pages/student/MobileExamAttempt.tsx
```
Expected: no output (file untouched by this branch).

- [ ] **Step 7: Report results**

No commit for this task (verification only) — proceed to `superpowers:finishing-a-development-branch` once all steps above pass. If any stubbed check fails to reach the admin panel, treat it as a blocker and return to the relevant task rather than proceeding.
