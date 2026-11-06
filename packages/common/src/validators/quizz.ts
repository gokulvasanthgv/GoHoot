import { MAX_ANSWERS, MEDIA_TYPES } from "@razzia/common/constants"
import { z } from "zod"

export const mediaUrlValidator = z
  .string()
  .max(2048)
  .refine((value) => {
    if (value === "") {
      return true
    }

    if (/^\/uploads\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/u.test(value)) {
      return true
    }

    try {
      const url = new URL(value)

      return (
        ["http:", "https:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      )
    } catch {
      return false
    }
  }, "errors:quizz.invalidMediaUrl")

export const questionMediaValidator = z.object({
  type: z
    .enum([MEDIA_TYPES.IMAGE, MEDIA_TYPES.VIDEO, MEDIA_TYPES.AUDIO])
    .optional(),
  url: mediaUrlValidator.refine(
    (value) => value.length > 0,
    "errors:quizz.invalidMediaUrl",
  ),
})

export const questionValidator = z
  .object({
    type: z
      .enum(["quiz", "slide", "puzzle", "true_or_false"])
      .optional()
      .default("quiz"),
    question: z.string().trim().min(1, "errors:quizz.questionEmpty").max(4000),
    text: z.string().max(20000).optional(),
    media: questionMediaValidator.optional(),
    answers: z
      .array(
        z
          .string()
          .trim()
          .min(1, "errors:quizz.answerEmpty")
          .max(65, "errors:quizz.answerTooLong"),
      )
      .min(2)
      .max(MAX_ANSWERS)
      .optional(),
    solutions: z
      .union([
        z.number().int().nonnegative(),
        z.array(z.number().int().nonnegative()).max(MAX_ANSWERS),
      ])
      .optional()
      .transform((value) =>
        value === undefined ? [] : Array.isArray(value) ? value : [value],
      ),
    cooldown: z.number().int().min(3).max(15).optional().default(5),
    time: z.number().int().min(5).max(120).optional().default(20),
    doublePoints: z.boolean().optional(),
  })
  .superRefine((question, context) => {
    if (question.type === "slide") {
      return
    }

    if (!question.answers || question.answers.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["answers"],
        message: "errors:quizz.tooFewAnswers",
      })
    }

    if (question.type === "puzzle") {
      return
    }

    if (
      !question.solutions.length ||
      new Set(question.solutions).size !== question.solutions.length ||
      question.solutions.some(
        (index) => index >= (question.answers?.length ?? 0),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["solutions"],
        message: "errors:quizz.invalidSolutions",
      })
    }

    if (
      question.type === "true_or_false" &&
      (question.answers?.length !== 2 || question.solutions.length !== 1)
    ) {
      context.addIssue({
        code: "custom",
        path: ["solutions"],
        message: "errors:quizz.invalidSolutions",
      })
    }
  })

export const quizzValidator = z.object({
  subject: z.string().trim().min(1, "errors:quizz.subjectEmpty").max(500),
  questions: z
    .array(questionValidator)
    .min(1, "errors:quizz.noQuestions")
    .max(500),
  wallpaper: mediaUrlValidator.optional(),
  audio: mediaUrlValidator.optional(),
  creatorId: z.string().max(128).optional(),
  deletedAt: z.string().max(128).optional(),
  deletedBy: z.string().max(128).optional(),
})

export type QuizzValidated = z.infer<typeof quizzValidator>
