# Exam Proctoring Suite — Part 1: Real-Time Infrastructure + Live Admin Monitoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ExamMaster its first real-time infrastructure layer (Socket.IO, JWT-authenticated, admin-scoped rooms) and a live admin dashboard showing every exam attempt currently in progress across the admin's exams, updating without a page refresh as students start exams, trigger security-monitoring activity, or submit.

**Architecture:** A singleton Socket.IO server (`server/sockets/`) attaches to the existing Express app via `http.createServer`. Three existing `ExamAttemptService` methods (`startAttempt`, `logActivity`, `submitAttempt`) gain a socket emission call right after their existing DB writes, scoped to a room keyed by the owning admin's user ID (`admin:{adminId}`) — no new admin-ownership query is needed since the owning exam is already loaded in each method for other reasons. A new cross-exam `LiveMonitoring.tsx` admin page fetches an initial snapshot via REST, then patches itself live from the same three events.

**Tech Stack:** Socket.IO 4.8.x (server + client), reusing the existing JWT/Express/Mongoose/React stack — no other new dependencies.

## Global Constraints

- No automated test framework exists in this repo. Verify backend changes with `node --check <file>` and one-off Node scripts (following this session's established pattern — see Task 1/2). Verify frontend changes with `npx tsc --noEmit -p tsconfig.app.json` from `client/`; confirm the error count doesn't increase from whatever the baseline is at execution time (check it in Task 0 below before making any changes).
- This is Part 1 of 3. **Do not** add screen capture/`getDisplayMedia`, screenshot pushing, cheat-detection heuristics, or any change to `client/src/pages/student/MobileExamAttempt.tsx` — all explicitly out of scope, reserved for Parts 2/3.
- Match existing code style exactly: `console.log`/`console.error` at the start/end of backend methods (this codebase's established pattern throughout `examAttemptService.js`), the `Description/Endpoint/Request/Response` comment block above each `client/src/api/examAttempts.ts` export, and the `try/catch/finally` + `toast` + `LoadingState`/`EmptyState` shape already used by `GradingQueue.tsx`.
- New route uses `requireAdmin` (not the older inline `role !== 'admin'` check pattern still present elsewhere in `examAttemptRoutes.js`) — matches the cleaner, more-recently-adopted convention already used in `aiChatRoutes.js`/`aiPlatformRoutes.js`.

---

### Task 0: Baseline check

- [ ] **Step 1: Record the current tsc baseline**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Record this number — every later task's tsc check compares against it, not a hardcoded value (unlike prior plans in this project, this one doesn't assume a specific baseline since time has passed since it was last measured).

---

### Task 1: Socket.IO server foundation

**Files:**
- Create: `server/sockets/socketManager.js`
- Create: `server/sockets/authMiddleware.js`
- Create: `server/sockets/connectionHandlers.js`
- Modify: `server/server.js`

**Interfaces:**
- Produces: `socketManager.init(httpServer)` (called once at boot), `socketManager.emitToAdmin(adminId: string, event: string, payload: object)` — this is the only function later tasks import from this module.
- Consumes: `process.env.JWT_SECRET` (already required and validated at server boot), `User` model (`server/models/User.js`).

- [ ] **Step 1: Install the server dependency**

Run (from `server/`): `npm install socket.io@^4.8.1`

- [ ] **Step 2: Create the auth handshake middleware**

Create `server/sockets/authMiddleware.js`:

```js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function socketAuthMiddleware(socket, next) {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user._id.toString();
    socket.userRole = user.role;
    next();
  } catch (error) {
    next(new Error('Invalid or expired token'));
  }
};
```

This mirrors `server/routes/middleware/auth.js`'s `requireUser` exactly (same `JWT_SECRET`, same `decoded.userId` payload shape, same `User.findById(...).select('-password')` lookup).

- [ ] **Step 3: Create the connection handler**

Create `server/sockets/connectionHandlers.js`:

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

- [ ] **Step 4: Create the socket manager singleton**

Create `server/sockets/socketManager.js`:

```js
let io = null;

function init(httpServer) {
  const { Server } = require('socket.io');
  const authMiddleware = require('./authMiddleware');
  const handleConnection = require('./connectionHandlers');

  io = new Server(httpServer);
  io.use(authMiddleware);
  io.on('connection', handleConnection);

  console.log('Socket.IO server initialized');
  return io;
}

function emitToAdmin(adminId, event, payload) {
  if (!io) {
    console.error('SocketManager: emitToAdmin called before init()');
    return;
  }
  io.to(`admin:${adminId}`).emit(event, payload);
}

module.exports = { init, emitToAdmin };
```

- [ ] **Step 5: Wire it into `server/server.js`**

Replace:
```js
const mongoose = require("mongoose");
const express = require("express");
```

With:
```js
const http = require("http");
const mongoose = require("mongoose");
const express = require("express");
```

Replace:
```js
const app = express();
const PORT = process.env.PORT || 3000;
```

With:
```js
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
```

Replace:
```js
  app.use('/api/ai-chat', require('./routes/aiChatRoutes.js'));

  // Legacy download route handler (redirect to reports download)
```

With:
```js
  app.use('/api/ai-chat', require('./routes/aiChatRoutes.js'));

  // Initialize Socket.IO for real-time admin monitoring
  const socketManager = require('./sockets/socketManager.js');
  socketManager.init(server);

  // Legacy download route handler (redirect to reports download)
```

Replace:
```js
  app.listen(PORT, () => {
```

With:
```js
  server.listen(PORT, () => {
```

- [ ] **Step 6: Verify syntax**

Run: `node --check server/server.js && node --check server/sockets/socketManager.js && node --check server/sockets/authMiddleware.js && node --check server/sockets/connectionHandlers.js`
Expected: no output, exit code 0.

- [ ] **Step 7: Verify the auth handshake end-to-end with a throwaway script**

Create a temporary `server/verify-socket-auth.js` (delete it in Step 8, do not commit it):

```js
require('dotenv').config();
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');
const socketManager = require('./sockets/socketManager.js');
const User = require('./models/User');

(async () => {
  await mongoose.connect(process.env.DATABASE_URL);
  const admin = await User.findOne({ email: 'admin@yahoo.com' });
  const student = await User.findOne({ email: 'student1@example.com' });

  const adminToken = jwt.sign({ userId: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const studentToken = jwt.sign({ userId: student._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const app = express();
  const server = http.createServer(app);
  socketManager.init(server);

  server.listen(4001, () => {
    console.log('Test server listening on 4001');

    const adminSocket = ioClient('http://localhost:4001', { auth: { token: adminToken } });
    adminSocket.on('connect', () => console.log('RESULT: ADMIN CONNECTED', adminSocket.id));
    adminSocket.on('connect_error', (err) => console.log('RESULT: ADMIN CONNECT ERROR', err.message));

    const studentSocket = ioClient('http://localhost:4001', { auth: { token: studentToken } });
    studentSocket.on('connect', () => console.log('RESULT: STUDENT CONNECTED', studentSocket.id));
    studentSocket.on('connect_error', (err) => console.log('RESULT: STUDENT CONNECT ERROR', err.message));

    const badSocket = ioClient('http://localhost:4001', { auth: { token: 'invalid-token' } });
    badSocket.on('connect', () => console.log('RESULT: BAD TOKEN CONNECTED (should not happen!)'));
    badSocket.on('connect_error', (err) => console.log('RESULT: BAD TOKEN REJECTED (expected):', err.message));

    setTimeout(() => {
      adminSocket.on('test:event', (payload) => console.log('RESULT: ADMIN RECEIVED test:event', JSON.stringify(payload)));
      setTimeout(() => {
        socketManager.emitToAdmin(admin._id.toString(), 'test:event', { hello: 'world' });
      }, 300);

      setTimeout(async () => {
        adminSocket.disconnect();
        studentSocket.disconnect();
        badSocket.disconnect();
        server.close();
        await mongoose.disconnect();
        process.exit(0);
      }, 1200);
    }, 800);
  });
})();
```

Run (from `server/`): `npm install socket.io-client@^4.8.1 --save-dev && node verify-socket-auth.js`

Expected output includes all of: `RESULT: ADMIN CONNECTED ...`, `RESULT: STUDENT CONNECTED ...`, `RESULT: BAD TOKEN REJECTED (expected): ...`, and `RESULT: ADMIN RECEIVED test:event {"hello":"world"}` — confirming valid tokens connect, invalid tokens are rejected, and `emitToAdmin` correctly reaches only the targeted admin's room.

- [ ] **Step 8: Delete the throwaway verification script**

```bash
rm server/verify-socket-auth.js
```

(`socket.io-client` stays installed as a devDependency — Task 4 will need it again for the real client integration, and it's a legitimate devDependency for any future server-side socket testing.)

- [ ] **Step 9: Commit**

```bash
git add server/package.json server/package-lock.json server/sockets/ server/server.js
git commit -m "feat(proctoring): add Socket.IO server with JWT-authenticated admin rooms"
```

---

### Task 2: Service layer — activity classifier, real-time emissions, and the live-attempts query

**Files:**
- Create: `server/sockets/activityClassifier.js`
- Modify: `server/services/examAttemptService.js`

**Interfaces:**
- Consumes: `socketManager.emitToAdmin` (Task 1).
- Produces: `isViolation(activity: string): boolean`; `ExamAttemptService.getLiveAttempts(adminId): Promise<LiveAttempt[]>` where `LiveAttempt = { _id, examId, examTitle, studentId, studentName, studentEmail, startTime, tabSwitches, latestActivity: {activity, timestamp} | null, updatedAt }` — consumed by Task 3's route.
- Emits three events consumed by Task 5's `LiveMonitoring.tsx`: `attempt:started`, `attempt:activity`, `attempt:ended` (exact payload shapes below).

- [ ] **Step 1: Create the activity classifier**

Create `server/sockets/activityClassifier.js`:

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

- [ ] **Step 2: Import the new modules in `examAttemptService.js`**

Replace:
```js
const ExamAttempt = require('../models/ExamAttempt.js');
const Exam = require('../models/Exam.js');
const Question = require('../models/Question.js');
const User = require('../models/User.js');
const AIGradingService = require('./aiGradingService.js');
const emailService = require('./emailService.js');
const mongoose = require('mongoose');
```

With:
```js
const ExamAttempt = require('../models/ExamAttempt.js');
const Exam = require('../models/Exam.js');
const Question = require('../models/Question.js');
const User = require('../models/User.js');
const AIGradingService = require('./aiGradingService.js');
const emailService = require('./emailService.js');
const mongoose = require('mongoose');
const socketManager = require('../sockets/socketManager.js');
const { isViolation } = require('../sockets/activityClassifier.js');
```

- [ ] **Step 3: Emit `attempt:started` in `startAttempt`**

Replace:
```js
      // Calculate remaining time (full duration since it's a new attempt)
      const remainingTime = exam.duration * 60; // Convert minutes to seconds

      console.log('ExamAttemptService: Exam attempt started successfully with ID:', savedAttempt._id);
      console.log(`ExamAttemptService: Loaded ${questions.length} questions for exam attempt`);
      
      return {
```

With:
```js
      // Calculate remaining time (full duration since it's a new attempt)
      const remainingTime = exam.duration * 60; // Convert minutes to seconds

      console.log('ExamAttemptService: Exam attempt started successfully with ID:', savedAttempt._id);
      console.log(`ExamAttemptService: Loaded ${questions.length} questions for exam attempt`);

      const student = await User.findById(studentId).select('name email');
      socketManager.emitToAdmin(exam.createdBy.toString(), 'attempt:started', {
        attemptId: savedAttempt._id.toString(),
        examId: exam._id.toString(),
        examTitle: exam.title,
        studentId: studentId.toString(),
        studentName: student?.name || student?.email,
        studentEmail: student?.email,
        startTime: savedAttempt.startTime,
        attemptNumber: nextAttemptNumber
      });

      return {
```

This only fires on the genuinely-new-attempt path — the two earlier `return` statements in this method (the "student has existing active attempt" branch, and the duplicate-key race recovery inside `buildAttemptResponse`) return before reaching this point, so they correctly do not re-emit `attempt:started`.

- [ ] **Step 4: Emit `attempt:activity` in `logActivity`, and append `getLiveAttempts` right after it**

Replace:
```js
      const attempt = await ExamAttempt.findById(attemptId);
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      // Verify the attempt belongs to the student
      if (attempt.studentId.toString() !== studentId.toString()) {
        throw new Error('You are not authorized to modify this exam attempt');
      }

      // Log the activity
      attempt.activityLog.push({
        activity,
        timestamp: new Date()
      });

      // Increment tab switches if it's a tab switch activity
      if (activity === 'tab_switch') {
        attempt.tabSwitches += 1;
      }

      await attempt.save();

      console.log('ExamAttemptService: Activity logged successfully');
      return { success: true };
    } catch (error) {
      console.error('ExamAttemptService: Error logging activity:', error.message);
      throw error;
    }
  }
```

With:
```js
      const attempt = await ExamAttempt.findById(attemptId).populate('examId', 'title createdBy');
      if (!attempt) {
        throw new Error('Exam attempt not found');
      }

      // Verify the attempt belongs to the student
      if (attempt.studentId.toString() !== studentId.toString()) {
        throw new Error('You are not authorized to modify this exam attempt');
      }

      // Log the activity
      const logEntry = { activity, timestamp: new Date() };
      attempt.activityLog.push(logEntry);

      // Increment tab switches if it's a tab switch activity
      if (activity === 'tab_switch') {
        attempt.tabSwitches += 1;
      }

      await attempt.save();

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

      console.log('ExamAttemptService: Activity logged successfully');
      return { success: true };
    } catch (error) {
      console.error('ExamAttemptService: Error logging activity:', error.message);
      throw error;
    }
  }

  // Get all currently in-progress (live) exam attempts across every exam this admin owns
  static async getLiveAttempts(adminId) {
    try {
      console.log('ExamAttemptService: Getting live attempts for admin:', adminId);

      const adminExams = await Exam.find({ createdBy: adminId }).select('_id title');
      const examIds = adminExams.map(exam => exam._id);

      if (examIds.length === 0) {
        return [];
      }

      const attempts = await ExamAttempt.find({ examId: { $in: examIds }, status: 'in-progress' })
        .populate('studentId', 'name email')
        .populate('examId', 'title')
        .sort({ startTime: -1 });

      return attempts.map(attempt => ({
        _id: attempt._id.toString(),
        examId: attempt.examId._id.toString(),
        examTitle: attempt.examId.title,
        studentId: attempt.studentId._id.toString(),
        studentName: attempt.studentId.name,
        studentEmail: attempt.studentId.email,
        startTime: attempt.startTime,
        tabSwitches: attempt.tabSwitches,
        latestActivity: attempt.activityLog.length > 0
          ? attempt.activityLog[attempt.activityLog.length - 1]
          : null,
        updatedAt: attempt.updatedAt
      }));
    } catch (error) {
      console.error('ExamAttemptService: Error getting live attempts:', error.message);
      throw error;
    }
  }
```

Widening `ExamAttempt.findById(attemptId)` to `.populate('examId', 'title createdBy')` is purely additive — nothing else in `logActivity` treats `attempt.examId` as more than an opaque ref today.

- [ ] **Step 5: Emit `attempt:ended` in `submitAttempt`**

Replace:
```js
      await attempt.save();

      console.log('ExamAttemptService: Exam attempt submitted successfully with total score:', totalScore);

      // Send email results if "Show Results Immediately" is enabled — only once the score is actually final
      if (exam && exam.showResultsImmediately && !needsReview) {
```

With:
```js
      await attempt.save();

      console.log('ExamAttemptService: Exam attempt submitted successfully with total score:', totalScore);

      socketManager.emitToAdmin(attempt.examId.createdBy.toString(), 'attempt:ended', {
        attemptId: attempt._id.toString(),
        examId: attempt.examId._id.toString(),
        examTitle: attempt.examId.title,
        studentId: attempt.studentId.toString(),
        status: attempt.status,
        score: totalScore,
        percentage: attempt.percentage,
        endTime: attempt.endTime,
        timeSpent: attempt.timeSpent
      });

      // Send email results if "Show Results Immediately" is enabled — only once the score is actually final
      if (exam && exam.showResultsImmediately && !needsReview) {
```

The emission fires before the (potentially slow) email-sending block, so the real-time notification isn't delayed by it. `attempt.examId` is already the full populated Exam doc here (`.populate('examId')` earlier in this same method).

- [ ] **Step 6: Verify syntax**

Run: `node --check server/sockets/activityClassifier.js && node --check server/services/examAttemptService.js`
Expected: no output, exit code 0.

- [ ] **Step 7: Verify emissions fire correctly with a throwaway script**

Create a temporary `server/verify-emissions.js` (delete it in Step 8):

```js
require('dotenv').config();
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { io: ioClient } = require('socket.io-client');
require('./models/Question');
const socketManager = require('./sockets/socketManager.js');
const ExamAttemptService = require('./services/examAttemptService.js');
const Exam = require('./models/Exam');
const User = require('./models/User');
const ExamAttempt = require('./models/ExamAttempt');

const STUDENT_EMAIL = 'student1@example.com';

(async () => {
  await mongoose.connect(process.env.DATABASE_URL);
  const exam = await Exam.findOne({ status: 'active' }).populate('questions');
  if (!exam || !exam.questions || exam.questions.length === 0) {
    console.error('No active exam with questions found in this dev DB — seed one before running this script.');
    process.exit(1);
  }
  const student = await User.findOne({ email: STUDENT_EMAIL });
  const admin = await User.findById(exam.createdBy);
  console.log(`Using exam "${exam.title}" (${exam._id}), student ${student.email}, admin ${admin.email}`);

  await ExamAttempt.deleteMany({ examId: exam._id, studentId: student._id });

  const adminToken = jwt.sign({ userId: admin._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

  const app = express();
  const server = http.createServer(app);
  socketManager.init(server);

  server.listen(4002, () => {
    const adminSocket = ioClient('http://localhost:4002', { auth: { token: adminToken } });

    adminSocket.on('attempt:started', (p) => console.log('RESULT: attempt:started', JSON.stringify(p)));
    adminSocket.on('attempt:activity', (p) => console.log('RESULT: attempt:activity', JSON.stringify(p)));
    adminSocket.on('attempt:ended', (p) => console.log('RESULT: attempt:ended', JSON.stringify(p)));

    adminSocket.on('connect', async () => {
      const { attemptId } = await ExamAttemptService.startAttempt(exam._id, student._id);
      console.log('Started attempt', attemptId);

      setTimeout(async () => {
        await ExamAttemptService.logActivity(attemptId, 'tab_switch', student._id);
        console.log('Logged tab_switch activity');

        setTimeout(async () => {
          await ExamAttemptService.submitAttempt(attemptId, student._id);
          console.log('Submitted attempt');

          setTimeout(async () => {
            await ExamAttempt.deleteMany({ examId: exam._id, studentId: student._id });
            adminSocket.disconnect();
            server.close();
            await mongoose.disconnect();
            process.exit(0);
          }, 500);
        }, 500);
      }, 500);
    });
  });
})();
```

Run (from `server/`): `node verify-emissions.js`

Expected: `RESULT: attempt:started {...}`, `RESULT: attempt:activity {..., "isViolation":true, "activity":"tab_switch"}`, `RESULT: attempt:ended {..., "status":"completed"}` (or `"pending-review"` depending on the test exam's questions) all print, each with the expected fields populated (not `undefined`/`null` where a real value is expected).

- [ ] **Step 8: Delete the throwaway verification script**

```bash
rm server/verify-emissions.js
```

- [ ] **Step 9: Commit**

```bash
git add server/sockets/activityClassifier.js server/services/examAttemptService.js
git commit -m "feat(proctoring): emit real-time attempt lifecycle events and add getLiveAttempts"
```

---

### Task 3: Admin route — GET /api/exam-attempts/admin/live

**Files:**
- Modify: `server/routes/examAttemptRoutes.js`

**Interfaces:**
- Consumes: `ExamAttemptService.getLiveAttempts(adminId)` (Task 2), `requireAdmin` (`server/routes/middleware/auth.js`, pre-existing).
- Produces: `GET /api/exam-attempts/admin/live` → `{ success: true, attempts: LiveAttempt[] }`, consumed by Task 5's client wrapper.

- [ ] **Step 1: Add `requireAdmin` to this file's middleware import**

Replace:
```js
const { requireUser } = require('./middleware/auth.js');
```

With:
```js
const { requireUser, requireAdmin } = require('./middleware/auth.js');
```

- [ ] **Step 2: Add the route**

Replace:
```js
router.get('/admin/recent-activity', requireUser, async (req, res) => {
  try {
    console.log(`Getting recent activity for admin: ${req.user.email}`);
    
    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view recent activity'
      });
    }

    const recentActivity = await ExamAttemptService.getAdminRecentActivity(req.user._id);

    console.log(`Found ${recentActivity.length} recent activities for admin: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      recentActivity: recentActivity
    });
  } catch (error) {
    console.error(`Error getting recent activity for admin ${req.user.email}:`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

With:
```js
router.get('/admin/recent-activity', requireUser, async (req, res) => {
  try {
    console.log(`Getting recent activity for admin: ${req.user.email}`);
    
    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only admin users can view recent activity'
      });
    }

    const recentActivity = await ExamAttemptService.getAdminRecentActivity(req.user._id);

    console.log(`Found ${recentActivity.length} recent activities for admin: ${req.user.email}`);
    return res.status(200).json({
      success: true,
      recentActivity: recentActivity
    });
  } catch (error) {
    console.error(`Error getting recent activity for admin ${req.user.email}:`, error.message);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get all currently in-progress (live) exam attempts across every exam this admin owns
router.get('/admin/live', requireAdmin, async (req, res) => {
  try {
    const attempts = await ExamAttemptService.getLiveAttempts(req.user._id);
    return res.status(200).json({ success: true, attempts });
  } catch (error) {
    console.error(`Error getting live attempts for admin ${req.user.email}:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
});
```

- [ ] **Step 3: Verify syntax**

Run: `node --check server/routes/examAttemptRoutes.js`
Expected: no output, exit code 0.

- [ ] **Step 4: Verify live against a running server**

Start the backend dev server, then:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@yahoo.com","password":"password123"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.accessToken))")
curl -s http://localhost:3000/api/exam-attempts/admin/live -H "Authorization: Bearer $TOKEN"
```

