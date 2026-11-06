import type {
  PasswordResetRequest,
  PublicUser,
  UserRole,
} from "@razzia/common/types/auth"
import {
  roleValidator,
  signUpValidator,
  passwordValidator,
} from "@razzia/common/validators/auth"
import { managerPassword } from "@razzia/socket/env"
import {
  getPath,
  isRecord,
  readJson,
  writeJson,
} from "@razzia/socket/services/storage"
import {
  randomBytes,
  randomUUID,
  pbkdf2,
  scrypt,
  timingSafeEqual,
} from "node:crypto"
import { promisify } from "node:util"
import { existsSync } from "node:fs"

const pbkdf2Async = promisify(pbkdf2)
const scryptAsync = promisify(scrypt)

interface User extends PublicUser {
  passwordHash: string
  salt: string
  algorithm?: "scrypt"
  sessionVersion?: number
}

const publicUser = (user: User): PublicUser => ({
  id: user.id,
  username: user.username,
  role: user.role,
  createdAt: user.createdAt,
})

const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString("hex")
  const hash = (await scryptAsync(password, salt, 64)) as Buffer

  return {
    passwordHash: hash.toString("hex"),
    salt,
    algorithm: "scrypt" as const,
  }
}

const verifyPassword = async (
  password: string,
  user: User,
): Promise<boolean> => {
  const stored = Buffer.from(user.passwordHash, "hex")

  if (stored.length !== 64) {
    return false
  }

  const actual =
    user.algorithm === "scrypt"
      ? ((await scryptAsync(password, user.salt, 64)) as Buffer)
      : await pbkdf2Async(password, user.salt, 1000, 64, "sha512")

  return timingSafeEqual(stored, actual)
}

class UserService {
  private users: User[] = []
  private loadedPath = ""

  private load(): void {
    const path = getPath("users.json")

    if (this.loadedPath === path) {
      return
    }

    const data = readJson(path)

    if (data === null && existsSync(path)) {
      throw new Error(
        "Unreadable users.json; refusing to replace existing accounts",
      )
    }

    if (data !== null && !Array.isArray(data)) {
      throw new Error(
        "Invalid users.json; refusing to replace existing accounts",
      )
    }

    this.users = Array.isArray(data)
      ? data.filter(
          (value): value is User =>
            isRecord(value) &&
            typeof value.id === "string" &&
            typeof value.username === "string" &&
            typeof value.passwordHash === "string" &&
            typeof value.salt === "string" &&
            roleValidator.safeParse(value.role).success,
        )
      : []

    if (Array.isArray(data) && this.users.length !== data.length) {
      throw new Error(
        "Invalid account record; refusing to discard account data",
      )
    }

    this.loadedPath = path
  }

  private save(): void {
    writeJson(getPath("users.json"), this.users)
  }

  private clearLegacyPassword(): void {
    const legacy = readJson(getPath("game.json"))

    if (isRecord(legacy) && Object.hasOwn(legacy, "managerPassword")) {
      writeJson(getPath("game.json"), { ...legacy, managerPassword: undefined })
    }
  }

  async initialize(): Promise<void> {
    this.load()

    if (this.users.some((user) => user.username.toLowerCase() === "admin")) {
      this.clearLegacyPassword()

      return
    }

    const legacy = readJson(getPath("game.json"))
    const legacyPassword =
      isRecord(legacy) &&
      typeof legacy.managerPassword === "string" &&
      legacy.managerPassword !== "PASSWORD" &&
      legacy.managerPassword !== "admin"
        ? legacy.managerPassword
        : undefined
    const password = managerPassword ?? legacyPassword

    if (!password) {
      return
    }

    this.users.push({
      id: randomUUID(),
      username: "admin",
      role: "admin",
      createdAt: new Date().toISOString(),
      sessionVersion: 0,
      ...(await hashPassword(password)),
    })
    this.save()
    this.clearLegacyPassword()
  }

  getAllUsers(): PublicUser[] {
    this.load()

    return this.users.map(publicUser)
  }
  getUserById(id: string): PublicUser | null {
    this.load()
    const user = this.users.find((value) => value.id === id)

    return user ? publicUser(user) : null
  }
  getSessionVersion(id: string): number | undefined {
    this.load()
    const user = this.users.find((value) => value.id === id)

    return user ? (user.sessionVersion ?? 0) : undefined
  }

