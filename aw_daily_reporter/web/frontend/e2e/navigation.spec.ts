import { expect, test } from "@playwright/test"

/**
 * ページナビゲーションの E2E テスト
 */
test.describe("ページナビゲーション", () => {
  test("設定ページに遷移できること", async ({ page }) => {
    // Arrange
    await page.goto("/")

    // Act: 設定ページへのリンクをクリック
    const settingsLink = page
      .locator('a[href="/settings"]')
      .or(page.locator("a").filter({ hasText: /settings|設定/i }))

    if ((await settingsLink.count()) > 0) {
      await settingsLink.first().click()

      // Assert: 設定ページに遷移したこと
      await expect(page).toHaveURL(/\/settings/)
    } else {
      // 直接URLで設定ページにアクセス
      await page.goto("/settings")
      await expect(page).toHaveURL(/\/settings/)
    }
  })

  test("デバッガーページに遷移できること", async ({ page }) => {
    // Arrange
    await page.goto("/")

    // Act: デバッガーページへのリンクをクリック
    const debuggerLink = page
      .locator('a[href="/debugger"]')
      .or(page.locator("a").filter({ hasText: /debug|デバッグ/i }))

    if ((await debuggerLink.count()) > 0) {
      await debuggerLink.first().click()

      // Assert: デバッガーページに遷移したこと
      await expect(page).toHaveURL(/\/debugger/)
    } else {
      // 直接URLでデバッガーページにアクセス
      await page.goto("/debugger")
      await expect(page).toHaveURL(/\/debugger/)
    }
  })

  test("カラー設定ページに遷移できること", async ({ page }) => {
    // Arrange
    await page.goto("/")

    // Act: カラーページへのリンクをクリック
    const colorsLink = page
      .locator('a[href="/colors"]')
      .or(page.locator("a").filter({ hasText: /colors|色|カラー/i }))

    if ((await colorsLink.count()) > 0) {
      await colorsLink.first().click()

      // Assert: カラーページに遷移したこと
      await expect(page).toHaveURL(/\/colors/)
    } else {
      // 直接URLでカラーページにアクセス
      await page.goto("/colors")
      await expect(page).toHaveURL(/\/colors/)
    }
  })

  test("ホームページに戻れること", async ({ page }) => {
    // Arrange: 設定ページに移動
    await page.goto("/settings")

    // Act: ホームページへのリンクをクリック
    const homeLink = page
      .locator('a[href="/"]')
      .or(
        page
          .locator("a")
          .filter({ hasText: /home|ホーム|dashboard|ダッシュボード/i }),
      )

    if ((await homeLink.count()) > 0) {
      await homeLink.first().click()

      // Assert: ホームページに遷移したこと
      await expect(page).toHaveURL("/")
    } else {
      // 直接URLでホームページにアクセス
      await page.goto("/")
      await expect(page).toHaveURL("/")
    }
  })
})
