import { EXAMPLE_QUIZZ } from "@razzia/common/constants"
import type {
  GameResult,
  GameResultMeta,
  QuizzWithId,
} from "@razzia/common/types/game"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { normalizeFilename } from "@razzia/socket/utils/game"
import fs from "fs"
import { resolve, join } from "path"
import UserService from "./user"

interface GameConfig {
  managerPassword: string
  defaultWallpaper?: string
  defaultAudio?: string
}

export const saveGameConfig = (config: GameConfig): void => {
  fs.writeFileSync(getPath("game.json"), JSON.stringify(config, null, 2))
}

const inContainerPath = process.env.CONFIG_PATH

export const getPath = (path = "") =>
  inContainerPath
    ? resolve(inContainerPath, path)
    : resolve(process.cwd(), "../../config", path)

export const initConfig = () => {
  const isConfigFolderExists = fs.existsSync(getPath())

  if (!isConfigFolderExists) {
    fs.mkdirSync(getPath())
  }

  const isGameConfigExists = fs.existsSync(getPath("game.json"))

  if (!isGameConfigExists) {
    fs.writeFileSync(
      getPath("game.json"),
      JSON.stringify(
        {
          managerPassword: "PASSWORD",
        },
        null,
        2,
      ),
    )
  }

  const isQuizzExists = fs.existsSync(getPath("quizz"))

  if (!isQuizzExists) {
    fs.mkdirSync(getPath("quizz"))

    fs.writeFileSync(
      getPath("quizz/example.json"),
      JSON.stringify(EXAMPLE_QUIZZ, null, 2),
    )
  }
}

export const getGameConfig = (): GameConfig => {
  const isExists = fs.existsSync(getPath("game.json"))

  if (!isExists) {
    throw new Error("Game config not found")
  }

  try {
    const config = fs.readFileSync(getPath("game.json"), "utf-8")

    return JSON.parse(config) as GameConfig
  } catch (error) {
    console.error("Failed to read game config:", error)
  }

  return {} as GameConfig
}

const getAdminUserId = (): string => {
  const admin = UserService.getAllUsers().find(u => u.username === "admin")
  return admin ? admin.id : ""
}

export const getQuizzMeta = () =>
  getQuizz().map(({ id, subject, incompatible, creatorId, deletedAt }) => ({ id, subject, incompatible, creatorId, deletedAt }))

export const loadQuizz = (id: string): QuizzWithId => {
  const filePath = getPath(`quizz/${id}.json`)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Quizz "${id}" not found`)
  }

  const data = fs.readFileSync(filePath, "utf-8")
  const parsed = JSON.parse(data)
  const result = quizzValidator.safeParse(parsed)

  if (!result.success) {
    if (parsed && typeof parsed.subject === "string" && Array.isArray(parsed.questions)) {
      return {
        id,
        subject: parsed.subject,
        questions: parsed.questions,
        wallpaper: parsed.wallpaper,
        incompatible: true,
        creatorId: parsed.creatorId || getAdminUserId()
      } as any
    }
    throw new Error(`Invalid quizz "${id}"`)
  }

  const quizData = { id, ...result.data }
  if (!quizData.creatorId) {
    quizData.creatorId = getAdminUserId()
  }

  return quizData
}

export const getQuizzById = (id: string) => {
  const filePath = getPath(`quizz/${id}.json`)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Quizz "${id}" not found`)
  }

  const data = fs.readFileSync(filePath, "utf-8")
  const result = quizzValidator.safeParse(JSON.parse(data))

  if (!result.success) {
    throw new Error(`Invalid quizz "${id}"`)
  }

  const quizData = { id, ...result.data }
  if (!quizData.creatorId) {
    quizData.creatorId = getAdminUserId()
  }

  return quizData
}

