# Phase 4 Part 4: Exam Attempt (Desktop+Mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up `ExamAttempt.tsx` and `MobileExamAttempt.tsx` — strip debug logging, fix a genuine data-plumbing bug behind a broken "Difficulty" badge, adopt `LoadingState`/`EmptyState`, remap ad-hoc colors onto status tokens, and flatten `MobileExamAttempt.tsx`'s last remaining background gradient — while leaving the desktop security/integrity monitoring logic and both files' Allow-Review navigation logic (already modified in Phase 4 part 1) completely untouched in behavior.

**Architecture:** One small backend+type prerequisite task, then two tasks per client file (dead-imports-and-logging, then colors-and-shared-components), then a final manual-verification task. Each client-file task pair is ordered so the logging/import cleanup lands first and the purely-visual pass lands second, since they touch overlapping import blocks and must be sequential.

**Tech Stack:** Node.js/Express (plain JavaScript) on the server; React + TypeScript (Vite) on the client. No test framework exists in this repo.

## Global Constraints

- No automated test framework exists in this repo. Backend (`.js`) changes are verified with `node --check <file>` (syntax-only). Client (`.tsx`/`.ts`) changes are verified with `npx tsc --noEmit -p tsconfig.app.json` (never bare `tsc --noEmit`), run from `client/`. The current baseline is **106 errors**; this plan fixes 5 confirmed dead-code/type errors specific to these two files, so the count drops task-by-task to **101** by the end (see each task's expected count below).
- Any new `npm install` in a fresh worktree needs `PUPPETEER_SKIP_DOWNLOAD=true` set first.
- `server/.env` is gitignored and does not exist in a fresh worktree — create it before starting the dev server, with `DATABASE_URL=mongodb://localhost:27017/exammaster-dev`, a freshly generated `JWT_SECRET`, and `PORT=3000`.
- Use `http://127.0.0.1:5173` in Playwright, never `localhost`.
- Seeded student accounts (`student1@example.com`, `student2@example.com`, `student3@example.com`) all use password `password123`.
- Scope is limited to `server/services/examAttemptService.js`, `client/src/api/examAttempts.ts`, `client/src/pages/student/ExamAttempt.tsx`, `client/src/pages/student/MobileExamAttempt.tsx`. Do not touch `App.tsx` routing, the `VideoRecorder` component's internals, or the Allow-Review/navigation logic Phase 4 part 1 already added to both attempt pages.
- **Do not change any security/integrity monitoring behavior in `ExamAttempt.tsx`** — every `setSecurityWarnings`/`setTabSwitchCount`/`setFocusLostCount` state update, every destructive-variant `toast`, and every `logExamActivity` server call must remain exactly as-is. Only the `console.log`/`console.error`/`console.warn` calls interleaved with that logic are removed.
- Reuse the existing 4 status tokens (`status-success`/`status-info`/`status-warning`/`status-danger`) via `text-status-*-foreground`/`bg-status-*` classNames, following the same pattern used throughout Phase 4 parts 2-3.

---

### Task 1: Backend `difficulty` field + type fix

**Files:**
- Modify: `server/services/examAttemptService.js` (both branches of `startAttempt`'s question mapping)
- Modify: `client/src/api/examAttempts.ts` (`ExamQuestion` interface)

**Interfaces:**
- Produces: `ExamQuestion.difficulty: 'easy' | 'medium' | 'hard'` — a new required field, now actually populated by the backend. Task 5 does not need to change any JSX to consume it; `MobileExamAttempt.tsx` already renders `currentQuestion.difficulty`.

- [ ] **Step 1: Include `difficulty` in the resume-attempt question mapping**

Replace:

```js
        const questions = questionsToReturn.map(question => {
          const storedOrder = activeAttempt.optionOrders?.get(question._id.toString());
          return {
            _id: question._id,
            type: question.type,
            question: question.question,
            options: storedOrder || question.options || [],
            marks: question.marks
          };
        });
```

with:

```js
        const questions = questionsToReturn.map(question => {
          const storedOrder = activeAttempt.optionOrders?.get(question._id.toString());
          return {
            _id: question._id,
            type: question.type,
            question: question.question,
            options: storedOrder || question.options || [],
            marks: question.marks,
            difficulty: question.difficulty
          };
        });
```

- [ ] **Step 2: Include `difficulty` in the fresh-start question mapping**

Replace:

```js
      const questions = selectedQuestions.map(question => {
        const storedOrder = savedAttempt.optionOrders?.get(question._id.toString());
        return {
          _id: question._id,
          type: question.type,
          question: question.question,
          options: storedOrder || question.options || [],
          marks: question.marks
        };
      });
```

with:

```js
      const questions = selectedQuestions.map(question => {
        const storedOrder = savedAttempt.optionOrders?.get(question._id.toString());
        return {
          _id: question._id,
          type: question.type,
          question: question.question,
          options: storedOrder || question.options || [],
          marks: question.marks,
          difficulty: question.difficulty
        };
      });
```

- [ ] **Step 3: Verify backend syntax**

Run (from repo root): `node --check server/services/examAttemptService.js`
Expected: no output, exit code 0.

- [ ] **Step 4: Add `difficulty` to the `ExamQuestion` type**

Replace:

```ts
export interface ExamQuestion {
  _id: string;
  type: 'multiple-choice' | 'true-false' | 'theory'| 'short-answer';
  question: string;
  options?: string[];
  marks: number;
}
```

with:

```ts
export interface ExamQuestion {
  _id: string;
  type: 'multiple-choice' | 'true-false' | 'theory'| 'short-answer';
  question: string;
  options?: string[];
  marks: number;
  difficulty: 'easy' | 'medium' | 'hard';
}
```

- [ ] **Step 5: Verify with tsc**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json`
Expected: **105 errors** (106 baseline minus the `MobileExamAttempt.tsx(336,38): Property 'difficulty' does not exist` error, now resolved).

- [ ] **Step 6: Commit**

```bash
git add server/services/examAttemptService.js client/src/api/examAttempts.ts
git commit -m "Include difficulty in exam-attempt question payload, fixing the Difficulty badge"
```

---

### Task 2: `ExamAttempt.tsx` — dead imports + debug logging strip

**Files:**
- Modify: `client/src/pages/student/ExamAttempt.tsx`

**Interfaces:**
- No signature changes — `ExamAttempt` remains a no-props page component.

- [ ] **Step 1: Remove the dead `CardDescription` and `Checkbox` imports**

Replace:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
```

with:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
```

- [ ] **Step 2: Strip debug logging from the auth-token/postMessage effect**

Replace:

```tsx
    // Check if we're in fullscreen mode (opened from new window)
    const isInFullscreenWindow = window.location.pathname.startsWith('/exam-fullscreen')
    setIsFullscreenMode(isInFullscreenWindow)
    
    console.log('ExamAttempt: Fullscreen mode detected:', isInFullscreenWindow)
    
    // Add beforeunload event to warn about closing the exam window
    if (isInFullscreenWindow) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = ''
        return 'Are you sure you want to leave? Your exam progress may be lost.'
      }
      
      // Listen for auth tokens from parent window
      const handleMessage = (event: MessageEvent) => {
        // Verify the origin for security
        if (event.origin !== window.location.origin) {
          console.warn('ExamAttempt: Received message from unknown origin:', event.origin)
          return
        }
        
        console.log('ExamAttempt: Received message:', event.data)
        
        if (event.data.type === 'AUTH_TOKENS') {
          console.log('ExamAttempt: Setting auth tokens in localStorage')
          
          if (event.data.accessToken) {
            localStorage.setItem('accessToken', event.data.accessToken)
            console.log('ExamAttempt: Access token set')
          }
          
          if (event.data.refreshToken) {
            localStorage.setItem('refreshToken', event.data.refreshToken)
            console.log('ExamAttempt: Refresh token set')
          }
          
          // Trigger a re-initialization of the exam now that we have auth tokens
          if (event.data.accessToken && id) {
            console.log('ExamAttempt: Re-initializing exam with auth tokens')
            setTimeout(() => {
              initializeExam()
            }, 100)
          }
        }
      }
      
      window.addEventListener('beforeunload', handleBeforeUnload)
      window.addEventListener('message', handleMessage)
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
        window.removeEventListener('message', handleMessage)
      }
    }
  }, [id])
