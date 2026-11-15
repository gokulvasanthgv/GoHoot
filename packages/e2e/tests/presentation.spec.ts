import { test, expect, type Browser, type Page } from "@playwright/test"

const musicUrl = "http://127.0.0.1:18855/sounds/answersMusic.mp3?conductor=1"
const wallpaperUrl =
  "http://127.0.0.1:18855/gohoot-logo-favicon.webp?wallpaper=presentation"
const baseWallpaperPattern = /\/assets\/background-[^/]+\.png$/u

const playingTracks = (page: Page, loop: boolean) =>
  page.evaluate((looping) => {
    const howler = (
      window as unknown as {
        Howler?: {
          _howls: Array<{
            _src: string
            _loop: boolean
            playing: () => boolean
            volume: () => number
          }>
        }
      }
    ).Howler

    return (howler?._howls ?? [])
      .filter((track) => track._loop === looping && track.playing())
      .map((track) => ({ source: track._src, volume: track.volume() }))
  }, loop)

const playingMusic = (page: Page) => playingTracks(page, true)
const playingAnnouncement = async (page: Page) =>
  (await playingTracks(page, false)).some(
    ({ source }) =>
      new URL(source, page.url()).pathname === "/sounds/results.mp3",
  )

const expectCustomWallpaper = async (page: Page) => {
  const layer = page.locator("[data-game-wallpaper]")
  await expect(layer.locator("img")).toHaveAttribute("src", wallpaperUrl)
  await expect(layer.locator("div")).toHaveCSS("opacity", "0.65")
}

