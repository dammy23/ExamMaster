# Screen Share Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hard-gate exam access on a validated entire-screen share when `exam.screenRecording` is enabled, and store every recording segment (a student can produce more than one, since stopping and re-sharing mid-exam mechanically starts a new recording).

**Architecture:** A new `requestEntireScreenShare()` utility acquires and validates (`displaySurface === 'monitor'`) a screen-share stream. `ExamAttempt.tsx`'s mount flow splits so `startExamAttempt` (which starts the clock) isn't called until that stream is confirmed; the same blocking UI reappears if the stream ends mid-exam. `ScreenRecorder.tsx` narrows to "given a stream and an attemptId, record and upload it" — it no longer requests its own permission. Recordings are stored as an array of segments (`{videoUrl, fileSize, startTime, endTime}`) instead of one flat set of fields.

**Tech Stack:** React 18 + TypeScript (client), Express + Mongoose (server) — no new dependencies.

## Global Constraints

- tsc baseline is **81 errors** (`cd client && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`). No task may increase this count.
- No automated test framework exists in this repo. Verification is `node --check` (backend), the tsc baseline check (frontend), throwaway `node -e` scripts for backend logic, and live Playwright runs for browser-only behavior.
- `displaySurface !== 'monitor'` (including when the browser doesn't report it at all) is always rejected — strict enforcement, no benefit-of-the-doubt case.
- `VideoRecorder.tsx` (webcam) and `client/src/pages/student/MobileExamAttempt.tsx` are not touched by this plan.
- New activity string: `screen_share_lost`, classified as `severity: 'high'`.

---

### Task 1: Backend — multi-segment screen recording storage

**Files:**
- Modify: `server/models/ExamAttempt.js:105-136`
- Modify: `server/services/examAttemptService.js:724-807`
- Modify: `server/routes/examAttemptRoutes.js:404-436`
- Test: manual — `node --check` + a throwaway `node -e` script (no test framework in this repo)

**Interfaces:**
- Produces: `ExamAttemptService.updateScreenRecording(attemptId, videoUrl, fileSize, studentId, startedAt)` — pushes `{videoUrl, fileSize, startTime, endTime}` onto `attempt.screenRecording.segments`. Consumed by Task 3's route handler.

- [ ] **Step 1: Update the `screenRecording` sub-schema**

Current content (`server/models/ExamAttempt.js:105-136`):
```js
  screenRecording: {
    enabled: {
      type: Boolean,
      default: false
    },
    videoUrl: {
      type: String,
      trim: true
    },
    recordingStartTime: {
      type: Date
    },
    recordingEndTime: {
      type: Date
    },
    recordingStatus: {
      type: String,
      enum: ['not_started', 'recording', 'completed', 'failed'],
      default: 'not_started'
    },
    fileSize: {
      type: Number, // in bytes
      min: 0
    },
    reviewed: {
      type: Boolean,
      default: false
    },
    reviewedAt: {
      type: Date
    }
  },
```

Replace with:
```js
  screenRecording: {
    enabled: {
      type: Boolean,
      default: false
    },
    segments: [{
      videoUrl: {
        type: String,
        trim: true,
        required: true
      },
      fileSize: {
        type: Number, // in bytes
        min: 0
      },
      startTime: {
        type: Date,
        required: true
      },
      endTime: {
        type: Date,
        required: true
      }
    }],
    recordingStatus: {
      type: String,
      enum: ['not_started', 'recording', 'completed', 'failed'],
      default: 'not_started'
    },
    reviewed: {
      type: Boolean,
      default: false
    },
    reviewedAt: {
      type: Date
    }
  },
```

- [ ] **Step 2: Update `startScreenRecording` to stop writing the removed `recordingStartTime` field**

Current content (`server/services/examAttemptService.js`, inside `startScreenRecording`):
```js
      attempt.screenRecording.recordingStatus = 'recording';
      attempt.screenRecording.recordingStartTime = new Date();

      attempt.activityLog.push({
        activity: 'screen_recording_started',
        timestamp: new Date()
      });
```

Replace with:
```js
      attempt.screenRecording.recordingStatus = 'recording';

      attempt.activityLog.push({
        activity: 'screen_recording_started',
        timestamp: new Date()
      });
```

- [ ] **Step 3: Change `updateScreenRecording` to append a segment instead of overwriting flat fields**

Current content (`server/services/examAttemptService.js:768-807`):
```js
  // Update screen recording after upload completes
  static async updateScreenRecording(attemptId, videoUrl, fileSize, studentId) {
    try {
      console.log('ExamAttemptService: Updating screen recording for attempt:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId);
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      if (attempt.studentId.toString() !== studentId.toString()) {
        throw new Error('You are not authorized to modify this exam attempt');
      }

      if (!attempt.screenRecording.enabled) {
        throw new Error('Screen recording is not enabled for this exam');
      }

      attempt.screenRecording.videoUrl = videoUrl;
      attempt.screenRecording.fileSize = fileSize;
      attempt.screenRecording.recordingEndTime = new Date();
      attempt.screenRecording.recordingStatus = 'completed';

      attempt.activityLog.push({
        activity: 'screen_recording_completed',
        timestamp: new Date()
      });

      await attempt.save();

      console.log('ExamAttemptService: Screen recording updated successfully');
      return { success: true, message: 'Screen recording completed' };
    } catch (error) {
      console.error('ExamAttemptService: Error updating screen recording:', error.message);
      throw error;
    }
  }
```

Replace with:
```js
  // Update screen recording after upload completes -- appends a new segment
  static async updateScreenRecording(attemptId, videoUrl, fileSize, studentId, startedAt) {
    try {
      console.log('ExamAttemptService: Updating screen recording for attempt:', attemptId);

      if (!mongoose.Types.ObjectId.isValid(attemptId)) {
        throw new Error('Invalid attempt ID format');
      }

      const attempt = await ExamAttempt.findById(attemptId);
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      if (attempt.studentId.toString() !== studentId.toString()) {
        throw new Error('You are not authorized to modify this exam attempt');
      }

      if (!attempt.screenRecording.enabled) {
        throw new Error('Screen recording is not enabled for this exam');
      }

      const endTime = new Date();
      const startTime = startedAt ? new Date(startedAt) : endTime;

      attempt.screenRecording.segments.push({
        videoUrl,
        fileSize,
        startTime,
        endTime
      });
      attempt.screenRecording.recordingStatus = 'completed';

      attempt.activityLog.push({
        activity: 'screen_recording_completed',
        timestamp: new Date()
      });

      await attempt.save();

      console.log('ExamAttemptService: Screen recording updated successfully, segment count:', attempt.screenRecording.segments.length);
      return { success: true, message: 'Screen recording completed' };
    } catch (error) {
      console.error('ExamAttemptService: Error updating screen recording:', error.message);
      throw error;
    }
  }
```

- [ ] **Step 4: Pass `startedAt` through the upload route**

Current content (`server/routes/examAttemptRoutes.js:404-430`):
```js
router.post('/screen/upload', requireUser, screenUpload.single('video'), async (req, res) => {
  try {
    const { attemptId } = req.body;
    console.log(`Uploading screen recording for attempt: ${attemptId} by user: ${req.user.email}`);

    if (!attemptId) {
      return res.status(400).json({
        success: false,
        error: 'Attempt ID is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Video file is required'
      });
    }

    const videoUrl = generateSecureScreenUrl(req.file.filename, attemptId, req.user._id.toString());

    const result = await ExamAttemptService.updateScreenRecording(
      attemptId,
      videoUrl,
      req.file.size,
      req.user._id
    );
```

Replace with:
```js
router.post('/screen/upload', requireUser, screenUpload.single('video'), async (req, res) => {
  try {
    const { attemptId, startedAt } = req.body;
    console.log(`Uploading screen recording for attempt: ${attemptId} by user: ${req.user.email}`);

    if (!attemptId) {
      return res.status(400).json({
        success: false,
        error: 'Attempt ID is required'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Video file is required'
      });
    }

    const videoUrl = generateSecureScreenUrl(req.file.filename, attemptId, req.user._id.toString());

    const result = await ExamAttemptService.updateScreenRecording(
      attemptId,
      videoUrl,
      req.file.size,
      req.user._id,
      startedAt
    );
```

- [ ] **Step 5: Syntax-check the modified backend files**

Run:
```bash
node --check server/models/ExamAttempt.js
node --check server/services/examAttemptService.js
node --check server/routes/examAttemptRoutes.js
```
Expected: no output from any of the three (success).

- [ ] **Step 6: Verify segment-append behavior with a throwaway script**

Run (from `server/`, against a real attempt already in the dev DB — substitute a real in-progress `attemptId`/`studentId` pair, or create one first via the existing `startAttempt` flow):
```bash
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
const ExamAttemptService = require('./services/examAttemptService.js');
const ExamAttempt = require('./models/ExamAttempt.js');

(async () => {
  await mongoose.connect(process.env.DATABASE_URL);
  const attempt = await ExamAttempt.findOne({ 'screenRecording.enabled': true, status: 'in-progress' });
  if (!attempt) { console.log('No suitable in-progress attempt found -- create one first'); process.exit(1); }

  await ExamAttemptService.startScreenRecording(attempt._id, attempt.studentId);
  await ExamAttemptService.updateScreenRecording(attempt._id, 'https://example.com/seg1.webm', 1000, attempt.studentId, new Date(Date.now() - 60000).toISOString());
  await ExamAttemptService.startScreenRecording(attempt._id, attempt.studentId);
  await ExamAttemptService.updateScreenRecording(attempt._id, 'https://example.com/seg2.webm', 2000, attempt.studentId, new Date(Date.now() - 30000).toISOString());

  const updated = await ExamAttempt.findById(attempt._id);
  console.log('segments:', JSON.stringify(updated.screenRecording.segments, null, 2));
  console.log('segment count:', updated.screenRecording.segments.length);

  await mongoose.disconnect();
})();
"
```
Expected: `segment count: 2`, each segment showing the correct `videoUrl`/`fileSize`/`startTime`/`endTime`.

- [ ] **Step 7: Commit**

```bash
git add server/models/ExamAttempt.js server/services/examAttemptService.js server/routes/examAttemptRoutes.js
git commit -m "Store screen recording as multiple segments instead of one flat set of fields"
```

---

### Task 2: Backend — severity classification for `screen_share_lost`

**Files:**
- Modify: `server/sockets/activityClassifier.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: `classifyActivity('screen_share_lost')` returns `{isViolation: true, severity: 'high'}`. Consumed by Task 7's `handleStreamLost`, via the existing `logActivity`/`attempt:activity` pipeline (unchanged plumbing from the earlier cheat-detection work).

- [ ] **Step 1: Add `screen_share_lost` to the high-severity set**

Current content (`server/sockets/activityClassifier.js`):
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
```

Replace with:
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
  'devtools_open_detected',
  'screen_share_lost'
]);
```

- [ ] **Step 2: Verify with a throwaway script**

Run (from `server/`):
```bash
node -e "
const { classifyActivity } = require('./sockets/activityClassifier.js');
console.log(JSON.stringify(classifyActivity('screen_share_lost')));
"
```
Expected: `{"isViolation":true,"severity":"high"}`

- [ ] **Step 3: Syntax-check**

Run: `node --check server/sockets/activityClassifier.js`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add server/sockets/activityClassifier.js
git commit -m "Classify screen_share_lost as a high-severity violation"
```

