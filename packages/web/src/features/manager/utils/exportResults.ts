import * as XLSX from "xlsx"
import type { GameResult, QuestionResult } from "@razzia/common/types/game"

const ANSWERS_LABELS = ["A", "B", "C", "D", "E", "F", "G"]

const isAnswerCorrect = (answerIds: number[] | null, qr: QuestionResult) => {
  if (!answerIds || answerIds.length === 0) {
    return false
  }

  if (qr.type === "puzzle") {
    const totalAnswers = qr.answers?.length ?? 0

    if (answerIds.length !== totalAnswers) {
      return false
    }

    return answerIds.every((val, index) => val === index)
  }

  const solutions = qr.solutions ?? []

  return answerIds.every((id) => solutions.includes(id))
}

const getAnswerLabel = (val: number, type?: string) => {
  if (type === "puzzle") {
    return `${val + 1}`
  }

  return ANSWERS_LABELS[val % ANSWERS_LABELS.length]
}

export const exportResultsToXlsx = (result: GameResult) => {
  const dateStr = new Date(result.date).toLocaleString()

  const rows: Array<Array<string | number>> = [
    [`Subject: ${result.subject}`],
    [`Date: ${dateStr}`],
    [`Game Mode: ${result.mode === "accuracy" ? "Accuracy Mode" : "Classic Mode"}`],
    [],
    [
      "Rank",
      "Nickname",
      "Total Points",
      "Correct Answers",
      ...result.questions.map((q, idx) => `Q${idx + 1}: ${q.question}`),
    ],
  ]

  const totalQuestions = result.questions.filter(
    (q) => q.type !== "slide",
  ).length

  result.players.forEach((player) => {
    let correctCount = 0

    const playerCols: string[] = []

    result.questions.forEach((q) => {
      if (q.type === "slide") {
        playerCols.push("N/A (Slide)")

        return
      }

      const pa = q.playerAnswers.find((a) => a.playerName === player.username)

      if (!pa || !pa.answerIds || pa.answerIds.length === 0) {
        playerCols.push("No Answer")

        return
      }

      const correct = isAnswerCorrect(pa.answerIds, q)

      if (correct) {
        correctCount += 1
      }

      const labels = pa.answerIds
        .map((val) => getAnswerLabel(val, q.type))
        .join(", ")

      playerCols.push(`${correct ? "Correct" : "Incorrect"} (${labels})`)
    })

    rows.push([
      player.rank,
      player.username,
      player.points,
      `${correctCount} / ${totalQuestions}`,
      ...playerCols,
    ])
  })

  const ws = XLSX.utils.aoa_to_sheet(rows)

  const wb = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(wb, ws, "Quiz Results")

  XLSX.writeFile(
    wb,
    `${result.subject.replace(/[/\\?%*:|"<>\s]+/g, "_")}_results.xlsx`,
  )
}
