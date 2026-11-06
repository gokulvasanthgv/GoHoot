import { EXAMPLE_QUIZZ } from "@razzia/common/constants"
import type {
  GameResult,
  GameResultMeta,
  QuizzWithId,
} from "@razzia/common/types/game"
import { quizzValidator } from "@razzia/common/validators/quizz"
import { invalidInput, notFound } from "@razzia/socket/services/errors"
import {
  ensureDirectory,
  getPath,
  isRecord,
  listJsonFiles,
  readJson,
  writeJson,
} from "@razzia/socket/services/storage"
import UserService from "@razzia/socket/services/user"
import fs from "node:fs"
import { join } from "node:path"
import { nanoid } from "nanoid"

export { getPath }

export interface GameConfig {
  defaultWallpaper?: string
  defaultAudio?: string
}

export const initConfig = (): void => {
  ensureDirectory(getPath())

  if (!fs.existsSync(getPath("game.json"))) {
    writeJson(getPath("game.json"), {})
  }

  if (!fs.existsSync(getPath("quizz"))) {
    ensureDirectory(getPath("quizz"))
    writeJson(getPath("quizz/example.json"), {
      id: "example",
      ...EXAMPLE_QUIZZ,
    })
  }
}

export const getGameConfig = (): GameConfig => {
  const data = readJson(getPath("game.json"))

  return isRecord(data)
    ? {
        defaultWallpaper:
          typeof data.defaultWallpaper === "string"
            ? data.defaultWallpaper
            : undefined,
        defaultAudio:
          typeof data.defaultAudio === "string" ? data.defaultAudio : undefined,
      }
    : {}
}

export const saveGameConfig = (config: GameConfig): void =>
  writeJson(getPath("game.json"), config)

const adminId = () =>
  UserService.getAllUsers().find(
    (user) => user.username.toLowerCase() === "admin",
  )?.id ?? ""

// IDs are compared to records, never interpolated into filesystem paths.
const findRecord = (
  directory: string,
  id: string,
): { path: string; data: Record<string, unknown>; id: string } | undefined => {
  for (const filename of listJsonFiles(getPath(directory))) {
    const path = join(getPath(directory), filename)
    const data = readJson(path)

    if (!isRecord(data)) {
      continue
    }

    const recordId =
      typeof data.id === "string" ? data.id : filename.slice(0, -5)

    if (id === recordId) {
      return { path, data, id: recordId }
    }
  }

  return undefined
}

const requireRecord = (directory: string, id: string, key: string) => {
  const record = findRecord(directory, id)

  if (!record) {
    throw notFound(key)
  }

  return record
}

const readQuiz = (
  id: string,
  data: Record<string, unknown>,
): QuizzWithId | null => {
  const parsed = quizzValidator.safeParse(data)

  if (parsed.success) {
    return {
      ...parsed.data,
      id,
      creatorId:
        typeof data.creatorId === "string" ? data.creatorId : adminId(),
    }
  }

  if (typeof data.subject === "string" && Array.isArray(data.questions)) {
    return {
      ...data,
      id,
      creatorId:
        typeof data.creatorId === "string" ? data.creatorId : adminId(),
      incompatible: true,
    } as unknown as QuizzWithId
  }

  return null
}

export const getQuizz = (): QuizzWithId[] =>
  listJsonFiles(getPath("quizz")).flatMap((filename) => {
    const data = readJson(join(getPath("quizz"), filename))

    if (!isRecord(data)) {
      return []
    }

    const id = typeof data.id === "string" ? data.id : filename.slice(0, -5)
    const quiz = readQuiz(id, data)

    return quiz ? [quiz] : []
  })

export const getQuizzMeta = () =>
  getQuizz()
    .map(({ id, subject, incompatible, creatorId, deletedAt }) => ({
      id,
      subject,
      incompatible,
      creatorId,
      deletedAt,
    }))
    .sort((a, b) =>
      a.subject.localeCompare(b.subject, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    )

export const getQuizzById = (id: string): QuizzWithId => {
  const record = requireRecord("quizz", id, "errors:quizz.notFound")
  const quiz = readQuiz(id, record.data)

  if (!quiz) {
    throw notFound("errors:quizz.notFound")
  }

  return quiz
}

export const loadQuizz = getQuizzById

export const saveQuizz = (data: unknown, creatorId: string): { id: string } => {
  const parsed = quizzValidator.safeParse(data)

  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0].message)
  }

  const id = nanoid()
  const {
    creatorId: _owner,
    deletedAt: _deletedAt,
    deletedBy: _deletedBy,
    ...quiz
  } = parsed.data
  writeJson(join(getPath("quizz"), `${nanoid()}.json`), {
    id,
    ...quiz,
    creatorId,
  })

  return { id }
}

export const updateQuizz = (id: string, data: unknown): { id: string } => {
  const record = requireRecord("quizz", id, "errors:quizz.notFound")
  const parsed = quizzValidator.safeParse(data)

  if (!parsed.success) {
    throw invalidInput(parsed.error.issues[0].message)
  }

  const {
    creatorId: _owner,
    deletedAt: _deletedAt,
    deletedBy: _deletedBy,
    ...quiz
  } = parsed.data
  writeJson(record.path, {
    id,
    ...quiz,
    creatorId:
      typeof record.data.creatorId === "string"
        ? record.data.creatorId
        : adminId(),
  })

  return { id }
}

