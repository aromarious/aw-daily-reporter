# ログレベル標準

本プロジェクトにおけるログレベルの役割と運用基準を定義します。

## ログレベルの定義

| レベル       | 役割             | 想定される状況                                                                                                  | ユーザーへの見え方                |
| :----------- | :--------------- | :-------------------------------------------------------------------------------------------------------------- | :-------------------------------- |
| **CRITICAL** | **致命的エラー** | アプリケーションの継続が不可能な状態。<br>例：必須設定ファイルの破損、ポート競合                                | 標準エラー出力 + 終了コード非ゼロ |
| **ERROR**    | **エラー**       | 特定の処理が失敗したが、アプリ自体は稼働継続可能。<br>例：プラグインのロード失敗、APIリクエスト失敗             | 標準エラー出力 (赤字推奨)         |
| **WARNING**  | **警告**         | 予期しない状態だが、デフォルト値などで回復可能。<br>例：ActivityWatch接続失敗（オフラインモード）、設定キー欠損 | 標準出力 / 標準エラー出力         |
| **INFO**     | **情報**         | ユーザーが知っておくべき主要なイベント。<br>例：サーバー起動完了、レポート生成完了                              | 標準出力                          |
| **DEBUG**    | **デバッグ**     | 開発者・調査用詳細情報。<br>例：変数の値、詳細なトレース、パフォーマンス計測(PERF scope)                        | 環境変数 `AW_DEBUG=1` 時のみ表示  |

## スコープ (Scope)

ログには処理のコンテキストを明確にするためにスコープを付与します。`ScopedLoggerAdapter` を使用して自動的に付与されます。

- `[Core]`: コアロジック、CLI処理
- `[Server]`: Webサーバー (Flask) のライフサイクル
- `[API]`: APIエンドポイントの処理
- `[Timeline]`: タイムライン生成処理 details
- `[Client]`: ActivityWatch APIクライアント
- `[Plugin]`: プラグインの実行
- `[i18n]`: 国際化処理
- `[PERF]`: パフォーマンス計測 (DEBUGレベルのみ)

## 実装ガイドライン

### ロガーの取得

```python
from aw_daily_reporter.shared.logging import get_logger

# スコープを指定してロガーを取得
logger = get_logger(__name__, scope="MyComponent")
```

### ログ出力

```python
# ユーザーに伝えるべき重要な情報
logger.info(_("Processing completed."))

# 開発者向けの調査情報
logger.debug(f"Processing item: {item_id}")

# エラー発生時 (スタックトレースを含める場合は exc_info=True)
try:
    ...
except Exception as e:
    logger.error(f"Failed to process item: {e}", exc_info=True)
```

### パフォーマンス計測

`[PERF]` スコープを使用し、DEBUGレベルで出力します。

```python
import time
perf_logger = get_logger("perf", scope="PERF")

start = time.perf_counter()
# ... heavy processing ...
perf_logger.debug(f"Process took {time.perf_counter() - start:.3f}s")
```
