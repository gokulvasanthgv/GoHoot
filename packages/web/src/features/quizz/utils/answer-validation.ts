import { MAX_ANSWER_LENGTH } from "@razzia/common/constants"
import type { Question } from "@razzia/common/types/game"

// Match the shared validator, which trims options before checking their length.
export const getAnswerLength = (answer: string): number => answer.trim().length

export const getOversizedAnswerIndexes = (question: Question): number[] =>
  (question.answers ?? []).flatMap((answer, index) =>
    getAnswerLength(answer) > MAX_ANSWER_LENGTH ? [index] : [],
  )

export const getAnswerInputId = (
  questionId: string,
  answerIndex: number,
): string => `answer-${questionId}-${answerIndex}`
