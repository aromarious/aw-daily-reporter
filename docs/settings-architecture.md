# 設定モデルアーキテクチャ

本ドキュメントでは、`aw-daily-reporter` の設定管理の仕組みと各クラスの役割を説明します。

## 概要

設定管理は以下の3つの責務に分離されています。

| 責務 | クラス/モジュール | 説明 |
|:-----|:-----------------|:-----|
| **永続化** | `ConfigStore` | config.json の読み書き（シングルトン） |
| **スキーマ定義** | `AppConfig` 他 | Pydantic モデルによるバリデーション |
| **プラグイン管理** | `PluginsConfig` | プラグインIDをキーとしたプラグイン別設定の管理 |

## クラス構成

```text
ConfigStore (シングルトン)
 └── config: AppConfig
       ├── system: SystemConfig
       │    ├── language: str
       │    ├── activitywatch: AWPeerConfig
       │    ├── day_start_source: str
       │    ├── start_of_day: str
       │    ├── enabled_bucket_ids: List[str]
       │    ├── default_renderer: Optional[str]
       │    ├── category_list: List[str]
       │    ├── category_colors: Dict[str, str]
       │    └── break_categories: List[str]
       ├── plugins: PluginsConfig
       │    └── <plugin_id>: Dict[str, Any]
       │         ├── enabled: bool
       │         └── ...(プラグイン固有の設定)
       ├── rules: List[CategoryRule]
       ├── project_map: Dict[str, str]
       ├── client_map: Dict[str, str]
       ├── apps: Dict[str, Any]
       └── clients: Dict[str, Any]
```

## 各クラスの詳細

### ConfigStore

`config.json` の読み書きを担うシングルトンクラスです。

- **ファイル**: `aw_daily_reporter/shared/settings_manager.py`
- **アクセス**: `ConfigStore.get_instance().load()` で `AppConfig` インスタンスを取得
- **保存**: `ConfigStore.get_instance().save()` でファイルに書き込み（Atomic Write）

```python
from aw_daily_reporter.shared.settings_manager import ConfigStore

store = ConfigStore.get_instance()
config = store.load()  # -> AppConfig
```

### AppConfig

アプリケーション全体の設定を集約するルートモデルです。

```python
class AppConfig(BaseModel):
    system: SystemConfig                    # システム設定
    plugins: PluginsConfig                  # プラグイン別設定（プラグインID: 設定）
    rules: List[CategoryRule]               # カテゴリ分類ルール
    project_map: Dict[str, str]             # プロジェクト名マッピング
    client_map: Dict[str, str]              # クライアントマッピング
    apps: Dict[str, Any]                    # アプリ別設定
    clients: Dict[str, Any]                 # クライアント定義
```

> **プラグイン設定の構造**: `plugins` フィールドはプラグインIDをキーとして、各プラグインの設定を保持します。
> 各プラグイン設定には必ず `enabled` フィールドが含まれ、プラグイン固有の設定も同じ辞書内に格納されます。

### SystemConfig

システム全体に関わる設定を保持します。

| フィールド | 型 | デフォルト | 説明 |
|:-----------|:---|:-----------|:-----|
| `language` | `str` | `"ja"` | UI/レポートの言語 |
| `activitywatch` | `AWPeerConfig` | `host=127.0.0.1, port=5600` | AW 接続先 |
| `day_start_source` | `str` | `"manual"` | 日開始時刻の取得元（`"manual"` or `"aw"`） |
| `start_of_day` | `str` | `"00:00"` | 手動指定の日開始時刻（HH:MM） |
| `enabled_bucket_ids` | `List[str]` | `[]` | 有効化するバケットIDのリスト（空の場合は全バケット） |
| `default_renderer` | `Optional[str]` | `None` | デフォルトで使用するレンダラのプラグインID |
| `category_list` | `List[str]` | `[]` | カテゴリ一覧 |
| `category_colors` | `Dict[str, str]` | `{}` | カテゴリごとの色定義 |
| `break_categories` | `List[str]` | `[]` | 休憩として扱うカテゴリ |

### PluginsConfig

プラグインIDをキーとしてプラグイン別の設定を格納するモデルです。`extra="allow"` により任意のプラグインIDをキーとして許容します。

各プラグイン設定は以下の構造を持ちます：

```python
{
  "<plugin_id>": {
    "enabled": bool,           # プラグインの有効/無効（必須）
    ...                        # プラグイン固有の設定
  }
}
```

**例**:
```python
{
  "aw_daily_reporter.plugins.renderer_ai.AIRendererPlugin": {
    "enabled": true,
    "ai_prompt": "..."
  },
  "aw_daily_reporter.plugins.processor_project_extractor.ProjectExtractionProcessor": {
    "enabled": true,
    "project_extraction_patterns": ["..."]
  }
}
```

