import type { GameResultMeta, QuizzMeta } from "@razzia/common/types/game"
import type { PasswordResetRequest } from "@razzia/common/types/auth"

export interface ManagerConfig {
  quizz: QuizzMeta[]
  results: GameResultMeta[]
  defaultWallpaper?: string
  defaultAudio?: string
  user?: {
    id: string
    username: string
    role: "admin" | "quizmaster" | "analyst" | "quizzer"
  }
  users?: Array<{
    id: string
    username: string
    role: "admin" | "quizmaster" | "analyst" | "quizzer"
    createdAt: string
  }>
  trash?: QuizzMeta[]
  notifications?: PasswordResetRequest[]
}
