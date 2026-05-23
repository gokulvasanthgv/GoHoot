import type { Server } from "@razzia/common/types/game/socket"
import { gameSocketHandlers } from "@razzia/socket/handlers/game"
import { managerSocketHandlers } from "@razzia/socket/handlers/manager"
import { quizzSocketHandlers } from "@razzia/socket/handlers/quizz"
import { resultsSocketHandlers } from "@razzia/socket/handlers/results"
import type { SocketHandler } from "@razzia/socket/handlers/types"
import { initConfig, getPath } from "@razzia/socket/services/config"
import Registry from "@razzia/socket/services/registry"
import { Server as ServerIO } from "socket.io"
import http from "http"
import fs from "fs"
import { extname } from "path"
import { uploadMedia } from "@razzia/socket/services/upload"
import manager from "@razzia/socket/services/manager"

const WS_PORT = 3001

initConfig()

const server = http.createServer((req, res) => {
  // Add CORS headers to enable API uploads from other origins if needed
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Client-ID")

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  // HTTP POST upload endpoint
  if (req.url?.startsWith("/uploads") && req.method === "POST") {
    try {
      const parsedUrl = new URL(
        req.url,
        `http://${req.headers.host ?? "localhost"}`,
      )
      const filename = parsedUrl.searchParams.get("filename") ?? "file"
      const fileType =
        parsedUrl.searchParams.get("fileType") ?? "application/octet-stream"
      const clientId =
        parsedUrl.searchParams.get("clientId") ??
        (req.headers["x-client-id"] as string | undefined)

      if (!clientId || !manager.isLoggedClientId(clientId)) {
        res.writeHead(401, { "Content-Type": "application/json" })
        res.end(JSON.stringify({ success: false, error: "Unauthorized" }))
        return
      }

      const chunks: Buffer[] = []
      req.on("data", (chunk: unknown) => {
        chunks.push(chunk as Buffer)
      })
      req.on("end", () => {
        ;(async () => {
          try {
            const buffer = Buffer.concat(chunks)
            const result = await uploadMedia(filename, fileType, buffer)
            res.writeHead(200, { "Content-Type": "application/json" })
            res.end(JSON.stringify(result))
          } catch (err) {
            console.error("HTTP upload error:", err)
            res.writeHead(500, { "Content-Type": "application/json" })
            res.end(
              JSON.stringify({
                success: false,
                error: "errors:quizz.uploadFailed",
              }),
            )
          }
        })().catch((err) => {
          console.error("Unhandled upload promise error:", err)
        })
      })
      req.on("error", (err) => {
        console.error("HTTP upload stream error:", err)
        res.writeHead(500, { "Content-Type": "application/json" })
        res.end(
          JSON.stringify({
            success: false,
            error: "errors:quizz.uploadFailed",
          }),
        )
      })
    } catch (err) {
      console.error("HTTP upload parameter parse error:", err)
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({ success: false, error: "Invalid Request" }))
    }
    return
  }

  if (req.url?.startsWith("/uploads/")) {
    const decodedUrl = decodeURIComponent(req.url)
    const filePath = getPath(decodedUrl.substring(1))
    const uploadsDir = getPath("uploads")

    // Check directory traversal
    if (!filePath.startsWith(uploadsDir)) {
      res.writeHead(403, { "Content-Type": "text/plain" })
      res.end("Forbidden")
      return
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/plain" })
        res.end("Not Found")
        return
      }

      const ext = extname(filePath).toLowerCase()
      let contentType = "application/octet-stream"
      if (ext === ".webp") contentType = "image/webp"
      else if (ext === ".png") contentType = "image/png"
      else if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg"
      else if (ext === ".gif") contentType = "image/gif"
      else if (ext === ".mp4") contentType = "video/mp4"
      else if (ext === ".webm") contentType = "video/webm"
      else if (ext === ".ogg") contentType = "video/ogg"
      else if (ext === ".mp3") contentType = "audio/mpeg"
      else if (ext === ".wav") contentType = "audio/wav"
      else if (ext === ".m4a") contentType = "audio/mp4"

      res.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": stats.size,
        "Access-Control-Allow-Origin": "*",
      })

      const stream = fs.createReadStream(filePath)
      stream.pipe(res)
    })
    return
  }

  res.writeHead(404, { "Content-Type": "text/plain" })
  res.end("Not Found")
})

const io: Server = new ServerIO(server, {
  path: "/ws",
  maxHttpBufferSize: 1e8, // 100MB
})

console.log(`Socket server running on port ${WS_PORT}`)
server.listen(WS_PORT)

const socketHandlers: SocketHandler[] = [
  managerSocketHandlers,
  quizzSocketHandlers,
  gameSocketHandlers,
  resultsSocketHandlers,
]

io.on("connection", (socket) => {
  console.log(
    `A user connected: socketId: ${socket.id}, clientId: ${socket.handshake.auth.clientId}`,
  )

  socketHandlers.forEach((handler) => {
    handler({ io, socket })
  })
})

process.on("SIGINT", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})

process.on("SIGTERM", () => {
  Registry.getInstance().cleanup()
  process.exit(0)
})