Expected: `{"success":true,"attempts":[]}` (or a populated array if a real attempt happens to be in progress at test time). Also confirm a request with no `Authorization` header gets a 401, and a request with a student's token gets a 403 (from `requireAdmin`).

- [ ] **Step 5: Commit**

```bash
git add server/routes/examAttemptRoutes.js
git commit -m "feat(proctoring): add GET /api/exam-attempts/admin/live route"
```

---

### Task 4: Client socket singleton + AuthContext wiring + dev proxy

**Files:**
- Create: `client/src/lib/socket.ts`
- Modify: `client/src/contexts/AuthContext.tsx`
- Modify: `client/vite.config.ts`

**Interfaces:**
- Produces: `connectSocket(): Socket`, `disconnectSocket(): void`, `getSocket(): Socket | null` — consumed by Task 5's `LiveMonitoring.tsx` and by Parts 2/3 later.

- [ ] **Step 1: Install the client dependency**

Run (from `client/`): `npm install socket.io-client@^4.8.1`

- [ ] **Step 2: Create the socket singleton**

Create `client/src/lib/socket.ts`:

```ts
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function connectSocket(): Socket {
  if (socket) return socket
  socket = io({
    auth: (cb) => cb({ token: localStorage.getItem('accessToken') }),
  })
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}

export function getSocket(): Socket | null {
  return socket
}
```

