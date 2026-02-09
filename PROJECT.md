# PROJECT.md - aw-daily-reporter プロジェクト概要

`aw-daily-reporter` は、[ActivityWatch](https://activitywatch.net/) のイベントデータを収集・分析し、日報・タイムラインレポートを生成するツールです。

## 1. プロジェクトの目的

個人の活動ログを自動的に集計し、人間が読みやすい形式で出力することを目指しています。プラグインシステムにより、カテゴリ分類やレポート形式を柔軟に拡張できます。

## 2. 主要機能

| 機能                   | 説明                                                                         |
| :--------------------- | :--------------------------------------------------------------------------- |
| **タイムライン生成**   | `aw-watcher-window`, `aw-watcher-afk` 等のデータを統合し、時系列データを作成 |
| **プラグインシステム** | Processor, Scanner, Renderer による拡張機能                                  |
| **Web UI**             | ダッシュボード、設定管理、タイムライン可視化を提供するインターフェース       |
| **AI Context Output**  | 生成AIによる要約用に最適化されたコンテキスト（プロンプト＋ログ）を出力       |
| **多言語対応**         | 日本語・英語プリセット、i18n 対応                                            |
| **テスト基盤**         | Vitest (Frontend), Pytest (Backend)                                          |

## 3. コマンドラインツール

| コマンド            | サブコマンド | 説明                                                    |
| :------------------ | :----------- | :------------------------------------------------------ |
| `aw-daily-reporter` | `report`     | タイムラインレポートを生成 (デフォルトレンダラーを使用) |
|                     | `serve`      | Web UI サーバーを起動 (http://localhost:5601)           |
|                     | `plugin`     | プラグインの管理 (list, install, remove)                |
|                     | `test`       | テストの実行 (`pnpm test` or `poetry run pytest`)       |

## 4. 技術スタック

### Backend

- **Language**: Python 3.10+
- **Framework**: Flask, Waitress
- **Package Manager**: Poetry
- **Main Libraries**:
  - `aw-client`: ActivityWatch API との通信
  - `pandas`: データ処理と集計
  - `tabulate`: CLI での表表示

### Frontend (Web UI)

- **Framework**: React + Vite
- **Language**: TypeScript
- **Styling**: TailwindCSS, DaisyUI
- **Testing**: Vitest, React Testing Library
- **Visualization**: ECharts (echarts-for-react)
- **State Management**: React Context / Hooks

## 5. ディレクトリ構成

```text
aw-daily-reporter/
├── aw_daily_reporter/
│   ├── __main__.py          # CLI エントリポイント
│   ├── core.py              # コアロジック・コマンド定義
│   ├── data/                # データファイル (presets)
│   ├── locales/             # 翻訳ファイル
│   ├── plugins/             # プラグインシステム
│   │   ├── manager.py       # プラグイン管理
│   │   └── ...              # 各種組み込みプラグイン
│   ├── shared/              # 共有ユーティリティ
│   │   ├── settings_manager.py # 設定管理
│   │   └── ...
│   ├── timeline/            # タイムライン処理ロジック
│   └── web/
│       ├── backend/         # Flask API サーバー
│       └── frontend/        # React + Vite フロントエンド
├── tests/                   # テストコード
│
└── pyproject.toml           # Python プロジェクト設定
```

## 6. 設定

### ユーザー設定

`~/.config/aw-daily-reporter/config.json`

```json
{
  "system": {
    "language": "ja",
    "day_start_source": "manual",
    "start_of_day": "04:00",
    "activitywatch": {
      "host": "127.0.0.1",
      "port": 5600
    }
  },
  "settings": {
    "afk_system_apps": ["loginwindow", "lockscreen", "screensaverengine"],
    "ai_prompt": "あなたは優秀なエンジニアのアシスタントです...",
    "break_categories": ["AFK", "エンターテインメント", "動画", "ゲーム"],
    "default_renderer": "aw_daily_reporter.plugins.renderer_ai.AIRendererPlugin",
    "excluded_categories": ["AFK", "エンターテインメント", "動画", "ゲーム"],
    "project_extraction_patterns": ["【(?P<project>.+?)】"]
  },
  "clients": {
    "client-uuid": { "name": "Client Name", "rate": 0 }
  },
  "client_map": {
    "regex-pattern": "client-uuid"
  },
  "project_map": {
    "regex-pattern": "Project Name"
  },
  "project_metadata": {
    "Project Name": { "client": "client-uuid" }
  },
  "apps": {
    "meetings": ["zoom", "slack"]
  },
  "rules": []
}
```

### カテゴリ・ルール設定

Web UI の設定画面から、アプリケーションごとのカテゴリ分類ルールやプロジェクトマッピングを編集できます。

## 7. ドキュメント (Documentation)

開発者・コントリビューター向けの技術ドキュメントです。

- **[specs.md](docs/specs.md)**
  - 詳細設計書。アーキテクチャ、データフロー、プラグイン仕様などの詳細。
- **[development.md](docs/development.md)**
  - 開発ガイド。セットアップ、ビルド、テスト、コマンドの使い方。
- **[logging.md](docs/logging.md)**
  - ログ出力のガイドライン。ログレベルの基準やフォーマットについて。
- **[git-operation.md](docs/git-operation.md)**
  - Git 運用ルール。ブランチ戦略、コミットメッセージの規約など。
- **[performance-improvement.md](docs/performance-improvement.md)**
  - パフォーマンス改善に関するメモ。ボトルネックの調査や最適化の方針。
- **[frontend-testing-strategy.md](docs/frontend-testing-strategy.md)**
  - フロントエンドのテスト戦略。テスト対象の選定基準や実装ルール。
- **[frontend-audit.md](docs/frontend-audit.md)**
  - フロントエンド品質監査ルール。Biome設定やカスタムチェックの仕様について。
