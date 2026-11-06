import { EVENTS } from "@razzia/common/constants"
import type { PublicUser } from "@razzia/common/types/auth"
import type { Socket } from "@razzia/common/types/game/socket"
import type { ManagerConfig } from "@razzia/common/types/manager"
import {
  isClaimsActive,
  mintToken,
  revokeToken,
  verifyToken,
} from "@razzia/socket/services/auth"
import {
  getQuizzMeta,
  getResultsMeta,
  getGameConfig,
  getTrashQuizzesMeta,
} from "@razzia/socket/services/config"
import UserService from "@razzia/socket/services/user"

export const getManagerConfig = (user: PublicUser): ManagerConfig => {
  const settings = getGameConfig()
  const config: ManagerConfig = {
    quizz: [],
    results: [],
    trash: [],
    users: [],
    notifications: [],
    ...settings,
    user,
  }

  if (user.role === "admin") {
    config.quizz = getQuizzMeta()
    config.results = getResultsMeta()
    config.trash = getTrashQuizzesMeta()
    config.users = UserService.getAllUsers()
    config.notifications = UserService.getForgotPasswordRequests()
  } else if (user.role === "quizmaster") {
    config.quizz = getQuizzMeta().filter((quiz) => quiz.creatorId === user.id)
    config.results = getResultsMeta().filter(
      (result) => result.creatorId === user.id,
    )
    config.trash = getTrashQuizzesMeta().filter(
      (quiz) =>
        quiz.creatorId === user.id &&
        Date.now() - new Date(quiz.deletedAt ?? "").getTime() <=
          90 * 24 * 60 * 60_000,
    )
  } else if (user.role === "analyst") {
    config.results = getResultsMeta()
  }

  return config
}

class Manager {
  async login(socket: Socket, user: PublicUser | null): Promise<void> {
    const previous = socket.data.claims
    const session = await mintToken(socket.data.clientId, user)

    revokeToken(previous)

    socket.data.claims = await verifyToken(session.token)
    socket.emit(EVENTS.MANAGER.SESSION, session)
  }
  async logout(socket: Socket): Promise<void> {
    await this.login(socket, null)
  }
  getUser(socket: Socket): PublicUser | null {
    const { claims } = socket.data

    return isClaimsActive(claims) && claims.userId
      ? UserService.getUserById(claims.userId)
      : null
  }
  isLogged(socket: Socket): boolean {
    return this.getUser(socket) !== null
  }
  withAuth<T extends unknown[]>(
    socket: Socket,
    handler: (...args: T) => void | Promise<void>,
  ) {
    return (...args: T): void => {
      if (!this.getUser(socket)) {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

        return
      }

      Promise.resolve()
        .then(() => handler(...args))
        .catch((error: unknown) => {
          console.error("Authenticated socket handler failed:", error)
          socket.emit(EVENTS.MANAGER.ERROR_MESSAGE, "errors:api.serverError")
        })
    }
  }
}

const manager = new Manager()

export const emitConfig = (socket: Socket): void => {
  const user = manager.getUser(socket)

  if (!user) {
    socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

    return
  }

  socket.emit(EVENTS.MANAGER.CONFIG, getManagerConfig(user))
}

export default manager
