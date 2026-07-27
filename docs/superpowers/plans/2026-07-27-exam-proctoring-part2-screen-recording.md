# Exam Proctoring Suite — Part 2: Screen Recording + Live Screenshots — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add screen recording (mirroring the existing webcam-recording pattern) as a new independent per-exam toggle, plus a 10-second live-view screenshot feed pushed to the admin's already-live Live Monitoring page through Part 1's Socket.IO infrastructure.

**Architecture:** A new `ScreenRecorder.tsx` component mirrors `VideoRecorder.tsx`'s exact structure (auto-start, floating widget, `MediaRecorder`, record-fully-then-upload-once) but captures via `getDisplayMedia` instead of `getUserMedia`, stores to a separate disk directory with a higher size cap, and additionally runs a 10s interval that draws a canvas snapshot of the same stream and emits it over the existing Socket.IO connection. A new server-side `socket.on('screenshot:capture', ...)` handler (the app's first client-initiated socket message) relays it to the owning admin's room via Part 1's `emitToAdmin`, ephemeral — never persisted.

**Tech Stack:** Same stack as Part 1 (Socket.IO, Express, Mongoose, React) plus browser `getDisplayMedia`/`MediaRecorder`/Canvas APIs — no new dependencies.

## Global Constraints

- No automated test framework exists in this repo. Verify backend changes with `node --check <file>` and one-off Node scripts. Verify frontend changes with `npx tsc --noEmit -p tsconfig.app.json` from `client/`; record the baseline count in Task 0 and confirm later tasks don't increase it.
- **Desktop only** — do not touch `client/src/pages/student/MobileExamAttempt.tsx`.
- **Screenshots are never persisted** — no new model field, no disk write. Purely relayed and discarded.
- Screen recording captures video only, no audio — `getDisplayMedia({ video: {...} })`, no `audio` option. Not discussed in the approved spec, and adding system-audio capture is a separate, more complex browser-permission surface not needed for this feature.
- Match existing code style exactly: mirror `VideoRecorder.tsx`/`videoHandler.js`/`examAttemptRoutes.js`'s video routes/`examAttemptService.js`'s video methods as closely as possible — the whole point of this part's design is minimal divergence from an already-working pattern.
- One correctness detail specific to `getDisplayMedia` that has no webcam equivalent: browsers show a native "Stop sharing" control outside the page's UI. If the student clicks it, the stream's video track fires an `ended` event — `ScreenRecorder.tsx` must listen for this and route it through the same `stopRecording()` cleanup (timers, toast, state) used by the in-app stop path, not just rely on `MediaRecorder`'s own automatic stop.

---

### Task 0: Baseline check

- [ ] **Step 1: Record the current tsc baseline**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Record this number — every later task's tsc check compares against it.

---

### Task 1: Data model — screen recording fields + attempt seeding

**Files:**
- Modify: `server/models/Exam.js`
- Modify: `server/models/ExamAttempt.js`
- Modify: `server/services/examAttemptService.js` (`startAttempt`, `buildAttemptResponse`)

**Interfaces:**
- Produces: `Exam.screenRecording: boolean`; `ExamAttempt.screenRecording: { enabled, videoUrl, recordingStartTime, recordingEndTime, recordingStatus, fileSize, reviewed, reviewedAt }` (identical shape to the existing `videoRecording` sub-schema); `startAttempt`'s and `buildAttemptResponse`'s return objects both gain `screenRecording: exam.screenRecording` alongside the existing `videoRecording: exam.videoRecording` — consumed by Task 6 (`ExamAttempt.tsx`).

- [ ] **Step 1: Add the toggle to the Exam model**

Replace:
```js
  videoRecording: {
    type: Boolean,
    default: false
  },
  mobileEnabled: {
    type: Boolean,
    default: false
  },
```

With:
```js
  videoRecording: {
    type: Boolean,
    default: false
  },
  screenRecording: {
    type: Boolean,
    default: false
  },
  mobileEnabled: {
    type: Boolean,
    default: false
  },
```

- [ ] **Step 2: Add the sub-schema to the ExamAttempt model**

Replace:
```js
  videoRecording: {
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
  aiGradingResults: {
```

With:
```js
  videoRecording: {
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
  aiGradingResults: {
```

- [ ] **Step 3: Seed `screenRecording` when a new attempt is created**

Replace:
```js
        examId,
        studentId,
        startTime: new Date(),
        status: 'in-progress',
        attemptNumber: nextAttemptNumber,
        videoRecording: {
          enabled: exam.videoRecording,
          recordingStatus: exam.videoRecording ? 'not_started' : undefined
        }
      });
```

With:
```js
        examId,
        studentId,
        startTime: new Date(),
        status: 'in-progress',
        attemptNumber: nextAttemptNumber,
        videoRecording: {
          enabled: exam.videoRecording,
          recordingStatus: exam.videoRecording ? 'not_started' : undefined
        },
        screenRecording: {
          enabled: exam.screenRecording,
          recordingStatus: exam.screenRecording ? 'not_started' : undefined
        }
      });
```

- [ ] **Step 4: Include `screenRecording` in both `startAttempt` response paths**

Replace:
```js
      return {
        attemptId: savedAttempt._id.toString(),
        questions: questions,
        videoRecording: exam.videoRecording,
        attemptNumber: nextAttemptNumber,
        maxAttempts: exam.maxAttempts,
        remainingTime: remainingTime
      };
    } catch (error) {
      console.error('ExamAttemptService: Error starting exam attempt:', error.message);
      throw error;
    }
```

With:
```js
      return {
        attemptId: savedAttempt._id.toString(),
        questions: questions,
        videoRecording: exam.videoRecording,
        screenRecording: exam.screenRecording,
        attemptNumber: nextAttemptNumber,
        maxAttempts: exam.maxAttempts,
        remainingTime: remainingTime
      };
    } catch (error) {
      console.error('ExamAttemptService: Error starting exam attempt:', error.message);
      throw error;
    }
```

Replace:
```js
    return {
      attemptId: activeAttempt._id.toString(),
      questions: questions,
      videoRecording: exam.videoRecording,
      attemptNumber: activeAttempt.attemptNumber,
      maxAttempts: exam.maxAttempts,
      remainingTime: remainingTime
    };
  }
```