export const getQuizz = () => {
  const isExists = fs.existsSync(getPath("quizz"))

  if (!isExists) {
    return []
  }

  try {
    const files = fs
      .readdirSync(getPath("quizz"))
      .filter((file) => file.endsWith(".json"))

    const quizz: QuizzWithId[] = files.flatMap((file) => {
      const data = fs.readFileSync(getPath(`quizz/${file}`), "utf-8")
      const id = file.replace(".json", "")
      let parsed: any
      try {
        parsed = JSON.parse(data)
      } catch {
        return []
      }

      const result = quizzValidator.safeParse(parsed)

      if (!result.success) {
        if (parsed && typeof parsed.subject === "string" && Array.isArray(parsed.questions)) {
          return [{
            id,
            subject: parsed.subject,
            questions: parsed.questions,
            wallpaper: parsed.wallpaper,
            incompatible: true,
            creatorId: parsed.creatorId || getAdminUserId()
          } as any]
        }

        return []
      }

      const quizData = { id, ...result.data }
      if (!quizData.creatorId) {
        quizData.creatorId = getAdminUserId()
      }

      return [quizData]
    })

    return quizz
  } catch (error) {
    console.error("Failed to read quizz config:", error)

    return []
  }
}

export const updateQuizz = (id: string, data: unknown): { id: string } => {
  const result = quizzValidator.safeParse(data)

  if (!result.success) {
    throw new Error(result.error.issues[0].message)
  }

  const oldPath = getPath(`quizz/${id}.json`)

  if (!fs.existsSync(oldPath)) {
    throw new Error(`Quizz "${id}" not found`)
  }

  const oldQuiz = JSON.parse(fs.readFileSync(oldPath, "utf-8"))
  const quizData = { ...result.data }
  if (!quizData.creatorId && oldQuiz.creatorId) {
    quizData.creatorId = oldQuiz.creatorId
  }

  fs.writeFileSync(oldPath, JSON.stringify(quizData, null, 2))

  return { id }
}

export const deleteQuizz = (id: string): void => {
  const filePath = getPath(`quizz/${id}.json`)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Quizz "${id}" not found`)
  }

  fs.unlinkSync(filePath)
}

export const saveResult = (data: GameResult): void => {
  try {
    const resultsPath = getPath("results")

    if (!fs.existsSync(resultsPath)) {
      fs.mkdirSync(resultsPath)
    }

    fs.writeFileSync(
      getPath(`results/${data.id}.json`),
      JSON.stringify(data, null, 2),
    )

    console.log(`Saved result for "${data.subject}"`)
  } catch (error) {
    console.error("Failed to save result:", error)
  }
}

export const getResultsMeta = (): GameResultMeta[] => {
  const resultsPath = getPath("results")

  if (!fs.existsSync(resultsPath)) {
    return []
  }

  const readMeta = (file: string): GameResultMeta | null => {
    try {
      const data = fs.readFileSync(getPath(`results/${file}`), "utf-8")
      const result = JSON.parse(data) as GameResult

      return {
        id: result.id,
        subject: result.subject,
        date: result.date,
        playerCount: result.players.length,
        mode: result.mode,
        creatorId: result.creatorId || getAdminUserId()
      }
    } catch {
      return null
    }
  }

  try {
    return fs
      .readdirSync(resultsPath)
      .filter((file) => file.endsWith(".json"))
      .map(readMeta)
      .filter((meta): meta is GameResultMeta => meta !== null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } catch {
    return []
  }
}

export const getResultById = (id: string): GameResult => {
  const filePath = getPath(`results/${id}.json`)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Result "${id}" not found`)
  }

  const res = JSON.parse(fs.readFileSync(filePath, "utf-8")) as GameResult
  if (!res.creatorId) {
    res.creatorId = getAdminUserId()
  }
  return res
}

export const deleteResult = (id: string): void => {
  const filePath = getPath(`results/${id}.json`)

  if (!fs.existsSync(filePath)) {
    throw new Error(`Result "${id}" not found`)
  }

  fs.unlinkSync(filePath)
}