`auth` is a **callback**, not a static object — Socket.IO re-invokes it on every (re)connect attempt, so a reconnect after the access token rotates (1-hour TTL) always sends the current `localStorage` value, not one captured at first connect. No URL argument is passed to `io()`, so it connects to the same origin the page loaded from, matching `client/src/api/api.ts`'s existing relative-URL convention.

- [ ] **Step 3: Wire connection lifecycle into `AuthContext.tsx`**

Replace:
```ts
import React, { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin, logout as apiLogout } from '@/api/auth'
import { getCurrentUser } from '@/api/users'
import { useToast } from '@/hooks/useToast'
```

With:
```ts
import React, { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin, logout as apiLogout } from '@/api/auth'
import { getCurrentUser } from '@/api/users'
import { useToast } from '@/hooks/useToast'
import { connectSocket, disconnectSocket } from '@/lib/socket'
```

Replace:
```ts
      if (token) {
        try {
          const response = await getCurrentUser()
          const userData = (response as any).data
          setUser(userData)
        } catch (error) {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
        }
      }
      setLoading(false)
```

With:
```ts
      if (token) {
        try {
          const response = await getCurrentUser()
          const userData = (response as any).data
          setUser(userData)
          connectSocket()
        } catch (error) {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
        }
      }
      setLoading(false)
```

