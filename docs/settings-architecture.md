# 設定モデルアーキテクチャ

本ドキュメントでは、`aw-daily-reporter` の設定管理の仕組みと各クラスの役割を説明します。

## 概要

設定管理は以下の3つの責務に分離されています。

| 責務 | クラス/モジュール | 説明 |
|:-----|:-----------------|:-----|
| **永続化** | `ConfigStore` | config.json の読み書き（シングルトン） |
| **スキーマ定義** | `AppConfig` 他 | Pydantic モデルによるバリデーション |
| **プラグイン連携** | `BasePlugin.required_settings` | プラグインが必要とする設定キーの宣言 |

## クラス構成

```text
ConfigStore (シングルトン)
 └── config: AppConfig
       ├── system: SystemConfig
       │    └── activitywatch: AWPeerConfig
       ├── plugin_params: PluginParams    ← JSON キーは "settings"
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
    plugin_params: PluginParams             # プラグイン用パラメータ (JSON: "settings")
    rules: List[CategoryRule]               # カテゴリ分類ルール
    project_map: Dict[str, str]             # プロジェクト名マッピング
    client_map: Dict[str, str]              # クライアントマッピング
    apps: Dict[str, Any]                    # アプリ別設定
    clients: Dict[str, Any]                 # クライアント定義
```

> **JSON互換性**: `plugin_params` フィールドは `alias="settings"` で定義されており、
> JSON シリアライズ時（`model_dump(by_alias=True)`）には `"settings"` キーで出力されます。
> これにより、フロントエンドや既存の config.json との互換性が保たれます。

### SystemConfig

システム全体に関わる設定を保持します。

| フィールド | 型 | デフォルト | 説明 |
|:-----------|:---|:-----------|:-----|
| `language` | `str` | `"ja"` | UI/レポートの言語 |
| `activitywatch` | `AWPeerConfig` | `host=127.0.0.1, port=5600` | AW 接続先 |
| `day_start_source` | `str` | `"manual"` | 日開始時刻の取得元（`"manual"` or `"aw"`） |
| `start_of_day` | `str` | `"00:00"` | 手動指定の日開始時刻（HH:MM） |

### PluginParams

プラグインが参照する動的パラメータを格納するモデルです。`extra="allow"` により任意のキーを許容します。

| フィールド | 型 | デフォルト | 説明 |
|:-----------|:---|:-----------|:-----|
| `default_renderer` | `Optional[str]` | `None` | デフォルトで使用するレンダラのプラグインID |
| _(任意のキー)_ | `Any` | — | プラグインが定義するカスタムパラメータ（例: `ai_prompt`） |

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
    "start_of_day": "00:00"
  },
  "settings": {
    "default_renderer": null,
    "ai_prompt": "..."
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

> **注意**: JSON 上のキー `"settings"` は Python 側では `AppConfig.plugin_params` フィールドに対応します。
> これは `alias="settings"` によるマッピングです。

## プラグインと設定の紐付け

各プラグインは `required_settings` プロパティで、自身が必要とする `AppConfig` のトップレベルキーを宣言します。

```python
class MyProcessor(ProcessorPlugin):
    @property
    def required_settings(self) -> list[str]:
        return ["rules", "apps"]  # このプラグインは rules と apps を必要とする
```

### ビルトインプラグインの設定依存

| プラグイン | 種別 | required_settings | 説明 |
|:-----------|:-----|:------------------|:-----|
| `AFKProcessor` | Processor | `["settings"]` | 休憩カテゴリ設定を参照 |
| `CompressionProcessor` | Processor | `["apps"]` | アプリ別圧縮設定を参照 |
| `ProjectExtractionProcessor` | Processor | `["settings"]` | プロジェクト抽出設定を参照 |
| `ProjectMappingProcessor` | Processor | `["project_map", "client_map", "clients"]` | マッピング定義を参照 |
| `RuleMatchingProcessor` | Processor | `["rules"]` | カテゴリ分類ルールを参照 |
| `GitScanner` | Scanner | `[]` | 設定不使用 |
| `MarkdownRendererPlugin` | Renderer | `["settings"]` | 表示設定を参照 |
| `JSONRendererPlugin` | Renderer | `[]` | 設定不使用 |
| `AIRendererPlugin` | Renderer | `["settings"]` | AI プロンプト等を参照 |

## 命名規則

設定関連のクラス名は以下の方針で命名されています。

| 用語 | 意味 | 例 |
|:-----|:-----|:---|
| `Config` | 構造化された設定スキーマ | `AppConfig`, `SystemConfig` |
| `Store` | 永続化ストレージへのアクセス | `ConfigStore` |
| `Params` | プラグイン等に渡すパラメータ | `PluginParams` |
| `Rule` | ユーザー定義のルール | `CategoryRule` |

> **背景**: 以前は `SettingsManager` / `SettingsConfig` という命名でしたが、
> 「settings」と「config」が両方とも日本語で「設定」を意味し混乱を招くため、
> 各クラスの責務に基づいた命名に変更しました。
