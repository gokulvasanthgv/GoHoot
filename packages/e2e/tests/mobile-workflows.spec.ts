import { test, expect, type BrowserContext, type Page } from "@playwright/test"
import { fileURLToPath } from "node:url"

const portrait = { width: 320, height: 568 }
const landscape = { width: 844, height: 390 }
const questionText =
  "Read the full question and all seven answer options on a small screen"

let managerState: Awaited<ReturnType<BrowserContext["storageState"]>>

test.beforeAll(async ({ browser, baseURL }) => {
  const session = await browser.newContext({ baseURL })

  try {
    const page = await session.newPage()
    await page.goto("/manager")
    await page.getByPlaceholder("Username").fill("admin")
    await page
      .getByPlaceholder("Password", { exact: true })
      .fill("browser-test-password")
    await page
      .getByRole("button", { name: "Sign In", exact: true })
      .last()
      .click()
    await expect(
      page.getByRole("button", { name: "Configurations", exact: true }),
    ).toBeVisible()
    managerState = await session.storageState()
  } finally {
    await session.close()
  }
})

test.use({
  viewport: portrait,
  isMobile: true,
  hasTouch: true,
  storageState: async ({ browserName: _browserName }, use) => {
    await use(managerState)
  },
})

const expectPageWidth = async (page: Page) => {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
}

const swipeUp = async (page: Page, x: number, fromY: number, toY: number) => {
  const session = await page.context().newCDPSession(page)

  try {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y: fromY }],
    })
    for (let step = 1; step <= 10; step += 1) {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: fromY + ((toY - fromY) * step) / 10 }],
      })
      await page.evaluate(() => new Promise(requestAnimationFrame))
    }
    await session.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    })
  } finally {
    await session.detach()
  }
}

test("mobile editor can reach seven options, switch questions, and save a new quiz", async ({
  page,
  browserName,
}, testInfo) => {
  await page.goto("/manager/quizz/browser-mobile")
  const title = page.getByPlaceholder("Start typing your question...")
  const save = page.getByRole("button", { name: "Save", exact: true })
  const listToggle = page.getByRole("button", { name: /^Questions /u })
  const settingsToggle = page.getByRole("button", {
    name: "Question settings",
    exact: true,
  })
  await expect(title).toHaveValue(questionText)
  await expect(save).toBeInViewport({ ratio: 1 })
  await expect(listToggle).toHaveAttribute("aria-expanded", "false")
  await expectPageWidth(page)

  if (browserName === "chromium") {
    await swipeUp(page, 8, 500, 135)
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0)
  }

  const lastOption = page.getByRole("textbox", {
    name: "Option G",
    exact: true,
  })
  await lastOption.scrollIntoViewIfNeeded()
  await expect(lastOption).toBeInViewport({ ratio: 1 })
  await expect(save).toBeInViewport({ ratio: 1 })
  await lastOption.fill("A shorter last option")

  await listToggle.tap()
  await expect(listToggle).toHaveAttribute("aria-expanded", "true")
  const questionList = page.locator("#quiz-question-list")
  await expect(
    questionList.getByRole("button", { name: "Delete question" }).last(),
  ).toBeInViewport({ ratio: 1 })
  await questionList
    .getByRole("button", { name: /Information slide on a phone/u })
    .tap()
  await expect(listToggle).toHaveAttribute("aria-expanded", "false")
  await expect(title).toHaveValue("Information slide on a phone")
  await settingsToggle.tap()
  await expect(
    page.getByRole("combobox", { name: "Question type" }),
  ).toHaveValue("slide")
  await page
    .getByRole("textbox", { name: "Slide text" })
    .fill("Edited slide text")

  await page.setViewportSize(landscape)
  await page
    .getByRole("button", { name: "Previous question", exact: true })
    .tap()
  await expect(title).toHaveValue(questionText)
  await page.getByRole("button", { name: "Question media", exact: true }).tap()
  await page
    .locator('#question-media input[type="file"]')
    .setInputFiles(
      fileURLToPath(
        new URL("../../web/public/gohoot-logo-favicon.webp", import.meta.url),
      ),
    )
  const cropper = page.getByRole("dialog", { name: "Crop Image", exact: true })
  await expect(cropper).toBeInViewport({ ratio: 1 })
  await cropper.getByRole("button", { name: "16:9", exact: true }).tap()
  await cropper.getByRole("button", { name: "Cancel", exact: true }).tap()
  await expect(cropper).toBeHidden()
  const mediaUrl = page.getByRole("textbox", { name: "Media URL" })
  await mediaUrl.clear()
  const replacementUrl = new URL("/gohoot-logo-favicon.webp", page.url()).href
  await mediaUrl.pressSequentially(replacementUrl)
  await expect(mediaUrl).toHaveValue(replacementUrl)
  await expect(page.getByRole("combobox", { name: "Media type" })).toHaveValue(
    "image",
  )
  await expectPageWidth(page)

  await page.goto("/manager/quizz")
  await page.setViewportSize({ width: 390, height: 844 })
  await page
    .getByPlaceholder("Quizz title...")
    .fill("Created in the mobile editor")
  await title.fill("Which option can the conductor read on a narrow phone?")
  await page
    .getByRole("textbox", { name: "Option A", exact: true })
    .fill("A short option")
  await page
    .getByRole("textbox", { name: "Option B", exact: true })
    .fill("A longer answer that wraps without hiding text or controls")
  await page
    .getByRole("button", { name: "Mark option B as correct", exact: true })
    .tap()
  await expectPageWidth(page)
  await page.screenshot({ path: testInfo.outputPath("mobile-quiz-editor.png") })
  await page.getByRole("button", { name: "Quiz Settings", exact: true }).tap()
  const settings = page.getByRole("dialog", {
    name: "Quiz Settings",
    exact: true,
  })
  await expect(
    settings.getByRole("button", { name: "Set Global Timer" }),
  ).toBeVisible()
  await settings.getByRole("button", { name: "Done", exact: true }).tap()
  await save.tap()
  await expect(page).toHaveURL(/\/manager\/config$/u)
  await expect(
    page.getByText("Quizz saved successfully", { exact: true }),
  ).toBeVisible()
})

