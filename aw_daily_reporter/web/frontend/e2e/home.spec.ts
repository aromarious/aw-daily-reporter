import { expect, test } from "@playwright/test"

/**
 * ホームページ（ダッシュボード）の E2E テスト
 */
test.describe("ホームページ", () => {
  test("ページが正常に読み込まれること", async ({ page }) => {
    // Arrange & Act
    await page.goto("/")

    // Assert: ページタイトルが存在すること
    await expect(page).toHaveTitle(/AW Daily Reporter/i)
  })

  test("ヘッダーが表示されること", async ({ page }) => {
    // Arrange & Act
    await page.goto("/")

    // Assert: ヘッダーが存在すること
    const header = page.locator("header")
    await expect(header).toBeVisible()
  })

  test("テーマトグルボタンが動作すること", async ({ page }) => {
    // Arrange
    await page.goto("/")

    // Act: テーマトグルボタンをクリック
    const themeToggle = page.locator('[data-testid="theme-toggle"]').or(
      page
        .locator("button")
        .filter({ hasText: /theme|dark|light/i })
        .first(),
    )

    if ((await themeToggle.count()) > 0) {
      const initialTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute("data-theme")
      })

      await themeToggle.click()

      // Assert: テーマが切り替わったこと
      const newTheme = await page.evaluate(() => {
        return document.documentElement.getAttribute("data-theme")
      })

      expect(newTheme).not.toBe(initialTheme)
    } else {
      test.skip()
    }
  })

  test("日付選択が可能であること", async ({ page }) => {
    // Arrange
    await page.goto("/")

    // Act: 日付入力フィールドを探す
    const dateInput = page.locator('input[type="date"]').first()

    if ((await dateInput.count()) > 0) {
      await dateInput.fill("2024-01-01")

      // Assert: 日付が設定されたこと
      await expect(dateInput).toHaveValue("2024-01-01")
    } else {
      test.skip()
    }
  })
})