### CategoryRule

カテゴリ分類ルールを定義するモデルです。

| フィールド | 型 | 説明 |
|:-----------|:---|:-----|
| `keyword` | `str \| List[str]` | マッチするキーワード |
| `category` | `Optional[str]` | 分類先カテゴリ |
| `project` | `Optional[str]` | 分類先プロジェクト |
| `app` | `Optional[str]` | 対象アプリ名 |
| `target` | `Optional[str]` | マッチ対象（`"app"`, `"title"`, `"url"`, or `None`） |

## config.json の構造

```json
{
  "system": {
    "language": "ja",
    "activitywatch": {
      "host": "127.0.0.1",
      "port": 5600
    },
    "day_start_source": "manual",
    "start_of_day": "00:00",
    "enabled_bucket_ids": [],
    "default_renderer": null,
    "category_list": [],
    "category_colors": {},
    "break_categories": []
  },
  "plugins": {
    "aw_daily_reporter.plugins.renderer_ai.AIRendererPlugin": {
      "enabled": true,
      "ai_prompt": "..."
    },
    "aw_daily_reporter.plugins.processor_project_extractor.ProjectExtractionProcessor": {
      "enabled": true,
      "project_extraction_patterns": ["..."]
    },
    "aw_daily_reporter.plugins.processor_afk.AFKProcessor": {
      "enabled": true
    }
  },
  "rules": [
    { "keyword": "Code", "category": "コーディング" }
  ],
  "project_map": {},
  "client_map": {},
  "apps": {},
  "clients": {}
}
```

> **プラグイン設定**: `plugins` キーの下に、プラグインIDをキーとして各プラグインの設定が格納されます。
> 各プラグイン設定には `enabled` フィールドが必須で、プラグイン固有の設定も同じオブジェクト内に保存されます。

## プラグインと設定の紐付け

プラグインは `config.plugins[plugin_id]` から自身の設定を取得します。各プラグイン設定には `enabled` フィールドが必須で含まれ、プラグイン固有の設定も同じ辞書内に格納されます。

### プラグイン設定の取得例

```python
# プラグインIDベースで設定を取得
plugin_id = "aw_daily_reporter.plugins.renderer_ai.AIRendererPlugin"
plugin_config = config.plugins.get(plugin_id, {})
enabled = plugin_config.get("enabled", False)
ai_prompt = plugin_config.get("ai_prompt", "")
```

### ビルトインプラグインの設定キー

| プラグイン | 種別 | プラグイン設定キー | グローバル設定依存 |
|:-----------|:-----|:-------------------|:-------------------|
| `AFKProcessor` | Processor | なし | `system.break_categories` |
| `CompressionProcessor` | Processor | なし | `apps` |
| `ProjectExtractionProcessor` | Processor | `project_extraction_patterns` | `apps` |
| `ProjectMappingProcessor` | Processor | なし | `project_map`, `client_map`, `clients` |
| `RuleMatchingProcessor` | Processor | なし | `rules` |
| `GitScanner` | Scanner | なし | なし |
| `MarkdownRendererPlugin` | Renderer | なし | `system.break_categories`, `system.category_colors` |
| `JSONRendererPlugin` | Renderer | なし | なし |
| `AIRendererPlugin` | Renderer | `ai_prompt` | なし |

## 命名規則

設定関連のクラス名は以下の方針で命名されています。

| 用語 | 意味 | 例 |
|:-----|:-----|:---|
| `Config` | 構造化された設定スキーマ | `AppConfig`, `SystemConfig`, `PluginsConfig` |
| `Store` | 永続化ストレージへのアクセス | `ConfigStore` |
| `Rule` | ユーザー定義のルール | `CategoryRule` |

> **背景**: 以前は `SettingsManager` / `SettingsConfig` という命名でしたが、
> 「settings」と「config」が両方とも日本語で「設定」を意味し混乱を招くため、
> 各クラスの責務に基づいた命名に変更しました。

## 移行履歴

### v0.2.1: プラグイン設定の統合

- **変更内容**: `plugins.json` を廃止し、`config.json` の `plugins` キーにプラグイン設定を統合
- **旧構造**: プラグインの有効/無効は `plugins.json` に、プラグイン固有設定は `config.json` の `settings` キーに分散
- **新構造**: プラグインIDをキーとして、`enabled` フィールドとプラグイン固有設定を同じオブジェクトに統合
- **マイグレーション**: 既存の `plugins.json` は自動的にバックアップされ、`config.json` に統合される
- **影響範囲**:
  - フロントエンドの設定UI: プラグインが無効な場合、関連する設定項目を非表示
  - ダッシュボード: プラグインが無効な場合、依存するカードを非表示
