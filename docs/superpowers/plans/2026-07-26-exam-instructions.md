# Phase 4 Part 3: Exam Instructions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up `ExamInstructions.tsx` — strip debug logging, adopt the shared `StatusBadge`/`LoadingState`/`EmptyState` components, and remap every ad-hoc color to the established status-token system, matching the flat design system the rest of the app now uses.

**Architecture:** Single-file, two-task change. Task 1 covers functionally-neutral cleanup (logging, shared components, one dead import). Task 2 covers pure color-token remapping, including unifying two ad-hoc "blocked" alert boxes onto the app's one established `border-l-4 border-destructive bg-destructive/10` convention. No changes to `handleStartExam`'s control flow, `canStartExam`, or `performSystemCheck`'s computation — only rendering/styling and logging.

**Tech Stack:** React + TypeScript (Vite) on the client. No test framework exists in this repo.

## Global Constraints

- No automated test framework exists in this repo. Every task is verified with `npx tsc --noEmit -p tsconfig.app.json` (never bare `tsc --noEmit`), run from `client/`. The current baseline is **107 errors**. This file itself contributes one of them (`'Users' is declared but its value is never read`, confirmed via a direct tsc run) — Task 1 fixes it as a dead-code removal, so the baseline drops to **106** after Task 1 and stays there through Task 2.
- Any new `npm install` in a fresh worktree needs `PUPPETEER_SKIP_DOWNLOAD=true` set first.
- `server/.env` is gitignored and does not exist in a fresh worktree — create it before starting the dev server, with `DATABASE_URL=mongodb://localhost:27017/exammaster-dev`, a freshly generated `JWT_SECRET`, and `PORT=3000`.
- Use `http://127.0.0.1:5173` in Playwright, never `localhost`.
- Seeded student accounts (`student1@example.com`, `student2@example.com`, `student3@example.com`) all use password `password123`.
- Scope is limited to `client/src/pages/student/ExamInstructions.tsx`. Do not touch `handleStartExam`'s popup-window logic, `canStartExam`, or `performSystemCheck`'s computation — only their rendered output.
- Reuse the existing 4 status tokens (`status-success`/`status-info`/`status-warning`/`status-danger`) via `text-status-*-foreground`/`bg-status-*` classNames (the `AdminDashboard.tsx` "Pending Grading" convention — plain card, colored icon/value text, no tinted background). The one established alert-box convention for "you can't proceed" states is `border-l-4 border-destructive bg-destructive/10` with a `text-destructive` icon/title and `text-muted-foreground` description (confirmed via `StudentVideoReview.tsx`/`SettingsPage.tsx`).
- `StatusBadge` (`@/components/ui/status-badge`) already supports `exam.status`'s full value set (`'draft' | 'active' | 'completed' | 'archived'`, per `client/src/lib/examStatus.ts`) — use `<StatusBadge status={exam.status} />`, matching `ExamDetails.tsx`'s existing admin-side usage exactly.

---

### Task 1: Cleanup — strip debug logging, adopt shared components

**Files:**
- Modify: `client/src/pages/student/ExamInstructions.tsx`

**Interfaces:**
- No signature changes — `ExamInstructions` remains a no-props page component.

- [ ] **Step 1: Update imports — remove the dead `Users` import, add `StatusBadge`/`LoadingState`/`EmptyState`**

Replace:

```tsx
import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Clock,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Users,
  Calendar,
  Target,
  Play,
  ArrowLeft,
  Shield,
  Eye,
  MonitorCheck,
  Smartphone
} from "lucide-react"
import { getExamById } from "@/api/exams"
import { useToast } from "@/hooks/useToast"
import { isMobileDevice, getDeviceType } from "@/utils/deviceDetection"
```

with:

