import { test, expect, type Page } from "@playwright/test"

const musicUrl = "http://127.0.0.1:18855/sounds/answersMusic.mp3?conductor=1"

const playingMusic = (page: Page) =>
  page.evaluate(() => {
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
      .filter((track) => track._loop && track.playing())
      .map((track) => ({ source: track._src, volume: track.volume() }))
  })

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
  await page.getByText("Conductor presentation checks", { exact: true }).click()
  await page.getByRole("button", { name: "Start game", exact: true }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Start", exact: true })
    .click()
  const pin = (await page.locator("p.text-6xl").innerText()).replace(/\s/gu, "")
  await expect
    .poll(() => playingMusic(page))
    .toEqual([{ source: musicUrl, volume: 0.2 }])

  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const guest = await guestContext.newPage()
  const guestMusicRequests: string[] = []
  guest.on("request", (request) => {
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
    await page.getByRole("button", { name: "Start Game", exact: true }).click()
    await page.getByLabel("Double time").check()
    await page.getByRole("button", { name: "Start Game", exact: true }).click()

    await expect(
      guest.getByRole("button", { name: "Submit", exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "A Red", exact: true }),
    ).toBeDisabled()
    await expect
      .poll(() => playingMusic(page))
      .toEqual([{ source: musicUrl, volume: 0.2 }])
    await expect.poll(() => playingMusic(guest)).toEqual([])

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
    for (const label of ["A: 1", "B: 0", "C: 1", "D: 1"]) {
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

    await nextQuestion(page)
    await expect(
      guest.getByRole("button", { name: "B Blue", exact: true }),
    ).toBeVisible()
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
    await guest.getByRole("button", { name: "B Blue", exact: true }).click()
    await expect(
      chart.getByRole("listitem", { name: "G: 0", exact: true }),
    ).toBeVisible()

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
      guest.getByRole("button", { name: "A True", exact: true }),
    ).toBeVisible()
    await page.getByRole("button", { name: "Skip", exact: true }).click()
    await expect(
      chart.getByRole("listitem", { name: "A: 0", exact: true }),
    ).toBeVisible()
    await expect(
      chart.getByRole("listitem", { name: "B: 0", exact: true }),
    ).toBeVisible()
    await expect
      .poll(() => playingMusic(page))
      .toEqual([{ source: musicUrl, volume: 1 }])
    expect(guestMusicRequests).toEqual([])
    await expect.poll(() => playingMusic(guest)).toEqual([])

    // History navigation keeps the document alive, so leaked audio cannot hide behind a reload.
    await page.goBack()
    await expect(page).toHaveURL(/\/manager\/config$/u)
    await expect.poll(() => playingMusic(page)).toEqual([])
  } finally {
    await guestContext.close()
  }
})
