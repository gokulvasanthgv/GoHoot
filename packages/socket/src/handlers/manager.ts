import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { getGameConfig, saveGameConfig } from "@razzia/socket/services/config"
import manager, { emitConfig } from "@razzia/socket/services/manager"

export const managerSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.MANAGER.GET_CONFIG,
    manager.withAuth(socket, () => {
      emitConfig(socket)
    }),
  )

  socket.on(
    EVENTS.MANAGER.UPDATE_SETTINGS,
    manager.withAuth(socket, (settings: { defaultWallpaper?: string; defaultAudio?: string }) => {
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

  socket.on(EVENTS.MANAGER.LOGOUT, () => {
    manager.logout(socket)
  })

  socket.on(EVENTS.MANAGER.AUTH, (password) => {
    try {
      const config = getGameConfig()

      if (config.managerPassword === "PASSWORD") {
        socket.emit(
          EVENTS.MANAGER.ERROR_MESSAGE,
          "errors:manager.passwordNotConfigured",
        )

        return
      }

      if (password !== config.managerPassword) {
        socket.emit(
          EVENTS.MANAGER.ERROR_MESSAGE,
          "errors:manager.invalidPassword",
        )

        return
      }

      manager.login(socket)
      emitConfig(socket)
    } catch (error) {
      console.error("Failed to read game config:", error)
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:failedToReadConfig")
    }
  })
}