test("mobile conductor can start a live quiz and scroll its stage with controls in view", async ({
  page,
  browser,
  browserName,
}, testInfo) => {
  await page.goto("/manager/config")
  await page.getByText("Mobile layout quiz", { exact: true }).tap()
  await page.getByRole("button", { name: "Start game", exact: true }).tap()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Start", exact: true })
    .tap()
  const pin = await page.locator("p.text-6xl").innerText()
  expect(pin).toMatch(/^\d{6}$/u)
  await page
    .getByRole("button", { name: "Enlarge join QR code", exact: true })
    .tap()
  const qr = page.getByRole("dialog", { name: "Join by QR code", exact: true })
  await expect(qr).toBeInViewport({ ratio: 1 })
  await qr
    .getByRole("button", { name: "Close join QR code", exact: true })
    .tap()

  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: { cookies: [], origins: [] },
  })

  try {
    const guest = await guestContext.newPage()
    await guest.goto(new URL(`/?pin=${pin}`, page.url()).href)
    await guest.getByPlaceholder("Username here").fill("Mobile layout player")
    await guest.getByRole("button", { name: "Submit", exact: true }).click()
    await expect(
      page.getByText("Mobile layout player", { exact: true }),
    ).toBeVisible()
    await expectPageWidth(page)

    await page.setViewportSize(landscape)
    await page.getByRole("button", { name: "Start Game", exact: true }).tap()
    const settings = page.getByRole("alertdialog", {
      name: "Pre-Game Settings",
    })
    const start = settings.getByRole("button", {
      name: "Start Game",
      exact: true,
    })
    await expect(settings).toBeInViewport({ ratio: 1 })
    await settings.getByLabel("Double time").check()
    await expect(start).toBeInViewport({ ratio: 1 })
    await start.tap()
    await page.setViewportSize({ width: 568, height: 320 })

    const stage = page.locator("[data-conductor] main")
    const skip = page.getByRole("button", { name: "Skip", exact: true })
    const end = page.getByRole("button", { name: "End Quiz", exact: true })
    const lastAnswer = page.getByRole("button", { name: /^G G+$/u })
    await expect(skip).toBeInViewport({ ratio: 1 })
    await expect(lastAnswer).toBeDisabled()
    await expect(
      page.getByRole("button", { name: "Submit", exact: true }),
    ).toHaveCount(0)
    expect(
      await stage.evaluate((element) => element.scrollHeight),
    ).toBeGreaterThan(await stage.evaluate((element) => element.clientHeight))

    if (browserName === "chromium") {
      await swipeUp(page, 280, 245, 100)
      await expect
        .poll(() => stage.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(0)
    }

    await lastAnswer.scrollIntoViewIfNeeded()
    await expect(lastAnswer).toBeInViewport({ ratio: 0.99 })
    await expect(skip).toBeInViewport({ ratio: 1 })
    await expect(end).toBeInViewport({ ratio: 1 })
    await expectPageWidth(page)

    await page.setViewportSize(landscape)
    await stage.evaluate((element) => element.scrollTo(0, 0))
    await expect(lastAnswer).toBeInViewport({ ratio: 0.99 })
    await page.screenshot({
      path: testInfo.outputPath("mobile-conductor-landscape.png"),
    })

    await guest.getByRole("button", { name: "B Blue", exact: true }).click()
    const chart = page.getByRole("list", { name: "Answer distribution" })
    await expect(
      chart.getByRole("listitem", { name: "B: 1", exact: true }),
    ).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(chart).toBeInViewport({ ratio: 1 })
    expect((await chart.boundingBox())?.height).toBeGreaterThanOrEqual(192)
    await expect(
      page
        .getByRole("list", { name: "Answer options" })
        .getByRole("listitem")
        .last(),
    ).toBeInViewport({ ratio: 0.99 })
    await expectPageWidth(page)
    await page.screenshot({
      path: testInfo.outputPath("mobile-conductor-results.png"),
    })

    const next = page.getByRole("button", { name: "Next", exact: true })
    await next.tap()
    await expect(
      page.getByRole("heading", { name: "Leaderboard" }),
    ).toBeVisible()
    await next.tap()
    await expect(
      page.getByRole("heading", { name: "Information slide on a phone" }),
    ).toBeVisible()
    await expect(end).toBeInViewport({ ratio: 1 })
    await end.tap()
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "End Quiz", exact: true })
      .tap()
    await expect(
      page.getByText("Mobile layout player", { exact: true }),
    ).toBeVisible()
  } finally {
    await guestContext.close()
  }
})
