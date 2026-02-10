"""
共有モジュールパッケージ

CLI、Web、プラグインなど複数のコンポーネントから共通で使用される
ユーティリティモジュールを集約します。
"""

from .constants import (
    DEFAULT_CATEGORY,
    DEFAULT_PROJECT,
    NON_BILLABLE_CLIENT,
    UNCATEGORIZED_KEYWORDS,
    UNKNOWN_APP,
    is_uncategorized,
)
from .date_utils import get_date_range
from .i18n import _, get_translator
from .logging import setup_logging
from .settings_manager import ConfigStore

__all__ = [
    "setup_logging",
    "DEFAULT_CATEGORY",
    "DEFAULT_PROJECT",
    "UNKNOWN_APP",
    "NON_BILLABLE_CLIENT",
    "UNCATEGORIZED_KEYWORDS",
    "is_uncategorized",
    "get_date_range",
    "_",
    "get_translator",
    "ConfigStore",
]