```

with:

```tsx
    // Check if we're in fullscreen mode (opened from new window)
    const isInFullscreenWindow = window.location.pathname.startsWith('/exam-fullscreen')
    setIsFullscreenMode(isInFullscreenWindow)
    
    // Add beforeunload event to warn about closing the exam window
    if (isInFullscreenWindow) {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault()
        e.returnValue = ''
        return 'Are you sure you want to leave? Your exam progress may be lost.'
      }
      
      // Listen for auth tokens from parent window
      const handleMessage = (event: MessageEvent) => {
        // Verify the origin for security
        if (event.origin !== window.location.origin) {
          return
        }
        
        if (event.data.type === 'AUTH_TOKENS') {
          if (event.data.accessToken) {
            localStorage.setItem('accessToken', event.data.accessToken)
          }
          
          if (event.data.refreshToken) {
            localStorage.setItem('refreshToken', event.data.refreshToken)
          }
          
          // Trigger a re-initialization of the exam now that we have auth tokens
          if (event.data.accessToken && id) {
            setTimeout(() => {
              initializeExam()
            }, 100)
          }
        }
      }
      
      window.addEventListener('beforeunload', handleBeforeUnload)
      window.addEventListener('message', handleMessage)
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload)
        window.removeEventListener('message', handleMessage)
      }
    }
  }, [id])
