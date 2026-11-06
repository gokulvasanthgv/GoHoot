import type { Question } from "@razzia/common/types/game"

export const scoreAnswer = (
  question: Question,
  selection: number[],
  basePoints: number,
  puzzleMap?: number[],
  exact = false,
): { correct: boolean; points: number; canonical: number[] } => {
  const answers = question.answers ?? []
  const valid =
    selection.length > 0 &&
    new Set(selection).size === selection.length &&
    selection.every(
      (value) =>
        Number.isInteger(value) && value >= 0 && value < answers.length,
    )

  if (!valid || !Number.isFinite(basePoints)) {
    return { correct: false, points: 0, canonical: [] }
  }

  const canonical = puzzleMap
    ? selection.map((index) => puzzleMap[index])
    : [...selection]
  const multiplier = question.doublePoints ? 2 : 1

  if (question.type === "puzzle") {
    const correct =
      selection.length === answers.length &&
      canonical.every((value, index) => value === index)

    return {
      correct,
      points: correct
        ? Math.round(Math.max(0, Math.min(1000, basePoints)) * multiplier)
        : 0,
      canonical,
    }
  }

  const solutions = question.solutions ?? []
  const correct =
    solutions.length > 0 &&
    selection.every((value) => solutions.includes(value)) &&
    (!exact || selection.length === solutions.length)

  return {
    correct,
    points: correct
      ? Math.round(
          Math.max(0, Math.min(1000, basePoints)) *
            (selection.length / solutions.length) *
            multiplier,
        )
      : 0,
    canonical,
  }
}
