import { EVENTS, MAX_ANSWERS } from "@razzia/common/constants"
import {
  adminResetPasswordValidator,
  changePasswordValidator,
  inviteCodeValidator,
  roleValidator,
  signInValidator,
  signUpValidator,
} from "@razzia/common/validators/auth"
import {
  mediaUrlValidator,
  quizzValidator,
} from "@razzia/common/validators/quizz"
import { z } from "zod"

const id = z.string().min(1).max(128)
const game = z.object({ gameId: id })
const nothing = z.undefined()
const answers = z
  .array(
    z
      .number()
      .int()
      .min(0)
      .max(MAX_ANSWERS - 1),
  )
  .min(1)
  .max(MAX_ANSWERS)
  .refine((keys) => new Set(keys).size === keys.length)

export const clientEventValidators: Record<string, z.ZodType> = {
  [EVENTS.GAME.CREATE]: id,
  [EVENTS.MANAGER.AUTH]: z.string().min(1).max(256),
  [EVENTS.MANAGER.SIGN_IN]: signInValidator,
  [EVENTS.MANAGER.SIGN_UP]: signUpValidator,
  [EVENTS.MANAGER.LOGOUT]: nothing,
  [EVENTS.MANAGER.GET_CONFIG]: nothing,
  [EVENTS.MANAGER.GET_CURRENT_USER]: nothing,
  [EVENTS.MANAGER.GET_USERS]: nothing,
  [EVENTS.MANAGER.RECONNECT]: game,
  [EVENTS.MANAGER.LEAVE]: game,
  [EVENTS.MANAGER.KICK_PLAYER]: game.extend({ playerId: id }),
  [EVENTS.MANAGER.START_GAME]: game.extend({
    mode: z.enum(["classic", "accuracy"]).optional(),
    options: z
      .object({
        shuffleQuestions: z.boolean().optional(),
        doubleTime: z.boolean().optional(),
        shuffleAnswers: z.boolean().optional(),
        hideTextOnClient: z.boolean().optional(),
      })
      .optional(),
  }),
  [EVENTS.MANAGER.ABORT_QUIZ]: game,
  [EVENTS.MANAGER.NEXT_QUESTION]: game,
  [EVENTS.MANAGER.SHOW_LEADERBOARD]: game,
  [EVENTS.MANAGER.GO_TO_QUESTION]: game.extend({
    index: z.number().int().min(0).max(499),
  }),
  [EVENTS.MANAGER.END_GAME]: game,
  [EVENTS.MANAGER.UPDATE_SETTINGS]: z.object({
    defaultWallpaper: mediaUrlValidator.optional(),
    defaultAudio: mediaUrlValidator.optional(),
  }),
  [EVENTS.MANAGER.UPDATE_GAME_SETTINGS]: game.extend({
    wallpaper: mediaUrlValidator.optional(),
    audio: mediaUrlValidator.optional(),
  }),
  [EVENTS.MANAGER.UPDATE_USER_ROLE]: z.object({
    userId: id,
    role: roleValidator,
  }),
  [EVENTS.MANAGER.DELETE_USER]: id,
  [EVENTS.MANAGER.CHANGE_PASSWORD]: changePasswordValidator,
  [EVENTS.MANAGER.ADMIN_RESET_PASSWORD]: adminResetPasswordValidator,
  [EVENTS.MANAGER.FORGOT_PASSWORD]: z.object({
    username: z.string().trim().min(1).max(64),
  }),
  [EVENTS.MANAGER.DISMISS_NOTIFICATION]: z.object({ requestId: id }),
  [EVENTS.QUIZZ.GET]: id,
  [EVENTS.QUIZZ.SAVE]: quizzValidator,
  [EVENTS.QUIZZ.UPDATE]: quizzValidator.extend({ id }),
  [EVENTS.QUIZZ.DELETE]: id,
  [EVENTS.QUIZZ.GET_TRASH]: nothing,
  [EVENTS.QUIZZ.RESTORE]: id,
  [EVENTS.QUIZZ.DELETE_PERMANENTLY]: id,
  [EVENTS.QUIZZ.GET_SOLO]: id,
  [EVENTS.PLAYER.JOIN]: inviteCodeValidator,
  [EVENTS.PLAYER.LOGIN]: z.object({ ticket: z.string().min(1).max(4096) }),
  [EVENTS.PLAYER.RECONNECT]: game,
  [EVENTS.PLAYER.LEAVE]: game,
  [EVENTS.PLAYER.SELECTED_ANSWER]: game.extend({
    data: z.object({
      answerKey: z.union([
        z
          .number()
          .int()
          .min(0)
          .max(MAX_ANSWERS - 1),
        answers,
      ]),
    }),
  }),
  [EVENTS.RESULTS.GET]: id,
  [EVENTS.RESULTS.DELETE]: id,
  [EVENTS.RESULTS.SAVE_SOLO]: z.never(),
  [EVENTS.RESULTS.PLAYER_DASHBOARD]: nothing,
}
