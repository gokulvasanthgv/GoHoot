import { EVENTS, MEDIA_TYPES } from "@razzia/common/constants"
import type {
  GameResult,
  Player,
  PodiumPlayer,
  Question,
  QuestionResult,
  Quizz,
} from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import {
  STATUS,
  type Status,
  type StatusDataMap,
} from "@razzia/common/types/game/status"
import type { CooldownTimer } from "@razzia/socket/services/game/cooldown-timer"
import type { PlayerManager } from "@razzia/socket/services/game/player-manager"
import { scoreAnswer } from "@razzia/socket/services/scoring/choice"
import { gameSpeed } from "@razzia/socket/env"
import { randomInt, randomUUID } from "node:crypto"

type Phase =
  | "lobby"
  | "starting"
  | "prepared"
  | "question"
  | "answer"
  | "responses"
  | "leaderboard"
  | "slide"
  | "finished"
type SendFn = <T extends Status>(
  _target: string,
  _status: T,
  _data: StatusDataMap[T],
) => void
type BroadcastFn = <T extends Status>(
  _status: T,
  _data: StatusDataMap[T],
) => void
interface GameOptions {
  shuffleQuestions?: boolean
  doubleTime?: boolean
  shuffleAnswers?: boolean
  hideTextOnClient?: boolean
}
interface CachedRound {
  question: QuestionResult
  responses: Record<number, number>
  results: Map<string, { correct: boolean; points: number }>
}

export interface RoundManagerOptions {
  quizz: Quizz
  players: PlayerManager
  cooldown: CooldownTimer
  io: Server
  gameId: string
  getManagerId: () => string
  broadcast: BroadcastFn
  send: SendFn
  onNewQuestion: () => void
  onGameFinished: (_result: GameResult) => void
}

const shuffled = <T>(values: T[]): T[] => {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1)
    ;[result[index], result[other]] = [result[other], result[index]]
  }

  return result
}

export class RoundManager {
  private readonly opts: RoundManagerOptions
  private phase: Phase = "lobby"
  private currentQuestion = 0
  private questions: Question[]
  private mode: "classic" | "accuracy" = "classic"
  private options: GameOptions = {}
  private run = 0
  private maxQuestionReached = 0
  private startTime = 0
  private acceptingAnswers = false
  private submissions = new Map<
    string,
    { answerIds: number[]; basePoints: number }
  >()
  private history = new Map<number, CachedRound>()
  private puzzleMap: number[] | undefined
  private oldLeaderboard: Player[] = []
  constructor(opts: RoundManagerOptions) {
    this.opts = opts
    this.questions = structuredClone(opts.quizz.questions)
  }
  isStarted(): boolean {
    return this.phase !== "lobby" && this.phase !== "finished"
  }
  hasFinished(): boolean {
    return this.phase === "finished"
  }
  getReconnectInfo() {
    return { current: this.currentQuestion + 1, total: this.questions.length }
  }
  getReconnectStatus(status: { name: Status; data: StatusDataMap[Status] }): {
    name: Status
    data: StatusDataMap[Status]
  } {
    if (status.name === STATUS.SELECT_ANSWER && this.phase === "answer") {
      return {
        ...status,
        data: { ...status.data, time: this.opts.cooldown.remaining() },
      }
    }

    if (status.name === STATUS.SHOW_QUESTION && this.phase === "question") {
      return {
        ...status,
        data: { ...status.data, cooldown: this.opts.cooldown.remaining() },
      }
    }

    return status
  }
  dispose(): void {
    this.run += 1
    this.phase = "finished"
    this.acceptingAnswers = false
    this.opts.cooldown.abort()
  }
  private valid(run: number): boolean {
    return run === this.run && this.isStarted()
  }
  private players(): Player[] {
    return [...this.opts.players.getAll()].sort((a, b) => b.points - a.points)
  }
  private rank(player: Player, players = this.players()): number {
    return this.mode === "accuracy"
      ? [...new Set(players.map((item) => item.points))].indexOf(
          player.points,
        ) + 1
      : players.findIndex((item) => item.clientId === player.clientId) + 1
  }
  private sendResult(
    player: Player,
    result: { correct: boolean; points: number },
  ): void {
    const players = this.players()
    const index = players.findIndex((item) => item.clientId === player.clientId)
    const ahead =
      index > 0 && players[index - 1].points > player.points
        ? players[index - 1].username
        : null
    this.opts.send(player.id, STATUS.SHOW_RESULT, {
      ...result,
      message: result.correct ? "game:correct" : "game:wrong",
      myPoints: player.points,
      rank: this.rank(player, players),
      aheadOfMe: ahead,
    })
  }
  async start(
    socket: Socket,
    mode: "classic" | "accuracy" = "classic",
    options: GameOptions = {},
  ): Promise<void> {
    if (socket.id !== this.opts.getManagerId() || this.phase !== "lobby") {
      return
    }

    this.opts.players.removeDisconnected()

    if (!this.opts.players.count()) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.noPlayersConnected")

      return
    }

