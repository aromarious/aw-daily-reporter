"""
共通定数モジュール

フロントエンドと共有するデフォルト値やキーワードを定義します。
フロントエンドは /api/constants エンドポイントから取得可能です。
"""

# デフォルトのカテゴリ名（未分類時に使用）
DEFAULT_CATEGORY = "Uncategorized"

# デフォルトのプロジェクト名（未分類時に使用）
DEFAULT_PROJECT = "Unknown"

# 未知のアプリ名
UNKNOWN_APP = "Unknown"

# 請求対象外のクライアント名
NON_BILLABLE_CLIENT = "Non-billable"

# 未分類と判定するキーワード一覧（小文字）
UNCATEGORIZED_KEYWORDS = [
    UNKNOWN_APP.lower(),
    DEFAULT_CATEGORY.lower(),
    DEFAULT_PROJECT.lower(),
    NON_BILLABLE_CLIENT.lower(),
    "",
    "other",
    "その他",
    "未分類",
    "unclassified",
]


# 未分類かどうかを判定
def is_uncategorized(name: str | None) -> bool:
    if name is None:
        return True
    return name.lower().strip() in UNCATEGORIZED_KEYWORDS