```tsx
import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { Separator } from "@/components/ui/separator"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Clock,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Calendar,
  Target,
  Play,
  ArrowLeft,
  Shield,
  Eye,
  MonitorCheck,
  Smartphone
} from "lucide-react"
import { getExamById } from "@/api/exams"
import { useToast } from "@/hooks/useToast"
import { isMobileDevice, getDeviceType } from "@/utils/deviceDetection"
```

- [ ] **Step 2: Strip debug logging from `fetchExamDetails`**

Replace:

```tsx
  const fetchExamDetails = async () => {
    try {
      console.log('Fetching exam details for instructions:', id)
      const response = await getExamById(id!)
      const examData = (response as any).exam
      
      console.log('Exam details loaded:', examData)
      setExam(examData)
    } catch (error) {
      console.error('Error fetching exam details:', error)
      toast({
        title: "Error",
        description: "Failed to load exam details",
        variant: "destructive"
      })
      navigate('/student')
    } finally {
      setLoading(false)
    }
  }
```

with:

```tsx
  const fetchExamDetails = async () => {
    try {
      const response = await getExamById(id!)
      const examData = (response as any).exam
      setExam(examData)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load exam details",
        variant: "destructive"
      })
      navigate('/student')
    } finally {
      setLoading(false)
    }
  }
```

- [ ] **Step 3: Strip debug logging from `performSystemCheck`**

Replace:

```tsx
  const performSystemCheck = () => {
    console.log('Performing system check...')
    
    // Check if browser supports fullscreen
    const supportsFullscreen = !!(
```

with:

```tsx
  const performSystemCheck = () => {
    // Check if browser supports fullscreen
    const supportsFullscreen = !!(
```

- [ ] **Step 4: Strip debug logging from `handleStartExam`**

Replace:

```tsx
      // Redirect to mobile exam page
      console.log('Starting mobile exam:', id)
      navigate(`/student/exam/${id}/mobile`)
      toast({
        title: "Mobile Exam Started",
        description: "Make sure you have a stable connection.",
      })
      return
    }
    
    console.log('Starting exam in new fullscreen window:', id)
    
    // Open exam in new window with fullscreen
    const examUrl = `/exam-fullscreen/${id}`
    const examWindow = window.open(
      examUrl, 
      'examWindow', 
      'fullscreen=yes,scrollbars=no,resizable=no,toolbar=no,menubar=no,location=no,status=no'
    )
    
    if (examWindow) {
      // Try to maximize the window
      examWindow.moveTo(0, 0)
      examWindow.resizeTo(screen.width, screen.height)
      
      // Focus on the new window
      examWindow.focus()
      
      // Pass authentication tokens to the new window
      const accessToken = localStorage.getItem('accessToken')
      const refreshToken = localStorage.getItem('refreshToken')
      
      console.log('Passing auth tokens to exam window. AccessToken exists:', !!accessToken)
      
      // Wait for the new window to load, then send auth tokens
      const sendAuthTokens = () => {
        try {
          examWindow.postMessage({
            type: 'AUTH_TOKENS',
            accessToken: accessToken,
            refreshToken: refreshToken
          }, window.location.origin)
          console.log('Auth tokens sent to exam window')
        } catch (error) {
          console.error('Error sending auth tokens to exam window:', error)
        }
      }
      
      // Send tokens immediately and also after a short delay to ensure the window is ready
      sendAuthTokens()
      setTimeout(sendAuthTokens, 1000)
      setTimeout(sendAuthTokens, 2000)
      
      toast({
        title: "Exam Window Opened",
        description: "Your exam has opened in a new fullscreen window. Complete your exam in that window.",
      })
      
      // Listen for window close to refresh current page
      const checkClosed = setInterval(() => {
        if (examWindow.closed) {
          clearInterval(checkClosed)
          console.log('Exam window closed, refreshing dashboard')
          toast({
            title: "Exam Window Closed",
            description: "Returning to dashboard...",
          })
          navigate('/student')
        }
      }, 1000)
    } else {
```

with:

