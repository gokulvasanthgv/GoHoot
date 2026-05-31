import { getPath, getGameConfig } from "./config"
import fs from "fs"
import crypto from "crypto"
import { v7 as uuid } from "uuid"

export interface User {
  id: string
  username: string
  passwordHash: string
  salt: string
  role: "admin" | "quizmaster" | "analyst" | "quizzer"
  createdAt: string
}

class UserService {
  private users: User[] | null = null

  private ensureLoaded() {
    if (this.users !== null) return

    this.users = []
    const filepath = getPath("users.json")
    if (fs.existsSync(filepath)) {
      try {
        const data = fs.readFileSync(filepath, "utf-8")
        this.users = JSON.parse(data) as User[]
      } catch (err) {
        console.error("Failed to load users:", err)
      }
    }

    if (this.users.length === 0) {
      this.seedAdminUser()
    }
  }

  private saveUsers() {
    if (this.users === null) return
    try {
      const filepath = getPath("users.json")
      fs.writeFileSync(filepath, JSON.stringify(this.users, null, 2))
    } catch (err) {
      console.error("Failed to save users:", err)
    }
  }

  private hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString("hex")
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex")
    return { hash, salt }
  }

  private verifyPassword(password: string, hash: string, salt: string): boolean {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex")
    return hash === verifyHash
  }

  private seedAdminUser() {
    let password = "admin"
    try {
      const config = getGameConfig()
      if (config.managerPassword && config.managerPassword !== "PASSWORD") {
        password = config.managerPassword
      }
    } catch (e) {
    }

    const { hash, salt } = this.hashPassword(password)
    const admin: User = {
      id: uuid(),
      username: "admin",
      passwordHash: hash,
      salt: salt,
      role: "admin",
      createdAt: new Date().toISOString()
    }
    this.users?.push(admin)
    this.saveUsers()
  }

  signUp(username: string, password: string): { success: boolean; user?: Omit<User, "passwordHash" | "salt">; error?: string } {
    this.ensureLoaded()
    const normalized = username.trim().toLowerCase()
    if (!normalized || password.length < 4) {
      return { success: false, error: "errors:auth.invalidInput" }
    }

    if (this.users === null) return { success: false, error: "errors:auth.signupFailed" }

    const exists = this.users.some(u => u.username.toLowerCase() === normalized)
    if (exists) {
      return { success: false, error: "errors:auth.usernameTaken" }
    }

    const { hash, salt } = this.hashPassword(password)
    const newUser: User = {
      id: uuid(),
      username: username.trim(),
      passwordHash: hash,
      salt: salt,
      role: "quizmaster",
      createdAt: new Date().toISOString()
    }

    this.users.push(newUser)
    this.saveUsers()

    const { passwordHash, salt: s, ...safeUser } = newUser
    return { success: true, user: safeUser }
  }

  signIn(username: string, password: string): { success: boolean; user?: Omit<User, "passwordHash" | "salt">; error?: string } {
    this.ensureLoaded()
    const normalized = username.trim().toLowerCase()
    if (this.users === null) return { success: false, error: "errors:manager.invalidPassword" }

    const user = this.users.find(u => u.username.toLowerCase() === normalized)

    if (!user) {
      return { success: false, error: "errors:manager.invalidPassword" }
    }

    const valid = this.verifyPassword(password, user.passwordHash, user.salt)
    if (!valid) {
      return { success: false, error: "errors:manager.invalidPassword" }
    }

    const { passwordHash, salt, ...safeUser } = user
    return { success: true, user: safeUser }
  }

  getAllUsers(): Omit<User, "passwordHash" | "salt">[] {
    this.ensureLoaded()
    if (this.users === null) return []
    return this.users.map(({ passwordHash, salt, ...safeUser }) => safeUser)
  }

  updateUserRole(userId: string, role: "admin" | "quizmaster" | "analyst" | "quizzer"): boolean {
    this.ensureLoaded()
    if (this.users === null) return false
    const user = this.users.find(u => u.id === userId)
    if (!user) return false

    user.role = role
    this.saveUsers()
    return true
  }

  deleteUser(userId: string): boolean {
    this.ensureLoaded()
    if (this.users === null) return false
    const initialLength = this.users.length
    this.users = this.users.filter(u => u.id !== userId)
    if (this.users.length < initialLength) {
      this.saveUsers()
      return true
    }
    return false
  }

  getUserById(userId: string): Omit<User, "passwordHash" | "salt"> | null {
    this.ensureLoaded()
    if (this.users === null) return null
    const user = this.users.find(u => u.id === userId)
    if (!user) return null
    const { passwordHash, salt, ...safeUser } = user
    return safeUser
  }
}

const userService = new UserService()
export default userService
