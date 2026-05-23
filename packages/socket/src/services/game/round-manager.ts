// oxlint-disable typescript/no-unnecessary-condition
import { EVENTS, MEDIA_TYPES } from "@razzia/common/constants"
import type {
  Answer,
  GameResult,
  Player,
  Question,
  QuestionResult,
  Quizz,
} from "@razzia/common/types/game"
import type { Server, Socket } from "@razzia/common/types/game/socket"
import {
  type Status,
  STATUS,
  type StatusDataMap,
} from "@razzia/common/types/game/status"
import { CooldownTimer } from "@razzia/socket/services/game/cooldown-timer"
import { PlayerManager } from "@razzia/socket/services/game/player-manager"
import { timeToPoint } from "@razzia/socket/utils/game"
import sleep from "@razzia/socket/utils/sleep"
import { nanoid } from "nanoid"

type BroadcastFn = <T extends Status>(
  _status: T,
  _data: StatusDataMap[T],
) => void
type SendFn = <T extends Status>(
  _target: string,
  _status: T,
  _data: StatusDataMap[T],
) => void

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

export class RoundManager {
  private readonly opts: RoundManagerOptions
  private started = false
  private currentQuestion = 0
  private playersAnswers: Answer[] = []
  private startTime = 0
  private leaderboard: Player[] = []
  private tempOldLeaderboard: Player[] | null = null
  private questionsHistory: QuestionResult[] = []
  private currentShuffleMap: number[] | null = null
  private playersHistoryState: {
    clientId: string
    points: number
    streak: number
  }[][] = []
  private maxQuestionReached = 0
  private answeredQuestionsState = new Map<
    number,
    {
      responses: Record<number, number>
      playerResults: {
        clientId: string
        correct: boolean
        message: string
        points: number
        myPoints: number
        rank: number
        aheadOfMe: string | null
      }[]
    }
  >()

  private mode: "classic" | "accuracy" = "classic"
  private options = {
    shuffleQuestions: false,
    doubleTime: false,
    shuffleAnswers: false,
    hideTextOnClient: false,
  }
  private questions: Question[] = []

  constructor(opts: RoundManagerOptions) {
    this.opts = opts
    this.questions = JSON.parse(JSON.stringify(opts.quizz.questions))
  }

  isStarted(): boolean {
    return this.started
  }

  getReconnectInfo() {
    return {
      current: this.currentQuestion + 1,
      total: this.questions.length,
    }
  }

  async start(
    socket: Socket,
    mode: "classic" | "accuracy" = "classic",
    options?: { shuffleQuestions?: boolean; doubleTime?: boolean; shuffleAnswers?: boolean; hideTextOnClient?: boolean },
  ): Promise<void> {
    if (this.opts.getManagerId() !== socket.id) {
      return
    }

    if (this.started) {
      return
    }

    if (this.opts.players.count() === 0) {
      socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:game.noPlayersConnected")

      return
    }

    this.mode = mode
    if (options) {
      this.options = {
        shuffleQuestions: !!options.shuffleQuestions,
        doubleTime: !!options.doubleTime,
        shuffleAnswers: !!options.shuffleAnswers,
        hideTextOnClient: !!options.hideTextOnClient,
      }
    }

    if (this.options.shuffleAnswers) {
      this.questions.forEach((q) => {
        if (q.type === "slide" || q.type === "puzzle" || !q.answers || q.answers.length <= 1) {
          return
        }

        const originalSolutions = q.solutions ?? []
        const indexedAnswers = q.answers.map((text, idx) => ({ text, idx }))

        for (let i = indexedAnswers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[indexedAnswers[i], indexedAnswers[j]] = [
            indexedAnswers[j],
            indexedAnswers[i],
          ]
        }

        q.answers = indexedAnswers.map((item) => item.text)

        const newSolutions: number[] = []
        originalSolutions.forEach((origIdx) => {
          const newIdx = indexedAnswers.findIndex((item) => item.idx === origIdx)
          if (newIdx !== -1) {
            newSolutions.push(newIdx)
          }
        })
        q.solutions = newSolutions
      })
    }

    if (this.options.shuffleQuestions) {
      for (let i = this.questions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[this.questions[i], this.questions[j]] = [
          this.questions[j],
          this.questions[i],
        ]
      }
    }

    this.started = true

    this.opts.broadcast(STATUS.SHOW_START, {
      time: 3,
      subject: this.opts.quizz.subject,
    })

    await sleep(3)

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.START_COOLDOWN)
    await this.opts.cooldown.start(3)

