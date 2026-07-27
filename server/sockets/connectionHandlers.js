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
