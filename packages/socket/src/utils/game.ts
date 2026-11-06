import type { Socket } from "@razzia/common/types/game/socket"
import Game from "@razzia/socket/services/game"
import Registry from "@razzia/socket/services/registry"
import { nanoid } from "nanoid"
import manager from "@razzia/socket/services/manager"
import { randomInt } from "node:crypto"

export const withGame = (
  gameId: string | undefined,
  socket: Socket,
  callback: (_game: Game) => void | Promise<void>,
): void => {
  if (!gameId) {
    socket.emit("game:errorMessage", "errors:game.notFound")

    return
  }

  const registry = Registry.getInstance()
  const game = registry.getGameById(gameId)

  if (!game) {
    socket.emit("game:errorMessage", "errors:game.notFound")

    return
  }

  Promise.resolve()
    .then(() => callback(game))
    .catch((error: unknown) => {
      console.error("Game action failed:", error)
      socket.emit("game:errorMessage", "errors:api.serverError")
    })
}

export const withManagerGame = (
  gameId: string | undefined,
  socket: Socket,
  callback: (_game: Game) => void | Promise<void>,
): void =>
  withGame(gameId, socket, (game) => {
    const user = manager.getUser(socket)

    if (
      !user ||
      (user.role !== "admin" && user.role !== "quizmaster") ||
      user.id !== game.creatorId ||
      game.manager.clientId !== socket.data.clientId ||
      game.manager.id !== socket.id
    ) {
      socket.emit("game:errorMessage", "errors:auth.unauthorized")

      return
    }

    return callback(game)
  })

export const withPlayerGame = (
  gameId: string | undefined,
  socket: Socket,
  callback: (_game: Game) => void | Promise<void>,
): void =>
  withGame(gameId, socket, (game) => {
    if (
      !game.players.some(
        (player) =>
          player.id === socket.id &&
          player.clientId === socket.data.clientId &&
          player.connected,
      )
    ) {
      socket.emit("game:errorMessage", "errors:auth.unauthorized")

      return
    }

    return callback(game)
  })

export const createInviteCode = (length = 6) => {
  let result = ""
  const characters = "0123456789"
  const charactersLength = characters.length

  for (let i = 0; i < length; i += 1) {
    const randomIndex = randomInt(charactersLength)
    result += characters.charAt(randomIndex)
  }

  return result
}

export const normalizeFilename = (subject: string) => {
  const slug = subject
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/gu, "-")
    .replace(/[^a-z0-9-]/gu, "")
    .slice(0, 10)

  const shortId = nanoid(8)

  return `${slug}-${shortId}`
}

export const timeToPoint = (startTime: number, secondes: number): number => {
  let points = 1000

  const actualTime = Date.now()
  const tempsPasseEnSecondes = (actualTime - startTime) / 1000

  points -= (1000 / secondes) * tempsPasseEnSecondes
  points = Math.max(0, points)

  return points
}