```

- [ ] **Step 3: Strip debug logging from the security-monitoring effect (behavior unchanged)**

Replace:

```tsx
  useEffect(() => {
    if (!attemptId) return

    // Enable fullscreen
    const enterFullScreen = () => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
          .then(() => {
            setIsFullScreen(true)
            console.log('Exam: Fullscreen mode activated')
            logExamActivity(attemptId, 'fullscreen_enabled')
          })
          .catch(err => {
            console.error('Failed to enable fullscreen:', err)
            const warning = 'Failed to enable fullscreen mode'
            setSecurityWarnings(prev => [...prev, warning])
            logExamActivity(attemptId, 'fullscreen_failed')
          })
      }
    }

    enterFullScreen()

    // Handle visibility change (tab switching detection)
    const handleVisibilityChange = () => {
      if (document.hidden && attemptId) {
        setTabSwitchCount(prev => prev + 1)
        const warning = `Tab switch detected at ${new Date().toLocaleTimeString()}`
        setSecurityWarnings(prev => [...prev, warning])
        logExamActivity(attemptId, 'tab_switch')
        console.log('Exam Security: Tab switch detected')
        toast({
          title: "Security Warning",
          description: "Tab switching detected and logged. Multiple violations may result in exam termination.",
          variant: "destructive"
        })
      }
    }

    // Handle window focus loss
    const handleFocusLoss = () => {
      if (attemptId) {
        setFocusLostCount(prev => prev + 1)
        const warning = `Window focus lost at ${new Date().toLocaleTimeString()}`
        setSecurityWarnings(prev => [...prev, warning])
        logExamActivity(attemptId, 'focus_lost')
        console.log('Exam Security: Window focus lost')
      }
    }

    // Handle fullscreen exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && attemptId) {
        setIsFullScreen(false)
        const warning = `Fullscreen mode exited at ${new Date().toLocaleTimeString()}`
        setSecurityWarnings(prev => [...prev, warning])
        logExamActivity(attemptId, 'fullscreen_exit')
        console.log('Exam Security: Fullscreen mode exited')
        toast({
          title: "Security Alert",
          description: "Fullscreen mode was exited. Please return to fullscreen.",
          variant: "destructive"
        })
        
        // Try to re-enable fullscreen after a short delay
        setTimeout(() => {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {
              // Ignore errors, user might have dismissed the request
            })
          }
        }, 1000)
      }
    }

    // Handle right-click context menu (disable)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      if (attemptId) {
        logExamActivity(attemptId, 'right_click_attempt')
        console.log('Exam Security: Right-click attempt blocked')
      }
      return false
    }

    // Handle keyboard shortcuts that might be used for cheating
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable common developer tools shortcuts
      if (
        (e.ctrlKey || e.metaKey) && 
        (e.key === 'i' || e.key === 'I' || // DevTools
         e.key === 'j' || e.key === 'J' || // Console
         e.key === 'u' || e.key === 'U' || // View Source
         e.key === 's' || e.key === 'S' || // Save page
         e.key === 'a' || e.key === 'A' || // Select all
         e.key === 'c' || e.key === 'C' || // Copy
         e.key === 'v' || e.key === 'V' || // Paste
         e.key === 'x' || e.key === 'X')   // Cut
      ) {
        e.preventDefault()
        if (attemptId) {
          logExamActivity(attemptId, `blocked_shortcut_${e.key.toLowerCase()}`)
          console.log(`Exam Security: Blocked keyboard shortcut Ctrl+${e.key}`)
        }
        return false
      }

      // Disable F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault()
        if (attemptId) {
          logExamActivity(attemptId, 'f12_attempt')
          console.log('Exam Security: F12 attempt blocked')
        }
        return false
      }

      // Alt+Tab detection
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault()
        if (attemptId) {
          logExamActivity(attemptId, 'alt_tab_attempt')
          console.log('Exam Security: Alt+Tab attempt blocked')
        }
        return false
      }
    }

    // Handle print screen attempts
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' && attemptId) {
        logExamActivity(attemptId, 'print_screen_attempt')
        console.log('Exam Security: Print screen attempt detected')
        toast({
          title: "Security Warning",
          description: "Screenshot attempt detected and logged.",
          variant: "destructive"
        })
      }
    }
