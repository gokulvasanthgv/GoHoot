import type { AttendedQuiz } from "@razzia/common/types/game"
import { getResultById, getResultsMeta } from "@razzia/socket/services/config"

export const getPlayerDashboard = (userId: string): AttendedQuiz[] =>
  getResultsMeta().flatMap((meta) => {
    try {
      const result = getResultById(meta.id)
      const player = result.players.find((item) => item.userId === userId)

      if (!player) {
        return []
      }

      return [
        {
          id: result.id,
          quizzId: result.quizzId,
          subject: result.subject,
          date: result.date,
          mode: result.mode,
          points: player.points,
          rank: player.rank,
          totalPlayers: result.players.length,
          questions: result.questions.map((question) => {
            const answer = question.playerAnswers.find(
              (item) => item.userId === userId,
            )
            const selected = answer?.answerIds ?? null
            const correct =
              answer?.correct ??
              (selected !== null &&
                selected.length > 0 &&
                (question.type === "puzzle"
                  ? selected.length === question.answers?.length &&
                    selected.every((value, index) => value === index)
                  : selected.every((value) =>
                      question.solutions?.includes(value),
                    )))

            return {
              question: question.question,
              type: question.type,
              correct,
              points: answer?.points,
              selectedAnswers: selected,
              answers: question.answers,
              solutions: question.solutions,
            }
          }),
        },
      ]
    } catch {
      return []
    }
  })