    this.mode = mode
    this.options = options

    if (options.shuffleAnswers) {
      this.questions = this.questions.map((question) => {
        if (
          !question.answers ||
          question.type === "slide" ||
          question.type === "puzzle" ||
          question.type === "true_or_false"
        ) {
          return question
        }

        const order = shuffled(question.answers.map((_, index) => index))

        return {
          ...question,
          answers: order.map((index) => (question.answers ?? [])[index]),
          solutions: (question.solutions ?? []).map((index) =>
            order.indexOf(index),
          ),
        }
      })
    }

    if (options.shuffleQuestions) {
      this.questions = shuffled(this.questions)
    }

    this.phase = "starting"
    this.run += 1
    const { run } = this
    this.opts.broadcast(STATUS.SHOW_START, {
      time: 3,
      subject: this.opts.quizz.subject,
    })
    await this.opts.cooldown.start(3, false)

    if (!this.valid(run)) {
      return
    }

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.START_COOLDOWN)
    await this.opts.cooldown.start(3)

    if (!this.valid(run)) {
      return
    }

    await this.newQuestion()
  }
  private async newQuestion(): Promise<void> {
    this.run += 1
    const { run } = this
    this.opts.cooldown.abort()
    this.acceptingAnswers = false
    this.submissions.clear()
    const question = this.questions.at(this.currentQuestion)

    if (!question) {
      this.finish()

      return
    }

    this.maxQuestionReached = Math.max(
      this.maxQuestionReached,
      this.currentQuestion,
    )
    this.opts.onNewQuestion()
    this.opts.io
      .to(this.opts.gameId)
      .emit(EVENTS.GAME.UPDATE_QUESTION, this.getReconnectInfo())

    if (question.type === "slide") {
      this.phase = "slide"
      this.opts.broadcast(STATUS.SHOW_SLIDE, {
        question: question.question,
        text: question.text ?? "",
        media: question.media,
      })

      if (!this.history.has(this.currentQuestion)) {
        this.history.set(this.currentQuestion, {
          question: { ...question, playerAnswers: [] },
          responses: {},
          results: new Map(),
        })
      }

      return
    }

    const previous = this.history.get(this.currentQuestion)

    if (previous) {
      this.phase = "responses"
      this.reveal(previous)

      return
    }

    this.phase = "prepared"
    this.opts.broadcast(STATUS.SHOW_PREPARED, {
      totalAnswers: question.answers?.length ?? 0,
      questionNumber: this.currentQuestion + 1,
    })
    await this.opts.cooldown.start(2, false)

    if (!this.valid(run)) {
      return
    }

    this.phase = "question"
    this.opts.broadcast(STATUS.SHOW_QUESTION, {
      question: question.question,
      media:
        question.media?.type === MEDIA_TYPES.IMAGE ? question.media : undefined,
      cooldown: question.cooldown,
      type: question.type ?? "quiz",
      hideTextOnClient: this.options.hideTextOnClient,
      answersCount: question.answers?.length ?? 0,
      doublePoints: Boolean(question.doublePoints),
    })
    await this.opts.cooldown.start(question.cooldown, false)

    if (!this.valid(run)) {
      return
    }

    this.puzzleMap =
      question.type === "puzzle"
        ? shuffled((question.answers ?? []).map((_, index) => index))
        : undefined
    this.phase = "answer"
    this.acceptingAnswers = true
    this.startTime = Date.now()
    const time = this.options.doubleTime ? question.time * 2 : question.time
    this.opts.broadcast(STATUS.SELECT_ANSWER, {
      question: question.question,
      answers: this.puzzleMap
        ? this.puzzleMap.map((index) => (question.answers ?? [])[index])
        : (question.answers ?? []),
      media: question.media,
      time,
      totalPlayer: this.opts.players.connectedCount(),
      type: question.type ?? "quiz",
      multiSelect:
        (question.type ?? "quiz") === "quiz" &&
        (question.solutions?.length ?? 0) > 1,
      hideTextOnClient: this.options.hideTextOnClient,
    })
    await this.opts.cooldown.start(time)

    if (!this.valid(run)) {
      return
    }

    this.acceptingAnswers = false
    this.phase = "responses"
    this.score(question)
  }
  private score(question: Question): void {
    this.oldLeaderboard = this.players().map((player) => ({ ...player }))
    const responses: Record<number, number> = {}
    const results = new Map<string, { correct: boolean; points: number }>()
    const playerAnswers = this.opts.players.getAll().map((player) => {
      const submission = this.submissions.get(player.clientId)
      const score = submission
        ? scoreAnswer(
            question,
            submission.answerIds,
            submission.basePoints,
            this.puzzleMap,
          )
        : { correct: false, points: 0, canonical: [] }

      if (question.type === "puzzle") {
        responses[score.correct ? 0 : 1] =
          (Object.hasOwn(responses, score.correct ? 0 : 1)
            ? responses[score.correct ? 0 : 1]
            : 0) + 1
      } else {
        submission?.answerIds.forEach((index) => {
          responses[index] = (responses[index] ?? 0) + 1
        })
      }

      player.points += score.points
      player.streak = score.correct ? player.streak + 1 : 0
      results.set(player.clientId, {
        correct: score.correct,
        points: score.points,
      })

      return {
        playerName: player.username,
        userId: player.userId,
        answerIds: submission ? score.canonical : null,
        correct: score.correct,
        points: score.points,
      }
    })
    this.opts.players.replace(this.players())
    const cached = {
      question: { ...question, playerAnswers },
      responses,
      results,
    }
    this.history.set(this.currentQuestion, cached)
    this.reveal(cached)
    this.submissions.clear()
  }
  private reveal(cached: CachedRound): void {
    const { question } = cached
    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
      ...question,
      answers: question.answers ?? [],
      solutions: question.type === "puzzle" ? [] : (question.solutions ?? []),
      responses: cached.responses,
    })
    for (const player of this.opts.players.getAll()) {
      this.sendResult(
        player,
        cached.results.get(player.clientId) ?? { correct: false, points: 0 },
      )
    }
  }
  selectAnswer(socket: Socket, answerIds: number[]): void {
    const player = this.opts.players.findById(socket.id)
    const question = this.questions.at(this.currentQuestion)

    if (
      !player ||
      !player.connected ||
      !this.acceptingAnswers ||
      this.phase !== "answer" ||
      !question ||
      this.submissions.has(player.clientId)
    ) {
      return
    }

    const count = question.answers?.length ?? 0

    if (
      !answerIds.length ||
      answerIds.length > count ||
      new Set(answerIds).size !== answerIds.length ||
      answerIds.some(
        (index) => !Number.isInteger(index) || index < 0 || index >= count,
      )
    ) {
      return
    }

    if (question.type === "puzzle" && answerIds.length !== count) {
      return
    }

    const time = this.options.doubleTime ? question.time * 2 : question.time
    const elapsed = (Date.now() - this.startTime) / (1000 * gameSpeed)

    if (elapsed > time) {
      return
    }

    this.submissions.set(player.clientId, {
      answerIds: [...answerIds],
      basePoints:
        this.mode === "accuracy"
          ? 1000
          : Math.max(0, 1000 * (1 - elapsed / time)),
    })
    this.opts.send(socket.id, STATUS.WAIT, { text: "game:waitingForAnswers" })
    this.opts.io
      .to(this.opts.getManagerId())
      .emit(EVENTS.GAME.PLAYER_ANSWER, this.submissions.size)
    this.endIfEveryoneAnswered()
  }
  endIfEveryoneAnswered(): void {
    const connected = this.opts.players
      .getAll()
      .filter((player) => player.connected)

    if (
      this.acceptingAnswers &&
      connected.length > 0 &&
      connected.every((player) => this.submissions.has(player.clientId))
    ) {
      this.acceptingAnswers = false
      this.opts.cooldown.abort()
    }
  }
  nextQuestion(socket: Socket): void {
    if (
      socket.id !== this.opts.getManagerId() ||
      !["leaderboard", "slide"].includes(this.phase)
    ) {
      return
    }

    if (this.currentQuestion + 1 >= this.questions.length) {
      this.finish()

      return
    }

    this.currentQuestion += 1
    void this.newQuestion()
  }
  abortQuestion(socket: Socket): void {
    if (socket.id !== this.opts.getManagerId() || this.phase !== "answer") {
      return
    }

    this.acceptingAnswers = false
    this.opts.cooldown.abort()
  }
  goToQuestion(socket: Socket, index: number): void {
    if (
      socket.id !== this.opts.getManagerId() ||
      !this.isStarted() ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > this.maxQuestionReached
    ) {
      return
    }

    this.currentQuestion = index
    void this.newQuestion()
  }
  endGame(socket: Socket): void {
    if (socket.id === this.opts.getManagerId() && this.isStarted()) {
      this.finish()
    }
  }
  showLeaderboard(): void {
    if (this.phase !== "responses") {
      return
    }

    if (this.currentQuestion + 1 === this.questions.length) {
      this.finish()

      return
    }

    this.phase = "leaderboard"
    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_LEADERBOARD, {
      oldLeaderboard: this.oldLeaderboard.slice(0, 5),
      leaderboard: this.players().slice(0, 5),
      previousQuestions: this.questions
        .slice(0, this.maxQuestionReached + 1)
        .map((question, index) => ({ index, question: question.question })),
    })
  }
  private finish(): void {
    if (this.phase === "finished") {
      return
    }

    this.phase = "finished"
    this.acceptingAnswers = false
    this.run += 1
    this.opts.cooldown.abort()
    const players = this.players()
    const top: PodiumPlayer[] =
      this.mode === "accuracy"
        ? [...new Set(players.map((player) => player.points))]
            .slice(0, 3)
            .map((points) => ({
              points,
              username: players
                .filter((player) => player.points === points)
                .map((player) => player.username)
                .join(", "),
            }))
        : players
            .slice(0, 3)
            .map(({ username, points }) => ({ username, points }))
    const result: GameResult = {
      id: randomUUID(),
      subject: this.opts.quizz.subject,
      date: new Date().toISOString(),
      mode: this.mode,
      players: players.map((player) => ({
        username: player.username,
        userId: player.userId,
        points: player.points,
        rank: this.rank(player, players),
      })),
      questions: [...this.history.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, entry]) => entry.question),
    }
    this.opts.onGameFinished(result)
    this.opts.send(this.opts.getManagerId(), STATUS.FINISHED, {
      subject: this.opts.quizz.subject,
      top,
      result,
    })
    for (const player of players) {
      this.opts.send(player.id, STATUS.FINISHED, {
        subject: this.opts.quizz.subject,
        top,
        rank: this.rank(player, players),
      })
    }
  }
}
