import { getPath } from "@razzia/socket/services/config"
import { execFile } from "child_process"
import fs from "fs"
import { nanoid } from "nanoid"
import { extname, join } from "path"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

let cachedCommand: string | null = null

async function getImageMagickCommand(): Promise<string | null> {
  if (cachedCommand) return cachedCommand

  // 1. Try standard system command paths
  try {
    const { stdout } = await execFileAsync("magick", ["-version"])
    if (stdout.includes("ImageMagick")) {
      cachedCommand = "magick"
      return "magick"
    }
  } catch (e) {
    // Ignore error
  }

  try {
    const { stdout } = await execFileAsync("convert", ["-version"])
    if (stdout.includes("ImageMagick")) {
      cachedCommand = "convert"
      return "convert"
    }
  } catch (e) {
    // Ignore error
  }

  // 2. On Windows, search Program Files directories as a fallback
  if (process.platform === "win32") {
    try {
      const pf = process.env.ProgramFiles ?? "C:\\Program Files"
      if (fs.existsSync(pf)) {
        const dirs = fs.readdirSync(pf)
        const imDirs = dirs
          .filter((d) => d.startsWith("ImageMagick-"))
          .sort()
          .reverse()
        for (const dir of imDirs) {
          const exePath = join(pf, dir, "magick.exe")
          if (fs.existsSync(exePath)) {
            cachedCommand = exePath
            return cachedCommand
          }
        }
      }
    } catch (e) {
      // Ignore error
    }
  }

  return null
}

export async function uploadMedia(
  filename: string,
  fileType: string,
  data: Buffer,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const uploadsDir = getPath("uploads")
    const tmpDir = getPath("uploads/tmp")

    // Ensure directories exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }

    // Video size check: 50MB limit
    if (fileType.startsWith("video/") && data.length > 50 * 1024 * 1024) {
      return { success: false, error: "errors:quizz.videoTooLarge" }
    }

    const fileExt =
      extname(filename).toLowerCase() || getExtensionFromMime(fileType)
    const id = nanoid()

    const IMAGE_EXTENSIONS = [
      ".png",
      ".jpg",
      ".jpeg",
      ".jpe",
      ".webp",
      ".heic",
      ".heif",
      ".tiff",
      ".tif",
      ".bmp",
      ".jfif",
      ".gif",
      ".svg",
      ".psd",
      ".ico",
      ".tga",
      ".dds",
      ".avif",
      ".raw",
      ".cr2",
      ".nef",
      ".orf",
      ".sr2",
      ".dng",
    ]
    const isImage =
      fileType.startsWith("image/") || IMAGE_EXTENSIONS.includes(fileExt)

    // Handle Image compression using ImageMagick
    if (
      isImage &&
      fileType !== "image/svg+xml" &&
      fileExt !== ".gif" &&
      fileExt !== ".svg"
    ) {
      const tempInputFile = join(tmpDir, `input-${id}${fileExt}`)
      const destFile = join(uploadsDir, `${id}.webp`)

      // Write buffer to temp file
      fs.writeFileSync(tempInputFile, data)

      try {
        const magickCmd = await getImageMagickCommand()
        if (magickCmd) {
          // Compress to webp with 80% quality in original resolution and preserve orientation info
          // Append [0] to extract only the first frame/layer of multi-layer images (like HEIC/PSD)
          await execFileAsync(magickCmd, [
            `${tempInputFile}[0]`,
            "-auto-orient",
            "-quality",
            "80",
            destFile,
          ])

          // Verify output exists and delete temp file
          if (fs.existsSync(destFile)) {
            fs.unlinkSync(tempInputFile)
            return { success: true, url: `/uploads/${id}.webp` }
          }
        }
        console.warn(
          "ImageMagick is not available. Falling back to original image save.",
        )
      } catch (err) {
        console.error("ImageMagick compression failed, using fallback:", err)
        // Cleanup temp input if it exists
        if (fs.existsSync(tempInputFile)) {
          fs.unlinkSync(tempInputFile)
        }
      }

      // Fallback: save original image directly
      const fallbackDestFile = join(uploadsDir, `${id}${fileExt}`)
      fs.writeFileSync(fallbackDestFile, data)
      return { success: true, url: `/uploads/${id}${fileExt}` }
    }

    // For videos, audios, gifs, svgs etc., save directly
    const destFile = join(uploadsDir, `${id}${fileExt}`)
    fs.writeFileSync(destFile, data)
    return { success: true, url: `/uploads/${id}${fileExt}` }
  } catch (error) {
    console.error("Error during media upload:", error)
    return { success: false, error: "errors:quizz.uploadFailed" }
  }
}

function getExtensionFromMime(mime: string): string {
  const parts = mime.split("/")
  if (parts.length > 1) {
    const ext = parts[1]
    if (ext === "jpeg") return ".jpg"
    return `.${ext}`
  }
  return ""
}