```

with:

```tsx
  useEffect(() => {
    if (!attemptId) return

    // Enable fullscreen
    const enterFullScreen = () => {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen()
          .then(() => {
            setIsFullScreen(true)
            logExamActivity(attemptId, 'fullscreen_enabled')
          })
          .catch(() => {
            const warning = 'Failed to enable fullscreen mode'
            setSecurityWarnings(prev => [...prev, warning])
            logExamActivity(attemptId, 'fullscreen_failed')
          })
      }
    }

    enterFullScreen()

    // Handle visibility change (tab switching detection)
    const handleVisibilityChange = () => {
      if (document.hidden && attemptId) {
        setTabSwitchCount(prev => prev + 1)
        const warning = `Tab switch detected at ${new Date().toLocaleTimeString()}`
        setSecurityWarnings(prev => [...prev, warning])
        logExamActivity(attemptId, 'tab_switch')
        toast({
          title: "Security Warning",
          description: "Tab switching detected and logged. Multiple violations may result in exam termination.",
          variant: "destructive"
        })
      }
    }

    // Handle window focus loss
    const handleFocusLoss = () => {
      if (attemptId) {
        setFocusLostCount(prev => prev + 1)
        const warning = `Window focus lost at ${new Date().toLocaleTimeString()}`
        setSecurityWarnings(prev => [...prev, warning])
        logExamActivity(attemptId, 'focus_lost')
      }
    }

    // Handle fullscreen exit
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && attemptId) {
        setIsFullScreen(false)
        const warning = `Fullscreen mode exited at ${new Date().toLocaleTimeString()}`
        setSecurityWarnings(prev => [...prev, warning])
        logExamActivity(attemptId, 'fullscreen_exit')
        toast({
          title: "Security Alert",
          description: "Fullscreen mode was exited. Please return to fullscreen.",
          variant: "destructive"
        })
        
        // Try to re-enable fullscreen after a short delay
        setTimeout(() => {
          if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {
              // Ignore errors, user might have dismissed the request
            })
          }
        }, 1000)
      }
    }

    // Handle right-click context menu (disable)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      if (attemptId) {
        logExamActivity(attemptId, 'right_click_attempt')
      }
      return false
    }

    // Handle keyboard shortcuts that might be used for cheating
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable common developer tools shortcuts
      if (
        (e.ctrlKey || e.metaKey) && 
        (e.key === 'i' || e.key === 'I' || // DevTools
         e.key === 'j' || e.key === 'J' || // Console
         e.key === 'u' || e.key === 'U' || // View Source
         e.key === 's' || e.key === 'S' || // Save page
         e.key === 'a' || e.key === 'A' || // Select all
         e.key === 'c' || e.key === 'C' || // Copy
         e.key === 'v' || e.key === 'V' || // Paste
         e.key === 'x' || e.key === 'X')   // Cut
      ) {
        e.preventDefault()
        if (attemptId) {
          logExamActivity(attemptId, `blocked_shortcut_${e.key.toLowerCase()}`)
        }
        return false
      }

      // Disable F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault()
        if (attemptId) {
          logExamActivity(attemptId, 'f12_attempt')
        }
        return false
      }

      // Alt+Tab detection
      if (e.altKey && e.key === 'Tab') {
        e.preventDefault()
        if (attemptId) {
          logExamActivity(attemptId, 'alt_tab_attempt')
        }
        return false
      }
    }

    // Handle print screen attempts
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' && attemptId) {
        logExamActivity(attemptId, 'print_screen_attempt')
        toast({
          title: "Security Warning",
          description: "Screenshot attempt detected and logged.",
          variant: "destructive"
        })
      }
    }
```

(Every `setSecurityWarnings`/`setTabSwitchCount`/`setFocusLostCount` update, every `toast`, and every `logExamActivity` call is preserved exactly — only `console.*` calls and the now-unused `err` catch parameter are removed.)

- [ ] **Step 4: Strip debug logging from `initializeExam`**

Replace:

```tsx
  const initializeExam = async () => {
    try {
      console.log('Initializing exam:', id)
      const [examResponse, attemptResponse] = await Promise.all([
        getExamById(id!),
        startExamAttempt(id!)
      ])

      const examData = (examResponse as any).exam
      const attemptData = (attemptResponse as any)

      setExam(examData)
      setQuestions(attemptData.questions)
      setAttemptId(attemptData.attemptId)
      setTimeRemaining(attemptData.remainingTime || examData.duration * 60) // Use remainingTime from attempt or fallback to full duration
      setVideoRecordingEnabled(attemptData.videoRecording || false)
      setAttemptNumber(attemptData.attemptNumber || 1)
      setMaxAttempts(attemptData.maxAttempts || 1)
    } catch (error: any) {
      console.error('Error initializing exam:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to start exam",
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
  const initializeExam = async () => {
    try {
      const [examResponse, attemptResponse] = await Promise.all([
        getExamById(id!),
        startExamAttempt(id!)
      ])

      const examData = (examResponse as any).exam
      const attemptData = (attemptResponse as any)

      setExam(examData)
      setQuestions(attemptData.questions)
      setAttemptId(attemptData.attemptId)
      setTimeRemaining(attemptData.remainingTime || examData.duration * 60) // Use remainingTime from attempt or fallback to full duration
      setVideoRecordingEnabled(attemptData.videoRecording || false)
      setAttemptNumber(attemptData.attemptNumber || 1)
      setMaxAttempts(attemptData.maxAttempts || 1)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start exam",
        variant: "destructive"
      })
      navigate('/student')
    } finally {
      setLoading(false)
    }
  }
```

- [ ] **Step 5: Strip debug logging from `handleAnswerChange`, `handleAutoSubmit`, `handleManualSubmit`, and the `VideoRecorder` callback**

Replace:

```tsx
    try {
      await saveExamAnswer(attemptId, questionId, answer)
    } catch (error: any) {
      console.error('Error saving answer:', error)
      toast({
        title: "Warning", 
        description: "Failed to save answer. Please try again.",
        variant: "destructive"
      })
    }
  }