  async signUp(username: string, password: string) {
    this.load()
    const result = signUpValidator.safeParse({ username, password })

    if (!result.success) {
      return { success: false as const, error: result.error.issues[0].message }
    }

    const normalized = result.data.username.toLowerCase()

    if (
      normalized === "admin" ||
      this.users.some((user) => user.username.toLowerCase() === normalized)
    ) {
      return { success: false as const, error: "errors:auth.usernameTaken" }
    }

    const passwordData = await hashPassword(password)

    if (this.users.some((user) => user.username.toLowerCase() === normalized)) {
      return { success: false as const, error: "errors:auth.usernameTaken" }
    }

    const user: User = {
      id: randomUUID(),
      username: result.data.username,
      role: "quizmaster",
      createdAt: new Date().toISOString(),
      sessionVersion: 0,
      ...passwordData,
    }
    this.users.push(user)
    this.save()

    return { success: true as const, user: publicUser(user) }
  }

  async signIn(username: string, password: string) {
    this.load()
    const user = this.users.find(
      (value) => value.username.toLowerCase() === username.trim().toLowerCase(),
    )

    if (!user) {
      await scryptAsync(password, "gohoot-invalid-account", 64)

      return {
        success: false as const,
        error: "errors:manager.invalidPassword",
      }
    }

    if (
      user.username.toLowerCase() === "admin" &&
      !user.algorithm &&
      (await verifyPassword("admin", user))
    ) {
      if (!managerPassword) {
        return {
          success: false as const,
          error: "errors:manager.passwordNotConfigured",
        }
      }

      const actual = (await scryptAsync(password, user.salt, 64)) as Buffer
      const expected = (await scryptAsync(
        managerPassword,
        user.salt,
        64,
      )) as Buffer

      if (!timingSafeEqual(actual, expected)) {
        return {
          success: false as const,
          error: "errors:manager.invalidPassword",
        }
      }

      Object.assign(user, await hashPassword(managerPassword))
      user.sessionVersion = (user.sessionVersion ?? 0) + 1
      this.save()
    } else if (!(await verifyPassword(password, user))) {
      return {
        success: false as const,
        error: "errors:manager.invalidPassword",
      }
    }

    if (!user.algorithm) {
      Object.assign(user, await hashPassword(password))
      this.save()
    }

    return { success: true as const, user: publicUser(user) }
  }

  updateUserRole(id: string, role: UserRole): boolean {
    this.load()
    const user = this.users.find((value) => value.id === id)

    if (
      !user ||
      user.username.toLowerCase() === "admin" ||
      !roleValidator.safeParse(role).success
    ) {
      return false
    }

    user.role = role
    user.sessionVersion = (user.sessionVersion ?? 0) + 1
    this.save()

    return true
  }

  deleteUser(id: string): boolean {
    this.load()
    const user = this.users.find((value) => value.id === id)

    if (!user || user.username.toLowerCase() === "admin") {
      return false
    }

    this.users = this.users.filter((value) => value.id !== id)
    this.save()

    return true
  }

  async changePassword(id: string, current: string, password: string) {
    this.load()
    const user = this.users.find((value) => value.id === id)

    if (!user || !(await verifyPassword(current, user))) {
      return { success: false, error: "errors:auth.invalidCurrentPassword" }
    }

    if (!passwordValidator.safeParse(password).success) {
      return { success: false, error: "errors:auth.passwordTooShort" }
    }

    Object.assign(user, await hashPassword(password))
    user.sessionVersion = (user.sessionVersion ?? 0) + 1
    this.save()

    return { success: true }
  }

  async adminChangePassword(id: string, password: string): Promise<boolean> {
    this.load()
    const user = this.users.find((value) => value.id === id)

    if (!user || !passwordValidator.safeParse(password).success) {
      return false
    }

    Object.assign(user, await hashPassword(password))
    user.sessionVersion = (user.sessionVersion ?? 0) + 1
    this.save()

    return true
  }

  requestPasswordReset(username: string) {
    this.load()
    const user = this.users.find(
      (value) => value.username.toLowerCase() === username.trim().toLowerCase(),
    )

    if (!user) {
      return { success: true }
    }

    const requests = this.getForgotPasswordRequests()

    if (
      !requests.some(
        (value) => value.username.toLowerCase() === user.username.toLowerCase(),
      )
    ) {
      requests.push({
        id: randomUUID(),
        username: user.username,
        createdAt: new Date().toISOString(),
      })
      writeJson(getPath("notifications.json"), requests)
    }

    return { success: true }
  }

  getForgotPasswordRequests(): PasswordResetRequest[] {
    const data = readJson(getPath("notifications.json"))

    return Array.isArray(data)
      ? data.filter(
          (value): value is PasswordResetRequest =>
            isRecord(value) &&
            typeof value.id === "string" &&
            typeof value.username === "string" &&
            typeof value.createdAt === "string",
        )
      : []
  }
  dismissPasswordReset(id: string): void {
    writeJson(
      getPath("notifications.json"),
      this.getForgotPasswordRequests().filter((value) => value.id !== id),
    )
  }
}

export default new UserService()
