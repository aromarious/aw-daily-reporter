import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E テスト設定
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // テストディレクトリ
  testDir: "./e2e",

  // 並列実行の設定
  fullyParallel: true,

  // CI環境でのみリトライを無効化
  forbidOnly: !!process.env.CI,

  // CI環境でのリトライ回数
  retries: process.env.CI ? 2 : 0,

  // ワーカー数（CI環境では1、ローカルでは並列実行）
  workers: process.env.CI ? 1 : undefined,

  // レポーター設定
  reporter: process.env.CI ? [["html"], ["github"]] : [["html"], ["list"]],

  // 共通設定
  use: {
    // ベースURL（フロントエンド開発サーバー）
    baseURL: "http://localhost:5601",

    // トレース設定（失敗時のみ）
    trace: "on-first-retry",

    // スクリーンショット設定（失敗時のみ）
    screenshot: "only-on-failure",

    // ビデオ設定（失敗時のみ）
    video: "retain-on-failure",
  },

  // プロジェクト設定（各ブラウザ）
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    // モバイル端末のテスト
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },
  ],

  // 開発サーバーの起動設定
  // バックエンド（Flask）とフロントエンド（Next.js）の両方を起動
  webServer: {
    command: "cd ../../.. && poetry run aw-daily-reporter serve --no-open",
    url: "http://localhost:5601",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
