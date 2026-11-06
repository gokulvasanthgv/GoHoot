import fs from "node:fs"
import { dirname, join, resolve } from "node:path"
import { randomUUID } from "node:crypto"

const projectRoot = () => {
  let root = process.cwd()

  while (
    !fs.existsSync(join(root, "pnpm-workspace.yaml")) &&
    dirname(root) !== root
  ) {
    root = dirname(root)
  }

  return root
}

export const getPath = (path = ""): string =>
  resolve(process.env.CONFIG_PATH ?? join(projectRoot(), "config"), path)

export const ensureDirectory = (directory: string): void => {
  fs.mkdirSync(directory, { recursive: true })

  if (!fs.lstatSync(directory).isDirectory()) {
    throw new Error("Configuration directory must not be a symbolic link")
  }
}

export const readJson = (path: string): unknown => {
  try {
    if (!fs.lstatSync(path).isFile()) {
      return null
    }

    return JSON.parse(fs.readFileSync(path, "utf8")) as unknown
  } catch {
    return null
  }
}

export const writeJson = (path: string, value: unknown): void => {
  ensureDirectory(dirname(path))
  const temporary = join(dirname(path), `.write-${randomUUID()}.tmp`)

  try {
    fs.writeFileSync(temporary, JSON.stringify(value, null, 2), {
      mode: 0o600,
      flag: "wx",
    })
    fs.renameSync(temporary, path)
  } finally {
    if (fs.existsSync(temporary)) {
      fs.unlinkSync(temporary)
    }
  }
}

export const listJsonFiles = (directory: string): string[] => {
  try {
    if (!fs.lstatSync(directory).isDirectory()) {
      return []
    }

    return fs
      .readdirSync(directory)
      .filter(
        (name) =>
          name.endsWith(".json") &&
          fs.lstatSync(join(directory, name)).isFile(),
      )
  } catch {
    return []
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
