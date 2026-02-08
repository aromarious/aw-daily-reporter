# 詳細設計書 (Specifications)

**プロジェクト**: aw-daily-reporter
**バージョン**: 0.1.0

---

## 1. 概要

aw-daily-reporter は ActivityWatch のデータを活用した日報・タイムライン生成ツールです。

### 1.1 主要機能

| 機能                   | 説明                                                     |
| :--------------------- | :------------------------------------------------------- |
| **タイムライン生成**   | ActivityWatch のデータを集約・加工してタイムラインを生成 |
| **プラグインシステム** | 処理・スキャン・レンダリングを拡張可能                   |
| **Web UI**             | ブラウザからプラグイン管理・設定編集                     |
| **レポート出力**       | Markdown 形式で日報を出力                                |

### 1.2 アーキテクチャ

```text
┌─────────────────┐     ┌──────────────────┐
│  ActivityWatch  │────▶│  aw-daily-reporter │
│  (aw-server)    │     │                  │
│                 │     │  ┌────────────┐  │
│                 │     │  │ Processors │  │
│                 │     │  ├────────────┤  │
│                 │     │  │ Scanners   │  │
│                 │     │  ├────────────┤  │
│                 │     │  │ Renderers  │  │
│                 │     │  └────────────┘  │
│                 │     │        │         │
│                 │     │        ▼         │
│                 │     │  ┌────────────┐  │
│                 │     │  │  Web UI    │  │
│                 │     │  └────────────┘  │
│                 │     └──────────────────┘
└─────────────────┘
```

---

## 2. コマンドラインインターフェース (CLI)

### 2.1 メインコマンド

```bash
aw-daily-reporter [COMMAND] [OPTIONS]
```

### 2.2 サブコマンド

| コマンド | 説明                                     |
| :------- | :--------------------------------------- |
| `report` | タイムラインレポートを生成（デフォルト） |
| `serve`  | Web UI を起動                            |
| `plugin` | プラグイン管理                           |

### 2.3 report コマンド

```bash
aw-daily-reporter report [OPTIONS]
```

| オプション  | 短縮形 | デフォルト | 説明                        |
| :---------- | :----- | :--------- | :-------------------------- |
| `--date`    | `-d`   | 今日       | 集計対象の日付 (YYYY-MM-DD) |
| `--output`  | `-o`   | stdout     | 出力先ファイル              |
| `--format`  | `-f`   | markdown   | 出力形式 (markdown/json)    |
| `--verbose` | `-v`   | False      | 詳細ログ表示                |

### 2.4 serve コマンド

```bash
aw-daily-reporter serve [OPTIONS]
```

| オプション  | 短縮形 | デフォルト | 説明                     |
| :---------- | :----- | :--------- | :----------------------- |
| `--port`    | `-p`   | 5601       | Web UI のポート番号      |
| `--host`    |        | 127.0.0.1  | バインドするホスト       |
| `--no-open` |        | False      | ブラウザを自動で開かない |

### 2.5 plugin コマンド

```bash
aw-daily-reporter plugin [SUBCOMMAND]
```

| サブコマンド    | 説明                             |
| :-------------- | :------------------------------- |
| `list`          | インストール済みプラグイン一覧   |
| `install <URL>` | URL からプラグインをインストール |
| `remove <NAME>` | プラグインをアンインストール     |

---

## 3. Web UI

### 3.1 使用パターン

- **通常時**: CLI (`aw-daily-reporter report`) でレポートを出力するだけ
- **調整時**: カテゴリ分類がイマイチな時だけ `aw-daily-reporter serve` で Web UI を起動

Web UI は常時起動するデーモンではなく、必要な時にオンデマンドで起動する設計。

### 3.2 機能

| 画面               | 機能                                        |
| :----------------- | :------------------------------------------ |
| **ダッシュボード** | 今日/昨日のレポートプレビュー、統計情報     |
| **プラグイン管理** | 有効/無効の切り替え、設定編集、インストール |
| **カテゴリ設定**   | カテゴリルールの追加・編集・削除            |
| **レポート履歴**   | 過去のレポート閲覧                          |

### 3.3 技術スタック

- **バックエンド**: Python (Flask + Waitress)
- **フロントエンド**: TypeScript + React + Vite + Tailwind CSS (DaisyUI)
- **ポート**: 5601（ActivityWatch の 5600 と被らない）

---

## 4. プラグインシステム

### 4.1 プラグインの種類

| 種類          | 役割                                   | 実行タイミング         |
| :------------ | :------------------------------------- | :--------------------- |
| **Processor** | タイムラインデータを加工・変換         | データ取得後、順次実行 |
| **Scanner**   | 外部データを取得してタイムラインに追加 | Processor 完了後       |
| **Renderer**  | レポートを出力形式に変換               | 最終段階               |

### 4.2 ビルトインプラグイン

```text
aw_daily_reporter/plugins/
├── processor_afk.py               # 離席判定
├── processor_compression.py       # イベント圧縮
├── processor_project_extractor.py # プロジェクト抽出
├── processor_project_mapping.py   # プロジェクト名マッピング
├── processor_rule_matching.py     # ルールマッチング
├── scanner_git.py                 # Git コミット情報取得
├── renderer_ai.py                 # AI レポート生成
├── renderer_json.py               # JSON 出力
└── renderer_markdown.py           # Markdown 出力
```

### 4.3 ユーザープラグイン

```text
~/.config/aw-daily-reporter/plugins/
├── my_custom_processor.py    # 自作プラグイン
└── ...
```

### 4.4 プラグイン設定

`~/.config/aw-daily-reporter/plugins.toml` で有効化・無効化を管理。

### 4.5 プラグイン開発

```python
from aw_daily_reporter.plugins.base import ProcessorPlugin

class MyProcessor(ProcessorPlugin):
    name = "my_processor"
    description = "カスタム処理を行うプラグイン"
    
    def process(self, timeline, config):
        # timeline を加工して返す
        return timeline
```

---

## 5. データ処理（省略）

基本的なフローは変わらず。

---

## 6. 設定ファイル

### 6.1 メイン設定 (`~/.config/aw-daily-reporter/config.toml`)

- 一般設定（言語、タイムゾーン）
- ActivityWatch 接続設定
- レポート出力設定

### 6.2 言語別プリセット (`data/presets/{lang}.json`)

- ja.json (日本語)
- en.json (英語)

---

## 7. モジュール構成

```
aw_daily_reporter/
├── __init__.py
├── __main__.py           # CLI エントリーポイント
├── core.py               # メインロジック
├── timeline/
│   ├── generator.py      # タイムライン生成
│   └── models.py         # データモデル
├── plugins/              # プラグイン
├── web/
│   ├── backend/          # Flask アプリケーション
│   └── frontend/         # React アプリケーション
└── data/
    └── builtin_config.json
```

---

## 8. 多言語対応 (i18n)

- **対応言語**: 日本語 (ja), 英語 (en)
- **実装**: `gettext` ベース

---

## 9. 制約事項

| 項目                  | 制約                                                |
| :-------------------- | :-------------------------------------------------- |
| **Python バージョン** | 3.10 以上                                           |
| **データソース**      | ローカルの ActivityWatch サーバー（aw-client 経由） |