```

with:

```tsx
    try {
      await saveExamAnswer(attemptId, questionId, answer)
    } catch (error: any) {
      toast({
        title: "Warning", 
        description: "Failed to save answer. Please try again.",
        variant: "destructive"
      })
    }
  }
```

Replace:

```tsx
  const handleAutoSubmit = async () => {
    try {
      console.log('Auto-submitting exam due to time expiry')
      await submitExamAttempt(attemptId)
      toast({
        title: "Time's Up!",
        description: "Your exam has been automatically submitted.",
      })
      
      if (isFullscreenMode) {
        console.log('Closing exam window after auto-submit')
        // Small delay to ensure toast is visible before closing
        setTimeout(() => {
          window.close()
        }, 2000)
      } else {
        navigate('/student/results')
      }
    } catch (error: any) {
      console.error('Error auto-submitting exam:', error)
      toast({
        title: "Submission Error",
        description: error.message || "Failed to auto-submit exam. Please submit manually.",
        variant: "destructive"
      })
    }
  }
```

with:

```tsx
  const handleAutoSubmit = async () => {
    try {
      await submitExamAttempt(attemptId)
      toast({
        title: "Time's Up!",
        description: "Your exam has been automatically submitted.",
      })
      
      if (isFullscreenMode) {
        // Small delay to ensure toast is visible before closing
        setTimeout(() => {
          window.close()
        }, 2000)
      } else {
        navigate('/student/results')
      }
    } catch (error: any) {
      toast({
        title: "Submission Error",
        description: error.message || "Failed to auto-submit exam. Please submit manually.",
        variant: "destructive"
      })
    }
  }
```

Replace:

```tsx
  const handleManualSubmit = async () => {
    try {
      console.log('Manually submitting exam')
      const response = await submitExamAttempt(attemptId)
      const result = response as any

      toast({
        title: "Exam Submitted",
        description: exam.showResultsImmediately
          ? `Your score: ${result.score}/${exam.totalMarks} (${result.percentage}%)`
          : "Your exam has been submitted successfully.",
      })
      
      if (isFullscreenMode) {
        console.log('Closing exam window after manual submit')
        // Small delay to ensure toast is visible before closing
        setTimeout(() => {
          window.close()
        }, 2000)
      } else {
        navigate('/student/results')
      }
    } catch (error: any) {
      console.error('Error submitting exam:', error)
      toast({
        title: "Error",
        description: error.message || "Failed to submit exam",
        variant: "destructive"
      })
    }
  }
```

with:

```tsx
  const handleManualSubmit = async () => {
    try {
      const response = await submitExamAttempt(attemptId)
      const result = response as any

      toast({
        title: "Exam Submitted",
        description: exam.showResultsImmediately
          ? `Your score: ${result.score}/${exam.totalMarks} (${result.percentage}%)`
          : "Your exam has been submitted successfully.",
      })
      
      if (isFullscreenMode) {
        // Small delay to ensure toast is visible before closing
        setTimeout(() => {
          window.close()
        }, 2000)
      } else {
        navigate('/student/results')
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit exam",
        variant: "destructive"
      })
    }
  }
```

Replace:

```tsx
      {/* Floating Video Recorder (if enabled) */}
      {videoRecordingEnabled && (
        <VideoRecorder 
          attemptId={attemptId}
          onRecordingComplete={(videoUrl) => {
            console.log('Video recording completed:', videoUrl)
          }}
        />
      )}
```

with:

```tsx
      {/* Floating Video Recorder (if enabled) */}
      {videoRecordingEnabled && (
        <VideoRecorder attemptId={attemptId} />
      )}
