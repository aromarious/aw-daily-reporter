# 開発・運用手順書

`aw-daily-reporter` の開発および実行方法についての手順です。

## 前提条件

- Python 3.8+
- Node.js (v20+)
- pnpm (Recommended for frontend package management)
- Corepack (Included with Node.js)

## 開発用コマンド

テストやリントを実行するためのコマンドです。

```bash
# テストの実行
poetry run pytest

# 型チェック
poetry run mypy .

# コードフォーマット (必要に応じて)
poetry run black .
```

# フロントエンド (React/Next.js)

## プロジェクトルートから実行する場合 (推奨)

```bash
# 全テスト実行
pnpm test

# フロントエンドのみテスト実行
pnpm test:frontend

# フロントエンドのカバレッジ計測
pnpm test:frontend:coverage
```

## サブディレクトリで実行する場合

```bash
cd aw_daily_reporter/web/frontend
npm run test    # テスト実行
npm run type-check # 型チェック
npm run lint    # Linter (Biome)
npm run check:rules # 品質監査 (Biome + Custom Rules)
```

詳細なテスト方針については、[frontend-testing-strategy.md](frontend-testing-strategy.md) を参照してください。
品質監査ルールの詳細は、[frontend-audit.md](frontend-audit.md) を参照してください。

## 開発環境のセットアップ

```bash
# ドキュメントルート
poetry install

# フロントエンド
# pnpmのバージョン管理にCorepackの使用を推奨
corepack enable
cd aw_daily_reporter/web/frontend
pnpm install
```

## 開発モード（ホットリロード有効）

フロントエンドとバックエンドの両方を開発モードで起動します。
コードの変更を検知して自動的にリロードされます。

```bash
# プロジェクトルートで実行
poetry run aw-daily-reporter serve --debug
```

- **Backend**: Flaskサーバーがデバッグモードで起動します。
- **Frontend**: `pnpm run dev` が自動的にサブプロセスとして起動します。
- ブラウザで表示されるURL: 通常は `http://localhost:5601` (Next.js開発サーバー) にアクセスします。
- APIリクエストはNext.jsの `rewrites` 設定によりバックエンド (`:5602`) にプロキシされます。

## 静的配信モード（本番に近い挙動）

Next.jsのビルド済み静的ファイルをFlaskから直接配信します。
配布パッケージの動作確認や、フロントエンド開発を伴わない利用に適しています。

### 1. フロントエンドのビルド

まず、静的ファイルを生成する必要があります。

```bash
cd aw_daily_reporter/web/frontend
pnpm run build
```

`aw_daily_reporter/web/frontend/out` ディレクトリにファイルが生成されます。

### 2. サーバーの起動

`--no-frontend` オプションを付与して起動します。

```bash
# プロジェクトルートで実行
poetry run aw-daily-reporter serve --no-frontend
```

- Flaskサーバーが静的ファイルホスティングモードで起動します。
- ブラウザで `http://localhost:5602` (デフォルトポート) にアクセスします。
- `aw_daily_reporter/web/frontend/out` 内のファイルが配信されます。
- 未知のパス（例: `/settings`）へのアクセスはSPAとして処理され、`index.html` が返されます。

## コマンドオプション

`serve` コマンドのヘルプでオプションを確認できます。

```bash
poetry run aw-daily-reporter serve --help
```

- `--port`: サーバーのポート指定
  - 開発モード（フロントエンド起動時）のデフォルト: **5602** (フロントエンドは 5601)
  - 静的配信モード（インストール版など）のデフォルト: **5601**
- `--host`: ホストのバインド指定（デフォルト: 127.0.0.1）
- `--debug`: デバッグモード有効化
- `--no-frontend`: フロントエンド（Next.js開発サーバー）を起動しない
- `--no-open`: ブラウザを自動的に開かない

## パッケージのビルド (ローカル)

配布用のパッケージ（Wheelファイル）をローカル環境で作成する手順です。

1. **フロントエンドのビルド**

   ```bash
   cd aw_daily_reporter/web/frontend
   pnpm run build
   ```

   ※ `out` ディレクトリが生成されます。

2. **パッケージの作成**

   ```bash
   # プロジェクトルートで実行
   cd - 
   poetry build
   ```

   ※ `dist` ディレクトリに `.whl` と `.tar.gz` が生成されます。

## 配布パッケージの利用

ビルドされたパッケージ（Wheelファイル）をインストールして利用する場合の手順です。

### インストール

**GitHub Releases から直接インストールする場合 (推奨):**
タグ (`v0.1.0` など) がプッシュされると、GitHub Releases にパッケージが自動的にアップロードされます。
以下のコマンドで直接インストール可能です（URLは実際のリリースページから取得してください）。

```bash
# 例: v0.1.0 の Wheelファイルをインストール
pip install https://github.com/<YOUR-USERNAME>/aw-daily-reporter/releases/download/v0.1.0/aw_daily_reporter-0.1.0-py3-none-any.whl
```

**その場で作られるArtifactsを利用する場合:**

1. GitHub Actions の実行結果ページから `dist-packages` をダウンロードして解凍。
2. 解凍された `.whl` ファイルをインストール。

   ```bash
   pip install path/to/aw_daily_reporter-0.1.0-py3-none-any.whl
   ```

**ローカルでビルドした場合:**

```bash
pip install dist/aw_daily_reporter-0.1.0-py3-none-any.whl
```

### 実行

インストールが完了すると、`aw-daily-reporter` コマンドがシステム（または仮想環境）のパスに追加されます。

```bash
# サーバーの起動
aw-daily-reporter serve
```

このコマンドで、同梱されたフロントエンドを含むWeb UIが起動します（デフォルト: `http://localhost:5601`）。
`--no-frontend` オプションは不要です（インストール版は常に静的配信モードで動作するため、オプションを指定しても無視されるか、単にバックエンドとして振る舞います）。
