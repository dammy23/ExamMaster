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
