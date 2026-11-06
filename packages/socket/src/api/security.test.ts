import type { SessionResponse, PublicUser } from "@razzia/common/types/auth"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { app } from "@razzia/socket/app"
import {
  account,
  cleanupConfig,
  quizData,
  setupConfig,
  TEST_PASSWORD,
} from "@razzia/socket/test/fixtures"
import {
  getPath,
  getQuizzById,
  getQuizzMeta,
  getResultById,
  getResultsMeta,
  saveQuizz,
  saveResult,
  trashQuizz,
} from "@razzia/socket/services/config"
import { mintJoinTicket, verifyToken } from "@razzia/socket/services/auth"
import UserService from "@razzia/socket/services/user"
import { readJson, writeJson } from "@razzia/socket/services/storage"
import type { GameResult } from "@razzia/common/types/game"
import fs from "node:fs"
import { pbkdf2Sync, randomUUID } from "node:crypto"
import { join } from "node:path"

let fixture: Awaited<ReturnType<typeof setupConfig>>
beforeEach(async () => {
  fixture = await setupConfig()
})
afterEach(() => cleanupConfig(fixture.directory))
const request = (
  path: string,
  token?: string,
  method = "GET",
  data?: unknown,
) =>
  app.request(`/api${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  })
const resultData = (userId: string, quizId?: string): GameResult => ({
  id: randomUUID(),
  subject: "Saved quiz",
  date: new Date().toISOString(),
  creatorId: fixture.admin.id,
  quizzId: quizId,
  players: [{ username: "Participant", points: 1000, rank: 1, userId }],
  questions: [],
  mode: "accuracy",
})

describe("signed sessions and account migration", () => {
  it("issues signed guest identities and ignores claimed client IDs", async () => {
    const response = await request("/auth/session", undefined, "POST", {
      clientId: fixture.session.clientId,
      role: "manager",
    })
    const session = (await response.json()) as SessionResponse
    expect(response.status).toBe(200)
    expect(session.clientId).not.toBe(fixture.session.clientId)
    expect((await verifyToken(session.token)).role).toBe("player")
    expect(session.user).toBeNull()
  })
  it("does not accept a join ticket as a session token", async () => {
    const ticket = await mintJoinTicket(
      fixture.session.clientId,
      "game",
      "Player",
    )
    expect((await request("/config", ticket)).status).toBe(401)
  })
  it("does not accept a token with edited claims", async () => {
    const parts = fixture.session.token.split(".")
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    ) as Record<string, unknown>
    payload.sub = "attacker"
    parts[1] = Buffer.from(JSON.stringify(payload)).toString("base64url")
    expect((await request("/config", parts.join("."))).status).toBe(401)
  })
  it("keeps legacy accounts and upgrades PBKDF2 hashes after valid login", async () => {
    const legacy = {
      id: randomUUID(),
      username: "old-account",
      role: "quizmaster",
      createdAt: new Date().toISOString(),
      salt: "legacy-salt",
      passwordHash: pbkdf2Sync(
        TEST_PASSWORD,
        "legacy-salt",
        1000,
        64,
        "sha512",
      ).toString("hex"),
    }
    const nextDirectory = join(fixture.directory, "legacy-config")
    process.env.CONFIG_PATH = nextDirectory
    writeJson(getPath("users.json"), [legacy])
    await UserService.initialize()
    expect(
      (await UserService.signIn("old-account", TEST_PASSWORD)).success,
    ).toBe(true)
    const stored = readJson(getPath("users.json")) as Array<
      Record<string, unknown>
    >
    expect(stored[0].id).toBe(legacy.id)
    expect(stored[0].algorithm).toBe("scrypt")
    expect(stored[0].passwordHash).not.toBe(legacy.passwordHash)
  })
  it("blocks the legacy built-in admin/admin credential", async () => {
    process.env.CONFIG_PATH = join(fixture.directory, "default-admin")
    writeJson(getPath("users.json"), [
      {
        id: randomUUID(),
        username: "admin",
        role: "admin",
        createdAt: new Date().toISOString(),
        salt: "salt",
        passwordHash: pbkdf2Sync("admin", "salt", 1000, 64, "sha512").toString(
          "hex",
        ),
      },
    ])
    await UserService.initialize()
    expect((await UserService.signIn("admin", "admin")).success).toBe(false)
    expect((await UserService.signIn("admin", TEST_PASSWORD)).success).toBe(
      true,
    )
  })
  it("refuses to overwrite an unreadable existing account file", async () => {
    process.env.CONFIG_PATH = join(fixture.directory, "broken-accounts")
    fs.mkdirSync(getPath(), { recursive: true })
    fs.writeFileSync(getPath("users.json"), "not json")
    await expect(UserService.initialize()).rejects.toThrow(
      "refusing to replace",
    )
    expect(fs.readFileSync(getPath("users.json"), "utf8")).toBe("not json")
  })
  it("removes legacy plaintext credentials while preserving game settings", async () => {
    process.env.CONFIG_PATH = join(fixture.directory, "plaintext-migration")
    writeJson(getPath("game.json"), {
      managerPassword: "legacy-private-password",
      defaultWallpaper: "https://example.org/wallpaper.png",
      defaultAudio: "https://example.org/music.mp3",
    })
    await UserService.initialize()
    expect(readJson(getPath("game.json"))).toEqual({
      defaultWallpaper: "https://example.org/wallpaper.png",
      defaultAudio: "https://example.org/music.mp3",
    })
    expect(
      UserService.getAllUsers().some((user) => user.role === "admin"),
    ).toBe(true)
  })
  it("logs in through the REST API without exposing password hashes", async () => {
    const response = await request("/auth/signin", undefined, "POST", {
      username: "admin",
      password: TEST_PASSWORD,
    })
    const session = (await response.json()) as SessionResponse
    expect(response.status).toBe(200)
    expect(session.user?.role).toBe("admin")
    expect(session.user).not.toHaveProperty("passwordHash")
    expect(session.user).not.toHaveProperty("salt")
  })
  it("revokes the original token on logout", async () => {
    expect(
      (await request("/auth/logout", fixture.session.token, "POST")).status,
    ).toBe(200)
    expect((await request("/config", fixture.session.token)).status).toBe(401)
  })
  it("invalidates existing sessions when the password changes", async () => {
    const teacher = await account("password-change-user")
    const response = await request(
      "/auth/password",
      teacher.session.token,
      "POST",
      { currentPassword: TEST_PASSWORD, newPassword: "replacement-password" },
    )
    const session = (await response.json()) as SessionResponse
    expect(response.status).toBe(200)
    expect((await request("/config", teacher.session.token)).status).toBe(401)
    expect((await request("/config", session.token)).status).toBe(200)
  })
  it("validates malformed authentication input before hashing it", async () => {
    expect(
      (
        await request("/auth/signin", undefined, "POST", {
          username: [],
          password: {},
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await request("/auth/signup", undefined, "POST", {
          username: "a",
          password: "tiny",
        })
      ).status,
    ).toBe(400)
  })
  it("does not enumerate accounts through password-reset requests", async () => {
    const known = await request("/auth/forgot-password", undefined, "POST", {
      username: "admin",
    })
    const unknown = await request("/auth/forgot-password", undefined, "POST", {
      username: "not-a-user",
    })
    expect(await known.json()).toEqual(await unknown.json())
    expect(UserService.getForgotPasswordRequests()).toHaveLength(1)
  })
})

describe("roles, ownership, and compatible quiz storage", () => {
  it.each(["admin", "quizmaster", "analyst", "quizzer"] as const)(
    "preserves the %s role",
    async (role) => {
      const current =
        role === "admin"
          ? { user: fixture.admin, session: fixture.session }
          : await account(`role-${role}`, role)
      const response = await request("/config", current.session.token)
      expect(response.status).toBe(200)
      expect(((await response.json()) as { user: PublicUser }).user.role).toBe(
        role,
      )
    },
  )
  it("does not allow role escalation through signup payloads", async () => {
    const response = await request("/auth/signup", undefined, "POST", {
      username: "new-member",
      password: TEST_PASSWORD,
      role: "admin",
      id: fixture.admin.id,
    })
    expect(response.status).toBe(201)
    const session = (await response.json()) as SessionResponse
    expect(session.user?.role).toBe("quizmaster")
    expect(session.user?.id).not.toBe(fixture.admin.id)
  })
  it("does not let another quizmaster read, edit, or delete a quiz", async () => {
    const owner = await account("owner")
    const stranger = await account("stranger")
    const { id } = owner.quiz()
    for (const method of ["GET", "PATCH", "DELETE"]) {
      expect(
        (
          await request(
            `/quizz/${id}`,
            stranger.session.token,
            method,
            method === "PATCH" ? quizData() : undefined,
          )
        ).status,
      ).toBe(403)
    }
    expect(getQuizzById(id).creatorId).toBe(owner.user.id)
  })
  it("pins creator ownership on create and update", async () => {
    const owner = await account("owner")
    const response = await request("/quizz", owner.session.token, "POST", {
      ...quizData(),
      creatorId: fixture.admin.id,
    })
    const { id } = (await response.json()) as { id: string }
    expect(getQuizzById(id).creatorId).toBe(owner.user.id)
    await request(`/quizz/${id}`, owner.session.token, "PATCH", {
      ...quizData(),
      creatorId: fixture.admin.id,
    })
    expect(getQuizzById(id).creatorId).toBe(owner.user.id)
  })
  it("enforces updated roles and deleted users against existing tokens", async () => {
    const owner = await account("demoted")
    UserService.updateUserRole(owner.user.id, "quizzer")
    expect(
      (await request("/quizz", owner.session.token, "POST", quizData())).status,
    ).toBe(403)
    UserService.deleteUser(owner.user.id)
    expect((await request("/config", owner.session.token)).status).toBe(401)
  })
  it("keeps legacy filenames and quiz IDs without rewriting source data", () => {
    const path = getPath("quizz/legacy-name.json")
    const data = JSON.stringify(quizData())
    fs.writeFileSync(path, data)
    expect(getQuizzById("legacy-name").subject).toBe(quizData().subject)
    expect(fs.readFileSync(path, "utf8")).toBe(data)
  })
  it("does not read or delete files through traversal IDs", async () => {
    const before = fs.readFileSync(getPath("users.json"), "utf8")
    for (const id of [
      "../users",
      "..%2fusers",
      "..%5cusers",
      "/users",
      "%2e%2e%2fusers",
    ]) {
      expect(
        (
          await request(
            `/quizz/${encodeURIComponent(id)}`,
            fixture.session.token,
          )
        ).status,
      ).not.toBe(200)
      expect(
        (
          await request(
            `/results/${encodeURIComponent(id)}`,
            fixture.session.token,
            "DELETE",
          )
        ).status,
      ).not.toBe(204)
    }
    expect(fs.readFileSync(getPath("users.json"), "utf8")).toBe(before)
  })
  it.skipIf(process.platform === "win32")(
    "does not follow planted JSON symlinks",
    () => {
      const target = getPath("private.json")
      fs.writeFileSync(target, JSON.stringify(quizData()))
      fs.symlinkSync(target, getPath("quizz/link.json"))
      expect(getQuizzMeta().some((meta) => meta.id === "link")).toBe(false)
    },
  )
  it("uses independent result filenames rather than client-controlled IDs", () => {
    const before = fs.readFileSync(getPath("users.json"), "utf8")
    const result = { ...resultData(fixture.admin.id), id: "../../users" }
    saveResult(result)
    expect(getResultById("../../users").subject).toBe(result.subject)
    expect(fs.readFileSync(getPath("users.json"), "utf8")).toBe(before)
  })
  it("preserves quiz trash, restore, and the ownership boundary", async () => {
    const owner = await account("trash-owner")
    const other = await account("trash-other")
    const { id } = owner.quiz()
    trashQuizz(id, owner.user.id)
    expect(
      (await request(`/trash/${id}/restore`, other.session.token, "POST"))
        .status,
    ).toBe(403)
    expect(
      (await request(`/trash/${id}/restore`, owner.session.token, "POST"))
        .status,
    ).toBe(200)
    expect(getQuizzById(id).creatorId).toBe(owner.user.id)
  })
})

describe("results and solo practice integrity", () => {
  it("keeps quizzId in result metadata for practice eligibility", () => {
    const result = resultData(fixture.admin.id, "legacy-quiz")
    saveResult(result)
    expect(getResultsMeta()[0].quizzId).toBe("legacy-quiz")
  })
  it("allows a quizzer to replay an attended quiz but not an unrelated quiz", async () => {
    const player = await account("attendee", "quizzer")
    const quiz = saveQuizz(quizData(), fixture.admin.id)
    saveResult(resultData(player.user.id, quiz.id))
    expect(
      (await request(`/solo/${quiz.id}`, player.session.token)).status,
    ).toBe(200)
    expect((await request("/solo/example", player.session.token)).status).toBe(
      403,
    )
  })
  it("computes solo points and ownership on the server", async () => {
    const player = await account("practice-owner")
    const quiz = player.quiz()
    const response = await request(
      `/solo/${quiz.id}/results`,
      player.session.token,
      "POST",
      {
        answers: { "0": [0] },
        players: [{ points: 999999 }],
        creatorId: fixture.admin.id,
        id: "../users",
      },
    )
    const result = (await response.json()) as GameResult
    expect(response.status).toBe(201)
    expect(result.players[0].points).toBe(1000)
    expect(result.players[0].userId).toBe(player.user.id)
    expect(result.creatorId).toBe(player.user.id)
    expect(result.id).not.toBe("../users")
  })
  it("does not award points for repeated solo answer indices", async () => {
    const player = await account("practice-duplicate")
    const quiz = player.quiz()
    const response = await request(
      `/solo/${quiz.id}/results`,
      player.session.token,
      "POST",
      { answers: { "0": [0, 0] } },
    )
    expect(((await response.json()) as GameResult).players[0].points).toBe(0)
  })
  it("keeps slides, true/false, and ordered puzzles in solo results", async () => {
    const data = {
      subject: "All formats",
      questions: [
        { type: "slide", question: "Welcome", text: "Body" },
        {
          type: "true_or_false",
          question: "True",
          answers: ["True", "False"],
          solutions: [0],
          doublePoints: true,
        },
        { type: "puzzle", question: "Order", answers: ["One", "Two", "Three"] },
      ],
    }
    const quiz = saveQuizz(data, fixture.admin.id)
    const response = await request(
      `/solo/${quiz.id}/results`,
      fixture.session.token,
      "POST",
      { answers: { "1": [0], "2": [0, 1, 2] } },
    )
    const result = (await response.json()) as GameResult
    expect(response.status).toBe(201)
    expect(result.players[0].points).toBe(3000)
    expect(result.questions).toHaveLength(3)
  })
  it("protects results from unrelated participants while keeping analyst access", async () => {
    const owner = await account("attending-player", "quizzer")
    const stranger = await account("non-attending", "quizzer")
    const analyst = await account("report-reader", "analyst")
    const result = resultData(owner.user.id)
    saveResult(result)
    expect(
      (await request(`/results/${result.id}`, owner.session.token)).status,
    ).toBe(200)
    expect(
      (await request(`/results/${result.id}`, stranger.session.token)).status,
    ).toBe(403)
    expect(
      (await request(`/results/${result.id}`, analyst.session.token)).status,
    ).toBe(200)
  })
})
