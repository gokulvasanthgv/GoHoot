import { Hono, type MiddlewareHandler } from "hono"
import { bodyLimit } from "hono/body-limit"
import { HTTPException } from "hono/http-exception"
import { secureHeaders } from "hono/secure-headers"
import type { ServerType } from "@hono/node-server"
import { Server as ServerIO } from "socket.io"
import type { Server } from "@razzia/common/types/game/socket"
import { EVENTS, MAX_MEDIA_SIZE } from "@razzia/common/constants"
import { clientEventValidators } from "@razzia/common/validators/socket"
import { api } from "@razzia/socket/api"
import { requireManager } from "@razzia/socket/api/middleware"
import { apiFactory, type ApiEnv } from "@razzia/socket/api/factory"
import { DomainError } from "@razzia/socket/services/errors"
import { isClaimsActive, verifyToken } from "@razzia/socket/services/auth"
import { consumeLimit } from "@razzia/socket/services/rate-limit"
import { safeUploadPath, uploadMedia } from "@razzia/socket/services/upload"
import { setIo } from "@razzia/socket/services/io"
import { managerSocketHandlers } from "@razzia/socket/handlers/manager"
import { quizzSocketHandlers } from "@razzia/socket/handlers/quizz"
import { resultsSocketHandlers } from "@razzia/socket/handlers/results"
import { gameSocketHandlers } from "@razzia/socket/handlers/game"
import UserService from "@razzia/socket/services/user"
import fs from "node:fs"
import { extname } from "node:path"
import { Readable } from "node:stream"

export const app = new Hono<ApiEnv>()

app.use("*", secureHeaders({ crossOriginResourcePolicy: "same-origin" }))
const requestLimit: MiddlewareHandler<ApiEnv> = (c, next) =>
  bodyLimit({
    maxSize:
      c.req.path === "/uploads" ||
      c.req.path === "/api/media" ||
      c.req.path === "/api/media/"
        ? MAX_MEDIA_SIZE + 65536
        : 2 * 1024 * 1024,
    onError: (context) => context.json({ error: "errors:media.tooLarge" }, 413),
  })(c, next)
app.use("*", requestLimit)
app.route("/api", api)
app.route(
  "/uploads",
  apiFactory.createApp().post("/", requireManager, async (c) => {
    const userId = c.get("user").id

    if (!consumeLimit(`uploads:${userId}`, 20, 60_000)) {
      return c.json({ success: false, error: "errors:auth.rateLimited" }, 429)
    }

    const result = await uploadMedia(
      c.req.query("filename") ?? "media",
      c.req.query("fileType") ?? "",
      Buffer.from(await c.req.arrayBuffer()),
      userId,
    )

    return c.json(result, result.success ? 201 : 415)
  }),
)

const mimeTypes: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
}
app.get("/uploads/:name", (c) => {
  const path = safeUploadPath(c.req.param("name"))
  const { size } = fs.statSync(path)
  const headers: Record<string, string> = {
    "Content-Type":
      mimeTypes[extname(path).toLowerCase()] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
    "Content-Security-Policy":
      "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:",
  }
  let start = 0
  let end = size - 1
  let status = 200
  const range = c.req.header("Range")

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/u.exec(range)

    if (!match || (!match[1] && !match[2])) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      })
    }

    start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]))
    end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1

    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start > end ||
      start >= size
    ) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${size}` },
      })
    }

    status = 206
    headers["Content-Range"] = `bytes ${start}-${end}/${size}`
  }

  headers["Content-Length"] = String(Math.max(0, end - start + 1))

  return new Response(
    size
      ? (Readable.toWeb(
          fs.createReadStream(path, { start, end }),
        ) as ReadableStream<Uint8Array>)
      : null,
    { status, headers },
  )
})
app.notFound((c) => c.json({ error: "errors:api.notFound" }, 404))
app.onError((error, c) => {
  if (error instanceof DomainError) {
    return c.json({ error: error.key }, error.status)
  }

  if (error instanceof HTTPException) {
    return c.json(
      {
        error:
          error.status === 400
            ? "errors:invalidRequest"
            : "errors:auth.unauthorized",
      },
      error.status,
    )
  }

  console.error("API error:", error)

  return c.json({ error: "errors:api.serverError" }, 500)
})

export const createSocketServer = (server: ServerType): Server => {
  const io: Server = new ServerIO(server, {
    path: "/ws",
    maxHttpBufferSize: 2 * 1024 * 1024,
    allowRequest: (request, callback) => {
      const { origin } = request.headers

      if (!origin) {
        callback(null, true)

        return
      }

      try {
        callback(
          null,
          new URL(origin).host.toLowerCase() ===
            request.headers.host?.toLowerCase(),
        )
      } catch {
        callback(null, false)
      }
    },
  })
  setIo(io)
  io.use((socket, next) => {
    const token: unknown = socket.handshake.auth.token

    if (typeof token !== "string" || token.length > 4096) {
      const error = Object.assign(new Error("errors:auth.tokenMissing"), {
        data: { code: "TOKEN_MISSING" },
      })
      next(error)

      return
    }

    verifyToken(token)
      .then((claims) => {
        socket.data = { clientId: claims.sub, claims }
        next()
      })
      .catch(() =>
        next(
          Object.assign(new Error("errors:auth.tokenInvalid"), {
            data: { code: "TOKEN_INVALID" },
          }),
        ),
      )
  })
  io.on("connection", (socket) => {
    socket.use((packet, next) => {
      if (!isClaimsActive(socket.data.claims)) {
        socket.emit(EVENTS.MANAGER.UNAUTHORIZED)
        socket.disconnect(true)

        return
      }

      if (!consumeLimit(`socket:${socket.data.clientId}`, 150, 10_000)) {
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:auth.rateLimited")

        return
      }

      const validator = Object.hasOwn(clientEventValidators, packet[0])
        ? clientEventValidators[packet[0]]
        : undefined

      if (!validator) {
        socket.emit(EVENTS.GAME.ERROR_MESSAGE, "errors:invalidRequest")

        return
      }

      const parsed = validator.safeParse(packet[1])

      if (!parsed.success) {
        socket.emit(
          EVENTS.GAME.ERROR_MESSAGE,
          parsed.error.issues[0].message.startsWith("errors:")
            ? parsed.error.issues[0].message
            : "errors:invalidRequest",
        )

        return
      }

      packet[1] = parsed.data
      next()
    })

    if (
      socket.data.claims.userId &&
      UserService.getUserById(socket.data.claims.userId)?.role === "admin"
    ) {
      socket.join("admins")
    }

    for (const handler of [
      managerSocketHandlers,
      quizzSocketHandlers,
      resultsSocketHandlers,
      gameSocketHandlers,
    ]) {
      handler({ io, socket })
    }
  })

  return io
}
