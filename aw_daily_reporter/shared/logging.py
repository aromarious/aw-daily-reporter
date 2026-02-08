"""
ロギング設定モジュール

アプリケーション全体のロギング設定を初期化する関数を提供します。
"""

import logging
import os
import sys


class ScopedLoggerAdapter(logging.LoggerAdapter):
    def process(self, msg, kwargs):
        return "[{}] {}".format(self.extra["scope"], msg), kwargs


def setup_logging():
    """ロギング設定の初期化。環境変数によってレベルを切り替えます。"""
    level = logging.INFO
    format_str = "%(levelname)s: %(message)s"

    if os.getenv("AW_DEBUG") or os.getenv("DEBUG"):
        level = logging.DEBUG
        # DEBUG時は時刻とモジュール名も表示
        format_str = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

    logging.basicConfig(level=level, format=format_str, stream=sys.stderr, datefmt="%H:%M:%S")


def get_logger(name: str, scope: str = None):
    """
    指定された名前とスコープでロガーを取得します。
    scopeが指定された場合、ScopedLoggerAdapterを返します。
    """
    logger = logging.getLogger(name)
    if scope:
        return ScopedLoggerAdapter(logger, {"scope": scope})
    return logger
