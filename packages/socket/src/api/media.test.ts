import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { app } from "@razzia/socket/app"
import {
  account,
  cleanupConfig,
  setupConfig,
} from "@razzia/socket/test/fixtures"
import { MAX_MEDIA_SIZE } from "@razzia/common/constants"
import { getPath, saveGameConfig } from "@razzia/socket/services/config"
import fs from "node:fs"

let fixture: Awaited<ReturnType<typeof setupConfig>>
beforeEach(async () => {
  fixture = await setupConfig()
})
afterEach(() => cleanupConfig(fixture.directory))
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfWQAAAAASUVORK5CYII=",
  "base64",
)
const upload = (
  data: Buffer,
  token = fixture.session.token,
  name = "picture.png",
  type = "image/png",
) =>
  app.request(
    `/uploads?filename=${encodeURIComponent(name)}&fileType=${encodeURIComponent(type)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: new Uint8Array(data),
    },
  )

describe("authenticated media handling", () => {
  it("does not authorize uploads using a client ID query parameter", async () => {
    const response = await app.request(
      `/uploads?clientId=${fixture.session.clientId}&filename=a.png&fileType=image/png`,
      { method: "POST", body: new Uint8Array(png) },
    )
    expect(response.status).toBe(403)
  })
  it("restricts uploads to admins and quizmasters", async () => {
    for (const role of ["analyst", "quizzer"] as const) {
      const user = await account(`upload-${role}`, role)
      expect((await upload(png, user.session.token)).status).toBe(403)
    }
  })
  it("checks file signatures instead of trusting filenames and MIME declarations", async () => {
    const bad = await upload(
      Buffer.from("<script>alert(document.cookie)</script>"),
      fixture.session.token,
      "image.png",
      "image/png",
    )
    expect(bad.status).toBe(415)
    const good = await upload(
      png,
      fixture.session.token,
      "payload.html",
      "text/html",
    )
    expect(good.status).toBe(201)
    const { url } = (await good.json()) as { url: string }
    expect(url).toMatch(/^\/uploads\/[A-Za-z0-9_-]+\.(png|webp)$/u)
    const file = await app.request(url)
    expect(file.status).toBe(200)
    expect(file.headers.get("Content-Type")).toMatch(/^image\//u)
    expect(file.headers.get("X-Content-Type-Options")).toBe("nosniff")
  })
  it("keeps SVG media but sandboxes its response", async () => {
    const response = await upload(
      Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
      ),
      fixture.session.token,
      "drawing.svg",
      "image/svg+xml",
    )
    expect(response.status).toBe(201)
    const { url } = (await response.json()) as { url: string }
    const file = await app.request(url)
    expect(file.headers.get("Content-Security-Policy")).toContain("sandbox")
    expect(file.headers.get("Content-Type")).toBe("image/svg+xml")
  })
  it("supports byte ranges for audio and video playback", async () => {
    const { url } = (await (await upload(png)).json()) as { url: string }
    const response = await app.request(url, { headers: { Range: "bytes=0-3" } })
    expect(response.status).toBe(206)
    expect((await response.arrayBuffer()).byteLength).toBe(4)
    expect(
      (await app.request(url, { headers: { Range: "bytes=999999-" } })).status,
    ).toBe(416)
  })
  it("bounds upload bodies before reading them into memory", async () => {
    const response = await app.request("/uploads", {
      method: "POST",
      headers: { "Content-Length": String(MAX_MEDIA_SIZE + 65537) },
      body: "x",
    })
    expect(response.status).toBe(413)
  })
  it("does not expose config files through encoded traversal paths", async () => {
    for (const path of [
      "/uploads/..%2fusers.json",
      "/uploads/..%5cusers.json",
      "/uploads/%2e%2e%2fusers.json",
      "/uploads/users.json%00.png",
    ]) {
      expect((await app.request(path)).status).not.toBe(200)
    }
  })
  it("prevents deleting another user's media and media still used in settings", async () => {
    const owner = await account("media-owner")
    const other = await account("media-other")
    const { url } = (await (await upload(png, owner.session.token)).json()) as {
      url: string
    }
    const name = url.split("/").pop()
    const remove = (token: string) =>
      app.request(`/api/media/${name}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    expect((await remove(other.session.token)).status).toBe(400)
    saveGameConfig({ defaultWallpaper: url })
    expect((await remove(fixture.session.token)).status).toBe(400)
    saveGameConfig({})
    expect((await remove(owner.session.token)).status).toBe(204)
    expect(fs.existsSync(getPath(`uploads/${name}`))).toBe(false)
  })
})
