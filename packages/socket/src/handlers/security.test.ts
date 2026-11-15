import { createAdaptorServer } from "@hono/node-server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  io as connectClient,
  type Socket as ClientSocket,
} from "socket.io-client"
import { app, createSocketServer } from "@razzia/socket/app"
import type { Quizz } from "@razzia/common/types/game"
import type {
  Server,
  ServerToClientEvents,
} from "@razzia/common/types/game/socket"
import { EVENTS } from "@razzia/common/constants"
import { STATUS } from "@razzia/common/types/game/status"
import type { SessionResponse } from "@razzia/common/types/auth"
import {
  mintJoinTicket,
  mintToken,
  newClientId,
} from "@razzia/socket/services/auth"
import {
  getQuizzById,
  getResultsMeta,
  saveQuizz,
} from "@razzia/socket/services/config"
import Registry from "@razzia/socket/services/registry"
import Game from "@razzia/socket/services/game"
import {
  account,
  cleanupConfig,
  quizData,
  setupConfig,
} from "@razzia/socket/test/fixtures"
import type { AddressInfo } from "node:net"

let fixture: Awaited<ReturnType<typeof setupConfig>>
let server: ReturnType<typeof createAdaptorServer>
let io: Server
let url: string
const clients: ClientSocket[] = []
const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
const event = <T = unknown>(
  socket: ClientSocket,
  name: string,
  accept: (_value: T) => boolean = () => true,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(name, handler)
      reject(new Error(`Timed out waiting for ${name}`))
    }, 5000)
    const handler = (value: T) => {
      if (accept(value)) {
        clearTimeout(timer)
        socket.off(name, handler)
        resolve(value)
      }
    }
    socket.on(name, handler)
  })
const status = (socket: ClientSocket, name: string) =>
  event<{ name: string; data: Record<string, unknown> }>(
    socket,
    EVENTS.GAME.STATUS,
    (value) => value.name === name,
  )
const connect = async (
  session?: SessionResponse,
  extra: Record<string, unknown> = {},
) => {
  const socket = connectClient(url, {
    path: "/ws",
    auth: { ...extra, ...(session ? { token: session.token } : {}) },
    transports: ["websocket"],
    reconnection: false,
    autoConnect: false,
  })
  clients.push(socket)
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve)
    socket.once("connect_error", reject)
    socket.connect()
  })

  return socket
}
beforeEach(async () => {
  fixture = await setupConfig()
  server = createAdaptorServer({ fetch: app.fetch })
  io = createSocketServer(server)
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterEach(async () => {
  cleanupConfig(fixture.directory)
  for (const client of clients.splice(0)) {
    client.disconnect()
  }
  await new Promise<void>((resolve) => {
    void io.close(() => resolve())
  })
})
const createGame = async (data: Quizz = quizData()) => {
  const host = await connect(fixture.session)
  const { id } = saveQuizz(data, fixture.admin.id)
  const hostSocket = io.sockets.sockets.get(host.id ?? "")

  if (!hostSocket) {
    throw new Error("Host socket is missing")
  }

  const game = new Game(io, hostSocket, getQuizzById(id), fixture.admin.id)
  Registry.getInstance().addGame(game)

  return { host, game }
}
const requestJoin = (game: Game, session: SessionResponse, username: string) =>
  fetch(`${url}/api/games/join`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inviteCode: game.inviteCode, username }),
  })

const join = async (
  game: Game,
  username: string,
  identity?: SessionResponse,
) => {
  const session = identity ?? (await mintToken(newClientId()))
  const response = await requestJoin(game, session, username)
  expect(response.status).toBe(200)
  const { ticket } = (await response.json()) as { ticket: string }
  const player = await connect(session)
  const joined = event<string>(player, EVENTS.GAME.SUCCESS_JOIN)
  player.emit(EVENTS.PLAYER.LOGIN, { ticket })
  expect(await joined).toBe(game.gameId)

  return { player, session }
}

const playerSnapshot = (player: ClientSocket, game: Game) => {
  type Snapshot = Parameters<
    ServerToClientEvents[typeof EVENTS.PLAYER.SUCCESS_RECONNECT]
  >[0]
  const snapshot = event<Snapshot>(player, EVENTS.PLAYER.SUCCESS_RECONNECT)
  player.emit(EVENTS.PLAYER.RECONNECT, { gameId: game.gameId })

  return snapshot
}