```tsx
      // Redirect to mobile exam page
      navigate(`/student/exam/${id}/mobile`)
      toast({
        title: "Mobile Exam Started",
        description: "Make sure you have a stable connection.",
      })
      return
    }
    
    // Open exam in new window with fullscreen
    const examUrl = `/exam-fullscreen/${id}`
    const examWindow = window.open(
      examUrl, 
      'examWindow', 
      'fullscreen=yes,scrollbars=no,resizable=no,toolbar=no,menubar=no,location=no,status=no'
    )
    
    if (examWindow) {
      // Try to maximize the window
      examWindow.moveTo(0, 0)
      examWindow.resizeTo(screen.width, screen.height)
      
      // Focus on the new window
      examWindow.focus()
      
      // Pass authentication tokens to the new window
      const accessToken = localStorage.getItem('accessToken')
      const refreshToken = localStorage.getItem('refreshToken')
      
      // Wait for the new window to load, then send auth tokens
      const sendAuthTokens = () => {
        try {
          examWindow.postMessage({
            type: 'AUTH_TOKENS',
            accessToken: accessToken,
            refreshToken: refreshToken
          }, window.location.origin)
        } catch {}
      }
      
      // Send tokens immediately and also after a short delay to ensure the window is ready
      sendAuthTokens()
      setTimeout(sendAuthTokens, 1000)
      setTimeout(sendAuthTokens, 2000)
      
      toast({
        title: "Exam Window Opened",
        description: "Your exam has opened in a new fullscreen window. Complete your exam in that window.",
      })
      
      // Listen for window close to refresh current page
      const checkClosed = setInterval(() => {
        if (examWindow.closed) {
          clearInterval(checkClosed)
          toast({
            title: "Exam Window Closed",
            description: "Returning to dashboard...",
          })
          navigate('/student')
        }
      }, 1000)
    } else {
```