export const deleteQuizz = (id: string): void =>
  fs.unlinkSync(requireRecord("quizz", id, "errors:quizz.notFound").path)

export const saveResult = (data: GameResult): void => {
  // The filename is independent of data.id, including for imported/legacy results.
  writeJson(join(getPath("results"), `${nanoid()}.json`), data)
}

export const getResultById = (id: string): GameResult => {
  const { data } = requireRecord("results", id, "errors:result.notFound")

  if (
    !Array.isArray(data.players) ||
    !Array.isArray(data.questions) ||
    typeof data.subject !== "string" ||
    typeof data.date !== "string"
  ) {
    throw notFound("errors:result.notFound")
  }

  return {
    ...data,
    id,
    creatorId: typeof data.creatorId === "string" ? data.creatorId : adminId(),
  } as unknown as GameResult
}

export const getResultsMeta = (): GameResultMeta[] =>
  listJsonFiles(getPath("results"))
    .flatMap((filename) => {
      const data = readJson(join(getPath("results"), filename))

      if (
        !isRecord(data) ||
        typeof data.subject !== "string" ||
        typeof data.date !== "string" ||
        !Array.isArray(data.players)
      ) {
        return []
      }

      return [
        {
          id: typeof data.id === "string" ? data.id : filename.slice(0, -5),
          subject: data.subject,
          date: data.date,
          playerCount: data.players.length,
          quizzId: typeof data.quizzId === "string" ? data.quizzId : undefined,
          mode:
            data.mode === "accuracy"
              ? ("accuracy" as const)
              : ("classic" as const),
          creatorId:
            typeof data.creatorId === "string" ? data.creatorId : adminId(),
        },
      ]
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

export const deleteResult = (id: string): void =>
  fs.unlinkSync(requireRecord("results", id, "errors:result.notFound").path)

export const trashQuizz = (id: string, userId: string): void => {
  const record = requireRecord("quizz", id, "errors:quizz.notFound")
  writeJson(join(getPath("trash"), `${nanoid()}.json`), {
    ...record.data,
    id,
    creatorId:
      typeof record.data.creatorId === "string"
        ? record.data.creatorId
        : adminId(),
    deletedAt: new Date().toISOString(),
    deletedBy: userId,
  })
  fs.unlinkSync(record.path)
}

export const getTrashQuizzById = (id: string): QuizzWithId => {
  const record = requireRecord("trash", id, "errors:quizz.notFound")

  return {
    ...record.data,
    id,
    creatorId:
      typeof record.data.creatorId === "string"
        ? record.data.creatorId
        : adminId(),
  } as unknown as QuizzWithId
}

export const getTrashQuizzesMeta = () =>
  listJsonFiles(getPath("trash")).flatMap((filename) => {
    const data = readJson(join(getPath("trash"), filename))

    if (!isRecord(data) || typeof data.subject !== "string") {
      return []
    }

    return [
      {
        id: typeof data.id === "string" ? data.id : filename.slice(0, -5),
        subject: data.subject,
        creatorId:
          typeof data.creatorId === "string" ? data.creatorId : adminId(),
        deletedAt:
          typeof data.deletedAt === "string" ? data.deletedAt : undefined,
        incompatible: false,
      },
    ]
  })

export const restoreQuizz = (id: string): void => {
  const record = requireRecord("trash", id, "errors:quizz.notFound")

  if (findRecord("quizz", id)) {
    throw invalidInput("errors:quizz.alreadyExists")
  }

  const { deletedAt: _deletedAt, deletedBy: _deletedBy, ...data } = record.data
  writeJson(join(getPath("quizz"), `${nanoid()}.json`), { ...data, id })
  fs.unlinkSync(record.path)
}

export const isAssetShared = (
  filename: string,
  excludedId?: string,
): boolean => {
  if (JSON.stringify(getGameConfig()).includes(filename)) {
    return true
  }

  return ["quizz", "trash", "results"].some((directory) =>
    listJsonFiles(getPath(directory)).some((file) => {
      const data = readJson(join(getPath(directory), file))

      if (!isRecord(data)) {
        return false
      }

      const id = typeof data.id === "string" ? data.id : file.slice(0, -5)

      return id !== excludedId && JSON.stringify(data).includes(filename)
    }),
  )
}

export const deleteQuizzPermanently = (id: string): void => {
  const record = requireRecord("trash", id, "errors:quizz.notFound")
  for (const match of JSON.stringify(record.data).matchAll(
    /\/uploads\/([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)/gu,
  )) {
    const [, name] = match

    if (isAssetShared(name, id)) {
      continue
    }

    const path = join(getPath("uploads"), name)

    try {
      if (fs.lstatSync(path).isFile()) {
        fs.unlinkSync(path)
      }
    } catch {
      /* Already removed. */
    }
  }
  fs.unlinkSync(record.path)
}
