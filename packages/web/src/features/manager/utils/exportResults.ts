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

export const createResultsWorkbook = async (result: GameResult) => {
  const { default: ExcelJS } = await import("exceljs")
  const dateStr = new Date(result.date).toLocaleString()

  const rows: Array<Array<string | number>> = [
    [`Subject: ${result.subject}`],
    [`Date: ${dateStr}`],
    [
      `Game Mode: ${result.mode === "accuracy" ? "Accuracy Mode" : "Classic Mode"}`,
    ],
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

      const correct = pa.correct ?? isAnswerCorrect(pa.answerIds, q)

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

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet("Quiz Results")
  sheet.addRows(rows)
  sheet.getRow(5).font = { bold: true }
  sheet.views = [{ state: "frozen", ySplit: 5 }]
  sheet.columns.forEach((column, index) => {
    column.width = index < 4 ? [8, 24, 16, 20][index] : 42
  })
  sheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true }
  })

  return workbook
}

export const exportResultsToXlsx = async (result: GameResult) => {
  const workbook = await createResultsWorkbook(result)
  const data = await workbook.xlsx.writeBuffer()
  const bytes = new Uint8Array(data)
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  )
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${result.subject.replace(/[/\\?%*:|"<>\s]+/g, "_").slice(0, 120)}_results.xlsx`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
