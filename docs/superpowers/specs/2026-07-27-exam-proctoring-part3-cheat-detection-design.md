# Exam Proctoring Suite — Part 3: Browser-Based Cheat-Detection Heuristics — Design

**Status:** Approved
**Date:** 2026-07-27
**Scope:** `client/src/lib/cheatDetection.ts` (new), `client/src/pages/student/ExamAttempt.tsx`, `server/sockets/activityClassifier.js`, `server/services/examAttemptService.js`, `client/src/pages/admin/LiveMonitoring.tsx`

## Context

This is Part 3, the final part of the exam proctoring suite (see [[exammaster-exam-proctoring-progress]]). Parts 1 (real-time infrastructure + live admin monitoring dashboard) and 2 (screen recording + live screenshots) are merged to `main`. Part 3 covers the "Pearson VUE kind of cheat app and process detection" half of the original request — scoped down, per the hard constraint established during Part 1's design, to what a browser can actually observe: **true OS-level process detection is impossible from a browser sandbox**, so this part adds heuristic signals rather than real process enumeration.

Codebase research (re-verified fresh for this design) confirmed the exact current state this part extends:
- `client/src/pages/student/ExamAttempt.tsx`'s security-monitoring `useEffect` (lines 121-293) already handles fullscreen enforcement, tab-switch/focus-loss detection, right-click/keyboard-shortcut/PrintScreen blocking, and select/drag prevention — all logging fire-and-forget activity strings via `logExamActivity(attemptId, activity)`. Today's DevTools handling is keystroke **blocking only** (F12, Ctrl+Shift+I/J/C, Ctrl+U are intercepted in `handleKeyDown`) — trivially bypassed via the browser's View menu, and there is no actual DevTools-open **detection** anywhere in the codebase.
- `server/sockets/activityClassifier.js` (built in Part 1): a `VIOLATION_ACTIVITIES` Set plus a `blocked_shortcut_` prefix check, exposed as `isViolation(activity): boolean`. This only classifies activity strings that already exist — it adds no detection signal of its own.
- `server/services/examAttemptService.js`'s `logActivity`: pushes `{ activity, timestamp }` onto `ExamAttempt.activityLog` (schema has no room for extra metadata — just those two fields), then emits `attempt:activity` over Part 1's socket channel with `isViolation` computed at emit time (never persisted — always derived from the activity string).
- `client/src/pages/admin/LiveMonitoring.tsx`'s "Recent Alerts" panel renders violation-flagged `attempt:activity` events, bounded to ~20 entries.

## Decisions

**Four heuristics, chosen for being the best signal-to-effort/false-positive ratio a browser can realistically provide**, confirmed with the user against the fuller candidate list (which also included the same four, minus nothing — all four candidates were approved for inclusion):
- **Multi-monitor detection** via `window.screen.isExtended` (Chromium; no permission prompt). High confidence.
- **DevTools-open detection** via the window outer/inner dimension delta (docked DevTools consumes viewport space while the outer window stays the same size). Medium-high confidence — can false-positive on unusual zoom/toolbar configurations, and misses an undocked DevTools window.
- **VM/virtualization indicators** via the WebGL `UNMASKED_RENDERER_WEBGL` string, matched against known software/VM renderer substrings. Medium confidence — some real laptops with disabled hardware acceleration or older integrated GPUs can false-positive.
- **Suspicious browser extension probing** via fetch-probing a small list of extension IDs' web-accessible resources. Lower confidence and real maintenance burden — extension IDs change and are inconsistently documented (confirmed during this design: even Chrome Remote Desktop, the most well-documented candidate, has conflicting IDs across sources — an old enterprise-policy ID vs. its current Chrome Web Store listing, `inomeogfingihgjfjlpeplalcfajhgai`). Shipped as a small, explicitly-illustrative starter list (one verified entry to start), not a comprehensive database. Fetch-probing only works against a resource path the target extension has declared in its own `web_accessible_resources` manifest entry — that exact path is extension-specific and must be verified against the real extension (its published source or a documented working probe URL) at implementation time, not guessed; the plan should treat "confirm a working resource path for the starter entry" as an explicit implementation step, not an assumed given.

