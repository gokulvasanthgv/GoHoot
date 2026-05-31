import type { MEDIA_TYPES } from "@razzia/common/constants"

export interface Player {
  id: string
  clientId: string
  connected: boolean
  username: string
  points: number
  streak: number
  userId?: string
}

export interface Answer {
  playerId: string
  answerIds: number[]
  points: number
}

export type QuestionMediaType =
  | (typeof MEDIA_TYPES)[keyof typeof MEDIA_TYPES]
  | undefined

export interface QuestionMedia {
  type?: QuestionMediaType
  url: string
}

export type QuestionType = "quiz" | "slide" | "puzzle" | "true_or_false"

export interface Question {
  type?: QuestionType
  question: string
  text?: string
  media?: QuestionMedia
  answers?: string[]
  solutions?: number[]
  cooldown: number
  time: number
  doublePoints?: boolean
}

export interface Quizz {
  subject: string
  questions: Question[]
  wallpaper?: string
  audio?: string
  incompatible?: boolean
  creatorId?: string
  deletedAt?: string
  deletedBy?: string
}

export type QuizzWithId = Quizz & { id: string }

export interface QuizzMeta {
  id: string
  subject: string
  incompatible?: boolean
  creatorId?: string
  deletedAt?: string
}

export interface GameUpdateQuestion {
  current: number
  total: number
}

export interface PlayerAnswerRecord {
  playerName: string
  answerIds: number[] | null
  userId?: string
}

export type QuestionResult = Question & {
  playerAnswers: PlayerAnswerRecord[]
}

export interface GameResultPlayer {
  username: string
  points: number
  rank: number
  userId?: string
}

export interface GameResult {
  id: string
  quizzId?: string
  subject: string
  date: string
  players: GameResultPlayer[]
  questions: QuestionResult[]
  mode?: "classic" | "accuracy"
  creatorId?: string
}

export interface GameResultMeta {
  id: string
  quizzId?: string
  subject: string
  date: string
  playerCount: number
  mode?: "classic" | "accuracy"
  creatorId?: string
}