With:
```js
    return {
      attemptId: activeAttempt._id.toString(),
      questions: questions,
      videoRecording: exam.videoRecording,
      screenRecording: exam.screenRecording,
      attemptNumber: activeAttempt.attemptNumber,
      maxAttempts: exam.maxAttempts,
      remainingTime: remainingTime
    };
  }
```

- [ ] **Step 5: Verify syntax**

Run: `node --check server/models/Exam.js && node --check server/models/ExamAttempt.js && node --check server/services/examAttemptService.js`
Expected: no output, exit code 0.

- [ ] **Step 6: Verify seeding with a throwaway script**

Create a temporary `server/verify-screen-seeding.js` (delete it after):

```js
require('dotenv').config();
const mongoose = require('mongoose');
require('./models/Question');
const Exam = require('./models/Exam');
const ExamAttemptService = require('./services/examAttemptService');
const ExamAttempt = require('./models/ExamAttempt');

(async () => {
  await mongoose.connect(process.env.DATABASE_URL);
  const exam = await Exam.findOne({ status: 'active' }).populate('questions');
  if (!exam || !exam.questions || exam.questions.length === 0) {
    console.error('No active exam with questions found in this dev DB.');
    process.exit(1);
  }

  // Force screenRecording on for this test, remember the original value
  const originalValue = exam.screenRecording;
  exam.screenRecording = true;
  await exam.save();

  const User = require('./models/User');
  const student = await User.findOne({ email: 'student3@example.com' });
  await ExamAttempt.deleteMany({ examId: exam._id, studentId: student._id });

  const result = await ExamAttemptService.startAttempt(exam._id, student._id);
  console.log('RESULT: startAttempt returned screenRecording =', result.screenRecording);

  const savedAttempt = await ExamAttempt.findById(result.attemptId);
  console.log('RESULT: attempt.screenRecording =', JSON.stringify(savedAttempt.screenRecording));

  await ExamAttempt.deleteMany({ examId: exam._id, studentId: student._id });
  exam.screenRecording = originalValue;
  await exam.save();

  await mongoose.disconnect();
})();
```

Run (from `server/`): `node verify-screen-seeding.js`
Expected: `RESULT: startAttempt returned screenRecording = true` and `RESULT: attempt.screenRecording = {"enabled":true,"recordingStatus":"not_started",...}`.

- [ ] **Step 7: Delete the throwaway script**

```bash
rm server/verify-screen-seeding.js
```

- [ ] **Step 8: Commit**

```bash
git add server/models/Exam.js server/models/ExamAttempt.js server/services/examAttemptService.js
git commit -m "feat(proctoring): add screenRecording data model and attempt seeding"
```

---

### Task 2: Backend — screen recording storage, service methods, and routes

**Files:**
- Create: `server/utils/screenRecordingHandler.js`
- Modify: `server/services/examAttemptService.js` (new `startScreenRecording`/`updateScreenRecording` methods)
- Modify: `server/routes/examAttemptRoutes.js` (new `/screen/*` routes)

**Interfaces:**
- Consumes: `ExamAttempt.screenRecording` (Task 1).
- Produces: `POST /api/exam-attempts/screen/start`, `POST /api/exam-attempts/screen/upload`, `GET /api/exam-attempts/screen/:examId/:studentId/:filename` — consumed by Task 5's client API wrappers.

- [ ] **Step 1: Create the screen recording storage handler**

Create `server/utils/screenRecordingHandler.js`:

```js
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Configure multer for screen recording uploads
const screenStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadDir = path.join(__dirname, '../uploads/screen-recordings');
      await fs.mkdir(uploadDir, { recursive: true });
      console.log('Screen recording upload directory ensured:', uploadDir);
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creating screen recording upload directory:', error);
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    try {
      const timestamp = Date.now();
      const randomHash = crypto.randomBytes(8).toString('hex');
      const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filename = `${timestamp}_${randomHash}_${sanitizedOriginalName}`;
      console.log('Generated screen recording filename:', filename);
      cb(null, filename);
    } catch (error) {
      console.error('Error generating screen recording filename:', error);
      cb(error, null);
    }
  }
});

const screenFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'video/mp4',
    'video/webm',
    'video/ogg',
    'video/avi',
    'video/mov',
    'video/quicktime'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.log('Screen recording file rejected - invalid type:', file.mimetype);
    cb(new Error('Invalid video file type. Allowed types: mp4, webm, ogg, avi, mov'), false);
  }
};

// Screen recordings are typically larger/longer than webcam clips, so this cap
// is higher than videoHandler.js's 500MB webcam limit.
const screenUpload = multer({
  storage: screenStorage,
  fileFilter: screenFileFilter,
  limits: {
    fileSize: 1.5 * 1024 * 1024 * 1024, // 1.5GB limit for screen recordings
    files: 1
  }
});

const generateSecureScreenUrl = (filename, examId, studentId) => {
  if (!filename || !examId || !studentId) {
    throw new Error('Missing required parameters for screen recording URL generation');
  }

  const timestamp = Date.now();
  const token = crypto
    .createHash('sha256')
    .update(`${filename}_${examId}_${studentId}_${timestamp}`)
    .digest('hex');

  const url = `/api/exam-attempts/screen/${examId}/${studentId}/${filename}?token=${token}&t=${timestamp}`;
  console.log('Generated secure screen recording URL:', url);
  return url;
};

const validateScreenAccessToken = (token, filename, examId, studentId, timestamp) => {
  if (!token || !filename || !examId || !studentId || !timestamp) {
    console.log('Screen recording access validation failed - missing parameters');
    return false;
  }

  const tokenAge = Date.now() - parseInt(timestamp);
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours

  if (tokenAge > maxAge) {
    console.log('Screen recording access validation failed - token expired');
    return false;
  }

  const expectedToken = crypto
    .createHash('sha256')
    .update(`${filename}_${examId}_${studentId}_${timestamp}`)
    .digest('hex');

  return token === expectedToken;
};

const getScreenRecordingFileInfo = async (filename) => {
  try {
    if (!filename) {
      throw new Error('Filename is required for screen recording info');
    }

    const filePath = path.join(__dirname, '../uploads/screen-recordings', filename);
    const stats = await fs.stat(filePath);

    return {
      filename,
      path: filePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      exists: true
    };
  } catch (error) {
    console.error('Error getting screen recording file info:', error);
    return {
      filename,
      exists: false,
      error: error.message
    };
  }
};

module.exports = {
  screenUpload,
  generateSecureScreenUrl,
  validateScreenAccessToken,
  getScreenRecordingFileInfo
};
```

