import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { getGameConfig, saveGameConfig, getQuizzMeta, getResultsMeta, getTrashQuizzesMeta } from "@razzia/socket/services/config"
import manager, { emitConfig } from "@razzia/socket/services/manager"
import Registry from "@razzia/socket/services/registry"
import UserService from "@razzia/socket/services/user"

export const managerSocketHandlers = ({ io, socket }: SocketContext) => {
  const registry = Registry.getInstance()

  socket.on(
    EVENTS.MANAGER.GET_CONFIG,
    manager.withAuth(socket, () => {
      emitConfig(socket)
    }),
  )

  socket.on(
    EVENTS.MANAGER.UPDATE_SETTINGS,
    manager.withAuth(socket, (settings: { defaultWallpaper?: string; defaultAudio?: string }) => {
      const user = manager.getUser(socket)
      if (!user || user.role !== "admin") {
        socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:unauthorized")
        return
      }

      try {
        const config = getGameConfig()
        config.defaultWallpaper = settings.defaultWallpaper
        config.defaultAudio = settings.defaultAudio
        saveGameConfig(config)
        emitConfig(socket)
      } catch (err) {
        console.error("Failed to update settings:", err)
        socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:failedToSaveSettings")
      }
    }),
  )

  socket.on(
    EVENTS.MANAGER.UPDATE_GAME_SETTINGS,
    manager.withAuth(socket, ({ gameId, wallpaper, audio }: { gameId: string; wallpaper?: string; audio?: string }) => {
      registry.getGameById(gameId)?.updateSettings(wallpaper, audio)
    }),
  )

  socket.on(EVENTS.MANAGER.LOGOUT, () => {
    socket.leave("admins")
    manager.logout(socket)
    socket.emit(EVENTS.MANAGER.CURRENT_USER, null)
  })

  socket.on(EVENTS.MANAGER.AUTH, (password) => {
    try {
      const result = UserService.signIn("admin", password)
      if (result.success && result.user) {
        manager.login(socket, result.user)
        if (result.user.role === "admin") {
          socket.join("admins")
        }
        socket.emit(EVENTS.MANAGER.CURRENT_USER, result.user)
        emitConfig(socket)
      } else {
        socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:manager.invalidPassword")
      }
    } catch (error) {
      console.error("Failed legacy auth:", error)
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:failedToReadConfig")
    }
  })

  socket.on(EVENTS.MANAGER.SIGN_UP, ({ username, password }) => {
    const result = UserService.signUp(username, password)
    if (result.success && result.user) {
      manager.login(socket, result.user)
      if (result.user.role === "admin") {
        socket.join("admins")
      }
      socket.emit(EVENTS.MANAGER.CURRENT_USER, result.user)
      emitConfig(socket)
    } else {
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, result.error || "errors:auth.signupFailed")
    }
  })

  socket.on(EVENTS.MANAGER.SIGN_IN, ({ username, password }) => {
    const result = UserService.signIn(username, password)
    if (result.success && result.user) {
      manager.login(socket, result.user)
      if (result.user.role === "admin") {
        socket.join("admins")
      }
      socket.emit(EVENTS.MANAGER.CURRENT_USER, result.user)
      emitConfig(socket)
    } else {
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, result.error || "errors:manager.invalidPassword")
    }
  })

  socket.on(EVENTS.MANAGER.GET_CURRENT_USER, () => {
    const user = manager.getUser(socket)
    if (user && user.role === "admin") {
      socket.join("admins")
    }
    socket.emit(EVENTS.MANAGER.CURRENT_USER, user || null)
  })

  socket.on(EVENTS.MANAGER.GET_USERS, () => {
    const user = manager.getUser(socket)
    if (user && user.role === "admin") {
      emitConfig(socket)
    } else {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)
    }
  })

  socket.on(EVENTS.MANAGER.UPDATE_USER_ROLE, ({ userId, role }) => {
    const user = manager.getUser(socket)
    if (user && user.role === "admin") {
      UserService.updateUserRole(userId, role)
      emitConfig(socket)
    } else {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)
    }
  })

  socket.on(EVENTS.MANAGER.DELETE_USER, (userId) => {
    const user = manager.getUser(socket)
    if (user && user.role === "admin") {
      UserService.deleteUser(userId)
      emitConfig(socket)
    } else {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)
    }
  })

  socket.on(EVENTS.MANAGER.CHANGE_PASSWORD, manager.withAuth(socket, ({ currentPassword, newPassword }) => {
    const user = manager.getUser(socket)
    if (!user) return
    const res = UserService.changePassword(user.id, currentPassword, newPassword)
    if (res.success) {
      socket.emit(EVENTS.MANAGER.CURRENT_USER, manager.getUser(socket))
      socket.emit("manager:passwordChanged", { success: true })
    } else {
      socket.emit("manager:passwordChanged", { success: false, error: res.error })
    }
  }))

  socket.on(EVENTS.MANAGER.ADMIN_RESET_PASSWORD, manager.withAuth(socket, ({ userId, newPassword }) => {
    const user = manager.getUser(socket)
    if (!user || user.role !== "admin") {
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:unauthorized")
      return
    }
    const targetUser = UserService.getUserById(userId)
    const success = UserService.adminChangePassword(userId, newPassword)
    if (success) {
      if (targetUser) {
        const reqs = UserService.getForgotPasswordRequests()
        const targetReq = reqs.find((r: any) => r.username.toLowerCase() === targetUser.username.toLowerCase())
        if (targetReq) {
          UserService.dismissPasswordReset(targetReq.id)
        }
      }
      io.to("admins").emit("manager:notifications", UserService.getForgotPasswordRequests())
      emitConfig(socket)
      socket.emit("manager:adminPasswordResetSuccess")
    }
  }))

  socket.on(EVENTS.MANAGER.FORGOT_PASSWORD, ({ username }) => {
    const res = UserService.requestPasswordReset(username)
    if (res.success) {
      io.to("admins").emit("manager:notifications", UserService.getForgotPasswordRequests())
      socket.emit("manager:forgotPasswordSuccess", { success: true })
    } else {
      socket.emit("manager:forgotPasswordSuccess", { success: false, error: res.error })
    }
  })

  socket.on(EVENTS.MANAGER.DISMISS_NOTIFICATION, manager.withAuth(socket, ({ requestId }) => {
    const user = manager.getUser(socket)
    if (!user || user.role !== "admin") {
      socket.emit(EVENTS.MANAGER.UNAUTHORIZED)
      return
    }
    UserService.dismissPasswordReset(requestId)
    io.to("admins").emit("manager:notifications", UserService.getForgotPasswordRequests())
    emitConfig(socket)
  }))
}
