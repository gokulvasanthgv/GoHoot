import { EVENTS } from "@razzia/common/constants"
import { inviteCodeValidator } from "@razzia/common/validators/auth"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { getQuizz } from "@razzia/socket/services/config"
import Game from "@razzia/socket/services/game"
import Registry from "@razzia/socket/services/registry"
import { withGame } from "@razzia/socket/utils/game"
import manager from "@razzia/socket/services/manager"

export const gameSocketHandlers = ({ io, socket }: SocketContext) => {
  const registry = Registry.getInstance()
  const clientId = socket.handshake.auth.clientId as string

  const handleManagerLeave = (game: Game) => {
    game.setManagerDisconnected()
    registry.markGameAsEmpty(game)

    if (!game.started) {
      game.abortCooldown()
      io.to(game.gameId).emit(
        EVENTS.GAME.RESET,
        "errors:game.managerDisconnected",
      )
      registry.removeGame(game.gameId)
    }
  }

  const handlePlayerLeave = (game: Game) => {
    if (!game.started) {
      const player = game.removePlayer(socket.id)

      if (player) {
        console.log(`Player ${player.username} left game ${game.gameId}`)
      }

      return
    }

    game.setPlayerDisconnected(socket.id)
  }

  socket.on(EVENTS.PLAYER.RECONNECT, ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "errors:game.notFound")
  })

  socket.on(EVENTS.MANAGER.RECONNECT, ({ gameId }) => {
    const game = registry.getManagerGame(gameId, clientId)

    if (game) {
      game.reconnect(socket)

      return
    }

    socket.emit(EVENTS.GAME.RESET, "errors:game.expired")
  })

  socket.on(EVENTS.GAME.CREATE, (quizzId) => {
    const user = manager.getUser(socket)
    if (!user || (user.role !== "admin" && user.role !== "quizmaster")) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:unauthorized")
      return
    }

    const quizzList = getQuizz()
    const quizz = quizzList.find((q) => q.id === quizzId)

    if (!quizz) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:quizz.notFound")

      return
    }

    if (user.role === "quizmaster" && quizz.creatorId !== user.id) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:unauthorized")
      return
    }

    const game = new Game(io, socket, quizz, user.id)
    registry.addGame(game)
  })

  socket.on(EVENTS.PLAYER.JOIN, (inviteCode) => {
    const result = inviteCodeValidator.safeParse(inviteCode)

    if (result.error) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, result.error.issues[0].message)

      return
    }

    const game = registry.getGameByInviteCode(inviteCode)

    if (!game) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.notFound")

      return
    }

    const existingPlayer = game.players.find((p) => p.clientId === clientId)
    if (existingPlayer) {
      socket.emit(EVENTS.GAME.SUCCESS_ROOM, {
        gameId: game.gameId,
        alreadyJoined: true,
        username: existingPlayer.username,
      })

      return
    }

    socket.emit(EVENTS.GAME.SUCCESS_ROOM, {
      gameId: game.gameId,
      alreadyJoined: false,
    })
  })

  socket.on(EVENTS.PLAYER.LOGIN, ({ gameId, data }) =>
    withGame(gameId, socket, (game) => game.join(socket, data.username)),
  )

  socket.on(EVENTS.MANAGER.KICK_PLAYER, ({ gameId, playerId }) =>
    withGame(gameId, socket, (game) => game.kickPlayer(socket, playerId)),
  )

  socket.on(EVENTS.MANAGER.START_GAME, ({ gameId, mode, options }) =>
    withGame(gameId, socket, (game) => game.start(socket, mode, options)),
  )

  socket.on(EVENTS.PLAYER.SELECTED_ANSWER, ({ gameId, data }) =>
    withGame(gameId, socket, (game) => {
      const keys = Array.isArray(data.answerKey)
        ? data.answerKey
        : typeof data.answerKey === "number"
          ? [data.answerKey]
          : []
      game.selectAnswer(socket, keys)
    }),
  )

  socket.on(EVENTS.MANAGER.ABORT_QUIZ, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.abortRound(socket)),
  )

  socket.on(EVENTS.MANAGER.NEXT_QUESTION, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.nextRound(socket)),
  )

  socket.on(EVENTS.MANAGER.SHOW_LEADERBOARD, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.showLeaderboard()),
  )

  socket.on(EVENTS.MANAGER.GO_TO_QUESTION, ({ gameId, index }) =>
    withGame(gameId, socket, (game) => game.goToQuestion(socket, index)),
  )

  socket.on(EVENTS.MANAGER.END_GAME, ({ gameId }) =>
    withGame(gameId, socket, (game) => game.endGame(socket)),
  )

  socket.on(EVENTS.MANAGER.LEAVE, ({ gameId }) => {
    const game = registry.getManagerGame(gameId, clientId)

    if (game) {
      console.log(`Manager left game ${game.inviteCode}`)
      handleManagerLeave(game)
    }
  })

  socket.on(EVENTS.PLAYER.LEAVE, ({ gameId }) => {
    const game = registry.getPlayerGame(gameId, clientId)

    if (game) {
      handlePlayerLeave(game)
    }
  })

  socket.on("disconnect", () => {
    console.log(`A user disconnected : ${socket.id}`)

    const managerGame = registry.getGameByManagerSocketId(socket.id)

    if (managerGame) {
      console.log(`Manager disconnected from game ${managerGame.inviteCode}`)
      handleManagerLeave(managerGame)

      return
    }

    const playerGame = registry.getGameByPlayerSocketId(socket.id)

    if (playerGame) {
      handlePlayerLeave(playerGame)
    }
  })
}
