import type { PublicUser } from "@razzia/common/types/auth"
import type { QuizzWithId, GameResult } from "@razzia/common/types/game"
import { getResultById, getResultsMeta } from "@razzia/socket/services/config"

export const canEditQuiz = (user: PublicUser, quiz: QuizzWithId): boolean =>
  user.role === "admin" ||
  (user.role === "quizmaster" && quiz.creatorId === user.id)

export const canReadResult = (user: PublicUser, result: GameResult): boolean =>
  user.role === "admin" ||
  user.role === "analyst" ||
  (user.role === "quizmaster" && result.creatorId === user.id) ||
  (user.role === "quizzer" &&
    result.players.some((player) => player.userId === user.id))

export const hasAttendedQuiz = (userId: string, quizId: string): boolean =>
  getResultsMeta().some((meta) => {
    if (meta.quizzId !== quizId) {
      return false
    }

    try {
      return getResultById(meta.id).players.some(
        (player) => player.userId === userId,
      )
    } catch {
      return false
    }
  })

export const canPlaySolo = (user: PublicUser, quiz: QuizzWithId): boolean =>
  canEditQuiz(user, quiz) ||
  (user.role === "quizzer" && hasAttendedQuiz(user.id, quiz.id))
