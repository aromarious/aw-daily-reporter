"""
設定管理モジュール

アプリケーションの設定ファイル(config.json)の読み込み・保存を行う
シングルトンクラスを提供します。
"""

import json
import logging
import os
import shutil
import tempfile
from typing import Any, Dict

logger = logging.getLogger(__name__)

CONFIG_DIR = os.path.expanduser("~/.config/aw-daily-reporter")
CONFIG_PATH = os.path.join(CONFIG_DIR, "config.json")


class SettingsManager:
    _instance = None

    def __init__(self):
        self.config: Dict[str, Any] = {}
        self.is_loaded = False

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = SettingsManager()
        return cls._instance

    def load(self) -> Dict[str, Any]:
        """設定をロードします。ファイルが存在しない場合は既存の設定ファイルから統合・マイグレーションを行います。"""
        if self.is_loaded:
            return self.config

        if not os.path.exists(CONFIG_PATH):
            logger.info("config.json not found. Creating default config...")
            self.config = self._create_default_config()
        else:
            try:
                with open(CONFIG_PATH, encoding="utf-8") as f:
                    self.config = json.load(f)
            except Exception as e:
                logger.error(f"Failed to load config.json: {e}")
                # Failed to load. Do NOT overwrite with empty dict.
                logger.error(f"Failed to load config.json: {e}")
                # If we have previous loaded config, keep it.
                if self.config:
                    return self.config
                # 初回のロードに失敗した場合、空の辞書を返して後に保存されてしまうよりも、例外を投げる方が安全です。
                # 堅牢性の観点からはバックアップのロードを試みることも考えられますが、
                # 現時点では、空の設定でアプリが起動するのを防ぐため、例外を投げてロード処理を中断します。
                raise e

        # Normalize/Migrate config immediately after load
        if self._cleanup_before_save():
            self.save()

        self.is_loaded = True
        return self.config

    def save(self) -> None:
        """設定を保存します (Atomic Write)。"""
        try:
            os.makedirs(CONFIG_DIR, exist_ok=True)

            # Atomic Write: 一時ファイルに書いてからリネーム
            # Ensure cleanup of ephemeral and legacy keys before saving
            self._cleanup_before_save()

            with tempfile.NamedTemporaryFile("w", dir=CONFIG_DIR, delete=False, encoding="utf-8") as tf:
                json.dump(self.config, tf, indent=2, ensure_ascii=False)
                temp_name = tf.name

            shutil.move(temp_name, CONFIG_PATH)
            logger.info("Successfully saved config.json")
        except Exception as e:
            logger.error(f"Failed to save config.json: {e}")
            raise

    def get(self, key: str, default: Any = None) -> Any:
        return self.config.get(key, default)

    def set(self, key: str, value: Any) -> None:
        self.config[key] = value

    def _create_default_config(self) -> Dict[str, Any]:
        """プリセットファイルからデフォルト設定を作成します。"""
        # プリセットファイルのパスを取得
        preset_dir = os.path.join(os.path.dirname(__file__), "..", "data", "presets")
        preset_path = os.path.join(preset_dir, "ja.json")

        default_config = {
            "system": {
                "language": "ja",
                "activitywatch": {"host": "127.0.0.1", "port": 5600},
                "day_start_source": "manual",
                "start_of_day": "00:00",
            },
            "settings": {},
            "rules": [],
            "project_map": {},
            "apps": {},
        }

        # プリセットファイルを読み込んでマージ
        if os.path.exists(preset_path):
            try:
                with open(preset_path, encoding="utf-8") as f:
                    preset = json.load(f)
                # プリセットの内容をマージ（systemは個別にマージして上書き防止）
                if "system" in preset:
                    default_config["system"].update(preset["system"])
                if "settings" in preset:
                    default_config["settings"] = preset["settings"]
                if "rules" in preset:
                    default_config["rules"] = preset["rules"]
                if "apps" in preset:
                    default_config["apps"] = preset["apps"]
                logger.info(f"Loaded preset from {preset_path}")
            except Exception as e:
                logger.warning(f"Failed to load preset: {e}")

        # Save the new config
        try:
            os.makedirs(CONFIG_DIR, exist_ok=True)
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                json.dump(default_config, f, indent=2, ensure_ascii=False)
            logger.info("Created default config.json")
        except Exception as e:
            logger.error(f"Failed to save default config.json: {e}")

        return default_config

    def _cleanup_before_save(self) -> bool:
        """保存前に不要なキーや一時的なキーを削除・整理します。変更があった場合はTrueを返します。"""
        modified = False
        system = self.config.get("system", {})

        # Ephemeral keys (not to be saved)
        if "aw_start_of_day" in system:
            del system["aw_start_of_day"]
            # Ephemeral cleanup doesn't necessarily need auto-save, but it keeps file clean.
            # modified = True

        # Legacy keys (migrate if needed, then remove)
        if "day_start_hour" in system:
            # If start_of_day is default/empty, but day_start_hour is set, migrate it
            day_hour = system["day_start_hour"]
            current_start = system.get("start_of_day", "00:00")

            if current_start == "00:00" and isinstance(day_hour, int) and day_hour != 0:
                system["start_of_day"] = f"{day_hour:02}:00"
                modified = True

            del system["day_start_hour"]
            modified = True

        # Migrate legacy renderer names to IDs
        settings = self.config.get("settings", {})
        default_renderer = settings.get("default_renderer")
        legacy_map = {
            "Markdown Renderer": "aw_daily_reporter.plugins.renderer_markdown.MarkdownRendererPlugin",
            "Markdown レンダラー": "aw_daily_reporter.plugins.renderer_markdown.MarkdownRendererPlugin",
            "AI Context Renderer": "aw_daily_reporter.plugins.renderer_ai.AIRendererPlugin",
        }

        if default_renderer and default_renderer in legacy_map:
            new_id = legacy_map[default_renderer]
            settings["default_renderer"] = new_id
            logger.info(f"Migrated default_renderer from '{default_renderer}' to '{new_id}'")
            self.config["settings"] = settings
            modified = True

        return modified