**Severity is added to the classifier, replacing the flat `isViolation` boolean with `classifyActivity(activity): { isViolation, severity }`.** The two high-confidence new signals (`multi_monitor_detected`, `devtools_open_detected`) join the existing violation set at `severity: 'high'`. The two lower-confidence signals (`vm_indicator_detected`, `suspicious_extension_detected`) get `severity: 'medium'`, so an admin doesn't treat a shaky VM guess with the same urgency as a confirmed tab-switch. No `ExamAttempt` schema change — severity stays purely derived at emit time, exactly like `isViolation` already was.

**One-time checks at exam start, except DevTools which runs continuously.** Multi-monitor, VM indicators, and extension probing describe a student's environment at the moment the exam begins and aren't expected to change mid-exam (matching the precedent of `enterFullScreen()`'s one-time setup call in the same effect) — a monitor being plugged in mid-exam is an edge case not worth polling for. DevTools-open is different in kind: a student could open it at any point, so it's polled every 1.5s for the exam's duration, matching the effect's other continuous listeners (tab-switch, focus-loss). The DevTools check is **edge-triggered** — it only logs on the closed→open transition, not on every poll tick while open, mirroring how `fullscreen_exit` already avoids re-logging a persistent state.

**New activity strings reuse the existing pipeline end-to-end** — no new socket event, no new DB field, no new route. `multi_monitor_detected`, `vm_indicator_detected`, `suspicious_extension_detected`, and `devtools_open_detected` are logged through the exact same `logExamActivity(attemptId, activity)` call every existing violation already uses, flow through the same `attempt:activity` emission, and render in the same Recent Alerts panel — only now carrying a `severity` field. Building a parallel pipeline for "heuristics" specifically would duplicate infrastructure Parts 1-2 already built and `LiveMonitoring.tsx` already renders.

**Detection logic lives in a new `client/src/lib/cheatDetection.ts`, not inlined into the security-monitoring effect.** That effect already handles six-plus concerns across 170+ lines; adding four more heuristic checks inline would make it harder to reason about. The new module exports isolated, individually-testable functions (`detectMultiMonitor()`, `detectVmIndicator()`, `probeSuspiciousExtensions()`, `createDevToolsWatcher(onOpen, thresholdPx, intervalMs)`), and the effect just calls them and routes any positive result through `logExamActivity` — the same wiring shape it already uses for everything else, delegated instead of grown.

**Any check whose underlying API is unsupported must degrade to "no signal," never a false positive.** `screen.isExtended` is `undefined` on non-Chromium browsers; a WebGL context can fail to initialize; an extension-probe fetch can behave ambiguously depending on browser and CORS handling. In every such case the function returns "not detected," not "detected." A heuristic that can misfire on an unsupported browser is worse than no heuristic — this is the one hard rule governing all four checks.

**`MobileExamAttempt.tsx` stays untouched.** It already has zero proctoring code (webcam, screen recording, or security monitoring), and mobile proctoring remains an explicitly deferred, out-of-scope question across all three parts of this initiative — Part 3 doesn't change that boundary. No native/companion app, and no admin-configurable extension list (the starter list is a hardcoded constant, matching how `activityClassifier.js`'s existing `VIOLATION_ACTIVITIES` set is also a hardcoded constant, not a settings-driven list).

## Changes

### 1. Detection module

