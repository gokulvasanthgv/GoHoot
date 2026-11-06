import { describe, expect, it } from "vitest"
import type { Question } from "@razzia/common/types/game"
import { scoreAnswer } from "@razzia/socket/services/scoring/choice"

const question: Question = {
  type: "quiz",
  question: "Multi",
  answers: ["A", "B", "C"],
  solutions: [0, 2],
  cooldown: 3,
  time: 20,
}
describe("GoHoot scoring", () => {
  it("keeps partial credit in live games", () =>
    expect(scoreAnswer(question, [0], 1000)).toMatchObject({
      correct: true,
      points: 500,
    }))
  it("keeps accuracy and double-points modes", () =>
    expect(
      scoreAnswer({ ...question, doublePoints: true }, [0, 2], 1000),
    ).toMatchObject({ correct: true, points: 2000 }))
  it("keeps time-based classic points", () =>
    expect(scoreAnswer(question, [0, 2], 625)).toMatchObject({ points: 625 }))
  it.each(
    [[0, 0], [0, 0, 2], [-1], [3], [NaN], [Infinity]].map((selection) => ({
      selection,
    })),
  )(
    "does not inflate scores for invalid or duplicate selections $selection",
    ({ selection }) =>
      expect(scoreAnswer(question, selection, 1000).points).toBe(0),
  )
  it("rejects a wrong answer mixed with correct answers", () =>
    expect(scoreAnswer(question, [0, 1, 2], 1000).points).toBe(0))
  it("keeps exact-answer scoring for solo practice", () =>
    expect(scoreAnswer(question, [0], 1000, undefined, true).points).toBe(0))
  it("scores shuffled puzzle positions against the original order", () =>
    expect(
      scoreAnswer({ ...question, type: "puzzle" }, [1, 2, 0], 1000, [2, 0, 1]),
    ).toMatchObject({ correct: true, points: 1000, canonical: [0, 1, 2] }))
  it("does not award puzzle points for a partial order", () =>
    expect(
      scoreAnswer({ ...question, type: "puzzle" }, [1, 2], 1000, [2, 0, 1])
        .points,
    ).toBe(0))
  it("bounds base points even if an internal caller supplies a bad value", () => {
    expect(scoreAnswer(question, [0, 2], 20000).points).toBe(1000)
    expect(scoreAnswer(question, [0, 2], NaN).points).toBe(0)
  })
})