```

(`onRecordingComplete` is optional on `VideoRecorderProps` and the upload itself is handled entirely inside `VideoRecorder.tsx` — this callback's only purpose here was the now-removed debug log, so it's dropped rather than replaced with a no-op function.)

- [ ] **Step 6: Verify with tsc**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: **103 errors** (105 minus the `CardDescription` and `Checkbox` unused-import errors).

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/student/ExamAttempt.tsx
git commit -m "Clean up ExamAttempt: remove dead imports, strip debug logging (behavior unchanged)"
```

---

### Task 3: `ExamAttempt.tsx` — color remap + shared components

**Files:**
- Modify: `client/src/pages/student/ExamAttempt.tsx`

**Interfaces:**
- No signature changes.

- [ ] **Step 1: Add `LoadingState`/`EmptyState` imports**

Replace:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
```

with:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
```

- [ ] **Step 2: Remap `getTimeColor()` onto status tokens**

Replace:

```tsx
  const getTimeColor = () => {
    const percentage = (timeRemaining / (exam?.duration * 60)) * 100
    if (percentage <= 10) return "text-red-600"
    if (percentage <= 25) return "text-orange-600"
    return "text-green-600"
  }
```

with:

```tsx
  const getTimeColor = () => {
    const percentage = (timeRemaining / (exam?.duration * 60)) * 100
    if (percentage <= 10) return "text-status-danger-foreground"
    if (percentage <= 25) return "text-status-warning-foreground"
    return "text-status-success-foreground"
  }
```

- [ ] **Step 3: Replace the loading/not-found/questions-not-found blocks with `LoadingState`/`EmptyState`**

Replace:

```tsx
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!exam ) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Exam not found</h2>
          <Button onClick={() => navigate('/student')}>Return to Dashboard</Button>
        </div>
      </div>
    )
  }

  if (!currentQuestion) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Questions not found</h2>
          <Button onClick={() => navigate('/student')}>Return to Dashboard</Button>
        </div>
      </div>
    )
  }
```

with:

```tsx
  if (loading) {
    return <LoadingState label="Loading exam..." className="min-h-screen" />
  }

  if (!exam ) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Exam not found"
        action={{ label: "Return to Dashboard", onClick: () => navigate('/student') }}
        className="min-h-screen"
      />
    )
  }

  if (!currentQuestion) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Questions not found"
        action={{ label: "Return to Dashboard", onClick: () => navigate('/student') }}
        className="min-h-screen"
      />
    )
  }
```

- [ ] **Step 4: Remap the question-navigation palette's answered/flagged colors**

Replace:

```tsx
              <div className="grid grid-cols-5 gap-2">
                {questions.map((question, index) => {
                  const isAnswered = answers[question._id]
                  const isFlagged = flaggedQuestions.has(question._id)
                  const isCurrent = index === currentQuestionIndex

                  return (
                    <Button
                      key={question._id}
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      className={`relative h-8 w-8 p-0 ${
                        isAnswered ? "bg-green-100 border-green-300" : ""
                      } ${isFlagged ? "bg-yellow-100 border-yellow-300" : ""}`}
                      onClick={() => {
                        if (exam.allowReview || index >= currentQuestionIndex) {
                          setCurrentQuestionIndex(index)
                        }
                      }}
                    >
                      {index + 1}
                      {isFlagged && (
                        <Flag className="absolute -top-1 -right-1 h-3 w-3 text-yellow-600" />
                      )}
                      {isAnswered && (
                        <CheckCircle className="absolute -bottom-1 -right-1 h-3 w-3 text-green-600" />
                      )}
                    </Button>
                  )
                })}
              </div>
```

with:

```tsx
              <div className="grid grid-cols-5 gap-2">
                {questions.map((question, index) => {
                  const isAnswered = answers[question._id]
                  const isFlagged = flaggedQuestions.has(question._id)
                  const isCurrent = index === currentQuestionIndex

                  return (
                    <Button
                      key={question._id}
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      className={`relative h-8 w-8 p-0 ${
                        isAnswered ? "bg-status-success/20 border-status-success" : ""
                      } ${isFlagged ? "bg-status-warning/20 border-status-warning" : ""}`}
                      onClick={() => {
                        if (exam.allowReview || index >= currentQuestionIndex) {
                          setCurrentQuestionIndex(index)
                        }
                      }}
                    >
                      {index + 1}
                      {isFlagged && (
                        <Flag className="absolute -top-1 -right-1 h-3 w-3 text-status-warning-foreground" />
                      )}
                      {isAnswered && (
                        <CheckCircle className="absolute -bottom-1 -right-1 h-3 w-3 text-status-success-foreground" />
                      )}
                    </Button>
                  )
                })}
              </div>
```

