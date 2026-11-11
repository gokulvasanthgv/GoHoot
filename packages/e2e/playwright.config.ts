import { defineConfig, devices } from "@playwright/test"
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve, join } from "node:path"
import { scryptSync } from "node:crypto"

const root = resolve(import.meta.dirname, "../..")
const configPath =
  process.env.GOHOOT_E2E_CONFIG_PATH ??
  mkdtempSync(join(tmpdir(), "gohoot-browser-"))
process.env.GOHOOT_E2E_CONFIG_PATH = configPath

const write = (path: string, value: unknown) =>
  writeFileSync(join(configPath, path), JSON.stringify(value))
for (const folder of ["quizz", "results", "trash", "uploads"]) {
  mkdirSync(join(configPath, folder), { recursive: true })
}
const password = "browser-test-password"

if (!existsSync(join(configPath, "users.json"))) {
  write(
    "users.json",
    [
      { id: "browser-admin", username: "admin", role: "admin" },
      {
        id: "browser-host",
        username: "A_Quizmaster_With_A_Long_Unbroken_Username_1234567890",
        role: "quizmaster",
      },
      { id: "browser-analyst", username: "Report analyst", role: "analyst" },
      { id: "browser-player", username: "Registered player", role: "quizzer" },
    ].map((user) => ({
      ...user,
      createdAt: "2026-01-01T00:00:00.000Z",
      algorithm: "scrypt",
      salt: user.id,
      passwordHash: scryptSync(password, user.id, 64).toString("hex"),
      sessionVersion: 0,
    })),
  )
  const question = {
    type: "quiz",
    question: "Choose red",
    answers: ["Red", "Blue"],
    solutions: [0],
    time: 120,
    cooldown: 3,
    doublePoints: true,
  }
  write("quizz/live.json", {
    id: "browser-live",
    creatorId: "browser-admin",
    subject: "Live compatibility quiz",
    questions: [question],
  })
  write("quizz/presentation.json", {
    id: "browser-presentation",
    creatorId: "browser-admin",
    subject: "Conductor presentation checks",
    audio: "http://127.0.0.1:18855/sounds/answersMusic.mp3?conductor=1",
    questions: [
      {
        ...question,
        question: "Which of these are primary colours?",
        answers: ["Red", "Green", "Blue", "Yellow"],
        solutions: [0, 2, 3],
      },
      {
        ...question,
        question: "Seven readable answer colours",
        answers: ["Amber", "Blue", "Green", "Pink", "Purple", "Red", "Teal"],
        solutions: [1],
      },
      {
        ...question,
        type: "puzzle",
        question: "Put these steps in order",
        answers: ["First step", "Second step", "Third step"],
        solutions: [],
      },
      {
        ...question,
        type: "true_or_false",
        question: "An unanswered round still shows readable zero counts",
        answers: ["True", "False"],
        solutions: [0],
      },
    ],
  })
  write("quizz/mobile.json", {
    id: "browser-mobile",
    creatorId: "browser-admin",
    subject: "Mobile layout quiz",
    questions: [
      {
        ...question,
        question:
          "Read the full question and all seven answer options on a small screen",
        answers: [
          "Amber",
          "Blue",
          "Green",
          "Pink",
          "Purple",
          "Red",
          "G".repeat(65),
        ],
        solutions: [1],
        media: {
          type: "image",
          url: "http://127.0.0.1:18855/gohoot-logo-favicon.webp",
        },
      },
      {
        ...question,
        type: "slide",
        question: "Information slide on a phone",
        text: "The slide body stays readable after rotating the phone. ".repeat(
          18,
        ),
        answers: undefined,
        solutions: undefined,
      },
    ],
  })
  write("quizz/solo.json", {
    id: "browser-solo",
    creatorId: "browser-admin",
    subject: "All GoHoot question types",
    questions: [
      {
        ...question,
        question: "Choose the two warm colours",
        answers: ["Red", "Orange", "Blue"],
        solutions: [0, 1],
      },
      {
        ...question,
        type: "true_or_false",
        question: "The sky is blue",
        answers: ["True", "False"],
        doublePoints: false,
      },
      {
        ...question,
        type: "slide",
        question: "Slide heading",
        text: "Slide body is preserved",
        answers: undefined,
        solutions: undefined,
      },
      {
        ...question,
        type: "puzzle",
        question: "Order these numbers",
        answers: ["First", "Second", "Third"],
        solutions: [0, 1, 2],
        doublePoints: false,
      },
    ],
  })
  write("quizz/long-options.json", {
    id: "browser-long-options",
    creatorId: "browser-admin",
    subject: "Legacy quiz with oversized options",
    questions: [
      {
        ...question,
        question: "Valid options at the limit",
        answers: ["V".repeat(65), "No"],
      },
      {
        ...question,
        question: "Question with oversized options",
        answers: [
          "First",
          "B".repeat(72),
          "Third",
          "Fourth",
          "Fifth",
          "Sixth",
          "G".repeat(66),
        ],
      },
      {
        ...question,
        type: "puzzle",
        question: "Puzzle with an oversized step",
        answers: ["First", "P".repeat(80), "Third"],
      },
      {
        ...question,
        type: "slide",
        question: "Information slide",
        text: "No answer options",
        answers: undefined,
        solutions: undefined,
      },
    ],
  })
  write("quizz/readonly-options.json", {
    id: "browser-readonly-options",
    creatorId: "browser-admin",
    subject: "Legacy fixed options",
    questions: [
      {
        ...question,
        type: "slide",
        question: "Slide with obsolete options",
        text: "Slide text",
        answers: ["S".repeat(70), "Unused"],
      },
      {
        ...question,
        type: "true_or_false",
        question: "Fixed options with an old oversized label",
        answers: ["T".repeat(70), "False"],
      },
    ],
  })
}

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:18855",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node packages/socket/dist/index.cjs",
      cwd: root,
      url: "http://127.0.0.1:18856/api/health",
      timeout: 30_000,
      env: {
        CONFIG_PATH: configPath,
        SOCKET_PORT: "18856",
        JWT_SECRET: "browser-test-secret-with-at-least-32-characters",
        MANAGER_PASSWORD: password,
        GAME_SPEED: "0.15",
      },
    },
    {
      command:
        "pnpm --filter @razzia/web exec vite preview --host 127.0.0.1 --strictPort",
      cwd: root,
      url: "http://127.0.0.1:18855",
      timeout: 30_000,
      env: { WEB_PORT: "18855", SOCKET_PORT: "18856" },
    },
  ],
})
