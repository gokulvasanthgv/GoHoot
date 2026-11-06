import { getPlayerDashboard } from "@razzia/socket/services/dashboard"
import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import { deleteResult, getResultById } from "@razzia/socket/services/config"
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
          const isParticipant = result.players.some((p) => p.userId === user.id)

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

        if (user?.role !== "admin") {
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
    EVENTS.RESULTS.PLAYER_DASHBOARD,
    manager.withAuth(socket, () => {
      try {
        const user = manager.getUser(socket)

        if (!user) {
          return
        }

        socket.emit(EVENTS.RESULTS.PLAYER_DASHBOARD_DATA, {
          attended: getPlayerDashboard(user.id),
        })
      } catch (err) {
        console.error("Failed fetching player dashboard:", err)
      }
    }),
  )
}
