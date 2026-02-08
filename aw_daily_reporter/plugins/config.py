"""
プラグイン設定モジュール

プラグインの有効/無効状態と実行順序を管理する設定ファイル(plugins.json)の
読み書きを行います。
"""

import json
import logging
import os
from typing import List, TypedDict

logger = logging.getLogger(__name__)

CONFIG_PATH = os.path.expanduser("~/.config/aw-daily-reporter/plugins.json")


class PluginConfigItem(TypedDict):
    plugin_id: str
    enabled: bool


def load_plugin_config() -> List[PluginConfigItem]:
    """Load plugin configuration from JSON file."""
    if not os.path.exists(CONFIG_PATH):
        return []

    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load plugin config: {e}")
        return []


def save_plugin_config(config: List[PluginConfigItem]) -> None:
    """Save plugin configuration to JSON file."""
    try:
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        with open(CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"Failed to save plugin config: {e}")
        raise