describe("socket authentication and authorization", () => {
  it("rejects unsigned client IDs, including an existing manager's ID", async () => {
    await expect(
      connect(undefined, { clientId: fixture.session.clientId }),
    ).rejects.toThrow("tokenMissing")
  })
  it("does not trust a claimed client ID alongside a valid guest token", async () => {
    const guest = await mintToken(newClientId())
    const socket = await connect(guest, { clientId: fixture.session.clientId })
    expect(io.sockets.sockets.get(socket.id ?? "")?.data.clientId).toBe(
      guest.clientId,
    )
  })
  it("rejects forged session tokens", async () => {
    await expect(
      connect({
        ...fixture.session,
        token: `${fixture.session.token.slice(0, -8)}forged!!`,
      }),
    ).rejects.toThrow("tokenInvalid")
  })
  it("binds a join ticket to the authenticated player's identity", async () => {
    const { game } = await createGame()
    const first = await mintToken(newClientId())
    const second = await mintToken(newClientId())
    const socket = await connect(second)
    const error = event<string>(socket, EVENTS.GAME.ERROR_MESSAGE)
    socket.emit(EVENTS.PLAYER.LOGIN, {
      ticket: await mintJoinTicket(first.clientId, game.gameId, "Player"),
    })
    expect(await error).toBe("errors:auth.unauthorized")
    expect(game.players).toHaveLength(0)
  })
  it("does not let a player start, advance, finish, or change another game", async () => {
    const { game } = await createGame()
    const { player } = await join(game, "Guest")
    for (const action of [
      EVENTS.MANAGER.START_GAME,
      EVENTS.MANAGER.SHOW_LEADERBOARD,
      EVENTS.MANAGER.NEXT_QUESTION,
      EVENTS.MANAGER.END_GAME,
      EVENTS.MANAGER.UPDATE_GAME_SETTINGS,
    ]) {
      const error = event<string>(player, EVENTS.GAME.ERROR_MESSAGE)
      player.emit(action, {
        gameId: game.gameId,
        wallpaper: "https://example.com/a.png",
      })
      expect(await error).toBe("errors:auth.unauthorized")
    }
    expect(game.started).toBe(false)
    expect(game.wallpaper).toBeUndefined()
  })
  it("ignores malformed packets without killing the server", async () => {
    const { host, game } = await createGame()
    for (const malformed of [
      null,
      {},
      { gameId: 44 },
      { gameId: game.gameId, index: -1 },
    ]) {
      const error = event<string>(host, EVENTS.GAME.ERROR_MESSAGE)
      host.emit(EVENTS.MANAGER.GO_TO_QUESTION, malformed)
      expect(await error).toBe("errors:invalidRequest")
    }
    expect((await fetch(`${url}/api/health`)).status).toBe(200)
  })
  it("rejects the legacy client-calculated solo result event", async () => {
    const host = await connect(fixture.session)
    const error = event<string>(host, EVENTS.GAME.ERROR_MESSAGE)
    host.emit(EVENTS.RESULTS.SAVE_SOLO, {
      id: "../../users",
      subject: "Forged",
      players: [{ points: 999999 }],
    })
    expect(await error).toBe("errors:invalidRequest")
    expect(getResultsMeta()).toHaveLength(0)
  })
})

