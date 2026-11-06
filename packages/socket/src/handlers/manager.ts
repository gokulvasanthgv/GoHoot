import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { allowSignup } from "@razzia/socket/env"
import { getGameConfig, saveGameConfig } from "@razzia/socket/services/config"
import manager, { emitConfig } from "@razzia/socket/services/manager"
import { consumeLimit } from "@razzia/socket/services/rate-limit"
import UserService from "@razzia/socket/services/user"
import { withManagerGame } from "@razzia/socket/utils/game"
import {
  disconnectUserSessions,
  notifyAdmins,
} from "@razzia/socket/services/notifications"

// Compatibility for GoHoot's existing management UI. Both transports use the
// same signed session, payload validators, role checks, and storage services.
export const managerSocketHandlers = ({ socket }: SocketContext) => {
  const notify = notifyAdmins
  const isAdmin = () => manager.getUser(socket)?.role === "admin"
  const allowedAuth = (username = "") =>
    consumeLimit(
      `socket-auth:${socket.handshake.address}:${username.toLowerCase()}`,
      10,
      15 * 60_000,
    )
  const handleLogin = async (username: string, password: string) => {
    if (!allowedAuth(username)) {
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:auth.rateLimited")

      return
    }

    const result = await UserService.signIn(username, password)

    if (!result.success) {
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, result.error)

      return
    }

    await manager.login(socket, result.user)

    if (result.user.role === "admin") {
      socket.join("admins")
    }

    socket.emit(EVENTS.MANAGER.CURRENT_USER, result.user)
    emitConfig(socket)
  }
  socket.on(EVENTS.MANAGER.AUTH, (password) => {
    void handleLogin("admin", password).catch(() =>
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:api.serverError"),
    )
  })
  socket.on(EVENTS.MANAGER.SIGN_IN, ({ username, password }) => {
    void handleLogin(username, password).catch(() =>
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:api.serverError"),
    )
  })
  socket.on(EVENTS.MANAGER.SIGN_UP, ({ username, password }) => {
    void (async () => {
      if (!allowSignup || !allowedAuth(username)) {
        socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:auth.rateLimited")

        return
      }

      const result = await UserService.signUp(username, password)

      if (!result.success) {
        socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, result.error)

        return
      }

      await manager.login(socket, result.user)
      socket.emit(EVENTS.MANAGER.CURRENT_USER, result.user)
      emitConfig(socket)
    })().catch(() =>
      socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:api.serverError"),
    )
  })
  socket.on(EVENTS.MANAGER.GET_CURRENT_USER, () => {
    const user = manager.getUser(socket)

    if (user?.role === "admin") {
      socket.join("admins")
    }

    socket.emit(EVENTS.MANAGER.CURRENT_USER, user)
  })
  socket.on(
    EVENTS.MANAGER.GET_CONFIG,
    manager.withAuth(socket, () => emitConfig(socket)),
  )
  socket.on(
    EVENTS.MANAGER.GET_USERS,
    manager.withAuth(socket, () => {
      if (isAdmin()) {
        emitConfig(socket)
      } else {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)
      }
    }),
  )
  socket.on(EVENTS.MANAGER.LOGOUT, () => {
    void manager
      .logout(socket)
      .then(() => {
        socket.leave("admins")
        socket.emit(EVENTS.MANAGER.CURRENT_USER, null)
      })
      .catch(() => socket.emit(EVENTS.MANAGER.UNAUTHORIZED))
  })
  socket.on(
    EVENTS.MANAGER.UPDATE_SETTINGS,
    manager.withAuth(socket, (settings) => {
      if (!isAdmin()) {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

        return
      }

      saveGameConfig({ ...getGameConfig(), ...settings })
      emitConfig(socket)
    }),
  )
  socket.on(
    EVENTS.MANAGER.UPDATE_GAME_SETTINGS,
    ({ gameId, wallpaper, audio }) =>
      withManagerGame(gameId, socket, (game) =>
        game.updateSettings(wallpaper, audio),
      ),
  )
  socket.on(
    EVENTS.MANAGER.UPDATE_USER_ROLE,
    manager.withAuth(socket, ({ userId, role }) => {
      if (
        !isAdmin() ||
        userId === manager.getUser(socket)?.id ||
        !UserService.updateUserRole(userId, role)
      ) {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

        return
      }

      disconnectUserSessions(userId)
      emitConfig(socket)
    }),
  )
  socket.on(
    EVENTS.MANAGER.DELETE_USER,
    manager.withAuth(socket, (userId) => {
      if (
        !isAdmin() ||
        userId === manager.getUser(socket)?.id ||
        !UserService.deleteUser(userId)
      ) {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

        return
      }

      disconnectUserSessions(userId)
      emitConfig(socket)
    }),
  )
  socket.on(
    EVENTS.MANAGER.CHANGE_PASSWORD,
    manager.withAuth(socket, async ({ currentPassword, newPassword }) => {
      if (!allowedAuth()) {
        socket.emit("manager:passwordChanged", {
          success: false,
          error: "errors:auth.rateLimited",
        })

        return
      }

      const user = manager.getUser(socket)

      if (!user) {
        return
      }

      const result = await UserService.changePassword(
        user.id,
        currentPassword,
        newPassword,
      )

      if (result.success) {
        disconnectUserSessions(user.id, socket.id)
        await manager.login(socket, UserService.getUserById(user.id))
      }

      socket.emit("manager:passwordChanged", result)
    }),
  )
  socket.on(
    EVENTS.MANAGER.ADMIN_RESET_PASSWORD,
    manager.withAuth(socket, async ({ userId, newPassword }) => {
      if (!isAdmin()) {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

        return
      }

      const user = UserService.getUserById(userId)
      const current = manager.getUser(socket)

      if (!current) {
        return
      }

      if (
        !user ||
        !(await UserService.adminChangePassword(userId, newPassword))
      ) {
        socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:auth.userNotFound")

        return
      }

      disconnectUserSessions(userId, socket.id)

      if (userId === current.id) {
        await manager.login(socket, UserService.getUserById(userId))
      }

      for (const request of UserService.getForgotPasswordRequests()) {
        if (request.username.toLowerCase() === user.username.toLowerCase()) {
          UserService.dismissPasswordReset(request.id)
        }
      }
      notify()
      emitConfig(socket)
      socket.emit("manager:adminPasswordResetSuccess")
    }),
  )
  socket.on(EVENTS.MANAGER.FORGOT_PASSWORD, ({ username }) => {
    if (!allowedAuth(username)) {
      socket.emit("manager:forgotPasswordSuccess", {
        success: false,
        error: "errors:auth.rateLimited",
      })

      return
    }

    UserService.requestPasswordReset(username)
    notify()
    socket.emit("manager:forgotPasswordSuccess", { success: true })
  })
  socket.on(
    EVENTS.MANAGER.DISMISS_NOTIFICATION,
    manager.withAuth(socket, ({ requestId }) => {
      if (!isAdmin()) {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

        return
      }

      UserService.dismissPasswordReset(requestId)
      notify()
      emitConfig(socket)
    }),
  )
}
