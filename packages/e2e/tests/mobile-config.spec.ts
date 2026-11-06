import { test, expect, type Page } from "@playwright/test"

const sections = ["Play", "Quizz", "Results", "Trash", "Users", "Settings"]
const getScrollY = (page: Page) => page.evaluate(() => window.scrollY)

const login = async (page: Page) => {
  await page.goto("/manager")
  await page.getByPlaceholder("Username").fill("admin")
  await page
    .getByPlaceholder("Password", { exact: true })
    .fill("browser-test-password")
  await page.getByRole("button", { name: "Sign In", exact: true }).last().tap()
  await page.getByRole("button", { name: "Configurations", exact: true }).tap()
  await expect(
    page.getByRole("heading", { name: "Configurations", exact: true }),
  ).toBeVisible()
}

const selectSection = async (page: Page, name: string) => {
  const menu = page.getByRole("button", {
    name: "Configuration menu",
    exact: true,
  })
  await menu.tap()
  const navigation = page.getByRole("navigation", { name: "Configurations" })
  await navigation.getByRole("button", { name, exact: true }).tap()
  await expect(menu).toHaveAttribute("aria-expanded", "false")
  await expect(menu).toContainText(name)
}

test.describe("mobile configuration pages", () => {
  test.use({
    viewport: { width: 390, height: 740 },
    isMobile: true,
    hasTouch: true,
  })

  test("hamburger navigation fits phones and landscape and retains desktop tabs", async ({
    page,
  }, testInfo) => {
    await login(page)
    const menu = page.getByRole("button", {
      name: "Configuration menu",
      exact: true,
    })
    const navigation = page.getByRole("navigation", { name: "Configurations" })

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(viewport)
      await expect(menu).toBeVisible()
      await expect(navigation).toBeHidden()
      await menu.tap()
      await expect(menu).toHaveAttribute("aria-expanded", "true")
      for (const name of sections) {
        const option = navigation.getByRole("button", { name, exact: true })
        await expect(option).toBeInViewport({ ratio: 1 })
        const box = await option.boundingBox()
        expect(box?.height).toBeGreaterThanOrEqual(44)
      }
      await page.keyboard.press("Escape")
      await expect(navigation).toBeHidden()
      await expect(menu).toBeFocused()
      for (const name of sections) {
        await selectSection(page, name)
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
    }

    await page.setViewportSize({ width: 390, height: 740 })
    await menu.tap()
    await page.screenshot({
      path: testInfo.outputPath("mobile-settings-menu.png"),
    })
    await menu.tap()
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(menu).toBeHidden()
    for (const name of sections) {
      await expect(
        navigation.getByRole("button", { name, exact: true }),
      ).toBeVisible()
    }
    await navigation.getByRole("button", { name: "Users", exact: true }).click()
    await expect(page.getByLabel("Role for Registered player")).toBeVisible()
  })

  test("native touch swipes scroll users and every overflowing configuration page", async ({
    page,
    context,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 500 })
    await login(page)
    const session = await context.newCDPSession(page)
    const swipeUp = async () => {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 195, y: 420 }],
      })
      for (let step = 1; step <= 10; step += 1) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: 195, y: 420 - step * 28 }],
        })
        await page.evaluate(() => new Promise(requestAnimationFrame))
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      })
    }

    for (const name of [
      "Users",
      "Play",
      "Quizz",
      "Results",
      "Trash",
      "Settings",
    ]) {
      await selectSection(page, name)
      // Start at the top so only a real touch gesture can advance the page.
      await page.evaluate(() => window.scrollTo(0, 0))
      const overflow = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      )

      if (name === "Users" || name === "Settings") {
        expect(overflow).toBeGreaterThan(0)
      }

      if (overflow > 0) {
        await swipeUp()
        await expect.poll(() => getScrollY(page)).toBeGreaterThan(0)
      }

      if (name === "Users") {
        const lastUser = page.getByRole("button", {
          name: "Delete user Registered player",
          exact: true,
        })
        for (let attempt = 0; attempt < 8; attempt += 1) {
          if (
            await lastUser.evaluate(
              (element) =>
                element.getBoundingClientRect().bottom <= window.innerHeight,
            )
          ) {
            break
          }

          await swipeUp()
        }
        await expect(lastUser).toBeInViewport({ ratio: 1 })
        await expect(
          page.getByRole("button", { name: "Configuration menu", exact: true }),
        ).toBeInViewport({ ratio: 1 })
        await page.screenshot({
          path: testInfo.outputPath("mobile-users-scrolled.png"),
        })
      }

      if (name === "Settings") {
        await expect(
          page.getByRole("button", { name: "Save Settings", exact: true }),
        ).toBeInViewport({ ratio: 1 })
      }
    }
    await session.detach()
  })
})