- [ ] **Step 5: Remap the Flag button's active-state color**

Replace:

```tsx
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFlagQuestion(currentQuestion._id)}
                    className={flaggedQuestions.has(currentQuestion._id) ? "bg-yellow-100" : ""}
                  >
```

with:

```tsx
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleFlagQuestion(currentQuestion._id)}
                    className={flaggedQuestions.has(currentQuestion._id) ? "bg-status-warning/20" : ""}
                  >
```

- [ ] **Step 6: Verify with tsc**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: **103 errors**, unchanged from Task 2 (purely visual, no dead-code fixes).

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/student/ExamAttempt.tsx
git commit -m "Remap ExamAttempt colors onto status tokens, adopt LoadingState/EmptyState"
```

---

### Task 4: `MobileExamAttempt.tsx` — dead imports + debug logging strip

**Files:**
- Modify: `client/src/pages/student/MobileExamAttempt.tsx`

**Interfaces:**
- No signature changes.

- [ ] **Step 1: Remove the dead `Checkbox` and `logExamActivity` imports**

Replace:

```tsx
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
```

with:

```tsx
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
```

Replace:

```tsx
import {
  startExamAttempt,
  saveExamAnswer,
  submitExamAttempt,
  logExamActivity,
  type ExamQuestion,
} from "@/api/examAttempts";
```

with:

```tsx
import {
  startExamAttempt,
  saveExamAnswer,
  submitExamAttempt,
  type ExamQuestion,
} from "@/api/examAttempts";
```

- [ ] **Step 2: Strip debug logging from the auto-save effect**

Replace:

```tsx
        saveExamAnswer(attemptId, currentQuestion._id, answer).catch((error) =>
          console.error("Error saving answer:", error),
        );
```

with:

```tsx
        saveExamAnswer(attemptId, currentQuestion._id, answer).catch(() => {});
```

- [ ] **Step 3: Strip debug logging from `initializeExam`**

Replace:

```tsx
    } catch (error: any) {
      console.error("Error initializing exam:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to start exam",
        variant: "destructive",
      });
      navigate("/student");
    } finally {
      setLoading(false);
    }
  };
```

with:

```tsx
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start exam",
        variant: "destructive",
      });
      navigate("/student");
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 4: Strip debug logging from `handleAutoSubmit`**

Replace:

```tsx
    } catch (error: any) {
      console.error("Error auto-submitting exam:", error);
      toast({
        title: "Error",
        description: "Failed to submit exam automatically",
        variant: "destructive",
      });
    }
  };
```

with:

```tsx
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to submit exam automatically",
        variant: "destructive",
      });
    }
  };
```

- [ ] **Step 5: Strip debug logging from `handleSubmit`**

Replace:

```tsx
    } catch (error: any) {
      console.error("Error submitting exam:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit exam",
        variant: "destructive",
      });
    }
  };
```

with:

```tsx
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit exam",
        variant: "destructive",
      });
    }
  };
```

- [ ] **Step 6: Verify with tsc**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: **101 errors** (103 minus the `Checkbox` and `logExamActivity` unused-import errors).

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/student/MobileExamAttempt.tsx
git commit -m "Clean up MobileExamAttempt: remove dead imports, strip debug logging"
```

---

### Task 5: `MobileExamAttempt.tsx` — color remap, shared components, background flatten

**Files:**
- Modify: `client/src/pages/student/MobileExamAttempt.tsx`

**Interfaces:**
- No signature changes.

- [ ] **Step 1: Add `LoadingState`/`EmptyState` imports**

Replace:

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
```

with:

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
```

- [ ] **Step 2: Replace the loading screen (also removes the gradient) with `LoadingState`**

Replace:

```tsx
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/10 to-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading exam...</p>
        </div>
      </div>
    );
  }
```

with:

```tsx
  if (loading) {
    return <LoadingState label="Loading exam..." className="min-h-screen" />;
  }
```

- [ ] **Step 3: Replace the "No Questions Available" block with `EmptyState`**

Replace:

```tsx
  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">No Questions Available</h2>
            <p className="text-muted-foreground mb-4">
              This exam has no questions.
            </p>
            <Button onClick={() => navigate("/student")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
```

with:

```tsx
  if (!currentQuestion) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No Questions Available"
        description="This exam has no questions."
        action={{ label: "Back to Dashboard", onClick: () => navigate("/student") }}
        className="min-h-screen"
      />
    );
  }
