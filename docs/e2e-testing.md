# E2E テストガイド

このドキュメントでは、Playwright を使用した E2E（End-to-End）テストの実行方法と、テストの追加方法について説明します。

## 概要

E2E テストは、ユーザーの視点からアプリケーション全体の動作を検証します。このプロジェクトでは、[Playwright](https://playwright.dev/) を使用して、複数のブラウザ（Chromium、Firefox、WebKit）でテストを実行します。

## セットアップ

### 1. Python 環境のセットアップ

E2E テストではバックエンドサーバーも必要なため、Python 環境をセットアップします。

```bash
# プロジェクトルートで実行
poetry install
```

### 2. フロントエンド依存関係のインストール

フロントエンドディレクトリで依存関係をインストールします。

```bash
cd aw_daily_reporter/web/frontend
pnpm install
```

### 3. Playwright ブラウザのインストール

Playwright が使用するブラウザをインストールします。

```bash
pnpm exec playwright install --with-deps
```

**注意**: `--with-deps` フラグを使用すると、ブラウザの実行に必要なシステム依存関係も自動的にインストールされます。

## テストの実行

### サーバーの自動起動

Playwright は、テスト実行時に自動的にバックエンド（Flask）とフロントエンド（Next.js）の両方を起動します。手動でサーバーを起動する必要はありません。

### 基本的な実行方法

```bash
# プロジェクトルートから実行（推奨）
pnpm run test:e2e

# または、フロントエンドディレクトリから実行
cd aw_daily_reporter/web/frontend
pnpm run test:e2e
```

### UI モード（推奨）

UI モードでは、テストをインタラクティブに実行・デバッグできます。

```bash
pnpm run test:e2e:ui
```

### ヘッド付きモード

ブラウザを表示してテストを実行します。

```bash
pnpm run test:e2e:headed
```

### デバッグモード

テストをステップ実行できるデバッグモードで実行します。

```bash
pnpm run test:e2e:debug
```

### 特定のブラウザのみで実行

```bash
# Chromium のみ
pnpm exec playwright test --project=chromium

# Firefox のみ
pnpm exec playwright test --project=firefox

# WebKit のみ
pnpm exec playwright test --project=webkit
```

### 特定のテストファイルのみ実行

```bash
pnpm exec playwright test e2e/home.spec.ts
```

## テストレポート

テスト実行後、HTML レポートを表示できます。

```bash
pnpm run test:e2e:report
```

## テストの追加

### テストファイルの配置

E2E テストは `aw_daily_reporter/web/frontend/e2e/` ディレクトリに配置します。

```
aw_daily_reporter/web/frontend/
├── e2e/
│   ├── home.spec.ts          # ホームページのテスト
│   ├── navigation.spec.ts    # ナビゲーションのテスト
│   ├── settings.spec.ts      # 設定ページのテスト
│   └── ...
├── playwright.config.ts      # Playwright 設定ファイル
└── ...
```

### テストの基本構造

```typescript
import { test, expect } from '@playwright/test';

/**
 * テストスイートの説明
 */
test.describe('機能名', () => {
  test('テストケースの説明', async ({ page }) => {
    // Arrange（準備）
    await page.goto('/');

    // Act（実行）
    const button = page.locator('button.submit');
    await button.click();

    // Assert（検証）
    await expect(page).toHaveURL('/success');
  });
});
```

### AAA パターンの遵守

テストコードは **Arrange（準備）**、**Act（実行）**、**Assert（検証）** の3つのブロックに分けることを推奨します。

```typescript
test('ログインが成功すること', async ({ page }) => {
  // Arrange: テストデータの準備とページ遷移
  await page.goto('/login');
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');
  const submitButton = page.locator('button[type="submit"]');

  // Act: ログイン操作の実行
  await emailInput.fill('user@example.com');
  await passwordInput.fill('password123');
  await submitButton.click();

  // Assert: 期待される結果の検証
  await expect(page).toHaveURL('/dashboard');
  await expect(page.locator('h1')).toContainText('Welcome');
});
```

### ベストプラクティス

#### 1. 適切なセレクタの使用

優先順位（推奨度の高い順）:

1. `data-testid` 属性
2. ロール・ラベル（アクセシビリティ属性）
3. テキストコンテンツ
4. CSS セレクタ

```typescript
// 推奨: data-testid を使用
await page.locator('[data-testid="submit-button"]').click();

// 次善: ロールとラベル
await page.locator('button', { hasText: 'Submit' }).click();

// 避ける: 脆弱な CSS セレクタ
await page.locator('.btn.btn-primary.submit').click();
```

#### 2. 待機の明示的な指定

```typescript
// 要素が表示されるまで待機
await expect(page.locator('.loading')).toBeVisible();
await expect(page.locator('.loading')).not.toBeVisible();

// ナビゲーションの完了を待機
await page.goto('/', { waitUntil: 'networkidle' });
```

#### 3. テストの独立性

各テストは他のテストに依存せず、独立して実行可能であること。

```typescript
// 良い例: 各テストで初期状態を設定
test('テスト1', async ({ page }) => {
  await page.goto('/');
  // テスト実行
});

test('テスト2', async ({ page }) => {
  await page.goto('/');
  // テスト実行
});
```

#### 4. エラーメッセージの明確化

```typescript
// 期待される結果を明確に記述
await expect(page.locator('.error-message')).toHaveText(
  'Invalid email address'
);
```

## CI/CD 統合

GitHub Actions で E2E テストが自動実行されます。

### ワークフローファイル

`.github/workflows/e2e-tests.yml` で定義されています。

### 実行タイミング

- `develop` または `main` ブランチへの push
- Pull Request の作成・更新

### テスト結果の確認

1. GitHub の Actions タブを開く
2. 該当のワークフロー実行を選択
3. "Playwright E2E Tests" ジョブを確認

失敗時には、スクリーンショットとテストレポートが Artifacts として保存されます。

## トラブルシューティング

### ブラウザが起動しない

```bash
# ブラウザを再インストール
pnpm exec playwright install --with-deps
```

### テストがタイムアウトする

`playwright.config.ts` でタイムアウト時間を調整します。

```typescript
export default defineConfig({
  timeout: 60000, // 60秒
  // ...
});
```

### 開発サーバーが起動しない

Playwright は自動的にバックエンドとフロントエンドの両方を起動しますが、問題が発生する場合は手動で起動できます。

```bash
# プロジェクトルートで実行（デバッグモードはデフォルトで有効）
poetry run aw-daily-reporter serve --no-open

# 別のターミナルで（既存のサーバーを再利用）
pnpm run test:e2e
```

**注意**: 手動でサーバーを起動した場合、`reuseExistingServer: true` により、Playwright は既存のサーバーを再利用します。

## 参考リンク

- [Playwright 公式ドキュメント](https://playwright.dev/)
- [Playwright ベストプラクティス](https://playwright.dev/docs/best-practices)
- [Playwright API リファレンス](https://playwright.dev/docs/api/class-playwright)
