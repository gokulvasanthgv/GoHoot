import { zValidator } from "@hono/zod-validator"
import { apiFactory } from "@razzia/socket/api/factory"
import { requireManager, requireSession } from "@razzia/socket/api/middleware"
import { i18nHook } from "@razzia/socket/api/validation"
import {
  inviteCodeValidator,
  usernameValidator,
} from "@razzia/common/validators/auth"
import { mediaUrlValidator } from "@razzia/common/validators/quizz"
import { mintJoinTicket } from "@razzia/socket/services/auth"
import { getQuizzById } from "@razzia/socket/services/config"
import { getIo } from "@razzia/socket/services/io"
import { canEditQuiz } from "@razzia/socket/services/permissions"
import Game from "@razzia/socket/services/game"
import Registry from "@razzia/socket/services/registry"
import { z } from "zod"

export const games = apiFactory
  .createApp()
  .post(
    "/",
    requireManager,
    zValidator(
      "json",
      z.object({ quizzId: z.string().min(1).max(128) }),
      i18nHook,
    ),
    (c) => {
      const quiz = getQuizzById(c.req.valid("json").quizzId)
      const claims = c.get("claims")

      if (!canEditQuiz(c.get("user"), quiz)) {
        return c.json({ error: "errors:auth.unauthorized" }, 403)
      }

      if (quiz.incompatible) {
        return c.json({ error: "errors:quizz.incompatible" }, 400)
      }

      const registry = Registry.getInstance()

      if (
        registry
          .getAllGames()
          .filter((game) => game.creatorId === claims.userId).length >= 10
      ) {
        return c.json({ error: "errors:game.tooManyGames" }, 429)
      }

      const game = new Game(getIo(), claims.sub, quiz, c.get("user").id)
      registry.addGame(game)
      registry.markGameAsEmpty(game)

      return c.json(
        {
          gameId: game.gameId,
          inviteCode: game.inviteCode,
          wallpaper: game.wallpaper,
          audio: game.audio,
        },
        201,
      )
    },
  )
  .post(
    "/check",
    requireSession,
    zValidator("json", z.object({ inviteCode: inviteCodeValidator }), i18nHook),
    (c) => {
      const game = Registry.getInstance().getGameByInviteCode(
        c.req.valid("json").inviteCode,
      )

      if (!game) {
        return c.json({ error: "errors:game.notFound" }, 404)
      }

      const player = game.players.find(
        (item) => item.clientId === c.get("claims").sub,
      )

      return c.json({
        gameId: game.gameId,
        alreadyJoined: Boolean(player),
        username: player?.username,
      })
    },
  )
  .post(
    "/join",
    requireSession,
    zValidator(
      "json",
      z.object({
        inviteCode: inviteCodeValidator,
        username: usernameValidator,
      }),
      i18nHook,
    ),
    async (c) => {
      const { inviteCode, username } = c.req.valid("json")
      const game = Registry.getInstance().getGameByInviteCode(inviteCode)

      if (!game) {
        return c.json({ error: "errors:game.notFound" }, 404)
      }

      const { sub } = c.get("claims")

      if (game.manager.clientId === sub) {
        return c.json({ error: "errors:game.managerCannotJoin" }, 403)
      }

      const player = game.players.find((item) => item.clientId === sub)

      if (player) {
        return c.json({
          gameId: game.gameId,
          ticket: null,
          username: player.username,
        })
      }

      if (game.started) {
        return c.json({ error: "errors:game.alreadyStarted" }, 409)
      }

      return c.json({
        gameId: game.gameId,
        ticket: await mintJoinTicket(sub, game.gameId, username),
        username,
      })
    },
  )
  .patch(
    "/:gameId/settings",
    requireManager,
    zValidator(
      "json",
      z.object({
        wallpaper: mediaUrlValidator.optional(),
        audio: mediaUrlValidator.optional(),
      }),
      i18nHook,
    ),
    (c) => {
      const game = Registry.getInstance().getGameById(c.req.param("gameId"))
      const claims = c.get("claims")

      if (
        !game ||
        game.manager.clientId !== claims.sub ||
        game.creatorId !== claims.userId
      ) {
        return c.json({ error: "errors:game.notFound" }, 404)
      }

      const { wallpaper, audio } = c.req.valid("json")
      game.updateSettings(wallpaper, audio)

      return c.json({ wallpaper: game.wallpaper, audio: game.audio })
    },
  )