```

- [ ] **Step 4: Flatten the main view's background gradient**

Replace:

```tsx
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex flex-col">
```

with:

```tsx
  return (
    <div className="min-h-screen bg-background flex flex-col">
```

- [ ] **Step 5: Remap the navigation grid's answered-state color and its legend**

Replace:

```tsx
                  className={`
                    aspect-square rounded-lg font-semibold text-sm transition-all
                    ${
                      idx === currentQuestionIndex
                        ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                        : answers[q._id] !== undefined
                          ? "bg-green-100 text-green-800 border-2 border-green-300"
                          : "bg-background border-2 border-border hover:border-primary/50"
                    }
                  `}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-green-100 border-2 border-green-300" />
                <span>Answered: {answeredCount}</span>
              </div>
```

with:

```tsx
                  className={`
                    aspect-square rounded-lg font-semibold text-sm transition-all
                    ${
                      idx === currentQuestionIndex
                        ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                        : answers[q._id] !== undefined
                          ? "bg-status-success/20 text-status-success-foreground border-2 border-status-success"
                          : "bg-background border-2 border-border hover:border-primary/50"
                    }
                  `}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-status-success/20 border-2 border-status-success" />
                <span>Answered: {answeredCount}</span>
              </div>
```

- [ ] **Step 6: Remap the submit-confirmation dialog's colors**

Replace:

```tsx
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Submit Exam?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to submit your exam?</p>
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Total Questions:</span>
                  <span className="font-semibold">{questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Answered:</span>
                  <span className="font-semibold text-green-600">
                    {answeredCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Unanswered:</span>
                  <span className="font-semibold text-red-600">
                    {unansweredCount}
                  </span>
                </div>
              </div>
              {unansweredCount > 0 && (
                <p className="text-yellow-600 text-sm">
                  ⚠️ You have {unansweredCount} unanswered question
                  {unansweredCount > 1 ? "s" : ""}.
                </p>
              )}
            </AlertDialogDescription>
```

with:

```tsx
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-status-warning-foreground" />
              Submit Exam?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to submit your exam?</p>
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Total Questions:</span>
                  <span className="font-semibold">{questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Answered:</span>
                  <span className="font-semibold text-status-success-foreground">
                    {answeredCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Unanswered:</span>
                  <span className="font-semibold text-status-danger-foreground">
                    {unansweredCount}
                  </span>
                </div>
              </div>
              {unansweredCount > 0 && (
                <p className="text-status-warning-foreground text-sm">
                  ⚠️ You have {unansweredCount} unanswered question
                  {unansweredCount > 1 ? "s" : ""}.
                </p>
              )}
            </AlertDialogDescription>
```

- [ ] **Step 7: Verify with tsc**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: **101 errors**, unchanged from Task 4 (purely visual, no dead-code fixes).

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/student/MobileExamAttempt.tsx
git commit -m "Remap MobileExamAttempt colors onto status tokens, flatten background, adopt LoadingState/EmptyState"
```

---

### Task 6: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Final tsc regression check**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: **101 errors**, matching the running total from Task 5.

- [ ] **Step 2: Start the app**

From the worktree root: create `server/.env` per Global Constraints if not already present, start `node server.js` in `server/` and `npm run dev` in `client/`.

- [ ] **Step 3: Verify the Difficulty badge now shows real data**

Log in as `student1@example.com` (password `password123`), start (or resume) an attempt on `/student/exam/6a65d6cab4b1fab75ed140a7/mobile` (or any seeded exam with multiple-choice questions). Confirm the question header's difficulty badge now shows `easy`/`medium`/`hard` instead of rendering empty.

- [ ] **Step 4: Verify desktop security monitoring still fires identically**

Start a desktop attempt at `/student/exam/<examId>`. Confirm fullscreen activates on start. Switch browser tabs and back; confirm the tab-switch counter badge increments and the destructive-variant "Security Warning" toast appears, exactly as before this sub-phase (only the browser devtools console output should differ — no more `Exam Security: Tab switch detected` log line).

- [ ] **Step 5: Verify desktop visual changes**

Confirm the timer color uses status tokens as time runs low (may require a short-duration test exam or manual time manipulation via MongoDB to see the warning/danger thresholds), the question-navigation palette's answered/flagged colors use status tokens, and the loading/not-found states render via `LoadingState`/`EmptyState`. Check both light and dark mode.

- [ ] **Step 6: Verify mobile visual changes**

Confirm `MobileExamAttempt.tsx`'s page background is now flat (no gradient) in both the loading and main-view states, the navigation grid's answered indicator and legend use status tokens, and the submit-confirmation dialog's Answered/Unanswered counts and warning text use status tokens. Check both light and dark mode.

- [ ] **Step 7: Report results**

Summarize the tsc comparison (106 → 101) and the live-verification outcome, explicitly confirming the security-monitoring behavior is unchanged, and noting any state that couldn't be fully verified and why.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-26-exam-attempt.md`.
