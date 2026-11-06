import { MAX_MEDIA_SIZE } from "@razzia/common/constants"
import { isAssetShared } from "@razzia/socket/services/config"
import {
  ensureDirectory,
  getPath,
  isRecord,
  readJson,
  writeJson,
} from "@razzia/socket/services/storage"
import { invalidInput, notFound } from "@razzia/socket/services/errors"
import type { PublicUser } from "@razzia/common/types/auth"
import { fileTypeFromBuffer } from "file-type"
import fs from "node:fs"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const exec = promisify(execFile)
const MIME: Record<string, { ext: string; type: "image" | "audio" | "video" }> =
  {
    "image/png": { ext: "png", type: "image" },
    "image/jpeg": { ext: "jpg", type: "image" },
    "image/webp": { ext: "webp", type: "image" },
    "image/gif": { ext: "gif", type: "image" },
    "image/avif": { ext: "avif", type: "image" },
    "image/heic": { ext: "heic", type: "image" },
    "image/heif": { ext: "heif", type: "image" },
    "image/tiff": { ext: "tiff", type: "image" },
    "image/bmp": { ext: "bmp", type: "image" },
    "image/vnd.adobe.photoshop": { ext: "psd", type: "image" },
    "video/mp4": { ext: "mp4", type: "video" },
    "video/webm": { ext: "webm", type: "video" },
    "audio/mpeg": { ext: "mp3", type: "audio" },
    "audio/mp4": { ext: "m4a", type: "audio" },
    "audio/x-m4a": { ext: "m4a", type: "audio" },
    "audio/wav": { ext: "wav", type: "audio" },
    "audio/x-wav": { ext: "wav", type: "audio" },
    "audio/ogg": { ext: "ogg", type: "audio" },
    "audio/flac": { ext: "flac", type: "audio" },
  }
let imageMagick: string | undefined = undefined
const getImageMagick = async () => {
  if (imageMagick) {
    return imageMagick
  }

  for (const command of ["magick", "convert"]) {
    try {
      if (
        // oxlint-disable-next-line no-await-in-loop -- Probe candidates in priority order.
        (await exec(command, ["-version"], { timeout: 3000 })).stdout.includes(
          "ImageMagick",
        )
      ) {
        imageMagick = command

        return command
      }
    } catch {
      /* Try the next executable. */
    }
  }

  if (process.platform === "win32") {
    const root = process.env.ProgramFiles ?? "C:\\Program Files"
    for (const entry of fs
      .readdirSync(root)
      .filter((name) => name.startsWith("ImageMagick-"))
      .sort()
      .reverse()) {
      const path = join(root, entry, "magick.exe")

      if (fs.existsSync(path)) {
        imageMagick = path

        return path
      }
    }
  }

  return undefined
}

const owners = (): Record<string, string> => {
  const data = readJson(getPath("uploads-index.json"))

  return isRecord(data)
    ? Object.fromEntries(
        Object.entries(data).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : {}
}

export const uploadMedia = async (
  _filename: string,
  _fileType: string,
  data: Buffer,
  ownerId: string,
): Promise<{ success: boolean; url?: string; error?: string }> => {
  if (!data.length || data.length > MAX_MEDIA_SIZE) {
    return { success: false, error: "errors:media.tooLarge" }
  }

  const detected = await fileTypeFromBuffer(data).catch(() => undefined)
  const svg =
    !detected &&
    data.length <= 1024 * 1024 &&
    /^\s*(?:<\?xml[^>]*>\s*)?<svg[\s>]/iu.test(data.toString("utf8"))
  const format = detected
    ? MIME[detected.mime]
    : svg
      ? { ext: "svg", type: "image" as const }
      : undefined

  if (!format) {
    return { success: false, error: "errors:media.invalidType" }
  }

  ensureDirectory(getPath("uploads"))
  const id = randomUUID()
  let name = `${id}.${format.ext}`

  if (format.type === "image" && !["svg", "gif", "webp"].includes(format.ext)) {
    const command = await getImageMagick()

    if (command) {
      ensureDirectory(getPath("uploads/tmp"))
      const input = join(getPath("uploads/tmp"), `${id}.${format.ext}`)
      const output = join(getPath("uploads"), `${id}.webp`)

      try {
        fs.writeFileSync(input, data, { flag: "wx", mode: 0o600 })
        await exec(
          command,
          [
            "-limit",
            "memory",
            "256MiB",
            "-limit",
            "map",
            "512MiB",
            "-limit",
            "disk",
            "256MiB",
            "-limit",
            "time",
            "30",
            `${input}[0]`,
            "-auto-orient",
            "-quality",
            "80",
            output,
          ],
          { timeout: 35000, maxBuffer: 64 * 1024 },
        )
        name = `${id}.webp`
      } catch {
        if (fs.existsSync(output)) {
          fs.unlinkSync(output)
        }
      } finally {
        if (fs.existsSync(input)) {
          fs.unlinkSync(input)
        }
      }
    }
  }

  const destination = join(getPath("uploads"), name)

  if (!fs.existsSync(destination)) {
    fs.writeFileSync(destination, data, { flag: "wx", mode: 0o600 })
  }

  writeJson(getPath("uploads-index.json"), { ...owners(), [name]: ownerId })

  return { success: true, url: `/uploads/${name}` }
}

export const safeUploadPath = (name: string): string => {
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/u.test(name)) {
    throw invalidInput("errors:media.invalidName")
  }

  const path = join(getPath("uploads"), name)

  try {
    if (
      fs.lstatSync(getPath("uploads")).isDirectory() &&
      fs.lstatSync(path).isFile()
    ) {
      return path
    }
  } catch {
    /* Missing or symlinked media. */
  }

  throw notFound("errors:media.notFound")
}

export const listMedia = (user: PublicUser) => {
  const ownerMap = owners()

  try {
    return fs
      .readdirSync(getPath("uploads"))
      .flatMap((name) => {
        if (user.role !== "admin" && ownerMap[name] !== user.id) {
          return []
        }

        try {
          const path = safeUploadPath(name)

          return [
            {
              name,
              url: `/uploads/${name}`,
              modifiedAt: fs.statSync(path).mtimeMs,
            },
          ]
        } catch {
          return []
        }
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt)
  } catch {
    return []
  }
}

export const deleteMedia = (name: string, user: PublicUser): void => {
  const ownerMap = owners()

  if (
    (user.role !== "admin" && ownerMap[name] !== user.id) ||
    isAssetShared(name)
  ) {
    throw invalidInput("errors:media.inUse")
  }

  fs.unlinkSync(safeUploadPath(name))
  const remaining = Object.fromEntries(
    Object.entries(ownerMap).filter(([key]) => key !== name),
  )
  writeJson(getPath("uploads-index.json"), remaining)
}
