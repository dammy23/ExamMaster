# Phase 4 Part 3: Exam Instructions — Design

**Status:** Approved
**Date:** 2026-07-26
**Scope:** `client/src/pages/student/ExamInstructions.tsx` only

## Context

Phase 4 part 2 (Dashboard + Results) merged to `main`. This is Phase 4 part 3 of 4 in the Student Experience phase (Exam Settings Enforcement → Dashboard+Results → **Exam Instructions** → Exam Attempt Desktop+Mobile).

Unlike `StudentDashboard.tsx`/`StudentResults.tsx` before this sub-phase, `ExamInstructions.tsx` is already close to the flat design system — it uses plain `Card`s throughout with no gradients. The remaining work is smaller: debug logging, ad-hoc colors that should be status tokens, one missed opportunity to reuse the shared `StatusBadge` component, and missing `LoadingState`/`EmptyState` adoption.

This sub-phase is scoped to visual/logging cleanup only, matching the established Phase 4 sub-phase boundaries. It does not touch `handleStartExam`'s popup-window exam-start flow, `canStartExam`, or `performSystemCheck`'s computation — only their rendered output's styling.

## Changes

### 1. Strip debug logging

Remove all `console.log`/`console.error` calls in `fetchExamDetails` (3), `performSystemCheck` (1), and `handleStartExam` (6) — 10 total. Error toasts already surface failures to the user; this matches the established convention from every prior phase (e.g. `Reports.tsx`, `StudentDashboard.tsx`).

### 2. Swap the exam status badge for the shared `StatusBadge`

Replace:
```tsx
<Badge variant="secondary" className="ml-4">
  {exam.status}
</Badge>
```
with:
```tsx
<StatusBadge status={exam.status} className="ml-4" />
```

`exam.status` is typed as `'draft' | 'active' | 'completed' | 'archived'` (`examStatus.ts`), all four of which already exist in `StatusBadge`'s `Status` union. `ExamDetails.tsx` (admin side) already renders exam status this exact way — this makes the student-facing page consistent with it.

### 3. Remap ad-hoc colors onto status tokens

- **Time-status box** (`timeStatus.type`): `starts` → `status-warning` (was `text-orange-600`), `available` → `status-success` (was `text-green-600`), `expired` → `status-danger` (was `text-red-600`). Same box structure (`p-4 rounded-lg bg-muted` containing an icon + text), only the icon/text color token changes.
- **System Check indicator dots + icons** (Browser Support, JavaScript Enabled, Fullscreen Support, Internet Connection): pass → `status-success` (was `bg-green-500`/`text-green-500`), fail → `status-danger` (was `bg-red-500`/`text-red-500`). The Fullscreen Support row's "N/A because mobile is enabled" state stays neutral (`bg-gray-400`/`text-gray-400` → `bg-muted-foreground`/`text-muted-foreground`) — it isn't a pass/fail state, so it doesn't get forced onto a status color.
- **Mobile Support badge**: "Enabled" → `status-success` styling (was `text-green-600 border-green-600`), "Disabled" stays plain/muted (was `text-gray-600`; not a failure state, just off).

### 4. Unify the two blocking alert boxes

Both currently use different ad-hoc styles for the same underlying meaning ("you cannot start the exam right now"):
- "Mobile Device Detected" — currently `bg-orange-50 border-orange-200`, `text-orange-700`/`text-orange-600`.
- "System Requirements Not Met" — currently `bg-red-50 border-red-200`, `text-red-700`/`text-red-600`.

Both become `border-l-4 border-destructive bg-destructive/10`, matching the convention already established in `StudentVideoReview.tsx` and `SettingsPage.tsx`'s "Test Error" box. This was a deliberate choice (confirmed with the user) over keeping them visually distinct, since both boxes represent the same kind of blocking condition.

### 5. Adopt `LoadingState`/`EmptyState`

- Replace the ad-hoc loading spinner (`animate-spin` div) with `<LoadingState label="Loading exam details..." />`.
- Replace the ad-hoc "Exam not found" block with:
```tsx
<EmptyState
  icon={AlertTriangle}
  title="Exam not found"
  action={{ label: "Return to Dashboard", onClick: () => navigate('/student') }}
/>
```
matching `EmptyState`'s existing `{label, onClick}` action-prop shape (already used elsewhere, e.g. `SettingsPage.tsx`).

## Out of scope

- `handleStartExam`'s desktop popup-window flow (`window.open` with `fullscreen=yes`, cross-window auth-token passing) and the mobile in-tab navigation path — noted as an interesting architectural asymmetry during exploration, but functional/navigation-flow changes are reserved for the next sub-phase (Exam Attempt Desktop+Mobile), which is itself also scoped to visual/logging cleanup only, not security/integrity logic.
- `canStartExam`/`performSystemCheck`'s actual computation — only their rendered styling changes.

## Testing

No automated test framework exists in this repo. Verification: `npx tsc --noEmit -p tsconfig.app.json` for a regression check against the current baseline (107 errors), then manual Playwright walkthrough covering light/dark mode, the loading state, the not-found state, an available exam (time-status box), a not-yet-started exam if reachable, and a mobile-disallowed exam if reachable (to check the unified alert box).
