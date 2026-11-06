import { zValidator } from "@hono/zod-validator"
import { apiFactory } from "@razzia/socket/api/factory"
import {
  requireAccount,
  requireAdmin,
  requireManager,
} from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import {
  mediaUrlValidator,
  quizzValidator,
} from "@razzia/common/validators/quizz"
import {
  deleteQuizzPermanently,
  getGameConfig,
  getQuizzById,
  getTrashQuizzById,
  restoreQuizz,
  saveGameConfig,
  saveQuizz,
  trashQuizz,
  updateQuizz,
} from "@razzia/socket/services/config"
import { getManagerConfig } from "@razzia/socket/services/manager"
import { canEditQuiz } from "@razzia/socket/services/permissions"
import { z } from "zod"

export const configuration = apiFactory
  .createApp()
  .get("/", requireAccount, (c) => c.json(getManagerConfig(c.get("user"))))
  .patch(
    "/",
    requireAdmin,
    zValidator(
      "json",
      z.object({
        defaultWallpaper: mediaUrlValidator.optional(),
        defaultAudio: mediaUrlValidator.optional(),
      }),
      i18nHook,
    ),
    (c) => {
      saveGameConfig({ ...getGameConfig(), ...c.req.valid("json") })

      return c.json(getGameConfig())
    },
  )

export const quizz = apiFactory
  .createApp()
  .use(requireManager)
  .get("/", (c) =>
    c.json({
      quizz: getManagerConfig(c.get("user")).quizz,
    }),
  )
  .get("/:id", (c) => {
    const quiz = getQuizzById(c.req.param("id"))

    if (!canEditQuiz(c.get("user"), quiz)) {
      return c.json({ error: "errors:auth.unauthorized" }, 403)
    }

    return c.json(quiz)
  })
  .post("/", zValidator("json", quizzValidator, i18nHook), (c) =>
    c.json(saveQuizz(c.req.valid("json"), c.get("user").id), 201),
  )
  .patch("/:id", zValidator("json", quizzValidator, i18nHook), (c) => {
    const id = c.req.param("id")

    if (!canEditQuiz(c.get("user"), getQuizzById(id))) {
      return c.json({ error: "errors:auth.unauthorized" }, 403)
    }

    return c.json(updateQuizz(id, c.req.valid("json")))
  })
  .delete("/:id", (c) => {
    const id = c.req.param("id")

    if (!canEditQuiz(c.get("user"), getQuizzById(id))) {
      return c.json({ error: "errors:auth.unauthorized" }, 403)
    }

    trashQuizz(id, c.get("user").id)

    return c.body(null, 204)
  })

export const trash = apiFactory
  .createApp()
  .use(requireManager)
  .get("/", (c) =>
    c.json({
      trash: getManagerConfig(c.get("user")).trash,
    }),
  )
  .post("/:id/restore", (c) => {
    const user = c.get("user")
    const quiz = getTrashQuizzById(c.req.param("id"))

    if (
      !canEditQuiz(user, quiz) ||
      (user.role !== "admin" &&
        Date.now() - new Date(quiz.deletedAt ?? "").getTime() >
          90 * 24 * 60 * 60_000)
    ) {
      return c.json({ error: "errors:auth.unauthorized" }, 403)
    }

    restoreQuizz(quiz.id)

    return c.json({ id: quiz.id })
  })
  .delete("/:id", requireAdmin, (c) => {
    deleteQuizzPermanently(c.req.param("id"))

    return c.body(null, 204)
  })
