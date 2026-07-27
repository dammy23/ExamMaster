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
