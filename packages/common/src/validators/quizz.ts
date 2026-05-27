import { MEDIA_TYPES } from "@razzia/common/constants"
import { z } from "zod"

export const questionMediaValidator = z.object({
  type: z
    .enum([MEDIA_TYPES.IMAGE, MEDIA_TYPES.VIDEO, MEDIA_TYPES.AUDIO])
    .optional(),
  url: z.string().min(1, "errors:quizz.invalidMediaUrl"),
})

const questionValidator = z.object({
  type: z.enum(["quiz", "slide", "puzzle", "true_or_false"]).optional().default("quiz"),
  question: z.string().min(1, "errors:quizz.questionEmpty"),
  text: z.string().optional(),
  media: questionMediaValidator.optional(),
  answers: z
    .array(z.string().min(1, "errors:quizz.answerEmpty").max(65, "errors:quizz.answerTooLong"))
    .min(2, "errors:quizz.tooFewAnswers")
    .max(7, "errors:quizz.tooManyAnswers")
    .optional(),
  solutions: z
    .union([z.number().int().min(0), z.array(z.number().int().min(0))])
    .optional()
    .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
  cooldown: z.number().int().min(3).max(15).optional().default(5),
  time: z.number().int().min(5).max(120).optional().default(20),
})

export const quizzValidator = z.object({
  subject: z.string().min(1, "errors:quizz.subjectEmpty"),
  questions: z.array(questionValidator).min(1, "errors:quizz.noQuestions"),
  wallpaper: z.string().optional(),
})

export type QuizzValidated = z.infer<typeof quizzValidator>
