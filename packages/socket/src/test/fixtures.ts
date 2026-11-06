import fs from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import type { PublicUser } from "@razzia/common/types/auth"
import { initConfig, saveQuizz } from "@razzia/socket/services/config"
import { mintToken, newClientId } from "@razzia/socket/services/auth"
import UserService from "@razzia/socket/services/user"
import Registry from "@razzia/socket/services/registry"

export const TEST_PASSWORD = "test-password"

export const quizData = () => ({
  subject: "GoHoot regression quiz",
  questions: [
    {
      type: "quiz" as const,
      question: "Choose the correct option",
      answers: ["Correct", "Wrong"],
      solutions: [0],
      cooldown: 3,
      time: 120,
    },
  ],
})

export const setupConfig = async () => {
  const directory = fs.mkdtempSync(join(tmpdir(), "gohoot-security-test-"))
  process.env.CONFIG_PATH = directory
  initConfig()
  await UserService.initialize()
  const admin = UserService.getAllUsers().find((user) => user.role === "admin")

  if (!admin) {
    throw new Error("Test admin was not initialized")
  }

  const session = await mintToken(newClientId(), admin)

  return { directory, admin, session }
}

export const account = async (
  username: string,
  role: PublicUser["role"] = "quizmaster",
) => {
  const response = await UserService.signUp(username, TEST_PASSWORD)

  if (!response.success) {
    throw new Error(response.error)
  }

  if (role !== "quizmaster") {
    UserService.updateUserRole(response.user.id, role)
  }

  const user = UserService.getUserById(response.user.id)

  if (!user) {
    throw new Error("Test account was not created")
  }

  return {
    user,
    session: await mintToken(newClientId(), user),
    quiz: () => saveQuizz(quizData(), user.id),
  }
}

export const cleanupConfig = (directory: string): void => {
  Registry.getInstance().cleanup()
  const target = resolve(directory)
  const prefix = resolve(tmpdir(), "gohoot-security-test-")

  if (!target.startsWith(prefix) || target === resolve(tmpdir())) {
    throw new Error("Refusing to remove a non-test configuration")
  }

  fs.rmSync(target, { recursive: true, force: true })
}
