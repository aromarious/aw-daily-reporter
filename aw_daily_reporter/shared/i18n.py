"""
国際化 (i18n) ヘルパーモジュール

gettext を使用した多言語対応のためのユーティリティ関数を提供します。
"""

import gettext
import os
from gettext import NullTranslations
from pathlib import Path
from typing import Optional

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

            # getdefaultlocale is deprecated since Python 3.11, use getlocale() instead
            sys_lang = locale.getlocale()[0]  # e.g., 'ja_JP'
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


# Single global instance
_translator = get_translator()
logger.debug(f"initialized with translator: {_translator}")


def setup_i18n(lang: str):
    """
    Initialize the global translator with the specified language.
    Should be called after loading configuration.
    """
    global _translator
    logger.debug(f"Setting up i18n for language: {lang}")
    _translator = get_translator(lang)


# Proxy function to ensure we always use the current translator
def _(message: str) -> str:
    return _translator.gettext(message)
