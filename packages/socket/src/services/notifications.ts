import { getIo } from "@razzia/socket/services/io"
import manager from "@razzia/socket/services/manager"
import UserService from "@razzia/socket/services/user"

export const notifyAdmins = (): void => {
  let io: ReturnType<typeof getIo> | undefined = undefined

  try {
    io = getIo()
  } catch {
    return
  }

  const requests = UserService.getForgotPasswordRequests()
  for (const socket of io.sockets.sockets.values()) {
    if (manager.getUser(socket)?.role === "admin") {
      socket.emit("manager:notifications", requests)
    }
  }
}

export const disconnectUserSessions = (
  userId: string,
  exceptSocketId?: string,
): void => {
  let io: ReturnType<typeof getIo> | undefined = undefined

  try {
    io = getIo()
  } catch {
    return
  }

  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.claims.userId === userId && socket.id !== exceptSocketId) {
      socket.emit("manager:currentUser", null)
      socket.emit("manager:unauthorized")
      socket.disconnect(true)
    }
  }
}