describe("live game integrity and reconnection", () => {
  it("announces the multi-select rule before and during the answer phase", async () => {
    const quiz = quizData()
    quiz.questions[0].solutions = [0, 1]
    const { host, game } = await createGame(quiz)
    const { player } = await join(game, "Player")
    const prepared = status(player, STATUS.SHOW_PREPARED)
    const reading = status(player, STATUS.SHOW_QUESTION)
    const answering = status(player, STATUS.SELECT_ANSWER)
    host.emit(EVENTS.MANAGER.START_GAME, { gameId: game.gameId })
    expect((await prepared).data).toMatchObject({
      type: "quiz",
      multiSelect: true,
    })
    expect((await reading).data).toMatchObject({ multiSelect: true })
    expect((await answering).data).toMatchObject({ multiSelect: true })
  })
  it("allows a new account to join and answer on the current round's clock", async () => {
    const { host, game } = await createGame()
    const { player } = await join(game, "First")
    const lateAccount = await account("Late account", "quizzer")
    const answering = status(host, STATUS.SELECT_ANSWER)
    host.emit(EVENTS.MANAGER.START_GAME, {
      gameId: game.gameId,
      mode: "accuracy",
      options: { hideTextOnClient: true },
    })
    await answering

    const tick = event<number>(host, EVENTS.GAME.COOLDOWN, (time) => time < 120)
    await tick
    const count = event<number>(
      host,
      EVENTS.GAME.TOTAL_PLAYERS,
      (total) => total === 2,
    )
    const late = await join(game, "Late player", lateAccount.session)
    expect(await count).toBe(2)
    const snapshot = await playerSnapshot(late.player, game)
    expect(snapshot).toMatchObject({
      status: {
        name: STATUS.SELECT_ANSWER,
        data: { totalPlayer: 2, hideTextOnClient: true },
      },
      player: { username: "Late player", points: 0 },
      currentQuestion: { current: 1, total: 1 },
    })
    expect(snapshot.status.data).toHaveProperty("time", expect.any(Number))
    const { time } = snapshot.status.data as { time: number }
    expect(time).toBeGreaterThan(0)
    expect(time).toBeLessThan(120)

    const firstAnswered = status(player, STATUS.WAIT)
    player.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId: game.gameId,
      data: { answerKey: [0] },
    })
    await firstAnswered
    const result = status(late.player, STATUS.SHOW_RESULT)
    late.player.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId: game.gameId,
      data: { answerKey: [0] },
    })
    expect((await result).data).toMatchObject({ correct: true, myPoints: 1000 })
  })

  it("lets new players wait through results and join a slide, while a finished room is closed", async () => {
    const quiz = quizData()
    const { host, game } = await createGame({
      ...quiz,
      questions: [
        ...quiz.questions,
        {
          ...quiz.questions[0],
          type: "slide",
          question: "An information slide",
        },
      ],
    })
    const { player } = await join(game, "First")
    const answering = status(host, STATUS.SELECT_ANSWER)
    host.emit(EVENTS.MANAGER.START_GAME, { gameId: game.gameId })
    await answering
    const answersClosed = status(host, STATUS.SHOW_RESPONSES)
    player.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId: game.gameId,
      data: { answerKey: [0] },
    })
    await answersClosed
    const late = await join(game, "Second")
    expect(await playerSnapshot(late.player, game)).toMatchObject({
      status: {
        name: STATUS.WAIT,
        data: { text: "game:waitingForNextQuestion" },
      },
      player: { points: 0 },
    })

    const board = status(host, STATUS.SHOW_LEADERBOARD)
    host.emit(EVENTS.MANAGER.SHOW_LEADERBOARD, { gameId: game.gameId })
    await board
    expect((await playerSnapshot(late.player, game)).status.name).toBe(
      STATUS.WAIT,
    )
    const slide = status(late.player, STATUS.SHOW_SLIDE)
    host.emit(EVENTS.MANAGER.NEXT_QUESTION, { gameId: game.gameId })
    await slide
    const onSlide = await join(game, "Third")
    expect(await playerSnapshot(onSlide.player, game)).toMatchObject({
      status: {
        name: STATUS.SHOW_SLIDE,
        data: { question: "An information slide" },
      },
      currentQuestion: { current: 2, total: 2 },
    })

    const pendingSession = await mintToken(newClientId())
    const pendingJoin = await requestJoin(game, pendingSession, "Fourth")
    expect(pendingJoin.status).toBe(200)
    const { ticket } = (await pendingJoin.json()) as { ticket: string }
    const finished = status(host, STATUS.FINISHED)
    host.emit(EVENTS.MANAGER.NEXT_QUESTION, { gameId: game.gameId })
    await finished

    const closed = await requestJoin(game, pendingSession, "Fourth")
    expect(closed.status).toBe(409)
    expect(await closed.json()).toEqual({ error: "errors:game.expired" })
    const pendingPlayer = await connect(pendingSession)
    const error = event<string>(pendingPlayer, EVENTS.GAME.ERROR_MESSAGE)
    pendingPlayer.emit(EVENTS.PLAYER.LOGIN, { ticket })
    expect(await error).toBe("errors:game.expired")
    expect((await playerSnapshot(onSlide.player, game)).status.name).toBe(
      STATUS.FINISHED,
    )
    expect(game.players).toHaveLength(3)
  })

  it("does not count answers sent before the answer phase", async () => {
    const { host, game } = await createGame()
    const { player } = await join(game, "Player")
    player.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId: game.gameId,
      data: { answerKey: [0] },
    })
    const answering = status(host, STATUS.SELECT_ANSWER)
    host.emit(EVENTS.MANAGER.START_GAME, {
      gameId: game.gameId,
      mode: "accuracy",
    })
    await answering
    expect(game.players[0].points).toBe(0)
    const result = status(player, STATUS.SHOW_RESULT)
    player.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId: game.gameId,
      data: { answerKey: [1] },
    })
    expect((await result).data).toMatchObject({
      correct: false,
      myPoints: 0,
      streak: 0,
    })
  })
  it("rejects duplicate indices and still accepts the player's valid answer", async () => {
    const { host, game } = await createGame()
    const { player } = await join(game, "Player")
    const answering = status(host, STATUS.SELECT_ANSWER)
    host.emit(EVENTS.MANAGER.START_GAME, {
      gameId: game.gameId,
      mode: "accuracy",
    })
    await answering
    const error = event<string>(player, EVENTS.GAME.ERROR_MESSAGE)
    player.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId: game.gameId,
      data: { answerKey: [0, 0] },
    })
    expect(await error).toBe("errors:invalidRequest")
    const result = status(player, STATUS.SHOW_RESULT)
    player.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId: game.gameId,
      data: { answerKey: [0] },
    })
    expect((await result).data).toMatchObject({
      correct: true,
      points: 1000,
      myPoints: 1000,
      streak: 1,
    })
  })
  it("keeps an already submitted answer when the socket reconnects", async () => {
    const { host, game } = await createGame()
    const first = await join(game, "First")
    const second = await join(game, "Second")
    const answering = status(host, STATUS.SELECT_ANSWER)
    host.emit(EVENTS.MANAGER.START_GAME, {
      gameId: game.gameId,
      mode: "accuracy",
    })
    await answering
    const waiting = status(first.player, STATUS.WAIT)
    first.player.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId: game.gameId,
      data: { answerKey: [0] },
    })
    await waiting
    const replacement = await connect(first.session)
    const reconnected = event<{ status: { name: string } }>(
      replacement,
      EVENTS.PLAYER.SUCCESS_RECONNECT,
    )
    replacement.emit(EVENTS.PLAYER.RECONNECT, { gameId: game.gameId })
    expect((await reconnected).status.name).toBe(STATUS.WAIT)
    const result = status(replacement, STATUS.SHOW_RESULT)
    second.player.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId: game.gameId,
      data: { answerKey: [0] },
    })
    expect((await result).data).toMatchObject({
      correct: true,
      myPoints: 1000,
      streak: 1,
    })
  })
  it("retains disconnected lobby players and counts only connected players", async () => {
    const { game } = await createGame()
    const first = await join(game, "Player")
    first.player.disconnect()
    await sleep(20)
    expect(game.players).toHaveLength(1)
    expect(game.players[0].connected).toBe(false)
    const replacement = await connect(first.session)
    const reconnected = event(replacement, EVENTS.PLAYER.SUCCESS_RECONNECT)
    replacement.emit(EVENTS.PLAYER.RECONNECT, { gameId: game.gameId })
    await reconnected
    expect(game.players).toHaveLength(1)
    expect(game.players[0].connected).toBe(true)
  })
  it("finishes only once and exposes only names and points in the podium", async () => {
    const { host, game } = await createGame()
    const { player } = await join(game, "Player")
    const answering = status(host, STATUS.SELECT_ANSWER)
    host.emit(EVENTS.MANAGER.START_GAME, {
      gameId: game.gameId,
      mode: "accuracy",
    })
    await answering
    const responses = status(host, STATUS.SHOW_RESPONSES)
    player.emit(EVENTS.PLAYER.SELECTED_ANSWER, {
      gameId: game.gameId,
      data: { answerKey: [0] },
    })
    await responses
    const finished = status(player, STATUS.FINISHED)
    host.emit(EVENTS.MANAGER.SHOW_LEADERBOARD, { gameId: game.gameId })
    const top = (await finished).data.top as Array<Record<string, unknown>>
    expect(top).toEqual([{ username: "Player", points: 1000 }])
    expect(getResultsMeta()).toHaveLength(1)
    host.emit(EVENTS.MANAGER.END_GAME, { gameId: game.gameId })
    host.emit(EVENTS.MANAGER.SHOW_LEADERBOARD, { gameId: game.gameId })
    await sleep(20)
    expect(getResultsMeta()).toHaveLength(1)
  })
  it("stops pending timers when a game is removed", async () => {
    const { host, game } = await createGame()
    await join(game, "Player")
    const states: string[] = []
    host.on(EVENTS.GAME.STATUS, ({ name }: { name: string }) =>
      states.push(name),
    )
    host.emit(EVENTS.MANAGER.START_GAME, { gameId: game.gameId })
    await sleep(10)
    Registry.getInstance().removeGame(game.gameId)
    await sleep(200)
    expect(states).not.toContain(STATUS.SHOW_QUESTION)
    expect(states).not.toContain(STATUS.SELECT_ANSWER)
  })
})
