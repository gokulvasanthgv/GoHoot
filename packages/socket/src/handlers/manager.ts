import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { getGameConfig, saveGameConfig, getQuizzMeta, getResultsMeta, getTrashQuizzesMeta } from "@razzia/socket/services/config"
import manager, { emitConfig } from "@razzia/socket/services/manager"
import Registry from "@razzia/socket/services/registry"
import UserService from "@razzia/socket/services/user"

export const managerSocketHandlers = ({ socket }: SocketContext) => {
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
    manager.logout(socket)
    socket.emit(EVENTS.MANAGER.CURRENT_USER, null)
  })

  socket.on(EVENTS.MANAGER.AUTH, (password) => {
    try {
      const result = UserService.signIn("admin", password)
      if (result.success && result.user) {
        manager.login(socket, result.user)
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
      socket.emit(EVENTS.MANAGER.CURRENT_USER, result.user)
      emitConfig(socket)
    } else {
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, result.error || "errors:manager.invalidPassword")
    }
  })

  socket.on(EVENTS.MANAGER.GET_CURRENT_USER, () => {
    const user = manager.getUser(socket)
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
}