- New `client/src/lib/cheatDetection.ts`:
  - `detectMultiMonitor(): boolean` — reads `window.screen.isExtended`; returns `false` (not `true`) when the property is `undefined`.
  - `detectVmIndicator(): boolean` — creates a throwaway `<canvas>`, gets a `webgl` context, reads `UNMASKED_RENDERER_WEBGL` via the `WEBGL_debug_renderer_info` extension, and matches the renderer string against a small substring list (`SwiftShader`, `llvmpipe`, `VMware`, `VirtualBox`, `Microsoft Basic Render Driver`, `Parallels`). Returns `false` if the context, extension, or parameter is unavailable.
  - `probeSuspiciousExtensions(): Promise<boolean>` — fetch-probes a small starter list of `{ name, url }` entries (chrome-extension:// web-accessible-resource URLs), each wrapped in its own `try/catch` so one probe's rejection doesn't affect the others; returns `true` if any resolves successfully. The starter list ships with one entry (Chrome Remote Desktop, ID `inomeogfingihgjfjlpeplalcfajhgai`) whose exact resource path must be confirmed working before the list is considered verified — implementation should test the probe against a real install of that extension rather than assume the URL is correct.
  - `createDevToolsWatcher(onOpen: () => void, thresholdPx = 160, intervalMs = 1500): () => void` — starts a `setInterval` comparing `window.outerWidth - window.innerWidth` and `window.outerHeight - window.innerHeight` against `thresholdPx`; calls `onOpen()` only on the closed→open transition (tracks previous state internally); returns a stop function that clears the interval.

### 2. Wiring into the exam attempt flow

- `client/src/pages/student/ExamAttempt.tsx`'s security-monitoring effect: after the existing `enterFullScreen()` call, run the three one-time checks and log any positive result (`multi_monitor_detected`, `vm_indicator_detected`, `suspicious_extension_detected` — the extension probe is awaited via an async IIFE since `probeSuspiciousExtensions` is a Promise). Call `createDevToolsWatcher(() => logExamActivity(attemptId, 'devtools_open_detected'))` and store its returned stop function; call it in the effect's existing cleanup alongside the other listener teardown.

### 3. Severity classification

- `server/sockets/activityClassifier.js`: rename/extend `isViolation(activity)` to `classifyActivity(activity): { isViolation: boolean, severity: 'high' | 'medium' }`. All existing entries in `VIOLATION_ACTIVITIES` plus the new `multi_monitor_detected` and `devtools_open_detected` classify as `severity: 'high'`. `vm_indicator_detected` and `suspicious_extension_detected` classify as `severity: 'medium'`. Non-violations keep `isViolation: false` (severity irrelevant/omitted).
- `server/services/examAttemptService.js`'s `logActivity`: update the single call site to use `classifyActivity(activity)`, adding `severity` to the `attempt:activity` emission payload alongside the existing `isViolation` field.

### 4. Admin-facing severity display

- `client/src/pages/admin/LiveMonitoring.tsx`: the `attempt:activity` socket handler and the `LiveAttempt`/alert-entry types pick up the new `severity` field. The Recent Alerts panel renders a severity-coded badge (high vs. medium) alongside each violation entry, distinguishing a confirmed tab-switch from a lower-confidence VM/extension signal at a glance.

## Testing

No automated test framework exists in this repo. Verification: `node --check` for the modified backend files, `npx tsc --noEmit -p tsconfig.app.json` for client files (current baseline — recheck at execution time, expected to hold at 81 per the pattern from Parts 1-2 unless something new surfaces). Manual/Playwright walkthrough, with known constraints on two of the four checks:
- **Multi-monitor and DevTools-open** can't be triggered for real inside an automated single-monitor browser session — verify by stubbing `window.screen.isExtended` / `outerWidth` via `browser_evaluate` to confirm the logging path fires correctly, and confirm both stay silent under normal (unmodified) conditions.
- **VM indicator** may fire as a true-but-coincidental positive in this session's own Chromium test environment, since Chromium's software rendering fallback (often `SwiftShader`) is common in sandboxed/headless setups — note this as an expected environment characteristic, not a bug, when verifying.
- **Extension probing**: verify the mechanism (probe fires, catches rejection per-entry, resolves `false` when nothing matches) since installing a real target extension in the test browser isn't practical; a stubbed/mocked `fetch` response via `browser_evaluate` confirms the positive-detection path.
- End-to-end: confirm a `severity: 'medium'` and a `severity: 'high'` event both appear correctly badged in `LiveMonitoring.tsx`'s Recent Alerts panel via a live two-session run (student attempt in one browser context, admin's Live Monitoring page open in another), matching Parts 1-2's live-verification style. Confirm `MobileExamAttempt.tsx` is untouched and unaffected.