Replace:
```ts
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      setUser(userData)

      toast({
        title: "Success",
        description: "Logged in successfully",
      })
```

With:
```ts
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      setUser(userData)
      connectSocket()

      toast({
        title: "Success",
        description: "Logged in successfully",
      })
```

Replace:
```ts
  const logout = () => {
    apiLogout()
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)
```

With:
```ts
  const logout = () => {
    apiLogout()
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)
    disconnectSocket()
```

- [ ] **Step 4: Add the dev-server WebSocket proxy**

Replace:
```ts
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/logs': {
        target: 'http://localhost:4444',
        changeOrigin: true,
      }
    },
```

With:
```ts
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
      '/logs': {
        target: 'http://localhost:4444',
        changeOrigin: true,
      }
    },
```

- [ ] **Step 5: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: matches the Task 0 baseline.

- [ ] **Step 6: Manually verify the connection**

With both dev servers running, log in as `admin@yahoo.com` / `password123`, open the browser DevTools Network tab, filter for `socket.io`, and confirm a connection is established (either a `101 Switching Protocols` WebSocket upgrade, or Socket.IO's polling fallback engaging cleanly — either is acceptable) with no `connect_error` in the console. Log out and confirm the connection closes.

- [ ] **Step 7: Commit**

```bash
git add client/package.json client/package-lock.json client/src/lib/socket.ts client/src/contexts/AuthContext.tsx client/vite.config.ts
git commit -m "feat(proctoring): add client Socket.IO singleton wired into auth lifecycle"
```

---

### Task 5: Live Monitoring admin page

**Files:**
- Modify: `client/src/api/examAttempts.ts`
- Create: `client/src/pages/admin/LiveMonitoring.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/lib/nav-config.ts`

**Interfaces:**
- Consumes: `GET /api/exam-attempts/admin/live` (Task 3), `getSocket()` (Task 4), events `attempt:started`/`attempt:activity`/`attempt:ended` (Task 2).

- [ ] **Step 1: Add the client API wrapper**

Append to the end of `client/src/api/examAttempts.ts` (after `getAttemptDetail`):

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

// Description: Get all currently in-progress exam attempts across every exam this admin owns
// Endpoint: GET /api/exam-attempts/admin/live
// Request: {}
// Response: { success: boolean, attempts: LiveAttempt[] }
export const getLiveAttempts = async () => {
  try {
    const response = await api.get('/api/exam-attempts/admin/live');
    return response.data;
  } catch (error: any) {
    console.error('Get live attempts error:', error);
    throw new Error(error?.response?.data?.error || error.message);
  }
};
```

- [ ] **Step 2: Create the Live Monitoring page**

Create `client/src/pages/admin/LiveMonitoring.tsx`:

```tsx
import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Activity, AlertTriangle } from "lucide-react"
import { getLiveAttempts, type LiveAttempt } from "@/api/examAttempts"
import { getSocket } from "@/lib/socket"
import { useToast } from "@/hooks/useToast"

