import { EVENTS } from "@razzia/common/constants"
import type { Socket } from "@razzia/common/types/game/socket"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { getQuizzMeta, getResultsMeta, getGameConfig, getTrashQuizzesMeta } from "@razzia/socket/services/config"
import UserService from "./user"

const getClientId = (socket: SocketContext["socket"]) =>
  socket.handshake.auth.clientId as string

export const emitConfig = (socket: SocketContext["socket"]) => {
  const gameConfig = getGameConfig()
  const user = manager.getUser(socket)
  if (!user) {
    socket.emit(EVENTS.MANAGER.UNAUTHORIZED)
    return
  }

  let quizz: any[] = []
  let results: any[] = []
  let trash: any[] = []
  let users: any[] = []

  if (user.role === "admin") {
    quizz = getQuizzMeta()
    results = getResultsMeta()
    trash = getTrashQuizzesMeta()
    users = UserService.getAllUsers()
  } else if (user.role === "quizmaster") {
    quizz = getQuizzMeta().filter(q => q.creatorId === user.id)
    results = getResultsMeta().filter(r => r.creatorId === user.id)
    trash = getTrashQuizzesMeta().filter(q => q.creatorId === user.id && (Date.now() - new Date(q.deletedAt!).getTime()) <= 90 * 24 * 60 * 60 * 1000)
  } else if (user.role === "analyst") {
    results = getResultsMeta()
  }

  socket.emit(EVENTS.MANAGER.CONFIG, {
    quizz,
    results,
    trash,
    users,
    defaultWallpaper: gameConfig.defaultWallpaper,
    defaultAudio: gameConfig.defaultAudio,
    user
  })
}

class Manager {
  private loggedClients = new Map<string, any>()

  isLogged(socket: Socket) {
    return this.loggedClients.has(getClientId(socket))
  }

  isLoggedClientId(clientId: string) {
    return this.loggedClients.has(clientId)
  }

  getUser(socket: Socket) {
    return this.loggedClients.get(getClientId(socket))
  }

  getUserByClientId(clientId: string) {
    return this.loggedClients.get(clientId)
  }

  login(socket: Socket, user: any) {
    this.loggedClients.set(getClientId(socket), user)
  }

  logout(socket: Socket) {
    this.loggedClients.delete(getClientId(socket))
  }

  withAuth<T extends unknown[]>(
    socket: Socket,
    handler: (..._args: T) => void,
  ) {
    return (..._args: T) => {
      if (!this.isLogged(socket)) {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)

        return
      }

      handler(..._args)
    }
  }
}

const manager = new Manager()
export default manager
