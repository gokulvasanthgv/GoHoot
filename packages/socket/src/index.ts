import { createAdaptorServer } from "@hono/node-server"
import { app, createSocketServer } from "@razzia/socket/app"
import { socketPort } from "@razzia/socket/env"
import { initConfig } from "@razzia/socket/services/config"
import Registry from "@razzia/socket/services/registry"
import UserService from "@razzia/socket/services/user"

const start = async () => {
  initConfig()
  await UserService.initialize()
  const server = createAdaptorServer({ fetch: app.fetch })
  const io = createSocketServer(server)
  server.listen(socketPort, () =>
    console.log(`GoHoot server running on port ${socketPort}`),
  )
  const stop = () => {
    Registry.getInstance().cleanup()
    io.close()
    server.close()
    process.exit(0)
  }
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
}

process.on("uncaughtException", (error) =>
  console.error("Uncaught exception:", error),
)
process.on("unhandledRejection", (reason) =>
  console.error("Unhandled rejection:", reason),
)
void start().catch((error: unknown) => {
  console.error("Could not start GoHoot:", error)
  process.exitCode = 1
})