interface AlertEntry {
  attemptId: string
  activity: string
  timestamp: string
}

function formatElapsed(startTime: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

export function LiveMonitoring() {
  const [attempts, setAttempts] = useState<LiveAttempt[]>([])
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set())
  const [alerts, setAlerts] = useState<AlertEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())
  const { toast } = useToast()
  const highlightTimers = useRef<{ [attemptId: string]: ReturnType<typeof setTimeout> }>({})

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const response = await getLiveAttempts()
        setAttempts((response as any).attempts)
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load live attempts",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAttempts()
  }, [toast])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleStarted = (payload: any) => {
      setAttempts(prev => [{
        _id: payload.attemptId,
        examId: payload.examId,
        examTitle: payload.examTitle,
        studentId: payload.studentId,
        studentName: payload.studentName,
        studentEmail: payload.studentEmail,
        startTime: payload.startTime,
        tabSwitches: 0,
        latestActivity: null,
        updatedAt: payload.startTime
      }, ...prev])
    }

    const handleActivity = (payload: any) => {
      setAttempts(prev => prev.map(a =>
        a._id === payload.attemptId
          ? { ...a, tabSwitches: payload.tabSwitches, latestActivity: { activity: payload.activity, timestamp: payload.timestamp } }
          : a
      ))

      setRecentlyUpdated(prev => new Set(prev).add(payload.attemptId))
      if (highlightTimers.current[payload.attemptId]) {
        clearTimeout(highlightTimers.current[payload.attemptId])
      }
      highlightTimers.current[payload.attemptId] = setTimeout(() => {
        setRecentlyUpdated(prev => {
          const next = new Set(prev)
          next.delete(payload.attemptId)
          return next
        })
      }, 2000)

      if (payload.isViolation) {
        setAlerts(prev => [
          { attemptId: payload.attemptId, activity: payload.activity, timestamp: payload.timestamp },
          ...prev
        ].slice(0, 20))
      }
    }

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

  if (loading) {
    return <LoadingState label="Loading live attempts..." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Live Monitoring</h1>
        <p className="text-muted-foreground">
          Exam attempts currently in progress
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Active Now ({attempts.length})
          </CardTitle>
          <CardDescription>
            Updates live as students start, interact with, and submit exams
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Elapsed</TableHead>
                    <TableHead>Tab Switches</TableHead>
                    <TableHead>Latest Activity</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((attempt) => (
                    <TableRow
                      key={attempt._id}
                      className={recentlyUpdated.has(attempt._id) ? "bg-muted/50 transition-colors" : "transition-colors"}
                    >
                      <TableCell>
                        <div className="font-medium">{attempt.studentName}</div>
                        <div className="text-sm text-muted-foreground">{attempt.studentEmail}</div>
                      </TableCell>
                      <TableCell>{attempt.examTitle}</TableCell>
                      <TableCell>{formatElapsed(attempt.startTime, now)}</TableCell>
                      <TableCell>{attempt.tabSwitches}</TableCell>
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No exams in progress" description="Students currently taking an exam will appear here in real time." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Recent Alerts
          </CardTitle>
          <CardDescription>Security-monitoring violations, newest first</CardDescription>
        </CardHeader>
        <CardContent>
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
            <p className="text-sm text-muted-foreground">No violations reported yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 3: Register the route**

Replace:
```tsx
import { AIChat } from "./pages/admin/AIChat"
```

With:
```tsx
import { AIChat } from "./pages/admin/AIChat"
import { LiveMonitoring } from "./pages/admin/LiveMonitoring"
```

Replace:
```tsx
            <Route path="admin/grading" element={<GradingQueue />} />
            <Route path="admin/grading/:attemptId" element={<GradeAttempt />} />
            <Route path="admin/reports" element={<Reports />} />
```

With:
```tsx
            <Route path="admin/grading" element={<GradingQueue />} />
            <Route path="admin/grading/:attemptId" element={<GradeAttempt />} />
            <Route path="admin/live-monitoring" element={<LiveMonitoring />} />
            <Route path="admin/reports" element={<Reports />} />
```

- [ ] **Step 4: Add the nav entry**

Replace:
```ts
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  BookOpen,
  ClipboardList,
  ClipboardCheck,
  TrendingUp,
  Bookmark,
  MessageSquare,
} from "lucide-react"
```

With:
```ts
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  BookOpen,
  ClipboardList,
  ClipboardCheck,
  TrendingUp,
  Bookmark,
  MessageSquare,
  Activity,
} from "lucide-react"
```

Replace:
```ts
  { title: "Grading", href: "/admin/grading", icon: ClipboardCheck },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
```

With:
```ts
  { title: "Grading", href: "/admin/grading", icon: ClipboardCheck },
  { title: "Live Monitoring", href: "/admin/live-monitoring", icon: Activity },
  { title: "Reports", href: "/admin/reports", icon: BarChart3 },
```

- [ ] **Step 5: Verify TypeScript compiles with no new errors**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: matches the Task 0 baseline.

- [ ] **Step 6: Commit**

```bash
git add client/src/api/examAttempts.ts client/src/pages/admin/LiveMonitoring.tsx client/src/App.tsx client/src/lib/nav-config.ts
git commit -m "feat(proctoring): add Live Monitoring admin page"
```

---

### Task 6: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Full backend syntax sweep**

Run: `node --check server/server.js && node --check server/sockets/socketManager.js && node --check server/sockets/authMiddleware.js && node --check server/sockets/connectionHandlers.js && node --check server/sockets/activityClassifier.js && node --check server/services/examAttemptService.js && node --check server/routes/examAttemptRoutes.js`
Expected: no output, exit code 0.

- [ ] **Step 2: Full frontend type check**

Run (from `client/`): `npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS"`
Expected: matches the Task 0 baseline.

- [ ] **Step 3: Live two-session walkthrough**

With both dev servers running:
1. Log in as `admin@yahoo.com` / `password123` in one browser context, navigate to Live Monitoring (new sidebar entry). Confirm the empty state shows if nothing is in progress.
2. Log in as a student in a second browser context (or incognito window) and start an exam attempt.
3. Confirm the row appears on the admin's Live Monitoring page **without a page refresh**, showing the correct student/exam/elapsed-time-ticking.
4. On the student side, trigger a tab switch (or any other monitored activity — switch browser tabs, press F12, etc.). Confirm the admin page's `Tab Switches`/`Latest Activity` update live, the row briefly highlights, and the event appears in the Recent Alerts panel.
5. Submit the exam attempt as the student. Confirm the row disappears from the admin's Live Monitoring page and a toast appears.

- [ ] **Step 4: Confirm no regression to the mobile exam flow**

Open `client/src/pages/student/MobileExamAttempt.tsx` in the browser (mobile viewport or `/student/exam/:id/mobile`), confirm it still works exactly as before with no new console errors — this task's only touch on the mobile flow is the app-wide socket connection opened in `AuthContext.tsx`, which should be inert here.

- [ ] **Step 5: Report results**

Summarize which of the Step 3 walkthrough items passed. Note any environment-specific issues (e.g., the dev proxy not carrying the WebSocket upgrade cleanly) and how they were resolved or worked around.

---

## Finishing

Once all 6 tasks are complete and verified, invoke `superpowers:finishing-a-development-branch` to merge this branch to `main`. This is Part 1 of 3 — after merging, create a new project memory (or update an existing one) tracking this initiative's progress, noting Part 1 complete and Parts 2 (screen recording + periodic live-view screenshots) and 3 (browser-based cheat-detection heuristics) as the next planned work, per `docs/superpowers/plans/2026-07-27-exam-proctoring-part1-realtime-foundation.md`'s own Context section.
