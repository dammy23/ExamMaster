# ExamMaster UI Overhaul — Phase 3d: Student Management

## Context

Fourth of five sub-phases within Phase 3 (Admin suite), itself the third phase of the ExamMaster UI overhaul (design system/shell → auth → **admin** → student). Design System (Phase 1), Auth (Phase 2), Admin Dashboard (Phase 3a), Exam Management (Phase 3b), and Question Bank (Phase 3c) are merged to `main`. Agreed sub-phase order: Dashboard → Exam Management → Question Bank → **Student Management** → Reports/AI Chat/Settings. This document covers `client/src/pages/admin/StudentManagement.tsx`, `client/src/pages/admin/StudentVideoReview.tsx`, plus the routing (`App.tsx`) and cross-page entry point (`ExamManagement.tsx`) needed to make the latter reachable, plus a small backend addition (the "reviewed" tracking concept Phase 3a's Dashboard design deferred to this phase).

## Current State (found during exploration)

- `StudentManagement.tsx`'s "Groups Overview" cards hardcode a blue gradient (`bg-gradient-to-br from-blue-50...`) — the exact fake-accent pattern already removed from `AdminDashboard.tsx` in Phase 3a.
- `getStatusBadge` (student active/inactive) hardcodes `bg-green-100 text-green-800` for active, matching the pattern already replaced with `StatusBadge` in `Subjects.tsx` (Phase 3c).
- **Two dead menu items, confirmed by reading the code — neither has an `onClick` handler at all:**
  - **"Remove Student"** has no handler, and there is no backend support either — `grep` of `server/routes/userRoutes.js` shows no `DELETE` route for users at all.
  - **"View Performance"** has no handler and no destination exists anywhere in the app — `Reports.tsx` has an aggregate table, not a per-student detail route.
- Custom spinner and plain-text empty/filtered-empty states in `StudentManagement.tsx`; same in `StudentVideoReview.tsx` (loading spinner, "No exam attempts found" text, "Exam not found" text).
- Debug `console.log`/`console.error` calls throughout both files.
- **`StudentVideoReview.tsx` is fully built (498 lines — attempt list, video player, security-log tab, activity-timeline tab) but completely unreachable**: it is never imported in `App.tsx`, no route is registered for it, and no other page links to it. The only navigation calls inside the file are to its own sub-route (`/admin/exams/:examId/video-review/:attemptId`), which itself is never registered either.
- `server/models/ExamAttempt.js`'s `videoRecording` sub-schema (`enabled`, `videoUrl`, `recordingStartTime`, `recordingEndTime`, `recordingStatus`, `fileSize`) has no "reviewed" concept — confirming Phase 3a's deferral was correct at the time.

## Decisions

### 1. Visual/UX consistency

- `StudentManagement.tsx`: Groups Overview cards drop the hardcoded gradient for flat `Card`s matching every other list page in the app (no special accent — group counts aren't a status). `getStatusBadge` becomes `<StatusBadge status={student.status === 'active' ? 'active' : 'archived'} />` — same `active`/`archived` reuse already applied to Subjects. Custom spinner → `<LoadingState label="Loading students..." />`. Plain-text empty/filtered-empty → `<EmptyState>` (true-empty gets an "Add Student" action opening the existing dialog; filtered-empty gets no action). `getPerformanceBadge` (score-threshold Excellent/Good/Average/Needs Improvement) is left unchanged — it's a single, non-duplicated categorical rating, not a pattern needing consolidation.
- `StudentVideoReview.tsx`: same spinner → `LoadingState`, plain-text → `EmptyState` treatment for its "no attempts" and "exam not found" states.
- Debug logging stripped from both files.

### 2. Deactivate replaces Remove Student; View Performance removed

The row dropdown's non-functional "Remove Student" becomes a status-aware action — **Deactivate** when the student is active, **Reactivate** when inactive — calling the existing `updateStudent(id, { status })` (already supports this; no backend change). No confirmation dialog needed since it's reversible either direction, consistent with how exam/subject status changes work. The non-functional "View Performance" item is deleted outright; a real per-student performance view is out of scope until the Reports phase (3e) exists to house it.

### 3. Wiring up Video Review

- **`App.tsx`:** add `import { StudentVideoReview } from "./pages/admin/StudentVideoReview"` and two routes, inserted directly after the existing `admin/exams/:examId/questions` route:
  ```tsx
  <Route path="admin/exams/:examId/video-review" element={<StudentVideoReview />} />
  <Route path="admin/exams/:examId/video-review/:attemptId" element={<StudentVideoReview />} />
  ```
  (`StudentVideoReview` already reads both `examId` and optional `attemptId` from `useParams`, so one component serves both routes exactly as the component already expects.)
- **`ExamManagement.tsx`:** add a **Video Review** action to the row dropdown, directly after "Questions", as a `Link` to `/admin/exams/${exam._id}/video-review`, following the exact existing pattern of the "Questions" `Link`/`DropdownMenuItem` pair.

### 4. Reviewed tracking (closing Phase 3a's deferral)

**Backend — `server/models/ExamAttempt.js`:** add two fields to the existing `videoRecording` sub-schema (alongside `recordingStatus`, `fileSize`):
```js
reviewed: {
  type: Boolean,
  default: false
},
reviewedAt: {
  type: Date
}
```

**Backend — `server/services/examAttemptService.js`:** two new methods, placed near the existing video/review methods:
```js
static async markVideoReviewed(attemptId, adminId) {
  try {
    console.log('ExamAttemptService: Marking video review complete for attempt:', attemptId);

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      throw new Error('Invalid attempt ID format');
    }

    const attempt = await ExamAttempt.findById(attemptId).populate('examId', 'createdBy');
    if (!attempt) {
      throw new Error('Exam attempt not found');
    }

    if (attempt.examId.createdBy.toString() !== adminId.toString()) {
      throw new Error('You are not authorized to review this exam attempt');
    }

    attempt.videoRecording.reviewed = true;
    attempt.videoRecording.reviewedAt = new Date();
    await attempt.save();

    console.log('ExamAttemptService: Video review marked complete');
    return attempt;
  } catch (error) {
    console.error('ExamAttemptService: Error marking video review complete:', error.message);
    throw error;
  }
}

static async getPendingVideoReviewsCount() {
  try {
    console.log('ExamAttemptService: Counting attempts pending video review...');
    const count = await ExamAttempt.countDocuments({
      'videoRecording.enabled': true,
      'videoRecording.recordingStatus': 'completed',
      'videoRecording.reviewed': { $ne: true }
    });
    console.log(`ExamAttemptService: ${count} attempts pending video review`);
    return count;
  } catch (error) {
    console.error('ExamAttemptService: Error counting pending video reviews:', error.message);
    throw error;
  }
}
```
This mirrors `getAttemptForReview`'s ownership-check shape and `getPendingGradingCount`'s aggregate shape exactly — no new patterns introduced.

**Backend — `server/routes/examAttemptRoutes.js`:** two new routes, following the exact `requireUser` + inline `role !== 'admin'` → 403 pattern used everywhere else in this file:
- `POST /api/exam-attempts/mark-reviewed/:attemptId` → calls `markVideoReviewed`, same 404/403/500 error-shape branching as the adjacent `grade-theory/:attemptId` route.
- `GET /api/exam-attempts/admin/pending-video-reviews-count` → calls `getPendingVideoReviewsCount`, identical shape to the adjacent `admin/pending-grading-count` route.

**Client — `client/src/api/examAttempts.ts`:** add `reviewed?: boolean` and `reviewedAt?: string` to the `ExamAttempt` interface's `videoRecording` field; add `markAttemptReviewed(attemptId)` and `getPendingVideoReviewsCount()`, following the exact shape of the adjacent `gradeTheoryQuestions`/`getPendingGradingCount` functions.

**`StudentVideoReview.tsx`:** the attempts list gets `<StatusBadge status="pending-review" />` per row when `videoRecording.enabled && recordingStatus === 'completed' && !reviewed` (reusing the existing amber `pending-review` value — no `StatusBadge` changes needed). The individual attempt's Video Recording tab gets a **Mark as Reviewed** button next to the existing recording-status badge, enabled only under that same condition; once reviewed, the button is replaced by a `<Badge className="gap-1"><CheckCircle .../>Reviewed</Badge>` plus the `reviewedAt` timestamp, matching the file's existing local-badge conventions (e.g. `getVideoStatusBadge`'s "Available" badge) rather than being forced through `StatusBadge`, since "Reviewed" isn't one of its existing values and doesn't need to be — it sits next to, not instead of, the recording-status badge.

**`AdminDashboard.tsx`:** add a 6th stat tile, **Pending Video Reviews**, styled identically to the existing Pending Grading tile (icon and value in `text-status-warning-foreground`). `DashboardStats` gains a `pendingVideoReviews: number` field, fetched via `getPendingVideoReviewsCount()` alongside the existing `Promise.all` fetch. The stat-tile grid changes from `sm:grid-cols-2 lg:grid-cols-5` to `sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6` to fit 6 tiles cleanly (3×2 at typical laptop widths, a single row at wide-monitor widths).

## Testing Approach

No automated test framework exists in this repo; this phase doesn't introduce one. Verification is manual: `tsc --noEmit -p tsconfig.app.json` for the frontend, `curl` against the two new backend routes (mirroring Phase 3a's exact verification style — log in as admin, confirm 200/403), then a live Playwright walkthrough covering: student deactivate/reactivate, the removed "View Performance" item, reaching `StudentVideoReview` via the new "Video Review" action from `ExamManagement`, marking an attempt reviewed and seeing the badge change, and the Dashboard's new 6th tile reflecting a real count.

## Risks

- **First backend change since Phase 3a.** Phases 3b and 3c were frontend-only; this phase reintroduces backend work (schema + service + routes), same low-risk shape as Phase 3a's `getPendingGradingCount` addition (additive fields, additive routes, no existing behavior changed).
- **`markVideoReviewed` requires a video recording to exist to be meaningful** — calling it on an attempt with `videoRecording.enabled: false` would still technically succeed (setting `reviewed: true` on a non-existent recording), but the UI only ever shows the button when `recordingStatus === 'completed'`, so this path isn't reachable through the app itself.
- **Testing the reviewed flow end-to-end requires at least one exam attempt with `videoRecording.enabled: true` and `recordingStatus: 'completed'` in the dev database** — if none exists, this needs seeding (via Database Seeding page or a direct MongoDB update) before the live verification step, same practical constraint every phase touching real attempt data has had.
