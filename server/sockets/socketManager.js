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
