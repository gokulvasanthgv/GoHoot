import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { deleteResult, getResultById, getResultsMeta, saveResult } from "@razzia/socket/services/config"
import manager, { emitConfig } from "@razzia/socket/services/manager"

export const resultsSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.RESULTS.GET,
    manager.withAuth(socket, (id) => {
      try {
        const user = manager.getUser(socket)
        if (!user) {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        const result = getResultById(id)
        if (user.role === "quizmaster" && result.creatorId !== user.id) {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        if (user.role === "quizzer") {
          const isParticipant = result.players.some(p => p.userId === user.id)
          if (!isParticipant) {
            socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
            return
          }
        }

        socket.emit(EVENTS.RESULTS.DATA, result)
      } catch (error) {
        console.error("Failed to get result:", error)
      }
    }),
  )

  socket.on(
    EVENTS.RESULTS.DELETE,
    manager.withAuth(socket, (id) => {
      try {
        const user = manager.getUser(socket)
        if (!user || user.role !== "admin") {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        deleteResult(id)
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to delete result:", error)
      }
    }),
  )

  socket.on(
    EVENTS.RESULTS.SAVE_SOLO,
    manager.withAuth(socket, (resultData) => {
      try {
        const user = manager.getUser(socket)
        if (!user || user.role === "analyst") {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        saveResult(resultData)
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to save solo result:", error)
      }
    }),
  )

  socket.on(
    EVENTS.RESULTS.PLAYER_DASHBOARD,
    manager.withAuth(socket, () => {
      try {
        const user = manager.getUser(socket)
        if (!user) return

        const results = getResultsMeta()
        const attendedMeta: any[] = []

        for (const r of results) {
          try {
            const fullResult = getResultById(r.id)
            const matchingPlayer = fullResult.players.find(p => p.userId === user.id)
            if (matchingPlayer) {
              attendedMeta.push({
                id: fullResult.id,
                quizzId: fullResult.quizzId,
                subject: fullResult.subject,
                date: fullResult.date,
                mode: fullResult.mode,
                points: matchingPlayer.points,
                rank: matchingPlayer.rank,
                totalPlayers: fullResult.players.length,
                questions: fullResult.questions.map(q => {
                  const pa = q.playerAnswers.find(ans => ans.userId === user.id)
                  let correct = false
                  if (pa && pa.answerIds && q.solutions) {
                    const sol = q.solutions
                    correct = Array.isArray(sol)
                      ? (pa.answerIds.length === sol.length && pa.answerIds.every(val => sol.includes(val)))
                      : pa.answerIds.includes(sol)
                  }
                  return {
                    question: q.question,
                    correct,
                    selectedAnswers: pa ? pa.answerIds : null,
                    answers: q.answers,
                    solutions: q.solutions
                  }
                })
              })
            }
          } catch (e) {
            console.error("Failed parsing attended result:", e)
          }
        }

        socket.emit(EVENTS.RESULTS.PLAYER_DASHBOARD_DATA, {
          attended: attendedMeta
        })
      } catch (err) {
        console.error("Failed fetching player dashboard:", err)
      }
    }),
  )
}
