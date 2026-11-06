import { getPlayerDashboard } from "@razzia/socket/services/dashboard"
import { zValidator } from "@hono/zod-validator"
import { apiFactory } from "@razzia/socket/api/factory"
import { requireAccount, requireAdmin } from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import {
  deleteResult,
  getQuizzById,
  getResultById,
  getResultsMeta,
  saveResult,
} from "@razzia/socket/services/config"
import { canPlaySolo, canReadResult } from "@razzia/socket/services/permissions"
import type { GameResult } from "@razzia/common/types/game"
import { randomUUID } from "node:crypto"
import { z } from "zod"

export const results = apiFactory
  .createApp()
  .use(requireAccount)
  .get("/", (c) => {
    const user = c.get("user")

    return c.json({
      results: getResultsMeta().filter((meta) => {
        try {
          return canReadResult(user, getResultById(meta.id))
        } catch {
          return false
        }
      }),
    })
  })
  .get("/:id", (c) => {
    const result = getResultById(c.req.param("id"))

    if (!canReadResult(c.get("user"), result)) {
      return c.json({ error: "errors:auth.unauthorized" }, 403)
    }

    return c.json(result)
  })
  .delete("/:id", requireAdmin, (c) => {
    deleteResult(c.req.param("id"))

    return c.body(null, 204)
  })

export const dashboard = apiFactory
  .createApp()
  .use(requireAccount)
  .get("/", (c) => {
    const userId = c.get("user").id
    const attended = getPlayerDashboard(userId)

    return c.json({ attended })
  })

const soloAnswers = z.object({
  answers: z.record(
    z.string().regex(/^\d{1,3}$/u),
    z.array(z.number().int().min(0).max(6)).max(7).nullable(),
  ),
})

export const solo = apiFactory
  .createApp()
  .use(requireAccount)
  .get("/:id", (c) => {
    const quiz = getQuizzById(c.req.param("id"))

    if (!canPlaySolo(c.get("user"), quiz)) {
      return c.json({ error: "errors:auth.unauthorized" }, 403)
    }

    if (quiz.incompatible) {
      return c.json({ error: "errors:quizz.incompatible" }, 400)
    }

    return c.json(quiz)
  })
  .post("/:id/results", zValidator("json", soloAnswers, i18nHook), (c) => {
    const quiz = getQuizzById(c.req.param("id"))
    const user = c.get("user")

    if (!canPlaySolo(user, quiz)) {
      return c.json({ error: "errors:auth.unauthorized" }, 403)
    }

    if (quiz.incompatible) {
      return c.json({ error: "errors:quizz.incompatible" }, 400)
    }

    const { answers } = c.req.valid("json")
    let total = 0
    const questions = quiz.questions.map((question, index) => {
      const selection = answers[String(index)] ?? null
      const valid =
        selection !== null &&
        new Set(selection).size === selection.length &&
        selection.every((value) => value < (question.answers?.length ?? 0))
      const correct =
        valid &&
        (question.type === "puzzle"
          ? selection.length === question.answers?.length &&
            selection.every((value, position) => value === position)
          : selection.length === question.solutions?.length &&
            selection.every((value) => question.solutions?.includes(value)))
      const points = correct ? (question.doublePoints ? 2000 : 1000) : 0
      total += points

      return {
        ...question,
        playerAnswers: [
          {
            playerName: user.username,
            userId: user.id,
            answerIds: valid ? selection : null,
            correct,
            points,
          },
        ],
      }
    })
    const result: GameResult = {
      id: `solo-${randomUUID()}`,
      quizzId: quiz.id,
      subject: quiz.subject,
      date: new Date().toISOString(),
      creatorId: user.id,
      mode: "classic",
      players: [
        { username: user.username, userId: user.id, points: total, rank: 1 },
      ],
      questions,
    }
    saveResult(result)

    return c.json(result, 201)
  })