export const saveQuizz = (data: unknown, creatorId?: string): { id: string } => {
  const result = quizzValidator.safeParse(data)

  if (!result.success) {
    throw new Error(result.error.issues[0].message)
  }

  const quizData = { ...result.data }
  if (!quizData.creatorId && creatorId) {
    quizData.creatorId = creatorId
  }

  const id = normalizeFilename(quizData.subject)
  const filePath = getPath(`quizz/${id}.json`)

  fs.writeFileSync(filePath, JSON.stringify(quizData, null, 2))

  return { id }
}

export const trashQuizz = (id: string, userId: string): void => {
  const filePath = getPath(`quizz/${id}.json`)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Quizz "${id}" not found`)
  }

  const quiz = JSON.parse(fs.readFileSync(filePath, "utf-8"))
  quiz.deletedAt = new Date().toISOString()
  quiz.deletedBy = userId

  const trashPath = getPath("trash")
  if (!fs.existsSync(trashPath)) {
    fs.mkdirSync(trashPath)
  }

  fs.writeFileSync(join(trashPath, `${id}.json`), JSON.stringify(quiz, null, 2))
  fs.unlinkSync(filePath)
}

export const getTrashQuizzesMeta = () => {
  const trashPath = getPath("trash")
  if (!fs.existsSync(trashPath)) return []

  try {
    const files = fs.readdirSync(trashPath).filter(f => f.endsWith(".json"))
    return files.flatMap(file => {
      try {
        const id = file.replace(".json", "")
        const data = fs.readFileSync(join(trashPath, file), "utf-8")
        const parsed = JSON.parse(data)
        return [{
          id,
          subject: parsed.subject,
          creatorId: parsed.creatorId || getAdminUserId(),
          deletedAt: parsed.deletedAt,
          incompatible: parsed.incompatible
        }]
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

export const getTrashQuizzById = (id: string) => {
  const filePath = getPath(`trash/${id}.json`)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Trashed quizz "${id}" not found`)
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8"))
}

export const restoreQuizz = (id: string): void => {
  const trashFilePath = getPath(`trash/${id}.json`)
  if (!fs.existsSync(trashFilePath)) {
    throw new Error(`Trashed quizz "${id}" not found`)
  }

  const quiz = JSON.parse(fs.readFileSync(trashFilePath, "utf-8"))
  delete quiz.deletedAt
  delete quiz.deletedBy

  const quizzDir = getPath("quizz")
  if (!fs.existsSync(quizzDir)) {
    fs.mkdirSync(quizzDir)
  }

  fs.writeFileSync(getPath(`quizz/${id}.json`), JSON.stringify(quiz, null, 2))
  fs.unlinkSync(trashFilePath)
}

const isAssetShared = (filename: string, excludeId: string): boolean => {
  const quizzes = getQuizz()
  for (const q of quizzes) {
    if (q.id === excludeId) continue
    if (JSON.stringify(q).includes(filename)) return true
  }
  const trashPath = getPath("trash")
  if (fs.existsSync(trashPath)) {
    const files = fs.readdirSync(trashPath).filter(f => f.endsWith(".json"))
    for (const file of files) {
      const id = file.replace(".json", "")
      if (id === excludeId) continue
      try {
        const content = fs.readFileSync(join(trashPath, file), "utf-8")
        if (content.includes(filename)) return true
      } catch {}
    }
  }
  return false
}

export const deleteQuizzPermanently = (id: string): void => {
  const trashFilePath = getPath(`trash/${id}.json`)
  if (!fs.existsSync(trashFilePath)) {
    throw new Error(`Trashed quizz "${id}" not found`)
  }

  const quizContent = fs.readFileSync(trashFilePath, "utf-8")
  const regex = /\/uploads\/([a-zA-Z0-9_\-]+\.[a-zA-Z0-9]+)/g
  let match
  while ((match = regex.exec(quizContent)) !== null) {
    const filename = match[1]
    if (!isAssetShared(filename, id)) {
      const filePath = getPath(join("uploads", filename))
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath)
        } catch (err) {
          console.error("Failed to delete asset:", filePath, err)
        }
      }
    }
  }

  fs.unlinkSync(trashFilePath)
}
