import { test, expect, type Page } from "@playwright/test"

const password = "browser-test-password"
const longName = "A_Quizmaster_With_A_Long_Unbroken_Username_1234567890"

const login = async (page: Page) => {
  await page.goto("/manager")
  await page.getByPlaceholder("Username").fill("admin")
  await page.getByPlaceholder("Password", { exact: true }).fill(password)
  await page
    .getByRole("button", { name: "Sign In", exact: true })
    .last()
    .click()
  await expect(
    page.getByRole("button", { name: "Configurations", exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Configurations", exact: true })
    .click()
  await expect(
    page.getByRole("heading", { name: "Configurations" }),
  ).toBeVisible()
}

test("signed login and user controls fit desktop, tablet, and mobile", async ({
  page,
}) => {
  await login(page)
  await page.getByRole("button", { name: "Users", exact: true }).click()
  for (const width of [320, 360, 390, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.getByText(longName, { exact: true })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    const clipped = await page
      .locator("li select, li button, li p")
      .evaluateAll((elements) =>
        elements
          .filter((element) => {
            const rect = element.getBoundingClientRect()

            return (
              rect.left < 0 ||
              rect.right > window.innerWidth + 1 ||
              element.scrollWidth > element.clientWidth + 1
            )
          })
          .map((element) => element.textContent),
      )
    expect(clipped).toEqual([])
  }
  const row = page.locator("li").filter({ hasText: longName })
  await row.getByRole("button", { name: "Reset Password", exact: true }).click()
  await page.setViewportSize({ width: 320, height: 740 })
  await expect(row.getByLabel("New password (min 8 characters)")).toBeVisible()
  await row
    .getByLabel("New password (min 8 characters)")
    .fill("replacement-test-password")
  await row.getByRole("button", { name: "Save", exact: true }).click()
  await expect(
    page.getByText("User password has been reset successfully"),
  ).toBeVisible()
  const response = await page.request.post("/api/auth/signin", {
    data: { username: longName, password: "replacement-test-password" },
  })
  expect(response.status()).toBe(200)
})

test("all four fork question types work in solo mode and results export", async ({
  page,
}) => {
  await login(page)
  await page.goto("/party/solo/browser-solo")
  await page.getByRole("button", { name: "Start", exact: true }).click()
  await page.getByRole("button", { name: "Red", exact: true }).click()
  await page.getByRole("button", { name: "Orange", exact: true }).click()
  await page.getByRole("button", { name: "Submit Selection" }).click()
  await page.getByRole("button", { name: "Next Question" }).click()
  await page.getByRole("button", { name: "True", exact: true }).click()
  await page.getByRole("button", { name: "Next Question" }).click()
  await expect(
    page.getByText("Slide body is preserved", { exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Next Question" }).click()
  await expect(page.getByRole("button", { name: "Submit Order" })).toBeVisible()
  for (const [index, text] of ["First", "Second", "Third"].entries()) {
    const rows = page.locator("[data-sortable-id]")
    const current = await rows.allTextContents()
    const position = current.findIndex((value) => value.includes(text))
    const handle = rows.filter({ hasText: text }).getByRole("button")

    if (position === index) {
      continue
    }

    await handle.click({ trial: true })
    await handle.focus()
    await page.keyboard.press("Space")
    await expect(handle).toHaveAttribute("aria-pressed", "true")
    for (let move = position; move > index; move -= 1) {
      const targetId = await rows.nth(move - 1).getAttribute("data-sortable-id")
      await page.keyboard.press("ArrowUp")
      await expect(page.getByRole("status")).toContainText(
        `droppable area ${targetId}.`,
      )
    }
    await page.keyboard.press("Space")
    await expect(rows.nth(index)).toContainText(text)
  }
  await page.getByRole("button", { name: "Submit Order" }).click()
  await page.getByRole("button", { name: "Finish Quiz" }).click()
  await expect(page.getByText("Quiz Completed!", { exact: true })).toBeVisible()
  await expect(page.getByText("4000", { exact: true })).toBeVisible()
  await page.goto("/manager/config")
  await page.getByRole("button", { name: "Results", exact: true }).click()
  await page.getByRole("button", { name: /All GoHoot question types/ }).click()
  const downloadPromise = page.waitForEvent("download")
  await page.getByRole("button", { name: "Export results" }).click()
  expect((await downloadPromise).suggestedFilename()).toMatch(/\.xlsx$/u)
})

test("host and guest reconnect, retain game options, and finish a live round", async ({
  page,
  browser,
}) => {
  await login(page)
  await page.getByText("Live compatibility quiz", { exact: true }).click()
  await page.getByRole("button", { name: "Start game", exact: true }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Start", exact: true })
    .click()
  await expect(page).toHaveURL(/\/party\/manager\//u)
  const pin = (await page.locator("p.text-6xl").innerText()).replace(/\s/gu, "")
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const guest = await guestContext.newPage()
  await guest.goto(`http://127.0.0.1:18855/?pin=${pin}`)
  await guest.getByPlaceholder("Username here").fill("MobilePlayer")
  await guest.getByRole("button", { name: "Submit", exact: true }).click()
  await expect(page.getByText("MobilePlayer", { exact: true })).toBeVisible()
  await guest.evaluate(() => localStorage.removeItem("token"))
  await guest.reload()
  await expect(guest.getByText("MobilePlayer", { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByText("MobilePlayer", { exact: true })).toHaveCount(1)
  await page.getByRole("button", { name: "Start Game", exact: true }).click()
  await page.getByRole("button", { name: /Accuracy Mode/ }).click()
  await page.getByLabel("Double time").check()
  await page.getByRole("button", { name: "Start Game", exact: true }).click()
  await guest.getByRole("button", { name: /Red/u }).click()
  await expect(guest.getByText("2000", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "End Quiz", exact: true }).click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "End Quiz", exact: true })
    .click()
  await expect(page.getByText("MobilePlayer", { exact: true })).toBeVisible()
  await guestContext.close()
})

test("quiz editing, question reordering, trash, and restore preserve the quiz ID", async ({
  page,
}) => {
  await login(page)
  await page.goto("/manager/quizz/browser-solo")
  await page
    .getByRole("textbox", { name: "Quiz title" })
    .fill("Edited compatibility quiz")
  const rows = page.locator("[data-sortable-id]")
  const first = page.getByRole("button", {
    name: "Move question 1",
    exact: true,
  })
  const targetId = await rows.nth(1).getAttribute("data-sortable-id")
  const activeId = await rows.nth(0).getAttribute("data-sortable-id")
  await first.click({ trial: true })
  await first.focus()
  await page.keyboard.press("Space")
  await expect(first).toHaveAttribute("aria-pressed", "true")
  await expect(page.getByRole("status")).toContainText(
    `droppable area ${activeId}.`,
  )
  await page.keyboard.press("ArrowDown")
  await expect(page.getByRole("status")).toContainText(
    `droppable area ${targetId}.`,
  )
  await page.keyboard.press("Space")
  await expect(rows.nth(0)).toContainText("The sky is blue")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page).toHaveURL(/\/manager\/config$/u)
  await page.getByRole("button", { name: "Quizz", exact: true }).click()
  await page
    .getByRole("button", {
      name: "Delete quiz Edited compatibility quiz",
      exact: true,
    })
    .click()
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click()
  await expect(
    page.getByText("Edited compatibility quiz", { exact: true }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Trash", exact: true }).click()
  await expect(
    page.getByText("Edited compatibility quiz", { exact: true }),
  ).toBeVisible()
  await page.getByRole("button", { name: "Restore Quiz", exact: true }).click()
  await page.getByRole("button", { name: "Quizz", exact: true }).click()
  await page
    .getByRole("button", {
      name: "Edit quiz Edited compatibility quiz",
      exact: true,
    })
    .click()
  await expect(page).toHaveURL(/\/manager\/quizz\/browser-solo$/u)
  await expect(rows.nth(0)).toContainText("The sky is blue")
})

test("oversized options are flagged, located, and cleared as they are corrected", async ({
  page,
}, testInfo) => {
  await login(page)
  await page.goto("/manager/quizz/browser-long-options")
  const questionTwo = page.getByRole("img", {
    name: "Question 2: options exceed 65 characters",
    exact: true,
  })
  const questionThree = page.getByRole("img", {
    name: "Question 3: options exceed 65 characters",
    exact: true,
  })
  await expect(questionTwo).toBeVisible()
  await expect(questionThree).toBeVisible()
  await expect(
    page.getByRole("img", {
      name: "Question 1: options exceed 65 characters",
      exact: true,
    }),
  ).toHaveCount(0)
  await expect(
    page.getByText("2 questions have oversized options", { exact: true }),
  ).toBeVisible()
  await expect(questionTwo).toHaveCSS("animation-name", "pulse")
  await page.emulateMedia({ reducedMotion: "reduce" })
  await expect(questionTwo).toHaveCSS("animation-name", "none")
  await page.emulateMedia({ reducedMotion: "no-preference" })

  const saves: string[] = []
  page.on("request", (request) => {
    if (
      request.method() === "PATCH" &&
      request.url().endsWith("/api/quizz/browser-long-options")
    ) {
      saves.push(request.url())
    }
  })
  await page.getByRole("button", { name: "Save", exact: true }).click()
  const secondOption = page.getByRole("textbox", {
    name: "Option B",
    exact: true,
  })
  await expect(secondOption).toBeFocused()
  await expect(secondOption).toHaveAttribute("aria-invalid", "true")
  await expect(
    page.getByRole("textbox", { name: "Option G", exact: true }),
  ).toHaveAttribute("aria-invalid", "true")
  await expect(
    page.getByText("7 characters over the 65-character limit", { exact: true }),
  ).toBeInViewport({ ratio: 1 })
  await expect(page.locator("header")).toBeInViewport({ ratio: 1 })
  expect(saves).toHaveLength(0)
  await page.screenshot({
    path: testInfo.outputPath("option-length-highlights.png"),
    fullPage: false,
  })

  await secondOption.fill("B".repeat(65))
  await expect(secondOption).toHaveAttribute("aria-invalid", "false")
  await expect(questionTwo).toBeVisible()
  await page
    .getByRole("button", { name: "Remove last option", exact: true })
    .click()
  await expect(questionTwo).toHaveCount(0)
  await expect(
    page.getByText("1 question has oversized options", { exact: true }),
  ).toBeVisible()

  await page
    .getByRole("button", { name: "Next flagged question", exact: true })
    .click()
  const puzzleOption = page.getByRole("textbox", {
    name: "Option 2",
    exact: true,
  })
  await expect(puzzleOption).toBeFocused()
  await expect(puzzleOption).toHaveAttribute("aria-invalid", "true")
  await expect(
    page.getByText("15 characters over the 65-character limit", {
      exact: true,
    }),
  ).toBeVisible()
  await puzzleOption.fill("Second")
  await expect(questionThree).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Next flagged question", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page).toHaveURL(/\/manager\/config$/u)
  expect(saves).toHaveLength(1)
})

test("legacy fixed options can be corrected without editing JSON", async ({
  page,
}) => {
  await login(page)
  await page.goto("/manager/quizz/browser-readonly-options")
  await expect(
    page.getByText("2 questions have oversized options", { exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Remove unused options", exact: true })
    .click()
  await expect(
    page.getByText("1 question has oversized options", { exact: true }),
  ).toBeVisible()
  await page
    .getByRole("button", { name: "Next flagged question", exact: true })
    .click()
  await expect(
    page.getByRole("textbox", { name: "Option A", exact: true }),
  ).toHaveAttribute("aria-invalid", "true")
  await page
    .getByRole("button", {
      name: "Reset oversized options to True / False",
      exact: true,
    })
    .click()
  await expect(
    page.getByRole("textbox", { name: "Option A", exact: true }),
  ).toHaveValue("True")
  await expect(
    page.getByRole("button", { name: "Next flagged question", exact: true }),
  ).toHaveCount(0)
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page).toHaveURL(/\/manager\/config$/u)
})