- [ ] **Step 2: Verify syntax**

Run: `node --check server/utils/screenRecordingHandler.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Add `startScreenRecording`/`updateScreenRecording` to ExamAttemptService**

Replace:
```js
    } catch (error) {
      console.error('ExamAttemptService: Error updating video recording:', error.message);
      throw error;
    }
  }

  // Get exam attempt with video details for admin review
```

With:
```js
    } catch (error) {
      console.error('ExamAttemptService: Error updating video recording:', error.message);
      throw error;
    }
  }

  // Start screen recording
  static async startScreenRecording(attemptId, studentId) {
    try {
      console.log('ExamAttemptService: Starting screen recording for attempt:', attemptId);

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

      if (attempt.status !== 'in-progress') {
        throw new Error('Cannot start recording for completed exam attempt');
      }

      if (!attempt.screenRecording.enabled) {
        throw new Error('Screen recording is not enabled for this exam');
      }

      attempt.screenRecording.recordingStatus = 'recording';
      attempt.screenRecording.recordingStartTime = new Date();

      attempt.activityLog.push({
        activity: 'screen_recording_started',
        timestamp: new Date()
      });

      await attempt.save();

      console.log('ExamAttemptService: Screen recording started successfully');
      return { success: true, message: 'Screen recording started' };
    } catch (error) {
      console.error('ExamAttemptService: Error starting screen recording:', error.message);
      throw error;
    }
  }

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

  // Get exam attempt with video details for admin review
