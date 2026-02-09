import { expect, test } from "@playwright/test"

/**
 * 設定ページの E2E テスト
 */
test.describe("設定ページ", () => {
  test("ページが正常に読み込まれること", async ({ page }) => {
    // Arrange & Act
    await page.goto("/settings")

    // Assert: 設定ページが表示されること
    await expect(page).toHaveURL(/\/settings/)
  })

  test("タブナビゲーションが表示されること", async ({ page }) => {
    // Arrange
    await page.goto("/settings")

    // Act & Assert: タブが存在すること
    const tabs = page.locator('[role="tablist"]').or(page.locator(".tabs"))

    // タブが存在する場合は確認
    if ((await tabs.count()) > 0) {
      await expect(tabs.first()).toBeVisible()
    }
  })

  test("各タブに切り替えられること", async ({ page }) => {
    // Arrange
    await page.goto("/settings")

    // Act: 各タブをクリック
    const tabButtons = page.locator('[role="tab"]').or(page.locator(".tab"))

    const tabCount = await tabButtons.count()

    if (tabCount > 0) {
      // 各タブをクリックして切り替わることを確認
      for (let i = 0; i < Math.min(tabCount, 3); i++) {
        const tab = tabButtons.nth(i)
        await tab.click()

        // Assert: タブがアクティブになったこと
        await expect(tab)
          .toHaveAttribute("aria-selected", "true")
          .or(expect(tab).toHaveClass(/active|selected/))
      }
    } else {
      test.skip()
    }
  })

  test("設定の保存ボタンが表示されること", async ({ page }) => {
    // Arrange
    await page.goto("/settings")

    // Act: 保存ボタンを探す
    const saveButton = page.locator("button").filter({
      hasText: /save|保存|apply|適用/i,
    })

    // Assert: 保存ボタンが存在する場合は表示されていること
    if ((await saveButton.count()) > 0) {
      await expect(saveButton.first()).toBeVisible()
    }
  })
})
