import type { GameResultMeta, QuizzMeta } from "@razzia/common/types/game"

export interface ManagerConfig {
  quizz: QuizzMeta[]
  results: GameResultMeta[]
  defaultWallpaper?: string
  defaultAudio?: string
  user?: { id: string; username: string; role: "admin" | "quizmaster" | "analyst" | "quizzer" }
  users?: { id: string; username: string; role: "admin" | "quizmaster" | "analyst" | "quizzer"; createdAt: string }[]
  trash?: QuizzMeta[]
}