```

- [ ] **Step 4: Verify syntax**

Run: `node --check server/services/examAttemptService.js`
Expected: no output, exit code 0.

- [ ] **Step 5: Add the screen recording routes**

Replace:
```js
const { videoUpload, generateSecureVideoUrl, validateVideoAccessToken, getVideoFileInfo } = require('../utils/videoHandler.js');
```

With:
```js
const { videoUpload, generateSecureVideoUrl, validateVideoAccessToken, getVideoFileInfo } = require('../utils/videoHandler.js');
const { screenUpload, generateSecureScreenUrl, validateScreenAccessToken, getScreenRecordingFileInfo } = require('../utils/screenRecordingHandler.js');
```

Replace:
```js
// Get exam attempts for admin review (with video details)
router.get('/admin/exam/:examId/attempts', requireUser, async (req, res) => {
```

With:
```js
// Start screen recording
router.post('/screen/start', requireUser, async (req, res) => {
  try {
    const { attemptId } = req.body;
    console.log(`Starting screen recording for attempt: ${attemptId} by user: ${req.user.email}`);

    if (!attemptId) {
      return res.status(400).json({
        success: false,
        error: 'Attempt ID is required'
      });
    }

    const result = await ExamAttemptService.startScreenRecording(attemptId, req.user._id);

    console.log(`Screen recording started successfully for user: ${req.user.email}`);
    return res.status(200).json(result);
  } catch (error) {
    console.error(`Error starting screen recording for user ${req.user.email}:`, error.message);

    if (error.message === 'Exam attempt not found' || error.message === 'Invalid attempt ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized') || error.message.includes('not enabled')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upload screen recording
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

    console.log(`Screen recording uploaded successfully for user: ${req.user.email}, file: ${req.file.filename}`);
    return res.status(200).json({
      ...result,
      videoUrl: videoUrl
    });
  } catch (error) {
    console.error(`Error uploading screen recording for user ${req.user.email}:`, error.message);

    if (req.file) {
      try {
        const filePath = req.file.path;
        await fs.unlink(filePath);
        console.log('Cleaned up uploaded file after error:', filePath);
      } catch (cleanupError) {
        console.error('Error cleaning up uploaded file:', cleanupError.message);
      }
    }

    if (error.message === 'Exam attempt not found' || error.message === 'Invalid attempt ID format') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('not authorized') || error.message.includes('not enabled')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Serve screen recording files (with access control)
router.get('/screen/:examId/:studentId/:filename', async (req, res) => {
  try {
    const { examId, studentId, filename } = req.params;
    const { token, t: timestamp } = req.query;

    console.log(`Screen recording access request: exam=${examId}, student=${studentId}, file=${filename}`);

    if (!validateScreenAccessToken(token, filename, examId, studentId, timestamp)) {
      console.log('Screen recording access denied - invalid token');
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const fileInfo = await getScreenRecordingFileInfo(filename);
    if (!fileInfo.exists) {
      console.log('Screen recording file not found:', filename);
      return res.status(404).json({
        success: false,
        error: 'Screen recording not found'
      });
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', fileInfo.size);
    res.setHeader('Accept-Ranges', 'bytes');

    const screenStream = require('fs').createReadStream(fileInfo.path);
    screenStream.pipe(res);

    console.log('Screen recording file served successfully:', filename);
  } catch (error) {
    console.error('Error serving screen recording file:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to serve screen recording file'
    });
  }
});

// Get exam attempts for admin review (with video details)
router.get('/admin/exam/:examId/attempts', requireUser, async (req, res) => {
```

- [ ] **Step 6: Verify syntax**

Run: `node --check server/routes/examAttemptRoutes.js`
Expected: no output, exit code 0.

- [ ] **Step 7: Verify the full start/upload/stream flow live**

Start the backend dev server, then create a real attempt on a `screenRecording: true` exam (reuse the DB-toggle approach from Task 1's verification script, or use the admin UI once Task 4 lands), grab an `attemptId` and a valid student JWT, and:

```bash
curl -s -X POST http://localhost:3000/api/exam-attempts/screen/start -H "Content-Type: application/json" -H "Authorization: Bearer $STUDENT_TOKEN" -d '{"attemptId":"'"$ATTEMPT_ID"'"}'

# Create a small dummy file to upload (content doesn't matter for this check, just the multipart mechanics)
echo "dummy video content" > /tmp/test-screen.webm
curl -s -X POST http://localhost:3000/api/exam-attempts/screen/upload -H "Authorization: Bearer $STUDENT_TOKEN" -F "video=@/tmp/test-screen.webm;type=video/webm" -F "attemptId=$ATTEMPT_ID"
```

Expected: `/screen/start` returns `{"success":true,"message":"Screen recording started"}`; `/screen/upload` returns `{"success":true,"message":"Screen recording completed","videoUrl":"/api/exam-attempts/screen/..."}`. Then `curl` the returned `videoUrl` directly and confirm it streams the dummy file content back (proving the token validation and file-serving route both work).

- [ ] **Step 8: Commit**

```bash
git add server/utils/screenRecordingHandler.js server/services/examAttemptService.js server/routes/examAttemptRoutes.js
git commit -m "feat(proctoring): add screen recording storage, service methods, and routes"
```

---

### Task 3: Backend — live screenshot relay

**Files:**
- Modify: `server/sockets/connectionHandlers.js`

**Interfaces:**
- Consumes: `socketManager.emitToAdmin` (Part 1), `ExamAttempt` model.
- Produces: server-side handling of client-emitted `screenshot:capture` → relayed as `screenshot:pushed` to `admin:{adminId}` — consumed by Task 5 (`ScreenRecorder.tsx`, the emitter) and Task 7 (`LiveMonitoring.tsx`, the receiver).

- [ ] **Step 1: Add the screenshot relay handler**

Replace:
```js
function handleConnection(socket) {
  console.log(`Socket connected: user ${socket.userId} (${socket.userRole})`);

  if (socket.userRole === 'admin') {
    socket.join(`admin:${socket.userId}`);
    console.log(`Socket ${socket.id} joined room admin:${socket.userId}`);
  }

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: user ${socket.userId}`);
  });
}

module.exports = handleConnection;
```

With:
```js
const socketManager = require('./socketManager');
const ExamAttempt = require('../models/ExamAttempt');

function handleConnection(socket) {
  console.log(`Socket connected: user ${socket.userId} (${socket.userRole})`);

  if (socket.userRole === 'admin') {
    socket.join(`admin:${socket.userId}`);
    console.log(`Socket ${socket.id} joined room admin:${socket.userId}`);
  }

  // Relay a student's periodic screen-share screenshot to the owning admin's room.
  // Never persisted -- relayed and discarded.
  socket.on('screenshot:capture', async ({ attemptId, imageDataUrl }) => {
    try {
      const attempt = await ExamAttempt.findById(attemptId).populate('examId', 'createdBy');
      if (!attempt || attempt.studentId.toString() !== socket.userId) {
        return;
      }
      if (attempt.examId && attempt.examId.createdBy) {
        socketManager.emitToAdmin(attempt.examId.createdBy.toString(), 'screenshot:pushed', {
          attemptId,
          imageDataUrl,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error(`Socket screenshot:capture error for attempt ${attemptId}:`, error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: user ${socket.userId}`);
  });
}

module.exports = handleConnection;
```

Note: `connectionHandlers.js` requiring `socketManager.js` here is safe, not a circular-require problem — `require('./connectionHandlers')` only happens lazily inside `socketManager.js`'s `init()` function body, by which point `socketManager.js`'s own `module.exports` has already fully evaluated.

- [ ] **Step 2: Verify syntax**

Run: `node --check server/sockets/connectionHandlers.js`
Expected: no output, exit code 0.

- [ ] **Step 3: Verify the relay end-to-end with a throwaway script**

Create a temporary `server/verify-screenshot-relay.js` (delete it after):

```js
require('dotenv').config();
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');
require('./models/Question');
const socketManager = require('./sockets/socketManager.js');
const Exam = require('./models/Exam');
const User = require('./models/User');
const ExamAttempt = require('./models/ExamAttempt');
const ExamAttemptService = require('./services/examAttemptService');

(async () => {
  await mongoose.connect(process.env.DATABASE_URL);
  const exam = await Exam.findOne({ status: 'active' }).populate('questions');
  const student = await User.findOne({ email: 'student3@example.com' });
  const admin = await User.findById(exam.createdBy);

  await ExamAttempt.deleteMany({ examId: exam._id, studentId: student._id });
  const { attemptId } = await ExamAttemptService.startAttempt(exam._id, student._id);

  const adminToken = jwt.sign({ userId: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const studentToken = jwt.sign({ userId: student._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const app = express();
  const server = http.createServer(app);
  socketManager.init(server);

  server.listen(4003, () => {
    const adminSocket = ioClient('http://localhost:4003', { auth: { token: adminToken } });
    const studentSocket = ioClient('http://localhost:4003', { auth: { token: studentToken } });

    adminSocket.on('screenshot:pushed', (payload) => {
      console.log('RESULT: admin received screenshot:pushed, attemptId matches:', payload.attemptId === attemptId, 'has imageDataUrl:', !!payload.imageDataUrl);
    });

    studentSocket.on('connect', () => {
      setTimeout(() => {
        studentSocket.emit('screenshot:capture', { attemptId, imageDataUrl: 'data:image/jpeg;base64,AAAA' });
      }, 500);

      setTimeout(async () => {
        adminSocket.disconnect();
        studentSocket.disconnect();
        server.close();
        await ExamAttempt.deleteMany({ examId: exam._id, studentId: student._id });
        await mongoose.disconnect();
        process.exit(0);
      }, 1500);
    });
  });
})();
```

Run (from `server/`): `node verify-screenshot-relay.js`
Expected: `RESULT: admin received screenshot:pushed, attemptId matches: true has imageDataUrl: true`.

- [ ] **Step 4: Delete the throwaway script**

```bash
rm server/verify-screenshot-relay.js
```

- [ ] **Step 5: Commit**

```bash
git add server/sockets/connectionHandlers.js
git commit -m "feat(proctoring): relay live screen-share screenshots to the owning admin"
```

---

### Task 4: Exam creation UI — Screen Recording toggle

**Files:**
- Modify: `client/src/api/exams.ts`
- Modify: `client/src/components/admin/ExamForm.tsx`
- Modify: `client/src/pages/admin/EditExam.tsx`

**Interfaces:**
- Produces: `Exam.screenRecording: boolean` (client type), `ExamFormData.screenRecording: boolean` — an admin-facing toggle, independent of the existing `videoRecording` toggle.

- [ ] **Step 1: Add the field to the client `Exam` type**

Replace:
```ts
  maxAttempts: number; // 0 means unlimited
  videoRecording: boolean;
  mobileEnabled: boolean;
```

With:
```ts
  maxAttempts: number; // 0 means unlimited
  videoRecording: boolean;
  screenRecording: boolean;
  mobileEnabled: boolean;
```

- [ ] **Step 2: Add the field to `ExamFormData` and its create-mode default**

Replace:
```ts
  useRandomQuestions: boolean
  videoRecording: boolean
  mobileEnabled: boolean
```

With:
```ts
  useRandomQuestions: boolean
  videoRecording: boolean
  screenRecording: boolean
  mobileEnabled: boolean
```

Replace:
```ts
  questionsPerExam: undefined,
  videoRecording: false,
  mobileEnabled: false,
```

With:
```ts
  questionsPerExam: undefined,
  videoRecording: false,
  screenRecording: false,
  mobileEnabled: false,
```

- [ ] **Step 3: Add the Switch to the form UI**

Replace:
```tsx
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Use Video Security</Label>
                  <p className="text-sm text-muted-foreground">
                    Record student video and audio during exam
                  </p>
                </div>
                <Switch
                  checked={watch("videoRecording")}
                  onCheckedChange={(checked) => setValue("videoRecording", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Mobile Devices</Label>
```

With:
```tsx
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Use Video Security</Label>
                  <p className="text-sm text-muted-foreground">
                    Record student video and audio during exam
                  </p>
                </div>
                <Switch
                  checked={watch("videoRecording")}
                  onCheckedChange={(checked) => setValue("videoRecording", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Screen Recording</Label>
                  <p className="text-sm text-muted-foreground">
                    Record the student's screen during exam
                  </p>
                </div>
                <Switch
                  checked={watch("screenRecording")}
                  onCheckedChange={(checked) => setValue("screenRecording", checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Mobile Devices</Label>
```

- [ ] **Step 4: Populate the field when editing an existing exam**

Replace:
```ts
        videoRecording: exam.videoRecording || false,
        mobileEnabled: exam.mobileEnabled || false,
```

With:
```ts
        videoRecording: exam.videoRecording || false,
        screenRecording: exam.screenRecording || false,
        mobileEnabled: exam.mobileEnabled || false,
```

- [ ] **Step 5: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: matches the Task 0 baseline.

- [ ] **Step 6: Manually verify the toggle**

Log in as admin, create or edit an exam, confirm "Screen Recording" appears as its own switch (independent of "Use Video Security" — toggle each on/off separately and confirm they don't affect each other), save, and confirm it persists correctly on re-opening the edit form.

- [ ] **Step 7: Commit**

```bash
git add client/src/api/exams.ts client/src/components/admin/ExamForm.tsx client/src/pages/admin/EditExam.tsx
git commit -m "feat(proctoring): add independent Screen Recording toggle to exam creation/edit"
```

---

### Task 5: Client — API wrappers + ScreenRecorder component

**Files:**
- Modify: `client/src/api/examAttempts.ts`
- Create: `client/src/components/ScreenRecorder.tsx`

**Interfaces:**
- Consumes: `POST /screen/start`, `POST /screen/upload` (Task 2); `getSocket()` (Part 1); `screenshot:capture` relay (Task 3).
- Produces: `startScreenRecording(attemptId): Promise<any>`, `uploadScreenRecording(attemptId, blob): Promise<string>`; React component `<ScreenRecorder attemptId={string} onRecordingComplete?={(videoUrl: string) => void} />` — consumed by Task 6.

- [ ] **Step 1: Add the `screenRecording` field to the `ExamAttempt` interface**

Replace:
```ts
  videoRecording: {
    enabled: boolean;
    videoUrl?: string;
    recordingStartTime?: string;
    recordingEndTime?: string;
    recordingStatus: 'not_started' | 'recording' | 'completed' | 'failed';
    fileSize?: number;
    reviewed?: boolean;
    reviewedAt?: string;
  };
  aiGradingResults?: {
```

With:
```ts
  videoRecording: {
    enabled: boolean;
    videoUrl?: string;
    recordingStartTime?: string;
    recordingEndTime?: string;
    recordingStatus: 'not_started' | 'recording' | 'completed' | 'failed';
    fileSize?: number;
    reviewed?: boolean;
    reviewedAt?: string;
  };
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
  aiGradingResults?: {
```

- [ ] **Step 2: Add the `startScreenRecording`/`uploadScreenRecording` API wrappers**

Replace:
```ts
// Description: Upload video recording for exam attempt
// Endpoint: POST /api/exam-attempts/video/upload
// Request: FormData with video file and attemptId
// Response: { success: boolean, message: string, videoUrl: string }
export const uploadVideoRecording = async (attemptId: string, videoBlob: Blob) => {
  try {
    const formData = new FormData();
    formData.append('video', videoBlob, 'exam-recording.webm');
    formData.append('attemptId', attemptId);

    const response = await api.post('/api/exam-attempts/video/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.videoUrl;
  } catch (error: any) {
    console.error('Upload video recording error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Get exam attempts for admin review
```

With:
```ts
// Description: Upload video recording for exam attempt
// Endpoint: POST /api/exam-attempts/video/upload
// Request: FormData with video file and attemptId
// Response: { success: boolean, message: string, videoUrl: string }
export const uploadVideoRecording = async (attemptId: string, videoBlob: Blob) => {
  try {
    const formData = new FormData();
    formData.append('video', videoBlob, 'exam-recording.webm');
    formData.append('attemptId', attemptId);

    const response = await api.post('/api/exam-attempts/video/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.videoUrl;
  } catch (error: any) {
    console.error('Upload video recording error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Start screen recording for exam attempt
// Endpoint: POST /api/exam-attempts/screen/start
// Request: { attemptId: string }
// Response: { success: boolean, message: string }
export const startScreenRecording = async (attemptId: string) => {
  try {
    const response = await api.post('/api/exam-attempts/screen/start', { attemptId });
    return response.data;
  } catch (error: any) {
    console.error('Start screen recording error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};

// Description: Upload screen recording for exam attempt
// Endpoint: POST /api/exam-attempts/screen/upload
// Request: FormData with video file and attemptId
// Response: { success: boolean, message: string, videoUrl: string }
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

// Description: Get exam attempts for admin review
```

- [ ] **Step 3: Add `latestScreenshot` to the `LiveAttempt` interface**

Replace:
```ts
export interface LiveAttempt {
  _id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  startTime: string;
  tabSwitches: number;
  latestActivity: { activity: string; timestamp: string } | null;
  updatedAt: string;
}
```

With:
```ts
export interface LiveAttempt {
  _id: string;
  examId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  startTime: string;
  tabSwitches: number;
  latestActivity: { activity: string; timestamp: string } | null;
  updatedAt: string;
  latestScreenshot?: string;
}
```

- [ ] **Step 4: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: matches the Task 0 baseline.

- [ ] **Step 5: Create the ScreenRecorder component**

Create `client/src/components/ScreenRecorder.tsx`:

```tsx
import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Monitor, AlertTriangle, CheckCircle, Minimize2, Maximize2, Move } from "lucide-react"
import { startScreenRecording, uploadScreenRecording } from "@/api/examAttempts"
import { getSocket } from "@/lib/socket"
import { useToast } from "@/hooks/useToast"

interface ScreenRecorderProps {
  attemptId: string
  onRecordingComplete?: (videoUrl: string) => void
}

export function ScreenRecorder({ attemptId, onRecordingComplete }: ScreenRecorderProps) {
  const { toast } = useToast()
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'stopped' | 'uploading' | 'completed'>('idle')
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [hasPermissions, setHasPermissions] = useState(false)
  const [permissionError, setPermissionError] = useState<string>("")

  // Floating window states -- offset to the right of VideoRecorder's default position
  // so both widgets don't stack exactly on top of each other when both are enabled
  const [position, setPosition] = useState({ x: 340, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [autoStarted, setAutoStarted] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const screenshotTimerRef = useRef<NodeJS.Timeout | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))

  useEffect(() => {
    if (!hasPermissions && !permissionError && !autoStarted) {
      setAutoStarted(true)
      requestPermissions().then(() => {
        setTimeout(() => {
          startRecording()
        }, 1000)
      }).catch((error) => {
        console.error('Screen share auto-start failed:', error)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      if (screenshotTimerRef.current) {
        clearInterval(screenshotTimerRef.current)
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  const requestPermissions = async () => {
    try {
      console.log('Requesting screen share permission...')
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 10 }
        }
      })

      setStream(mediaStream)
      setHasPermissions(true)
      setPermissionError("")

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }

      // Browsers show a native "Stop sharing" control outside the page's UI. If the
      // student uses it, route that through the same cleanup as the in-app stop path.
      mediaStream.getVideoTracks()[0].addEventListener('ended', () => {
        stopRecording()
      })

      console.log('Screen share permission granted successfully')
      toast({
        title: "Screen Share Access Granted",
        description: "Screen recording will start automatically for exam security",
      })

      return mediaStream
    } catch (error: any) {
      console.error('Error requesting screen share permission:', error)
      let errorMessage = "Failed to access screen sharing. "

      if (error.name === 'NotAllowedError') {
        errorMessage += "Please allow screen sharing for exam security."
      } else {
        errorMessage += error.message || "Unknown error occurred."
      }

      setPermissionError(errorMessage)
      toast({
        title: "Screen Share Error",
        description: errorMessage,
        variant: "destructive"
      })
      throw new Error(errorMessage)
    }
  }

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

  const startRecording = async () => {
    try {
      console.log('Starting screen recording for attempt:', attemptId)

      let mediaStream = stream
      if (!mediaStream) {
        mediaStream = await requestPermissions()
      }

      if (!mediaStream) {
        throw new Error('No screen share stream available')
      }

      await startScreenRecording(attemptId)

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

      const videoUrl = await uploadScreenRecording(attemptId, recordedBlob)

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

  if (!hasPermissions && !permissionError) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Screen Recording Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This exam requires screen recording for security purposes. Please share your screen when prompted.
          </p>
          <Button onClick={requestPermissions} className="w-full">
            Share Screen
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (permissionError) {
    return (
      <Card className="w-full max-w-md border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Screen Share Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-destructive">{permissionError}</p>
          <Button onClick={requestPermissions} variant="outline" className="w-full">
            Retry Screen Share
          </Button>
        </CardContent>
      </Card>
    )
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

- [ ] **Step 6: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: matches the Task 0 baseline.

- [ ] **Step 7: Commit**

```bash
git add client/src/api/examAttempts.ts client/src/components/ScreenRecorder.tsx
git commit -m "feat(proctoring): add ScreenRecorder component and client API wrappers"
```

---

### Task 6: Wire ScreenRecorder into the exam-taking page

**Files:**
- Modify: `client/src/pages/student/ExamAttempt.tsx`

**Interfaces:**
- Consumes: `screenRecording` boolean from `startExamAttempt`'s response (Task 1); `<ScreenRecorder>` (Task 5).

- [ ] **Step 1: Import the component and add state**

Replace:
```tsx
import { VideoRecorder } from "@/components/VideoRecorder"
```

With:
```tsx
import { VideoRecorder } from "@/components/VideoRecorder"
import { ScreenRecorder } from "@/components/ScreenRecorder"
```

Replace:
```tsx
  const [videoRecordingEnabled, setVideoRecordingEnabled] = useState(false)
```

With:
```tsx
  const [videoRecordingEnabled, setVideoRecordingEnabled] = useState(false)
  const [screenRecordingEnabled, setScreenRecordingEnabled] = useState(false)
```

- [ ] **Step 2: Set the state from the attempt response**

Replace:
```tsx
      setVideoRecordingEnabled(attemptData.videoRecording || false)
```

With:
```tsx
      setVideoRecordingEnabled(attemptData.videoRecording || false)
      setScreenRecordingEnabled(attemptData.screenRecording || false)
```

- [ ] **Step 3: Add the `Monitor` icon import**

Replace:
```tsx
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  Send,
  AlertTriangle,
  CheckCircle,
  Video
} from "lucide-react"
```

With:
```tsx
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  Send,
  AlertTriangle,
  CheckCircle,
  Video,
  Monitor
} from "lucide-react"
```

- [ ] **Step 4: Add the header badge**

Replace:
```tsx
              {videoRecordingEnabled && (
                <Badge variant="secondary" className="gap-1">
                  <Video className="h-3 w-3" />
                  Recording
                </Badge>
              )}
            </div>
```

With:
```tsx
              {videoRecordingEnabled && (
                <Badge variant="secondary" className="gap-1">
                  <Video className="h-3 w-3" />
                  Recording
                </Badge>
              )}
              {screenRecordingEnabled && (
                <Badge variant="secondary" className="gap-1">
                  <Monitor className="h-3 w-3" />
                  Screen Recording
                </Badge>
              )}
            </div>
```

- [ ] **Step 5: Render the floating widget**

Replace:
```tsx
      {/* Floating Video Recorder (if enabled) */}
      {videoRecordingEnabled && (
        <VideoRecorder attemptId={attemptId} />
      )}
    </div>
  )
}
```

With:
```tsx
      {/* Floating Video Recorder (if enabled) */}
      {videoRecordingEnabled && (
        <VideoRecorder attemptId={attemptId} />
      )}
      {/* Floating Screen Recorder (if enabled) -- independent of video recording, can run alongside it */}
      {screenRecordingEnabled && (
        <ScreenRecorder attemptId={attemptId} />
      )}
    </div>
  )
}
```

- [ ] **Step 6: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: matches the Task 0 baseline.

- [ ] **Step 7: Manually verify (with the caveat below)**

Enable "Screen Recording" (and optionally also "Use Video Security") on a test exam, start an attempt as a student, and confirm the browser prompts for screen-share permission, the floating "Screen Recording" widget appears (offset from the video widget if both are enabled, not stacked on top of it), and the header badge shows "Screen Recording".

**Known test limitation:** automated browser tools (including the Playwright MCP tooling available in this session) do not reliably support programmatically granting `getDisplayMedia` screen-share permission the way they can for camera/microphone — the screen-picker dialog is OS-level UI. If full automated verification isn't achievable in your environment, verify the component renders its "Screen Recording Setup" card correctly and that clicking "Share Screen" triggers the browser's real permission prompt (proving the code path executes correctly up to that point), and note this limitation explicitly rather than skipping it silently or claiming full automated coverage.

- [ ] **Step 8: Commit**

```bash
git add client/src/pages/student/ExamAttempt.tsx
git commit -m "feat(proctoring): wire ScreenRecorder into the exam attempt page"
```

---

### Task 7: Admin review — Screen Recording tab

**Files:**
- Modify: `client/src/pages/admin/StudentVideoReview.tsx`

**Interfaces:**
- Consumes: `selectedAttempt.screenRecording` (populated by the backend's existing `getAttemptForReview`/`getExamAttemptsForReview`, which already return full `ExamAttempt` documents — no backend change needed here since Task 1 already added the field to the schema).

- [ ] **Step 1: Add `screenRecording` to the local `ExamAttemptReview` interface**

Replace:
```tsx
  videoRecording?: {
    enabled: boolean
    videoUrl?: string
    recordingStartTime?: string
    recordingEndTime?: string
    recordingStatus: string
    fileSize?: number
    reviewed?: boolean
    reviewedAt?: string
  }
  activityLog: Array<{
```

With:
```tsx
  videoRecording?: {
    enabled: boolean
    videoUrl?: string
    recordingStartTime?: string
    recordingEndTime?: string
    recordingStatus: string
    fileSize?: number
    reviewed?: boolean
    reviewedAt?: string
  }
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
  activityLog: Array<{
```

- [ ] **Step 2: Add the `Monitor` icon import**

Replace:
```tsx
import { 
  ArrowLeft, 
  Video, 
  Clock, 
  User, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Eye,
  Download
} from "lucide-react"
```

With:
```tsx
import { 
  ArrowLeft, 
  Video, 
  Monitor,
  Clock, 
  User, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Eye,
  Download
} from "lucide-react"
```

- [ ] **Step 3: Add the "Screen Recording" tab trigger**

Replace:
```tsx
          <Tabs defaultValue="video" className="space-y-4">
            <TabsList>
              <TabsTrigger value="video">Video Recording</TabsTrigger>
              <TabsTrigger value="security">Security Log</TabsTrigger>
              <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
            </TabsList>
```

With:
```tsx
          <Tabs defaultValue="video" className="space-y-4">
            <TabsList>
              <TabsTrigger value="video">Video Recording</TabsTrigger>
              <TabsTrigger value="screen">Screen Recording</TabsTrigger>
              <TabsTrigger value="security">Security Log</TabsTrigger>
              <TabsTrigger value="activity">Activity Timeline</TabsTrigger>
            </TabsList>
```

- [ ] **Step 4: Add the "Screen Recording" tab content**

Replace:
```tsx
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Video recording was not enabled for this exam</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
```

With:
```tsx
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Video className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Video recording was not enabled for this exam</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

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
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-4">
```

- [ ] **Step 5: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: matches the Task 0 baseline.

- [ ] **Step 6: Manually verify**

After completing a test attempt with screen recording enabled (from Task 6's walkthrough), open its review page as admin and confirm the new "Screen Recording" tab shows the uploaded recording, playable, with the spinner overlay correctly confined to the player (not the whole page — the fix from earlier this session).

- [ ] **Step 7: Commit**

```bash
git add client/src/pages/admin/StudentVideoReview.tsx
git commit -m "feat(proctoring): add Screen Recording review tab"
```

---

### Task 8: Admin live view — screenshot thumbnails

**Files:**
- Modify: `client/src/pages/admin/LiveMonitoring.tsx`

**Interfaces:**
- Consumes: `screenshot:pushed` event (Task 3), `Dialog`/`DialogTrigger`/`DialogContent` (`@/components/ui/dialog`, pre-existing).

- [ ] **Step 1: Add the `Dialog` and `Monitor` imports**

Replace:
```tsx
import { Activity, AlertTriangle } from "lucide-react"
import { getLiveAttempts, type LiveAttempt } from "@/api/examAttempts"
import { getSocket } from "@/lib/socket"
import { useToast } from "@/hooks/useToast"
```

With:
```tsx
import { Activity, AlertTriangle, Monitor } from "lucide-react"
import { getLiveAttempts, type LiveAttempt } from "@/api/examAttempts"
import { getSocket } from "@/lib/socket"
import { useToast } from "@/hooks/useToast"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
```

- [ ] **Step 2: Add the `screenshot:pushed` listener**

Replace:
```tsx
    const handleEnded = (payload: any) => {
      setAttempts(prev => prev.filter(a => a._id !== payload.attemptId))
      toast({
        title: "Attempt Submitted",
        description: `${payload.examTitle} — status: ${payload.status}`
      })
    }

    socket.on('attempt:started', handleStarted)
    socket.on('attempt:activity', handleActivity)
    socket.on('attempt:ended', handleEnded)

    return () => {
      socket.off('attempt:started', handleStarted)
      socket.off('attempt:activity', handleActivity)
      socket.off('attempt:ended', handleEnded)
    }
  }, [toast])
```

With:
```tsx
    const handleEnded = (payload: any) => {
      setAttempts(prev => prev.filter(a => a._id !== payload.attemptId))
      toast({
        title: "Attempt Submitted",
        description: `${payload.examTitle} — status: ${payload.status}`
      })
    }

    const handleScreenshot = (payload: any) => {
      setAttempts(prev => prev.map(a =>
        a._id === payload.attemptId
          ? { ...a, latestScreenshot: payload.imageDataUrl }
          : a
      ))
    }

    socket.on('attempt:started', handleStarted)
    socket.on('attempt:activity', handleActivity)
    socket.on('attempt:ended', handleEnded)
    socket.on('screenshot:pushed', handleScreenshot)

    return () => {
      socket.off('attempt:started', handleStarted)
      socket.off('attempt:activity', handleActivity)
      socket.off('attempt:ended', handleEnded)
      socket.off('screenshot:pushed', handleScreenshot)
    }
  }, [toast])
```

- [ ] **Step 3: Add the "Screen" column**

Replace:
```tsx
                    <TableHead>Latest Activity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
```

With:
```tsx
                    <TableHead>Latest Activity</TableHead>
                    <TableHead>Screen</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
```

Replace:
```tsx
                      <TableCell>
                        {attempt.latestActivity ? (
                          <Badge variant="outline">{attempt.latestActivity.activity.replace(/_/g, ' ')}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1 animate-pulse">
                          <Activity className="h-3 w-3" />
                          Live
                        </Badge>
                      </TableCell>
```

With:
```tsx
                      <TableCell>
                        {attempt.latestActivity ? (
                          <Badge variant="outline">{attempt.latestActivity.activity.replace(/_/g, ' ')}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {attempt.latestScreenshot ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="block h-10 w-16 overflow-hidden rounded border">
                                <img
                                  src={attempt.latestScreenshot}
                                  alt={`${attempt.studentName}'s screen`}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <img
                                src={attempt.latestScreenshot}
                                alt={`${attempt.studentName}'s screen`}
                                className="w-full rounded"
                              />
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1 animate-pulse">
                          <Activity className="h-3 w-3" />
                          Live
                        </Badge>
                      </TableCell>
```

- [ ] **Step 4: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: matches the Task 0 baseline.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/admin/LiveMonitoring.tsx
git commit -m "feat(proctoring): show live screenshot thumbnails on the Live Monitoring page"
```

---

### Task 9: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full backend syntax sweep**

Run: `node --check server/models/Exam.js && node --check server/models/ExamAttempt.js && node --check server/services/examAttemptService.js && node --check server/utils/screenRecordingHandler.js && node --check server/routes/examAttemptRoutes.js && node --check server/sockets/connectionHandlers.js`
Expected: no output, exit code 0.

- [ ] **Step 2: Full frontend type check**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: matches the Task 0 baseline.

- [ ] **Step 3: Live walkthrough (budgeting for the getDisplayMedia automation limitation noted in Task 6)**

With both dev servers running:
1. As admin, create/edit a test exam with "Screen Recording" enabled (and optionally "Use Video Security" too, to confirm both floating widgets coexist without interfering).
2. As a student (in a real interactive browser session, not just automation, if `getDisplayMedia`'s permission prompt can't be scripted in your environment), start the attempt, grant screen-share, and confirm the floating widget and header badge appear.
3. On the admin's Live Monitoring page (open in a separate session), confirm a live-updating screenshot thumbnail appears for that attempt roughly every 10s, and confirm clicking it opens a larger view via the dialog.
4. Submit the attempt, then open it in Student Video Review and confirm the "Screen Recording" tab shows the uploaded recording, playable.
5. Confirm `MobileExamAttempt.tsx` is untouched and unaffected (no `ScreenRecorder` import, no new console errors on that page).

- [ ] **Step 4: Report results**

Summarize which of the Step 3 walkthrough items passed via automation vs. manual verification, being explicit about the `getDisplayMedia` automation limitation rather than glossing over it.

---

## Finishing

Once all 9 tasks are complete and verified, invoke `superpowers:finishing-a-development-branch` to merge this branch to `main`. This is Part 2 of 3 — after merging, update the `exammaster-exam-proctoring-progress.md` memory file to mark Part 2 complete, and note Part 3 (browser-based cheat-detection heuristics, feeding alerts into this same Live Monitoring page) as the next planned work.