    void this.newQuestion()
  }

  async newQuestion(): Promise<void> {
    if (!this.started) {
      return
    }

    const currentPlayers = this.opts.players.getAll()
    this.playersHistoryState[this.currentQuestion] = currentPlayers.map(
      (p) => ({
        clientId: p.clientId,
        points: p.points,
        streak: p.streak,
      }),
    )

    this.maxQuestionReached = Math.max(this.maxQuestionReached, this.currentQuestion)

    const question = this.questions[this.currentQuestion]

    this.opts.onNewQuestion()

    this.opts.io.to(this.opts.gameId).emit(EVENTS.GAME.UPDATE_QUESTION, {
      current: this.currentQuestion + 1,
      total: this.questions.length,
    })

    if (question.type === "slide") {
      this.opts.broadcast(STATUS.SHOW_SLIDE, {
        question: question.question,
        text: question.text ?? "",
        media: question.media,
      })

      return
    }

    if (this.answeredQuestionsState.has(this.currentQuestion)) {
      const state = this.answeredQuestionsState.get(this.currentQuestion)!

      if (question.type === "puzzle") {
        this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
          ...question,
          answers: question.answers ?? [],
          solutions: [],
          responses: state.responses,
          type: "puzzle",
        })
      } else {
        this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
          ...question,
          answers: question.answers ?? [],
          responses: state.responses,
          solutions: question.solutions ?? [],
        })
      }

      state.playerResults.forEach((res) => {
        const player = this.opts.players.findByClientId(res.clientId)
        if (player) {
          const currentRank = this.leaderboard.findIndex((p) => p.clientId === res.clientId) + 1
          const rank = currentRank > 0 ? currentRank : res.rank
          const aheadPlayer = rank > 1 ? this.leaderboard[rank - 2] : null
          const aheadOfMe = aheadPlayer ? aheadPlayer.username : null

          this.opts.send(player.id, STATUS.SHOW_RESULT, {
            correct: res.correct,
            message: res.message,
            points: res.points,
            myPoints: player.points,
            rank,
            aheadOfMe,
          })
        }
      })

      return
    }

    this.opts.broadcast(STATUS.SHOW_PREPARED, {
      totalAnswers: question.answers?.length ?? 0,
      questionNumber: this.currentQuestion + 1,
    })

    await sleep(2)

    if (!this.started) {
      return
    }

    const imageMedia =
      question.media?.type === MEDIA_TYPES.IMAGE ? question.media : undefined

    const questionTime = this.options.doubleTime ? question.time * 2 : question.time

    this.opts.broadcast(STATUS.SHOW_QUESTION, {
      question: question.question,
      media: imageMedia,
      cooldown: question.cooldown,
      type: question.type ?? "quiz",
      hideTextOnClient: this.options.hideTextOnClient,
    })

    await sleep(question.cooldown)

    if (!this.started) {
      return
    }

    this.startTime = Date.now()

    let answersToSend = question.answers ?? []
    this.currentShuffleMap = null

    if (question.type === "puzzle") {
      const originalAnswers = question.answers ?? []
      const indices = originalAnswers.map((_, idx) => idx)

      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[indices[i], indices[j]] = [indices[j], indices[i]]
      }

      this.currentShuffleMap = indices
      answersToSend = indices.map((idx) => originalAnswers[idx])
    }

    this.opts.broadcast(STATUS.SELECT_ANSWER, {
      question: question.question,
      answers: answersToSend,
      media: question.media,
      time: questionTime,
      totalPlayer: this.opts.players.count(),
      type: question.type ?? "quiz",
      multiSelect:
        question.type === "quiz" && (question.solutions?.length ?? 0) > 1,
      hideTextOnClient: this.options.hideTextOnClient,
    })

    await this.opts.cooldown.start(questionTime)

    if (!this.started) {
      return
    }

    this.showResults(question)
  }

  private showResults(question: Question): void {
    const currentPlayers = this.opts.players.getAll()

    const oldLeaderboard = (() => {
      if (this.leaderboard.length === 0) {
        return currentPlayers.map((p) => ({ ...p }))
      }

      return this.leaderboard.map((p) => ({ ...p }))
    })()

    const totalType: Record<number, number> = {}

    if (question.type === "puzzle") {
      let correctCount = 0
      this.playersAnswers.forEach((a) => {
        const hasCorrectAnswers =
          a.answerIds.length === (question.answers?.length ?? 0)
        const isOrderCorrect =
          hasCorrectAnswers &&
          a.answerIds
            .map((idx) => this.currentShuffleMap![idx])
            .every((val, index) => val === index)
        if (isOrderCorrect) {
          correctCount++
        }
      })
      const incorrectCount = currentPlayers.length - correctCount
      totalType[0] = correctCount
      totalType[1] = incorrectCount
    } else {
      this.playersAnswers.forEach(({ answerIds }) => {
        answerIds.forEach((id) => {
          totalType[id] = (totalType[id] || 0) + 1
        })
      })
    }

    const sortedPlayers = currentPlayers
      .map((player) => {
        const playerAnswer = this.playersAnswers.find(
          (a) => a.playerId === player.id,
        )

        let isCorrect = false
        let points = 0

        if (playerAnswer) {
          if (question.type === "puzzle") {
            const hasCorrectAnswers =
              playerAnswer.answerIds.length === (question.answers?.length ?? 0)
            const isOrderCorrect =
              hasCorrectAnswers &&
              playerAnswer.answerIds
                .map((idx) => this.currentShuffleMap![idx])
                .every((val, index) => val === index)
            isCorrect = isOrderCorrect
            points = isCorrect ? Math.round(playerAnswer.points) : 0
          } else {
            const submitted = playerAnswer.answerIds
            const solutions = question.solutions ?? []
            const hasWrong = submitted.some((ans) => !solutions.includes(ans))

            if (submitted.length > 0 && !hasWrong) {
              const correctCount = submitted.filter((ans) =>
                solutions.includes(ans),
              ).length
              const totalSolutions = solutions.length
              isCorrect = true
              points = Math.round(
                playerAnswer.points * (correctCount / totalSolutions),
              )
            } else {
              isCorrect = false
              points = 0
            }
          }
        }

        player.points += points
        player.streak = isCorrect ? player.streak + 1 : 0

        return { ...player, lastCorrect: isCorrect, lastPoints: points }
      })
      .sort((a, b) => b.points - a.points)

    this.opts.players.replace(sortedPlayers)

    const uniqueScores = this.mode === "accuracy"
      ? Array.from(new Set(sortedPlayers.map((p) => p.points))).sort((a, b) => b - a)
      : []

    const getPlayerRank = (points: number, idx: number): number => {
      if (this.mode === "accuracy") {
        const scoreIndex = uniqueScores.indexOf(points)
        return scoreIndex !== -1 ? scoreIndex + 1 : idx + 1
      }
      return idx + 1
    }

    sortedPlayers.forEach((player, index) => {
      const rank = getPlayerRank(player.points, index)
      const aheadPlayer = (index > 0 && sortedPlayers[index - 1].points > player.points) ? sortedPlayers[index - 1] : null

      this.opts.send(player.id, STATUS.SHOW_RESULT, {
        correct: player.lastCorrect,
        message: player.lastCorrect ? "game:correct" : "game:wrong",
        points: player.lastPoints,
        myPoints: player.points,
        rank,
        aheadOfMe: aheadPlayer ? aheadPlayer.username : null,
      })
    })

    if (question.type === "puzzle") {
      this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
        ...question,
        answers: question.answers ?? [],
        solutions: [],
        responses: totalType,
        type: "puzzle",
      })
    } else {
      this.opts.send(this.opts.getManagerId(), STATUS.SHOW_RESPONSES, {
        ...question,
        answers: question.answers ?? [],
        responses: totalType,
        solutions: question.solutions ?? [],
      })
    }

    this.questionsHistory.push({
      ...question,
      playerAnswers: currentPlayers.map((player) => {
        const pa = this.playersAnswers.find((a) => a.playerId === player.id)
        let answerIds: number[] | null = null
        if (pa) {
          if (question.type === "puzzle" && this.currentShuffleMap) {
            answerIds = pa.answerIds.map((idx) => this.currentShuffleMap![idx])
          } else {
            answerIds = pa.answerIds
          }
        }
        return {
          playerName: player.username,
          answerIds,
        }
      }),
    })

    const playerResults: {
      clientId: string
      correct: boolean
      message: string
      points: number
      myPoints: number
      rank: number
      aheadOfMe: string | null
    }[] = []

    sortedPlayers.forEach((player, index) => {
      const rank = getPlayerRank(player.points, index)
      const aheadPlayer = (index > 0 && sortedPlayers[index - 1].points > player.points) ? sortedPlayers[index - 1] : null
      playerResults.push({
        clientId: player.clientId,
        correct: player.lastCorrect,
        message: player.lastCorrect ? "game:correct" : "game:wrong",
        points: player.lastPoints,
        myPoints: player.points,
        rank,
        aheadOfMe: aheadPlayer ? aheadPlayer.username : null,
      })
    })

    this.answeredQuestionsState.set(this.currentQuestion, {
      responses: totalType,
      playerResults,
    })

    this.leaderboard = sortedPlayers
    this.tempOldLeaderboard = oldLeaderboard
    this.playersAnswers = []
  }

  selectAnswer(socket: Socket, answerIds: number[]): void {
    const player = this.opts.players.findById(socket.id)
    const question = this.opts.quizz.questions[this.currentQuestion]

    if (!player) {
      return
    }

    if (this.playersAnswers.find((a) => a.playerId === socket.id)) {
      return
    }

    const questionTime = this.options.doubleTime ? question.time * 2 : question.time
    const pts = this.mode === "accuracy" ? 1000 : timeToPoint(this.startTime, questionTime)

    this.playersAnswers.push({
      playerId: player.id,
      answerIds,
      points: pts,
    })

    this.opts.send(socket.id, STATUS.WAIT, {
      text: "game:waitingForAnswers",
    })

    socket
      .to(this.opts.gameId)
      .emit(EVENTS.GAME.PLAYER_ANSWER, this.playersAnswers.length)
    this.opts.players.broadcastCount()

    if (this.playersAnswers.length === this.opts.players.count()) {
      this.opts.cooldown.abort()
    }
  }

  nextQuestion(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    if (!this.questions[this.currentQuestion + 1]) {
      this.showLeaderboard()
      return
    }

    this.currentQuestion += 1
    void this.newQuestion()
  }

  abortQuestion(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    this.opts.cooldown.abort()
  }

  goToQuestion(socket: Socket, index: number): void {
    if (!this.started) {
      return
    }

    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    if (index < 0 || index >= this.questions.length) {
      return
    }

    this.opts.cooldown.abort()

    this.tempOldLeaderboard = null
    this.playersAnswers = []
    this.currentQuestion = index
    void this.newQuestion()
  }

  endGame(socket: Socket): void {
    if (!this.started) {
      return
    }

    if (socket.id !== this.opts.getManagerId()) {
      return
    }

    this.opts.cooldown.abort()
    this.started = false

    const uniqueScores = this.mode === "accuracy"
      ? Array.from(new Set(this.leaderboard.map((p) => p.points))).sort((a, b) => b - a)
      : []

    const getPlayerRank = (points: number, idx: number): number => {
      if (this.mode === "accuracy") {
        const scoreIndex = uniqueScores.indexOf(points)
        return scoreIndex !== -1 ? scoreIndex + 1 : idx + 1
      }
      return idx + 1
    }

    let top: any[] = []
    if (this.mode === "accuracy") {
      const goldPlayers = this.leaderboard.filter((p) => p.points === uniqueScores[0])
      const silverPlayers = uniqueScores.length > 1 ? this.leaderboard.filter((p) => p.points === uniqueScores[1]) : []
      const bronzePlayers = uniqueScores.length > 2 ? this.leaderboard.filter((p) => p.points === uniqueScores[2]) : []

      if (goldPlayers.length > 0) {
        top.push({
          id: "gold",
          clientId: "gold",
          connected: true,
          username: goldPlayers.map((p) => p.username).join(", "),
          points: uniqueScores[0],
          streak: 0,
        })
      }
      if (silverPlayers.length > 0) {
        top.push({
          id: "silver",
          clientId: "silver",
          connected: true,
          username: silverPlayers.map((p) => p.username).join(", "),
          points: uniqueScores[1],
          streak: 0,
        })
      }
      if (bronzePlayers.length > 0) {
        top.push({
          id: "bronze",
          clientId: "bronze",
          connected: true,
          username: bronzePlayers.map((p) => p.username).join(", "),
          points: uniqueScores[2],
          streak: 0,
        })
      }
    } else {
      top = this.leaderboard.slice(0, 3)
    }

    const result = {
      id: `${Date.now()}-${nanoid(8)}`,
      subject: this.opts.quizz.subject,
      date: new Date().toISOString(),
      players: this.leaderboard.map((player, index) => ({
        username: player.username,
        points: player.points,
        rank: getPlayerRank(player.points, index),
      })),
      questions: this.questionsHistory,
      mode: this.mode,
    }

    this.opts.onGameFinished(result)

    this.opts.send(this.opts.getManagerId(), STATUS.FINISHED, {
      subject: this.opts.quizz.subject,
      top,
      result,
    })

    this.leaderboard.forEach((player, index) => {
      this.opts.send(player.id, STATUS.FINISHED, {
        subject: this.opts.quizz.subject,
        top,
        rank: getPlayerRank(player.points, index),
      })
    })
  }

  showLeaderboard(): void {
    const isLastRound =
      this.currentQuestion + 1 === this.questions.length

    if (isLastRound) {
      this.started = false

      const uniqueScores = this.mode === "accuracy"
        ? Array.from(new Set(this.leaderboard.map((p) => p.points))).sort((a, b) => b - a)
        : []

      const getPlayerRank = (points: number, idx: number): number => {
        if (this.mode === "accuracy") {
          const scoreIndex = uniqueScores.indexOf(points)
          return scoreIndex !== -1 ? scoreIndex + 1 : idx + 1
        }
        return idx + 1
      }

      let top: any[] = []
      if (this.mode === "accuracy") {
        const goldPlayers = this.leaderboard.filter((p) => p.points === uniqueScores[0])
        const silverPlayers = uniqueScores.length > 1 ? this.leaderboard.filter((p) => p.points === uniqueScores[1]) : []
        const bronzePlayers = uniqueScores.length > 2 ? this.leaderboard.filter((p) => p.points === uniqueScores[2]) : []

        if (goldPlayers.length > 0) {
          top.push({
            id: "gold",
            clientId: "gold",
            connected: true,
            username: goldPlayers.map((p) => p.username).join(", "),
            points: uniqueScores[0],
            streak: 0,
          })
        }
        if (silverPlayers.length > 0) {
          top.push({
            id: "silver",
            clientId: "silver",
            connected: true,
            username: silverPlayers.map((p) => p.username).join(", "),
            points: uniqueScores[1],
            streak: 0,
          })
        }
        if (bronzePlayers.length > 0) {
          top.push({
            id: "bronze",
            clientId: "bronze",
            connected: true,
            username: bronzePlayers.map((p) => p.username).join(", "),
            points: uniqueScores[2],
            streak: 0,
          })
        }
      } else {
        top = this.leaderboard.slice(0, 3)
      }

      const result = {
        id: `${Date.now()}-${nanoid(8)}`,
        subject: this.opts.quizz.subject,
        date: new Date().toISOString(),
        players: this.leaderboard.map((player, index) => ({
          username: player.username,
          points: player.points,
          rank: getPlayerRank(player.points, index),
        })),
        questions: this.questionsHistory,
        mode: this.mode,
      }

      this.opts.onGameFinished(result)

      this.opts.send(this.opts.getManagerId(), STATUS.FINISHED, {
        subject: this.opts.quizz.subject,
        top,
        result,
      })

      this.leaderboard.forEach((player, index) => {
        this.opts.send(player.id, STATUS.FINISHED, {
          subject: this.opts.quizz.subject,
          top,
          rank: getPlayerRank(player.points, index),
        })
      })

      return
    }

    const oldLeaderboard = this.tempOldLeaderboard ?? this.leaderboard

    this.opts.send(this.opts.getManagerId(), STATUS.SHOW_LEADERBOARD, {
      oldLeaderboard: oldLeaderboard.slice(0, 5),
      leaderboard: this.leaderboard.slice(0, 5),
      previousQuestions: this.questions
        .slice(0, this.maxQuestionReached + 1)
        .map((q, idx) => ({ index: idx, question: q.question })),
    })

    this.tempOldLeaderboard = null
  }
}
