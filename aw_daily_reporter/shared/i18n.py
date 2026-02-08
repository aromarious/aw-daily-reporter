"""
国際化 (i18n) ヘルパーモジュール

gettext を使用した多言語対応のためのユーティリティ関数を提供します。
"""

import gettext
import os
from gettext import NullTranslations
from pathlib import Path
from typing import Callable, Optional

from .logging import get_logger

logger = get_logger(__name__, scope="i18n")

# Path to the locales directory (shared/ の親である aw_daily_reporter/locales を参照)
LOCALES_DIR = Path(__file__).parent.parent / "locales"


def get_translator(lang: Optional[str] = None) -> NullTranslations:
    """
        Get a translator instance for the specified language.
    # ... (omitted)
    """
    if lang is None:
        # 1. Config (not passed here)
        # 2. System Locale
        try:
            import locale

            sys_lang = locale.getdefaultlocale()[0]  # e.g., 'ja_JP'
            if sys_lang:
                lang = sys_lang.split("_")[0]
        except Exception:
            pass

        # 3. Environment variables (Fallback)
        if not lang:
            lang_env = os.environ.get("LANG", "en")
            lang = lang_env.split(".")[0].split("_")[0]

    try:
        return gettext.translation("messages", localedir=LOCALES_DIR, languages=[lang], fallback=True)
    except FileNotFoundError:
        logger.debug(f"Locale directory not found for lang={lang}")
        return gettext.NullTranslations()


# Single global instance for easy import
# In a real app you might want dynamic language switching,
# but for CLI verified at startup, this is fine.
_translator = get_translator()
logger.debug(f"initialized with translator: {_translator}")
_: Callable[[str], str] = _translator.gettext