(The retried `sendAuthTokens()` calls below already cover a failed early `postMessage`, so the empty `catch {}` needs no replacement logging — this matches the file's existing retry-based error tolerance, just without the debug noise.)

- [ ] **Step 5: Replace the loading spinner with `LoadingState`**

Replace:

```tsx
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
```

with:

```tsx
  if (loading) {
    return <LoadingState label="Loading exam details..." />
  }
```

- [ ] **Step 6: Replace the "Exam not found" block with `EmptyState`**

Replace:

```tsx
  if (!exam) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Exam not found</h2>
          <Button onClick={() => navigate('/student')}>Return to Dashboard</Button>
        </div>
      </div>
    )
  }
```

with:

```tsx
  if (!exam) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Exam not found"
        action={{ label: "Return to Dashboard", onClick: () => navigate('/student') }}
      />
    )
  }
```

- [ ] **Step 7: Swap the exam status badge for `StatusBadge`**

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

- [ ] **Step 8: Verify with tsc**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json`
Expected: 106 errors (107 baseline minus the fixed `'Users' is declared but its value is never read` error).

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/student/ExamInstructions.tsx
git commit -m "Clean up ExamInstructions: strip debug logging, adopt StatusBadge/LoadingState/EmptyState"
```

---

### Task 2: Remap ad-hoc colors onto status tokens

**Files:**
- Modify: `client/src/pages/student/ExamInstructions.tsx`

**Interfaces:**
- No signature changes.

- [ ] **Step 1: Remap the time-status box colors**

Replace:

```tsx
              {timeStatus && (
                <div className="p-4 rounded-lg bg-muted">
                  {timeStatus.type === 'starts' && (
                    <div className="flex items-center gap-2 text-orange-600">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Exam starts in {timeStatus.time}
                      </span>
                    </div>
                  )}
                  {timeStatus.type === 'available' && (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Exam is available now
                      </span>
                    </div>
                  )}
                  {timeStatus.type === 'expired' && (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Exam time has expired
                      </span>
                    </div>
                  )}
                </div>
              )}
```

with:

```tsx
              {timeStatus && (
                <div className="p-4 rounded-lg bg-muted">
                  {timeStatus.type === 'starts' && (
                    <div className="flex items-center gap-2 text-status-warning-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Exam starts in {timeStatus.time}
                      </span>
                    </div>
                  )}
                  {timeStatus.type === 'available' && (
                    <div className="flex items-center gap-2 text-status-success-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Exam is available now
                      </span>
                    </div>
                  )}
                  {timeStatus.type === 'expired' && (
                    <div className="flex items-center gap-2 text-status-danger-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Exam time has expired
                      </span>
                    </div>
                  )}
                </div>
              )}
```

- [ ] **Step 2: Remap System Check dots/icons, Mobile Support badge, and unify the two blocking alert boxes**

Replace:

```tsx
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemCheck.browser ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm">Browser Support</span>
                </div>
                {systemCheck.browser ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemCheck.javascript ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm">JavaScript Enabled</span>
                </div>
                {systemCheck.javascript ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    exam.mobileEnabled 
                      ? 'bg-gray-400' 
                      : systemCheck.fullScreen ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm">Fullscreen Support</span>
                  {exam.mobileEnabled && (
                    <Badge variant="outline" className="text-xs ml-1">Optional</Badge>
                  )}
                </div>
                {exam.mobileEnabled ? (
                  <CheckCircle2 className="h-4 w-4 text-gray-400" />
                ) : systemCheck.fullScreen ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemCheck.connection ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-sm">Internet Connection</span>
                </div>
                {systemCheck.connection ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Device Type</span>
                </div>
                <Badge variant="outline" className="capitalize">
                  {deviceType}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${exam.mobileEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className="text-sm">Mobile Support</span>
                </div>
                {exam.mobileEnabled ? (
                  <Badge variant="outline" className="text-green-600 border-green-600">Enabled</Badge>
                ) : (
                  <Badge variant="outline" className="text-gray-600">Disabled</Badge>
                )}
              </div>

              {isMobile && !exam.mobileEnabled && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-700">
                    <Smartphone className="h-4 w-4" />
                    <span className="text-sm font-medium">Mobile Device Detected</span>
                  </div>
                  <p className="text-xs text-orange-600 mt-1">
                    This exam is not available on mobile devices. Please use a desktop or laptop computer.
                  </p>
                </div>
              )}

              {!canStartExam() && timeStatus?.type === 'available' && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">System Requirements Not Met</span>
                  </div>
                  <p className="text-xs text-red-600 mt-1">
                    Please ensure all required system checks pass before starting the exam.
                  </p>
                </div>
              )}
            </CardContent>
```

with:

```tsx
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemCheck.browser ? 'bg-status-success' : 'bg-status-danger'}`} />
                  <span className="text-sm">Browser Support</span>
                </div>
                {systemCheck.browser ? (
                  <CheckCircle2 className="h-4 w-4 text-status-success-foreground" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-status-danger-foreground" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemCheck.javascript ? 'bg-status-success' : 'bg-status-danger'}`} />
                  <span className="text-sm">JavaScript Enabled</span>
                </div>
                {systemCheck.javascript ? (
                  <CheckCircle2 className="h-4 w-4 text-status-success-foreground" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-status-danger-foreground" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    exam.mobileEnabled 
                      ? 'bg-muted-foreground' 
                      : systemCheck.fullScreen ? 'bg-status-success' : 'bg-status-danger'
                  }`} />
                  <span className="text-sm">Fullscreen Support</span>
                  {exam.mobileEnabled && (
                    <Badge variant="outline" className="text-xs ml-1">Optional</Badge>
                  )}
                </div>
                {exam.mobileEnabled ? (
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                ) : systemCheck.fullScreen ? (
                  <CheckCircle2 className="h-4 w-4 text-status-success-foreground" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-status-danger-foreground" />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${systemCheck.connection ? 'bg-status-success' : 'bg-status-danger'}`} />
                  <span className="text-sm">Internet Connection</span>
                </div>
                {systemCheck.connection ? (
                  <CheckCircle2 className="h-4 w-4 text-status-success-foreground" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-status-danger-foreground" />
                )}
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Device Type</span>
                </div>
                <Badge variant="outline" className="capitalize">
                  {deviceType}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${exam.mobileEnabled ? 'bg-status-success' : 'bg-muted-foreground'}`} />
                  <span className="text-sm">Mobile Support</span>
                </div>
                {exam.mobileEnabled ? (
                  <Badge variant="outline" className="text-status-success-foreground border-status-success">Enabled</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>
                )}
              </div>

              {isMobile && !exam.mobileEnabled && (
                <div className="mt-4 p-3 border-l-4 border-destructive bg-destructive/10 rounded-lg">
                  <div className="flex items-center gap-2 text-destructive">
                    <Smartphone className="h-4 w-4" />
                    <span className="text-sm font-medium">Mobile Device Detected</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    This exam is not available on mobile devices. Please use a desktop or laptop computer.
                  </p>
                </div>
              )}

              {!canStartExam() && timeStatus?.type === 'available' && (
                <div className="mt-4 p-3 border-l-4 border-destructive bg-destructive/10 rounded-lg">
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">System Requirements Not Met</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Please ensure all required system checks pass before starting the exam.
                  </p>
                </div>
              )}
            </CardContent>
```

- [ ] **Step 3: Verify with tsc**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 106 errors, unchanged from Task 1.

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/student/ExamInstructions.tsx
git commit -m "Remap ExamInstructions colors onto status tokens, unify blocking alert boxes"
```

---

### Task 3: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Final tsc regression check**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: 106 errors (107 baseline minus the `Users` dead-import fix from Task 1).

- [ ] **Step 2: Start the app**

From the worktree root: create `server/.env` per Global Constraints if not already present, start `node server.js` in `server/` and `npm run dev` in `client/`.

- [ ] **Step 3: Verify the loading and not-found states**

Log in as `student1@example.com` (password `password123`) via Playwright. Navigate to `/student/exam/<a-nonexistent-id>/instructions` (e.g. a 24-hex-char ObjectId that doesn't exist, like `000000000000000000000000`) and confirm the `EmptyState` "Exam not found" renders with a working "Return to Dashboard" action. Reload `/student/exam/<a-real-exam-id>/instructions` and confirm `LoadingState` briefly renders before the exam details appear (may be too fast to see reliably — note if so, that's expected given local dev speed).

- [ ] **Step 4: Verify the exam-details view and status token colors**

Using the leftover Exam Settings Enforcement test exam (`6a65d6cab4b1fab75ed140a7`) or any other seeded exam, navigate to its `/instructions` page. Confirm: the exam status badge now renders via `StatusBadge` (colored pill, not the old plain gray `secondary` badge); the time-status box shows the correct token color for the exam's current schedule state (available now → success/green, not yet started → warning/amber, expired → danger/red — test whichever states are reachable with existing seeded exams, noting any unreachable ones); the System Check dots/icons use status-success/status-danger tokens; the Mobile Support badge is status-success-colored when enabled.

- [ ] **Step 5: Verify the unified alert boxes**

If a mobile-disabled exam is available, load its instructions page on a simulated mobile viewport (or via `isMobileDevice()`'s detection path) and confirm the "Mobile Device Detected" box now renders with the `border-l-4 border-destructive bg-destructive/10` treatment instead of orange. If reachable, also verify "System Requirements Not Met" renders with the same treatment. Note as unverified (with reason) any state that isn't reachable with current seeded data rather than fabricating it.

- [ ] **Step 6: Check light and dark mode**

Repeat the key views (exam details, at least one alert box state) in both light and dark mode.

- [ ] **Step 7: Report results**

Summarize the tsc comparison and the live-verification outcome, noting any states that couldn't be fully verified and why.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-exam-instructions.md`.