const whiteContrast = (background: string) => {
  const channels = (background.match(/[\d.]+/gu) ?? []).slice(0, 3).map(Number)
  const linear = channels.map((channel) => {
    const value = channel / 255

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  return (
    1.05 / (0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] + 0.05)
  )
}

const answerStyles = (page: Page) =>
  page.locator("button[disabled]").evaluateAll((buttons) =>
    buttons.map((button) => {
      const style = getComputedStyle(button)

      return {
        background: style.backgroundColor,
        color: style.color,
        opacity: style.opacity,
      }
    }),
  )

const waitForModeCue = async (page: Page, mode: string) => {
  await page.waitForFunction((key) => {
    const cue = document.querySelector(`[data-question-mode-art="${key}"]`)

    return cue && getComputedStyle(cue).animationName === "question-mode-enter"
  }, mode)
}

const nextQuestion = async (page: Page) => {
  await page.getByRole("button", { name: "Next", exact: true }).click()
  await expect.poll(() => playingMusic(page)).toEqual([])
  await page.getByRole("button", { name: "Next", exact: true }).click()
}

test("conductor colours, response charts, player controls, and music work across live rounds", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(90_000)
  await page.goto("/manager")
  await page.getByPlaceholder("Username").fill("admin")
  await page
    .getByPlaceholder("Password", { exact: true })
    .fill("browser-test-password")
  await page
    .getByRole("button", { name: "Sign In", exact: true })
    .last()
    .click()
  await page
    .getByRole("button", { name: "Configurations", exact: true })
    .click()
  await expect.poll(() => playingMusic(page)).toEqual([])
  const baseWallpaperRequests: string[] = []
  const recordBaseWallpaper = (url: string) => {
    if (baseWallpaperPattern.test(new URL(url).pathname)) {
      baseWallpaperRequests.push(url)
    }
  }
  page.on("request", (request) => recordBaseWallpaper(request.url()))
  await page.getByText("Conductor presentation checks", { exact: true }).click()
  await page.getByRole("button", { name: "Start game", exact: true }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Start", exact: true })
    .click()
  const pin = (await page.locator("p.text-6xl").innerText()).replace(/\s/gu, "")
  await expectCustomWallpaper(page)
  await expect
    .poll(() => playingMusic(page))
    .toEqual([{ source: musicUrl, volume: 0.2 }])

  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const guest = await guestContext.newPage()
  const guestMusicRequests: string[] = []
  guest.on("request", (request) => {
    recordBaseWallpaper(request.url())

    if (request.url().includes("answersMusic.mp3")) {
      guestMusicRequests.push(request.url())
    }
  })

  try {
    await guest.goto(`http://127.0.0.1:18855/?pin=${pin}`)
    await guest.getByPlaceholder("Username here").fill("Presentation player")
    await guest.getByRole("button", { name: "Submit", exact: true }).click()
    await expect(
      page.getByText("Presentation player", { exact: true }),
    ).toBeVisible()
    await expectCustomWallpaper(guest)
    await guest
      .getByRole("button", { name: "Unmute background music", exact: true })
      .click()
    await expect
      .poll(() => playingMusic(guest))
      .toEqual([{ source: musicUrl, volume: 0.2 }])
    await guest
      .getByRole("button", {
        name: "Mute sound effects and question audio",
        exact: true,
      })
      .click()
    await expect
      .poll(() => playingMusic(guest))
      .toEqual([{ source: musicUrl, volume: 0.2 }])
    await guest
      .getByRole("button", { name: "Mute background music", exact: true })
      .click()
    await expect.poll(() => playingMusic(guest)).toEqual([])
    await page.getByRole("button", { name: "Start Game", exact: true }).click()
    await page.getByLabel("Double time").check()
    await Promise.all([
      ...[page, guest].map((client) => waitForModeCue(client, "multiple")),
      page.getByRole("button", { name: "Start Game", exact: true }).click(),
    ])

    await expect(
      guest.getByRole("button", { name: "Submit", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Red", exact: true }),
    ).toBeDisabled()
    await expect
      .poll(() => playingMusic(page))
      .toEqual([{ source: musicUrl, volume: 0.2 }])
    await expect.poll(() => playingMusic(guest)).toEqual([])
    await expectCustomWallpaper(page)
    await expectCustomWallpaper(guest)

    for (const client of [page, guest]) {
      const tiles = client.locator(".answer-grid .answer-option")
      const shapes = await tiles
        .locator("svg[data-answer-shape]")
        .evaluateAll((icons) =>
          icons.map((icon) => icon.getAttribute("data-answer-shape")),
        )
      expect(shapes).toEqual(["triangle", "diamond", "circle", "hexagon"])
      const first = tiles.first()
      const shape = await first.locator("[data-answer-shape]").boundingBox()
      const tile = await first.boundingBox()

      if (!shape || !tile) {
        throw new Error("Expected a visible tile and shape")
      }

      expect(shape.x + shape.width).toBeLessThan(tile.x + tile.width / 2)
      expect(
        Math.abs(shape.y + shape.height / 2 - tile.y - tile.height / 2),
      ).toBeLessThan(2)
    }

    const conductorTiles = page.locator("main .answer-option")
    const measureTiles = () =>
      conductorTiles.evaluateAll((tiles) =>
        tiles.map((tile) => {
          const { x, y, width, height, bottom } = tile.getBoundingClientRect()

          return { x, y, width, height, bottom }
        }),
      )
    await page.setViewportSize({ width: 800, height: 900 })
    const portraitTiles = await measureTiles()
    expect(new Set(portraitTiles.map(({ y }) => y)).size).toBe(2)
    for (const tile of portraitTiles) {
      expect(Math.abs(tile.width - portraitTiles[0].width)).toBeLessThan(1)
      expect(Math.abs(tile.height - portraitTiles[0].height)).toBeLessThan(1)
    }
    const footer = await page.locator("[data-conductor] footer").boundingBox()
    expect(footer?.y).toBeDefined()
    const gap =
      (footer?.y ?? 0) - Math.max(...portraitTiles.map(({ bottom }) => bottom))
    expect(gap).toBeGreaterThanOrEqual(0)
    expect(gap).toBeLessThan(32)
    await page.setViewportSize({ width: 1920, height: 1080 })
    const landscapeTiles = await measureTiles()
    expect(new Set(landscapeTiles.map(({ y }) => y)).size).toBe(1)
    expect(landscapeTiles[0].height).toBeGreaterThan(portraitTiles[0].height)

    const resizeNotice = page
      .getByRole("status")
      .filter({ hasText: "Resize this window" })
    await expect(resizeNotice).toBeHidden()
    for (const viewport of [
      { width: 1440, height: 400 },
      { width: 304, height: 960 },
    ]) {
      await page.setViewportSize(viewport)
      await expect(resizeNotice).toBeVisible()
      await expect(
        page.getByRole("button", { name: "Skip", exact: true }),
      ).toBeInViewport({ ratio: 1 })
      await expect(conductorTiles.last()).toBeInViewport({ ratio: 1 })
    }
    await page.getByRole("button", { name: "Dismiss resize notice" }).click()
    await expect(resizeNotice).toBeHidden()
    await expect(
      page.getByRole("button", { name: "End Quiz", exact: true }),
    ).toBeInViewport({ ratio: 1 })
    await page.setViewportSize({ width: 1920, height: 1080 })

    const firstColours = (await answerStyles(page)).map(
      (style) => style.background,
    )
    for (const name of ["Red", "Blue", "Yellow"]) {
      await guest.getByRole("button", { name: new RegExp(name, "u") }).click()
    }
    const guestOptions = guest.locator("button[aria-pressed]")
    await expect(guestOptions).toHaveCount(4)
    for (const option of await guestOptions.all()) {
      await expect(option).toHaveCSS("opacity", "1")
    }
    await page.screenshot({
      path: testInfo.outputPath("conductor-opaque-options.png"),
    })
    await guest.getByRole("button", { name: "Submit", exact: true }).click()

    const chart = page.getByRole("list", {
      name: "Answer distribution",
      exact: true,
    })
    const options = page.getByRole("list", {
      name: "Answer options",
      exact: true,
    })
    await expect(chart).toBeVisible()
    await expect.poll(() => playingAnnouncement(page)).toBe(true)
    await expect.poll(() => playingMusic(page)).toEqual([])
    for (const label of [
      "Triangle: 1",
      "Diamond: 0",
      "Circle: 1",
      "Hexagon: 1",
    ]) {
      await expect(
        chart.getByRole("listitem", { name: label, exact: true }),
      ).toBeVisible()
    }
    const resultColours = await options
      .locator("li")
      .evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).backgroundColor),
      )
    const graphColours = await chart
      .locator("li > div > div")
      .evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).backgroundColor),
      )
    expect(resultColours).toEqual(firstColours)
    expect(graphColours).toEqual(firstColours)

    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport)
      const chartBox = await chart.boundingBox()
      const optionsBox = await options.boundingBox()
      expect(chartBox?.height).toBeGreaterThanOrEqual(160)

      if (viewport.width >= 1024) {
        expect(chartBox?.height).toBeGreaterThan(viewport.height * 0.35)
        expect(optionsBox?.height).toBeLessThan(viewport.height * 0.2)
        await expect(chart).toBeInViewport({ ratio: 1 })
        await expect(options).toBeInViewport({ ratio: 1 })
      }

      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.screenshot({
      path: testInfo.outputPath("conductor-round-results.png"),
    })

    const volume = page.getByRole("slider", {
      name: "Background music volume",
      exact: true,
    })
    await volume.focus()
    await volume.press("End")
    await expect.poll(() => playingMusic(page)).toEqual([])

    await nextQuestion(page)
    await expect(
      guest.getByRole("button", { name: "Blue", exact: true }),
    ).toBeVisible()
    await expect
      .poll(() => playingMusic(page))
      .toEqual([{ source: musicUrl, volume: 1 }])
    await page
      .getByRole("button", { name: "Mute background music", exact: true })
      .click()
    await expect
      .poll(() => playingMusic(page))
      .toEqual([{ source: musicUrl, volume: 0 }])
    await page
      .getByRole("button", { name: "Unmute background music", exact: true })
      .click()
    await expect
      .poll(() => playingMusic(page))
      .toEqual([{ source: musicUrl, volume: 1 }])

    await page.setViewportSize({ width: 800, height: 900 })
    const sevenTiles = await measureTiles()
    expect(new Set(sevenTiles.map(({ width }) => Math.round(width))).size).toBe(
      1,
    )
    expect(
      new Set(sevenTiles.map(({ height }) => Math.round(height))).size,
    ).toBe(1)
    const reachedLastRow = sevenTiles.filter(
      ({ y }) => y === sevenTiles.at(-1)?.y,
    )
    const rowLeft = reachedLastRow[0].x
    const rowRight = reachedLastRow.reduce(
      (right, tile) => Math.max(right, tile.x + tile.width),
      0,
    )
    expect(Math.abs((rowLeft + rowRight) / 2 - 400)).toBeLessThan(2)
    await page.setViewportSize({ width: 1920, height: 1080 })
    const sevenStyles = await answerStyles(page)
    expect(sevenStyles).toHaveLength(7)
    for (const style of sevenStyles) {
      expect(style.background).toMatch(/^rgb\(/u)
      expect(style.opacity).toBe("1")
      expect(style.color).toBe("rgb(255, 255, 255)")
      expect(whiteContrast(style.background)).toBeGreaterThanOrEqual(4.5)
    }
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toHaveCount(0)
    await page
      .getByRole("button", {
        name: "Mute sound effects and question audio",
        exact: true,
      })
      .click()
    await expect
      .poll(() => playingMusic(page))
      .toEqual([{ source: musicUrl, volume: 1 }])
    await guest.getByRole("button", { name: "Blue", exact: true }).click()
    await expect(
      chart.getByRole("listitem", { name: "Pentagon: 0", exact: true }),
    ).toBeVisible()
    await expect.poll(() => playingAnnouncement(page)).toBe(false)
    await page
      .getByRole("button", {
        name: "Unmute sound effects and question audio",
        exact: true,
      })
      .click()

    await nextQuestion(page)
    await expect(
      guest.getByRole("button", { name: "Submit", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: /Move answer/u }),
    ).toHaveCount(0)
    const rows = guest.locator("[data-sortable-id]")
    for (const [index, text] of [
      "First step",
      "Second step",
      "Third step",
    ].entries()) {
      const position = (await rows.allTextContents()).findIndex((value) =>
        value.includes(text),
      )
      const handle = rows.filter({ hasText: text }).getByRole("button")

      if (position === index) {
        continue
      }

      await handle.click({ trial: true })
      await handle.focus()
      await guest.keyboard.press("Space")
      await expect(handle).toHaveAttribute("aria-pressed", "true")
      const activeId = await rows.nth(position).getAttribute("data-sortable-id")
      await expect(guest.getByRole("status")).toContainText(
        `droppable area ${activeId}.`,
      )
      for (let move = position; move > index; move -= 1) {
        const targetId = await rows
          .nth(move - 1)
          .getAttribute("data-sortable-id")
        await guest.keyboard.press("ArrowUp")
        await expect(guest.getByRole("status")).toContainText(
          `droppable area ${targetId}.`,
        )
      }
      await guest.keyboard.press("Space")
      await expect(rows.nth(index)).toContainText(text)
    }
    await guest.getByRole("button", { name: "Submit", exact: true }).click()
    await expect(
      chart.getByRole("listitem", { name: "Correct: 1", exact: true }),
    ).toBeVisible()
    await expect(
      chart.getByRole("listitem", { name: "Incorrect: 0", exact: true }),
    ).toBeVisible()

    await nextQuestion(page)
    await expect(
      guest.getByRole("button", { name: "True", exact: true }),
    ).toBeVisible()
    await expect
      .poll(() => playingMusic(page))
      .toEqual([{ source: musicUrl, volume: 1 }])
    await page.getByRole("button", { name: "Skip", exact: true }).click()
    await expect(
      chart.getByRole("listitem", { name: "Triangle: 0", exact: true }),
    ).toBeVisible()
    await expect(
      chart.getByRole("listitem", { name: "Diamond: 0", exact: true }),
    ).toBeVisible()
    await expect.poll(() => playingAnnouncement(page)).toBe(true)
    await expect.poll(() => playingMusic(page)).toEqual([])
    await expectCustomWallpaper(page)
    expect(baseWallpaperRequests).toEqual([])
    expect(guestMusicRequests.length).toBeGreaterThan(0)
    await expect.poll(() => playingMusic(guest)).toEqual([])

    // History navigation keeps the document alive, so leaked audio cannot hide behind a reload.
    await page.goBack()
    await expect(page).toHaveURL(/\/manager\/config$/u)
    await expect.poll(() => playingMusic(page)).toEqual([])

    await page.getByText("Live compatibility quiz", { exact: true }).click()
    await page.getByRole("button", { name: "Start game", exact: true }).click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Start", exact: true })
      .click()
    await expect(page.locator("[data-game-wallpaper] img")).toHaveAttribute(
      "src",
      baseWallpaperPattern,
    )
    await test.step("The podium keeps rank heights and aligns the bases during resize", () =>
      verifyPodiumLayout(page, browser))
  } finally {
    await guestContext.close()
  }
})

