import { Hono } from "hono"
import { auth, users } from "@razzia/socket/api/routes/auth"
import { games } from "@razzia/socket/api/routes/games"
import { configuration, quizz, trash } from "@razzia/socket/api/routes/quizz"
import { dashboard, results, solo } from "@razzia/socket/api/routes/results"
import { media } from "@razzia/socket/api/routes/media"

export const api = new Hono()
  .get("/health", (c) => c.json({ status: "ok" }))
  .route("/auth", auth)
  .route("/users", users)
  .route("/config", configuration)
  .route("/quizz", quizz)
  .route("/trash", trash)
  .route("/results", results)
  .route("/dashboard", dashboard)
  .route("/solo", solo)
  .route("/games", games)
  .route("/media", media)

export type ApiType = typeof api
