import { describe, expect, it } from "vitest"
import {
  quizzValidator,
  mediaUrlValidator,
} from "@razzia/common/validators/quizz"
import { clientEventValidators } from "@razzia/common/validators/socket"
import { EVENTS } from "@razzia/common/constants"

const valid = () => ({
  subject: "Example",
  questions: [
    {
      type: "quiz",
      question: "Question",
      answers: ["A", "B"],
      solutions: [0],
      cooldown: 3,
      time: 5,
    },
  ],
})
describe("quiz validation", () => {
  it("reads legacy scalar solutions and supplies default timings", () => {
    const parsed = quizzValidator.parse({
      subject: "Old quiz",
      questions: [{ question: "Legacy", answers: ["A", "B"], solutions: 0 }],
    })
    expect(parsed.questions[0]).toMatchObject({
      type: "quiz",
      solutions: [0],
      time: 20,
      cooldown: 5,
    })
  })
  it.each(["quiz", "puzzle", "true_or_false"])(
    "preserves %s questions and double points",
    (type) => {
      const data = valid()
      data.questions[0].type = type
      expect(
        quizzValidator.safeParse({
          ...data,
          questions: [{ ...data.questions[0], doublePoints: true }],
        }).success,
      ).toBe(true)
    },
  )
  it("preserves informational slides without answers", () =>
    expect(
      quizzValidator.safeParse({
        subject: "Slides",
        questions: [{ type: "slide", question: "Title", text: "Body" }],
      }).success,
    ).toBe(true))
  it.each(
    [[0, 0], [-1], [2], [], [0, 1, 2]].map((solutions) => ({ solutions })),
  )("rejects invalid solution indices $solutions", ({ solutions }) => {
    const data = valid()
    data.questions[0].solutions = solutions
    expect(quizzValidator.safeParse(data).success).toBe(false)
  })
  it.each([0, 1, 8])("rejects %i choice answers", (count) => {
    const data = valid()
    data.questions[0].answers = Array.from({ length: count }, () => "Option")
    expect(quizzValidator.safeParse(data).success).toBe(false)
  })
  it.each([
    // oxlint-disable-next-line no-script-url -- Verify that script URLs are rejected.
    "javascript:alert(1)",
    "data:text/html,hello",
    "file:///etc/passwd",
    "/uploads/../users.json",
    "//attacker.test/a.png",
  ])("rejects unsafe media URL %s", (url) =>
    expect(mediaUrlValidator.safeParse(url).success).toBe(false),
  )
  it.each([
    "https://example.com/image.png",
    "http://localhost/image.png",
    "/uploads/abc-123.webp",
    "",
  ])("accepts supported media URL %s", (url) =>
    expect(mediaUrlValidator.safeParse(url).success).toBe(true),
  )
  it("rejects duplicate multi-answer submissions", () =>
    expect(
      clientEventValidators[EVENTS.PLAYER.SELECTED_ANSWER].safeParse({
        gameId: "room",
        data: { answerKey: [0, 0] },
      }).success,
    ).toBe(false))
  it.each([
    null,
    {},
    { gameId: 9 },
    { gameId: "room", data: null },
    { gameId: "room", data: { answerKey: [NaN] } },
  ])("rejects malformed answer payload %j", (payload) =>
    expect(
      clientEventValidators[EVENTS.PLAYER.SELECTED_ANSWER].safeParse(payload)
        .success,
    ).toBe(false),
  )
  it("requires a signed join ticket instead of a claimed username and game ID", () =>
    expect(
      clientEventValidators[EVENTS.PLAYER.LOGIN].safeParse({
        gameId: "room",
        data: { username: "Someone" },
      }).success,
    ).toBe(false))
  it("rejects client-calculated solo result records", () =>
    expect(
      clientEventValidators[EVENTS.RESULTS.SAVE_SOLO].safeParse({
        id: "../users",
        players: [],
      }).success,
    ).toBe(false))
})
