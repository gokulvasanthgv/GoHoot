import { describe, expect, it } from "vitest"
import { createResultsWorkbook } from "@razzia/web/features/manager/utils/exportResults"
import type { GameResult } from "@razzia/common/types/game"

describe("Excel results compatibility", () => {
  it("preserves scoring mode, names, slides, puzzle ordering and server correctness", async () => {
    const result: GameResult = {
      id: "result",
      subject: "GoHoot results",
      date: "2026-11-06T12:00:00Z",
      mode: "accuracy",
      players: [{ username: "=not-a-formula", points: 2000, rank: 1 }],
      questions: [
        {
          type: "slide",
          question: "Welcome",
          text: "Information",
          cooldown: 3,
          time: 5,
          playerAnswers: [],
        },
        {
          type: "puzzle",
          question: "Sort",
          answers: ["One", "Two"],
          cooldown: 3,
          time: 20,
          playerAnswers: [
            {
              playerName: "=not-a-formula",
              answerIds: [0, 1],
              correct: true,
              points: 2000,
            },
          ],
        },
      ],
    }
    const workbook = await createResultsWorkbook(result)
    const sheet = workbook.getWorksheet("Quiz Results")

    if (!sheet) {
      throw new Error("Results worksheet is missing")
    }

    expect(sheet.getCell("A3").value).toContain("Accuracy Mode")
    expect(sheet.getCell("B6").value).toBe("=not-a-formula")
    expect(sheet.getCell("C6").value).toBe(2000)
    expect(sheet.getCell("E6").value).toBe("N/A (Slide)")
    expect(sheet.getCell("F6").value).toBe("Correct (1, 2)")
    const data = await workbook.xlsx.writeBuffer()
    expect(new Uint8Array(data).slice(0, 2)).toEqual(new Uint8Array([80, 75]))
  }, 20_000)
})