---

### Task 3: Client API layer — segments and `startedAt`

**Files:**
- Modify: `client/src/api/examAttempts.ts:33-42` (`ExamAttempt` interface), `:205-225` (`uploadScreenRecording`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `uploadScreenRecording(attemptId: string, videoBlob: Blob, startedAt: string): Promise<string>`. Consumed by Task 5's `ScreenRecorder.tsx`.

- [ ] **Step 1: Update the `screenRecording` field on the `ExamAttempt` interface**

Current content (`client/src/api/examAttempts.ts:33-42`):
```typescript
  screenRecording: {
    enabled: boolean;
    videoUrl?: string;
    recordingStartTime?: string;
    recordingEndTime?: string;
    recordingStatus: 'not_started' | 'recording' | 'completed' | 'failed';
    fileSize?: number;
    reviewed?: boolean;
    reviewedAt?: string;
  };
```

Replace with:
```typescript
  screenRecording: {
    enabled: boolean;
    segments: Array<{
      videoUrl: string;
      fileSize: number;
      startTime: string;
      endTime: string;
    }>;
    recordingStatus: 'not_started' | 'recording' | 'completed' | 'failed';
    reviewed?: boolean;
    reviewedAt?: string;
  };
```

- [ ] **Step 2: Add `startedAt` to `uploadScreenRecording`**

Current content (`client/src/api/examAttempts.ts:205-225`):
```typescript
\ Description: Upload screen recording for exam attempt
\ Endpoint: POST /api/exam-attempts/screen/upload
\ Request: FormData with video file and attemptId
\ Response: { success: boolean, message: string, videoUrl: string }
export const uploadScreenRecording = async (attemptId: string, videoBlob: Blob) => {
  try {
    const formData = new FormData();
    formData.append('video', videoBlob, 'screen-recording.webm');
    formData.append('attemptId', attemptId);

    const response = await api.post('/api/exam-attempts/screen/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.videoUrl;
  } catch (error: any) {
    console.error('Upload screen recording error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
```

Replace with:
```typescript
\ Description: Upload a screen recording segment for exam attempt
\ Endpoint: POST /api/exam-attempts/screen/upload
\ Request: FormData with video file, attemptId, and startedAt (ISO timestamp this segment began)
\ Response: { success: boolean, message: string, videoUrl: string }
export const uploadScreenRecording = async (attemptId: string, videoBlob: Blob, startedAt: string) => {
  try {
    const formData = new FormData();
    formData.append('video', videoBlob, 'screen-recording.webm');
    formData.append('attemptId', attemptId);
    formData.append('startedAt', startedAt);

    const response = await api.post('/api/exam-attempts/screen/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.videoUrl;
  } catch (error: any) {
    console.error('Upload screen recording error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
```

- [ ] **Step 3: Verify no new TypeScript errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: more than `81` at this point is **expected and fine** — `StudentVideoReview.tsx` (Task 8) and `ScreenRecorder.tsx` (Task 5) still reference the old flat fields and haven't been updated yet. Confirm the count increased only in those two files by running:
```bash
npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep "error TS"
```
and checking every new error is in `ScreenRecorder.tsx` or `StudentVideoReview.tsx`. These clear once Tasks 5 and 8 land.

- [ ] **Step 4: Commit**

```bash
git add client/src/api/examAttempts.ts
git commit -m "Update client API types and upload call for multi-segment screen recording"
```

---

### Task 4: Screen-share gate utility

**Files:**
- Create: `client/src/lib/screenShareGate.ts`
- Test: manual — tsc baseline check

**Interfaces:**
- Produces: `WrongSurfaceError` (an `Error` subclass with `name === 'WrongSurfaceError'`), `requestEntireScreenShare(): Promise<MediaStream>`. Consumed by Task 7's `ExamAttempt.tsx`.

- [ ] **Step 1: Create the gate utility**

```typescript
// client/src/lib/screenShareGate.ts

export class WrongSurfaceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WrongSurfaceError'
  }
}

export async function requestEntireScreenShare(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      displaySurface: 'monitor',
      frameRate: { ideal: 10 }
    } as MediaTrackConstraints
  })

  const [track] = stream.getVideoTracks()
  const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string }

  if (settings.displaySurface !== 'monitor') {
    stream.getTracks().forEach(t => t.stop())
    throw new WrongSurfaceError(
      'You must share your Entire Screen, not a window or a browser tab. Please try again and select "Entire Screen".'
    )
  }

  return stream
}
```

- [ ] **Step 2: Verify no new TypeScript errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: same count as the end of Task 3 (this file is additive and doesn't touch the flat-field references still pending in Tasks 5/8).

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/screenShareGate.ts
git commit -m "Add entire-screen-share request and validation utility"
```

---

### Task 5: Narrow `ScreenRecorder.tsx` to recording-only

**Files:**
- Modify: `client/src/components/ScreenRecorder.tsx` (full rewrite of permission-related logic)

**Interfaces:**
- Consumes: `uploadScreenRecording(attemptId, blob, startedAt)` from Task 3.
- Produces: `ScreenRecorderProps = { attemptId: string, stream: MediaStream, onStreamLost: () => void, onRecordingComplete?: (videoUrl: string) => void }`. Consumed by Task 7's `ExamAttempt.tsx`.

- [ ] **Step 1: Replace the full file content**

Replace the entire content of `client/src/components/ScreenRecorder.tsx` with:

```tsx
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Monitor, CheckCircle, Minimize2, Maximize2, Move } from "lucide-react"
import { startScreenRecording, uploadScreenRecording } from "@/api/examAttempts"
import { getSocket } from "@/lib/socket"
import { useToast } from "@/hooks/useToast"

interface ScreenRecorderProps {
  attemptId: string
  stream: MediaStream
  onStreamLost: () => void
  onRecordingComplete?: (videoUrl: string) => void
}

export function ScreenRecorder({ attemptId, stream, onStreamLost, onRecordingComplete }: ScreenRecorderProps) {
  const { toast } = useToast()
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'stopped' | 'uploading' | 'completed'>('idle')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [segmentStartedAt, setSegmentStartedAt] = useState<string>("")

  // Floating window states -- offset to the right of VideoRecorder's default position
  // so both widgets don't stack exactly on top of each other when both are enabled
  const [position, setPosition] = useState({ x: 340, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })

  const videoRef = useRef<HTMLVideoElement>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const screenshotTimerRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))

  // Runs once per segment: a fresh `stream` prop (initial grant, or a re-share after a
  // mid-exam loss) attaches the preview, starts recording, and watches for the track
  // ending. Cleanup here (not a separate unmount-only effect) is deliberate: it must
  // stop whichever stream is CURRENT when this effect re-runs or the component
  // unmounts, not whatever stream was present on first mount.
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream
    }

    const [track] = stream.getVideoTracks()
    const handleEnded = () => {
      stopRecording()
      onStreamLost()
    }
    track.addEventListener('ended', handleEnded)

    startRecording(stream)

    return () => {
      track.removeEventListener('ended', handleEnded)
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (screenshotTimerRef.current) {
        clearInterval(screenshotTimerRef.current)
      }
      stream.getTracks().forEach(t => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      })
      setIsDragging(true)
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, dragOffset])

  const captureScreenshot = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const socket = getSocket()
    if (!video || !video.videoWidth || !socket) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.5)
    socket.emit('screenshot:capture', { attemptId, imageDataUrl })
  }

  const startRecording = async (mediaStream: MediaStream) => {
    try {
      console.log('Starting screen recording for attempt:', attemptId)

      await startScreenRecording(attemptId)
      setSegmentStartedAt(new Date().toISOString())

      const recorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm;codecs=vp9'
      })

      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        setRecordedBlob(blob)
        setRecordingStatus('stopped')
        console.log('Screen recording stopped, blob size:', blob.size)
      }

      recorder.onerror = (event: any) => {
        console.error('Screen MediaRecorder error:', event.error)
        toast({
          title: "Recording Error",
          description: "Failed to record screen. Please try again.",
          variant: "destructive"
        })
        setRecordingStatus('idle')
        setIsRecording(false)
      }

      recorder.start(1000)
      setMediaRecorder(recorder)
      setIsRecording(true)
      setRecordingStatus('recording')
      setRecordingTime(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)

      screenshotTimerRef.current = setInterval(() => {
        captureScreenshot()
      }, 10000)

      console.log('Screen recording started successfully')
      toast({
        title: "Screen Recording Started",
        description: "Screen recording is now active for exam security",
      })

    } catch (error: any) {
      console.error('Error starting screen recording:', error)
      toast({
        title: "Recording Failed",
        description: error.message || "Failed to start screen recording",
        variant: "destructive"
      })
      setRecordingStatus('idle')
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    try {
      console.log('Stopping screen recording')

      if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop()
      }

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
        recordingTimerRef.current = null
      }

      if (screenshotTimerRef.current) {
        clearInterval(screenshotTimerRef.current)
        screenshotTimerRef.current = null
      }

      setIsRecording(false)

      toast({
        title: "Screen Recording Stopped",
        description: "Screen recording has been stopped. Upload will begin automatically.",
      })

    } catch (error: any) {
      console.error('Error stopping screen recording:', error)
      toast({
        title: "Error",
        description: "Failed to stop screen recording properly",
        variant: "destructive"
      })
    }
  }

  const uploadRecording = async () => {
    if (!recordedBlob) {
      toast({
        title: "Error",
        description: "No screen recording available to upload",
        variant: "destructive"
      })
      return
    }

    try {
      setRecordingStatus('uploading')
      console.log('Uploading screen recording, size:', recordedBlob.size)

      const videoUrl = await uploadScreenRecording(attemptId, recordedBlob, segmentStartedAt)

      setRecordingStatus('completed')
      console.log('Screen recording uploaded successfully:', videoUrl)

      toast({
        title: "Upload Complete",
        description: "Screen recording has been uploaded successfully",
      })

      if (onRecordingComplete) {
        onRecordingComplete(videoUrl)
      }

    } catch (error: any) {
      console.error('Error uploading screen recording:', error)
      setRecordingStatus('stopped')
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload screen recording",
        variant: "destructive"
      })
    }
  }

  useEffect(() => {
    if (recordingStatus === 'stopped' && recordedBlob) {
      uploadRecording()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingStatus, recordedBlob])

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getStatusBadge = () => {
    switch (recordingStatus) {
      case 'idle':
        return <Badge variant="secondary">Ready</Badge>
      case 'recording':
        return <Badge variant="destructive" className="animate-pulse">Recording</Badge>
      case 'stopped':
        return <Badge variant="outline">Stopped</Badge>
      case 'uploading':
        return <Badge variant="secondary">Uploading...</Badge>
      case 'completed':
        return <Badge variant="default" className="gap-1">
          <CheckCircle className="h-3 w-3" />
          Completed
        </Badge>
      default:
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  return (
    <div
      ref={containerRef}
      className={`fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 ${
        isDragging ? 'cursor-grabbing' : 'cursor-default'
      } ${isMinimized ? 'w-64' : 'w-80'}`}
      style={{
        left: position.x,
        top: position.y,
        maxWidth: '90vw',
        maxHeight: '90vh'
      }}
    >
      <div
        className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg cursor-grab active:cursor-grabbing border-b"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Move className="h-4 w-4 text-gray-500" />
          <Monitor className="h-4 w-4" />
          <span className="text-sm font-medium">Screen Recording</span>
          {getStatusBadge()}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="h-6 w-6 p-0"
          >
            {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-3 space-y-3">
          <div className="relative bg-black rounded-md overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {isRecording && (
              <div className="absolute top-1 right-1 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded text-xs">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                REC {formatTime(recordingTime)}
              </div>
            )}
          </div>

          <div className="text-xs text-center text-gray-600">
            {recordingStatus === 'recording' && (
              <p>Screen recording active for exam security</p>
            )}
            {recordingStatus === 'uploading' && (
              <p>Uploading recording...</p>
            )}
            {recordingStatus === 'completed' && (
              <p className="text-green-600">Recording completed ✓</p>
            )}
          </div>
        </div>
      )}

      {isMinimized && (
        <div className="px-3 py-2 text-xs text-center text-gray-600">
          {recordingStatus === 'recording' && `Recording: ${formatTime(recordingTime)}`}
          {recordingStatus === 'uploading' && 'Uploading...'}
          {recordingStatus === 'completed' && 'Completed ✓'}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no new TypeScript errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: the count from Task 3 minus whatever errors were attributed to `ScreenRecorder.tsx` specifically (it no longer references the removed flat fields, and no longer imports `Card`/`AlertTriangle`, which are gone along with the removed setup/error card markup).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ScreenRecorder.tsx
git commit -m "Narrow ScreenRecorder to recording-only, driven by an externally-provided stream"
```

---

### Task 6: `ScreenShareGate` blocking-overlay component

**Files:**
- Create: `client/src/components/ScreenShareGate.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `ScreenShareGateProps = { mode: 'initial' | 'reshare', error: string, onRetry: () => void }`. Consumed by Task 7's `ExamAttempt.tsx`.

- [ ] **Step 1: Create the component**

```tsx
// client/src/components/ScreenShareGate.tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Monitor } from "lucide-react"

interface ScreenShareGateProps {
  mode: 'initial' | 'reshare'
  error: string
  onRetry: () => void
}

export function ScreenShareGate({ mode, error, onRetry }: ScreenShareGateProps) {
  const hasError = Boolean(error)

  const defaultMessage = mode === 'initial'
    ? 'This exam requires you to share your entire screen. Please select "Entire Screen" when prompted.'
    : 'Your screen share has stopped. You must re-share your entire screen to continue the exam. The timer has not been paused.'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <Card className={`w-full max-w-md ${hasError ? 'border-destructive' : ''}`}>
        <CardHeader>
          <CardTitle className={`flex items-center gap-2 ${hasError ? 'text-destructive' : ''}`}>
            {hasError ? <AlertTriangle className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
            {mode === 'initial' ? 'Entire Screen Sharing Required' : 'Screen Sharing Lost'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className={`text-sm ${hasError ? 'text-destructive' : 'text-muted-foreground'}`}>
            {error || defaultMessage}
          </p>
          <Button onClick={onRetry} className="w-full">
            {hasError ? 'Retry Screen Share' : 'Share Entire Screen'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify no new TypeScript errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: unchanged from the end of Task 5 (additive, not yet imported anywhere).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/ScreenShareGate.tsx
git commit -m "Add ScreenShareGate blocking-overlay component"
```

---

### Task 7: Restructure `ExamAttempt.tsx` around the gate

**Files:**
- Modify: `client/src/pages/student/ExamAttempt.tsx:1-50` (imports), `:57-70` (state), `:338-366` (`initializeExam`), `:472-497` (render guards), `:746-753` (recorder rendering)

**Interfaces:**
- Consumes: `requestEntireScreenShare`, `WrongSurfaceError` from Task 4; the narrowed `ScreenRecorder` props from Task 5; `ScreenShareGate` from Task 6.
- Produces: nothing for later tasks.

- [ ] **Step 1: Update imports**

Current content (`client/src/pages/student/ExamAttempt.tsx:43-50`):
```typescript
import { VideoRecorder } from "@/components/VideoRecorder"
import { ScreenRecorder } from "@/components/ScreenRecorder"
import {
  detectMultiMonitor,
  detectVmIndicator,
  probeSuspiciousExtensions,
  createDevToolsWatcher,
} from "@/lib/cheatDetection"
```

Replace with:
```typescript
import { VideoRecorder } from "@/components/VideoRecorder"
import { ScreenRecorder } from "@/components/ScreenRecorder"
import { ScreenShareGate } from "@/components/ScreenShareGate"
import {
  detectMultiMonitor,
  detectVmIndicator,
  probeSuspiciousExtensions,
  createDevToolsWatcher,
} from "@/lib/cheatDetection"
import { requestEntireScreenShare } from "@/lib/screenShareGate"
```

- [ ] **Step 2: Add new state**

Current content (`client/src/pages/student/ExamAttempt.tsx:69-70`):
```typescript
  const [videoRecordingEnabled, setVideoRecordingEnabled] = useState(false)
  const [screenRecordingEnabled, setScreenRecordingEnabled] = useState(false)
```

Replace with:
```typescript
  const [videoRecordingEnabled, setVideoRecordingEnabled] = useState(false)
  const [screenRecordingEnabled, setScreenRecordingEnabled] = useState(false)
  const [screenShareBlocked, setScreenShareBlocked] = useState(false)
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null)
  const [screenShareError, setScreenShareError] = useState<string>("")
```

- [ ] **Step 3: Split `initializeExam` into the gate flow and attempt-start**

Current content (`client/src/pages/student/ExamAttempt.tsx:338-366`):
```typescript
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
      setScreenRecordingEnabled(attemptData.screenRecording || false)
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

Replace with:
```typescript
  const initializeExam = async () => {
    try {
      const examResponse = await getExamById(id!)
      const examData = (examResponse as any).exam
      setExam(examData)

      if (examData.screenRecording) {
        setLoading(false)
        await runScreenShareGate(examData)
        return
      }

      await beginAttempt(examData)
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

  const beginAttempt = async (examData: any) => {
    const attemptResponse = await startExamAttempt(id!)
    const attemptData = attemptResponse as any

    setQuestions(attemptData.questions)
    setAttemptId(attemptData.attemptId)
    setTimeRemaining(attemptData.remainingTime || examData.duration * 60) // Use remainingTime from attempt or fallback to full duration
    setVideoRecordingEnabled(attemptData.videoRecording || false)
    setScreenRecordingEnabled(attemptData.screenRecording || false)
    setAttemptNumber(attemptData.attemptNumber || 1)
    setMaxAttempts(attemptData.maxAttempts || 1)
  }

  const attemptScreenShare = async (): Promise<boolean> => {
    setScreenShareError("")
    try {
      const mediaStream = await requestEntireScreenShare()
      setScreenShareStream(mediaStream)
      setScreenShareBlocked(false)
      return true
    } catch (error: any) {
      setScreenShareError(
        error.name === 'WrongSurfaceError'
          ? error.message
          : error.name === 'NotAllowedError'
            ? 'Please allow screen sharing of your entire screen to continue.'
            : (error.message || 'Failed to access screen sharing.')
      )
      return false
    }
  }

  const runScreenShareGate = async (examData: any) => {
    setScreenShareBlocked(true)
    const granted = await attemptScreenShare()
    if (granted) {
      await beginAttempt(examData)
    }
  }

  const handleRetryScreenShare = async () => {
    const granted = await attemptScreenShare()
    if (granted && !attemptId) {
      await beginAttempt(exam)
    }
  }

  const handleScreenShareLost = () => {
    setScreenShareStream(null)
    setScreenShareBlocked(true)
    setScreenShareError("")
    if (attemptId) {
      logExamActivity(attemptId, 'screen_share_lost')
    }
  }
```

- [ ] **Step 4: Add the blocking-overlay render guard**

Current content (`client/src/pages/student/ExamAttempt.tsx:472-497`):
```typescript
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

Replace with:
```typescript
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

  if (screenShareBlocked) {
    return (
      <ScreenShareGate
        mode={attemptId ? 'reshare' : 'initial'}
        error={screenShareError}
        onRetry={handleRetryScreenShare}
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

- [ ] **Step 5: Pass the confirmed stream to `ScreenRecorder`**

Current content (`client/src/pages/student/ExamAttempt.tsx:746-753`):
```typescript
      {/* Floating Video Recorder (if enabled) */}
      {videoRecordingEnabled && (
        <VideoRecorder attemptId={attemptId} />
      )}
      {/* Floating Screen Recorder (if enabled) -- independent of video recording, can run alongside it */}
      {screenRecordingEnabled && (
        <ScreenRecorder attemptId={attemptId} />
      )}
```

Replace with:
```typescript
      {/* Floating Video Recorder (if enabled) */}
      {videoRecordingEnabled && (
        <VideoRecorder attemptId={attemptId} />
      )}
      {/* Floating Screen Recorder (if enabled) -- independent of video recording, can run alongside it */}
      {screenRecordingEnabled && screenShareStream && (
        <ScreenRecorder attemptId={attemptId} stream={screenShareStream} onStreamLost={handleScreenShareLost} />
      )}
```

- [ ] **Step 6: Verify no new TypeScript errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: back down to `81` — this was the last file still referencing the old `ScreenRecorder` props shape.

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/student/ExamAttempt.tsx
git commit -m "Gate exam start and continuation on a validated entire-screen share"
```

---

### Task 8: Admin review — segment list

**Files:**
- Modify: `client/src/pages/admin/StudentVideoReview.tsx:55-64` (`ExamAttemptReview.screenRecording`), `:421-449` (Screen Recording tab)

**Interfaces:**
- Consumes: `screenRecording.segments` shape from Task 1/3.
- Produces: nothing for later tasks.

- [ ] **Step 1: Update the `screenRecording` field on `ExamAttemptReview`**

Current content (`client/src/pages/admin/StudentVideoReview.tsx:55-64`):
```typescript
  screenRecording?: {
    enabled: boolean
    videoUrl?: string
    recordingStartTime?: string
    recordingEndTime?: string
    recordingStatus: string
    fileSize?: number
    reviewed?: boolean
    reviewedAt?: string
  }
```

Replace with:
```typescript
  screenRecording?: {
    enabled: boolean
    segments: Array<{
      videoUrl: string
      fileSize: number
      startTime: string
      endTime: string
    }>
    recordingStatus: string
    reviewed?: boolean
    reviewedAt?: string
  }
```

- [ ] **Step 2: Render a list of segments instead of a single player**

Current content (`client/src/pages/admin/StudentVideoReview.tsx:421-449`):
```typescript
            <TabsContent value="screen" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Screen Recording
                    {selectedAttempt.screenRecording?.enabled && (
                      getVideoStatusBadge(selectedAttempt.screenRecording.recordingStatus)
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedAttempt.screenRecording?.enabled ? (
                    selectedAttempt.screenRecording.videoUrl ? (
                      renderVideoPlayer(selectedAttempt.screenRecording.videoUrl)
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Screen recording is enabled but not available</p>
                        <p className="text-sm">Status: {selectedAttempt.screenRecording.recordingStatus}</p>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Screen recording was not enabled for this exam</p>
                    </div>
                  )}
                </CardContent>
```

Replace with:
```typescript
            <TabsContent value="screen" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Screen Recording
                    {selectedAttempt.screenRecording?.enabled && (
                      getVideoStatusBadge(selectedAttempt.screenRecording.recordingStatus)
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedAttempt.screenRecording?.enabled ? (
                    selectedAttempt.screenRecording.segments && selectedAttempt.screenRecording.segments.length > 0 ? (
                      <div className="space-y-6">
                        {selectedAttempt.screenRecording.segments.map((segment, index) => (
                          <div key={index} className="space-y-2">
                            <p className="text-sm font-medium">
                              Segment {index + 1} · {new Date(segment.startTime).toLocaleTimeString()}–{new Date(segment.endTime).toLocaleTimeString()}
                            </p>
                            {renderVideoPlayer(segment.videoUrl)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>Screen recording is enabled but not available</p>
                        <p className="text-sm">Status: {selectedAttempt.screenRecording.recordingStatus}</p>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Monitor className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Screen recording was not enabled for this exam</p>
                    </div>
                  )}
                </CardContent>
```

- [ ] **Step 3: Verify tsc is back to baseline**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: `81` — this was the other file still referencing the old flat-field shape (from Task 3's note).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/admin/StudentVideoReview.tsx
git commit -m "Show all screen recording segments in admin review, not just one video"
```

---

### Task 9: End-to-end live verification

**Files:** none (verification only)

**Interfaces:** none.

- [ ] **Step 1: Full syntax/type sweep**

```bash
node --check server/models/ExamAttempt.js
node --check server/services/examAttemptService.js
node --check server/routes/examAttemptRoutes.js
node --check server/sockets/activityClassifier.js
cd client && npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"
```
Expected: no `node --check` output; tsc count is `81`.

- [ ] **Step 2: Confirm the gate actually blocks attempt creation**

Enable "Screen Recording" on a test exam (existing `ExamForm.tsx` toggle from the earlier proctoring work). As a student, navigate to that exam's attempt URL and deny the screen-share prompt. Confirm via direct DB/API check that **no** `ExamAttempt` document was created for that student/exam pair (i.e., `startExamAttempt` was never called) — this is the core behavior being fixed, so it must be checked directly, not assumed from the UI alone.

- [ ] **Step 3: Confirm entire-screen enforcement**

Grant screen share but pick a specific window or tab instead of "Entire Screen" (this environment's fake-grant behavior may need to be worked around — check via `browser_evaluate` stubbing of `getSettings().displaySurface` returning `'window'` if a real picker choice can't be automated, following the same stubbing approach used for the earlier cheat-detection heuristics). Confirm the wrong-surface message appears and, again, that no attempt was created. Then grant with `displaySurface: 'monitor'` and confirm the exam starts normally.

- [ ] **Step 4: Confirm mid-exam loss blocks and preserves state**

Mid-exam, answer at least one question, note the current question index, then end the screen share (stub the video track's `ended` event via `browser_evaluate` if a real "Stop sharing" click can't be automated). Confirm the `ScreenShareGate` overlay appears (`mode: 'reshare'` copy), confirm the timer is still counting down underneath (check `timeRemaining` continues to decrease), then re-grant a valid entire-screen share and confirm the exam reappears with the same question index and previously-entered answer intact (proving state was preserved, not reset).

- [ ] **Step 5: Confirm two segments are stored**

After the loss-and-reshare in Step 4, submit the exam and confirm via direct DB/API inspection that `screenRecording.segments` has exactly 2 entries with sane, non-overlapping `startTime`/`endTime` values, and that both uploaded video files exist server-side.

- [ ] **Step 6: Confirm `screen_share_lost` reaches the admin panel**

While driving the Step 4 loss via curl-based activity logging (or the live browser flow), confirm `screen_share_lost` appears in the admin's Live Monitoring "Recent Alerts" panel with a `High` badge — reuse the single-admin-tab-plus-direct-HTTP verification approach established during the cheat-detection work to avoid the same-origin `localStorage` sharing pitfall if driving both roles from one browser.

- [ ] **Step 7: Confirm admin review shows both segments**

Open `StudentVideoReview.tsx` for that attempt and confirm both segments render as separately labeled players with correct timestamps.

- [ ] **Step 8: Confirm unaffected files**

```bash
git diff main -- client/src/components/VideoRecorder.tsx client/src/pages/student/MobileExamAttempt.tsx
```
Expected: no output for either file.

- [ ] **Step 9: Report results**

No commit for this task (verification only) — proceed to `superpowers:finishing-a-development-branch` once all steps above pass. If any step fails, treat it as a blocker and return to the relevant task rather than proceeding.