const verifyPodiumLayout = async (page: Page, browser: Browser) => {
  const pin = (await page.locator("p.text-6xl").innerText()).replace(/\s/gu, "")
  const first = await browser.newPage()
  const second = await browser.newPage()

  try {
    for (const [guest, name] of [
      [first, "First player"],
      [second, "Long Runner-Up Name"],
    ] as const) {
      await guest.goto(new URL(`/?pin=${pin}`, page.url()).href)
      await guest.getByPlaceholder("Username here").fill(name)
      await guest.getByRole("button", { name: "Submit", exact: true }).click()
      await expect(page.getByText(name, { exact: true })).toBeVisible()
    }
    await page.getByRole("button", { name: "Start Game", exact: true }).click()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Start Game", exact: true })
      .click()
    await first.getByRole("button", { name: "Red", exact: true }).click()
    await second.getByRole("button", { name: "Blue", exact: true }).click()
    await page.getByRole("button", { name: "Next", exact: true }).click()

    const winner = page.locator('[data-podium-rank="1"] .conductor-podium-step')
    const runnerUp = page.locator(
      '[data-podium-rank="2"] .conductor-podium-step',
    )
    await expect(page.locator('[data-podium-rank="1"]')).toContainText(
      "First player",
    )
    await expect(
      page.getByRole("button", { name: "Export results" }),
    ).toBeVisible()
    for (const viewport of [
      { width: 800, height: 900 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 1920, height: 1080 },
    ]) {
      await page.setViewportSize(viewport)
      await expect(winner).toBeInViewport({ ratio: 1 })
      await expect(runnerUp).toBeInViewport({ ratio: 1 })

      await expect
        .poll(async () => {
          const firstStep = await winner.boundingBox()
          const secondStep = await runnerUp.boundingBox()

          if (!firstStep || !secondStep) {
            return false
          }

          return (
            firstStep.height > secondStep.height &&
            Math.abs(
              firstStep.y + firstStep.height - secondStep.y - secondStep.height,
            ) < 1
          )
        })
        .toBe(true)
    }
  } finally {
    await first.close()
    await second.close()
  }
}
