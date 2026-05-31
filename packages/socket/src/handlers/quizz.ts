import { EVENTS } from "@razzia/common/constants"
import type { SocketContext } from "@razzia/socket/handlers/types"
import {
  trashQuizz,
  getTrashQuizzesMeta,
  getTrashQuizzById,
  restoreQuizz,
  deleteQuizzPermanently,
  getQuizzById,
  saveQuizz,
  updateQuizz,
  getResultsMeta,
  getResultById
} from "@razzia/socket/services/config"
import manager, { emitConfig } from "@razzia/socket/services/manager"
import { uploadMedia } from "@razzia/socket/services/upload"

export const quizzSocketHandlers = ({ socket }: SocketContext) => {
  socket.on(
    EVENTS.QUIZZ.GET,
    manager.withAuth(socket, (id) => {
      try {
        const user = manager.getUser(socket)
        if (!user || user.role === "analyst" || user.role === "quizzer") {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        const quizz = getQuizzById(id)
        if (user.role === "quizmaster" && quizz.creatorId !== user.id) {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        socket.emit(EVENTS.QUIZZ.DATA, quizz)
      } catch (error) {
        console.error("Failed to get quizz:", error)
        socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.notFound")
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.SAVE,
    manager.withAuth(socket, (data) => {
      try {
        const user = manager.getUser(socket)
        if (!user || user.role === "analyst" || user.role === "quizzer") {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        const { id } = saveQuizz(data, user.id)
        socket.emit(EVENTS.QUIZZ.SAVE_SUCCESS, { id })
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to save quizz:", error)
        const message =
          error instanceof Error ? error.message : "errors:quizz.failedToSave"
        socket.emit(EVENTS.QUIZZ.ERROR, message)
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.DELETE,
    manager.withAuth(socket, (id) => {
      try {
        const user = manager.getUser(socket)
        if (!user || user.role === "analyst" || user.role === "quizzer") {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        const quizz = getQuizzById(id)
        if (user.role === "quizmaster" && quizz.creatorId !== user.id) {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        trashQuizz(id, user.id)
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to delete quizz:", error)
        socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.failedToDelete")
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.UPDATE,
    manager.withAuth(socket, ({ id, ...data }) => {
      try {
        const user = manager.getUser(socket)
        if (!user || user.role === "analyst" || user.role === "quizzer") {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        const quizz = getQuizzById(id)
        if (user.role === "quizmaster" && quizz.creatorId !== user.id) {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        const { id: newId } = updateQuizz(id, { id, ...data })
        socket.emit(EVENTS.QUIZZ.UPDATE_SUCCESS, { id: newId })
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to update quizz:", error)
        const message =
          error instanceof Error ? error.message : "errors:quizz.failedToUpdate"
        socket.emit(EVENTS.QUIZZ.ERROR, message)
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.UPLOAD_MEDIA,
    manager.withAuth(socket, ({ filename, fileType, data }, callback) => {
      ;(async () => {
        try {
          const result = await uploadMedia(filename, fileType, data)
          callback(result)
        } catch (error) {
          console.error("Failed to upload media:", error)
          callback({ success: false, error: "errors:quizz.uploadFailed" })
        }
      })().catch((err) => {
        console.error("Unhandled socket upload promise error:", err)
      })
    }),
  )

  socket.on(
    EVENTS.QUIZZ.GET_TRASH,
    manager.withAuth(socket, () => {
      try {
        const user = manager.getUser(socket)
        if (!user || user.role === "analyst" || user.role === "quizzer") {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        let trash = getTrashQuizzesMeta()
        if (user.role === "quizmaster") {
          trash = trash.filter(q => q.creatorId === user.id && (Date.now() - new Date(q.deletedAt!).getTime()) <= 90 * 24 * 60 * 60 * 1000)
        }

        socket.emit(EVENTS.QUIZZ.TRASH_DATA, trash)
      } catch (error) {
        console.error("Failed to get trash:", error)
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.RESTORE,
    manager.withAuth(socket, (id) => {
      try {
        const user = manager.getUser(socket)
        if (!user || user.role === "analyst" || user.role === "quizzer") {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        const quizz = getTrashQuizzById(id)
        if (user.role === "quizmaster") {
          if (quizz.creatorId !== user.id) {
            socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
            return
          }
          const deletedTime = new Date(quizz.deletedAt).getTime()
          if (Date.now() - deletedTime > 90 * 24 * 60 * 60 * 1000) {
            socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.trashExpired")
            return
          }
        }

        restoreQuizz(id)
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to restore quizz:", error)
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.DELETE_PERMANENTLY,
    manager.withAuth(socket, (id) => {
      try {
        const user = manager.getUser(socket)
        if (!user || user.role !== "admin") {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        deleteQuizzPermanently(id)
        emitConfig(socket)
      } catch (error) {
        console.error("Failed to permanently delete quizz:", error)
      }
    }),
  )

  socket.on(
    EVENTS.QUIZZ.GET_SOLO,
    manager.withAuth(socket, (id) => {
      try {
        const user = manager.getUser(socket)
        if (!user) {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        if (user.role === "analyst") {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        const quizz = getQuizzById(id)

        if (user.role === "quizmaster" && quizz.creatorId !== user.id) {
          socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
          return
        }

        if (user.role === "quizzer") {
          const results = getResultsMeta()
          const attended = results.some(r => {
            if (r.quizzId !== id) return false
            try {
              const fullResult = getResultById(r.id)
              return fullResult.players.some(p => p.userId === user.id)
            } catch {
              return false
            }
          })

          if (!attended) {
            socket.emit(EVENTS.QUIZZ.ERROR, "errors:unauthorized")
            return
          }
        }

        socket.emit(EVENTS.QUIZZ.DATA, quizz)
      } catch (error) {
        console.error("Failed to get solo quizz:", error)
        socket.emit(EVENTS.QUIZZ.ERROR, "errors:quizz.notFound")
      }
    }),
  )
}
