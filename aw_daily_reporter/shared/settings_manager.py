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
from typing import Any, Dict, List, Optional, Union, cast

from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)

CONFIG_DIR = os.path.expanduser("~/.config/aw-daily-reporter")
CONFIG_PATH = os.path.join(CONFIG_DIR, "config.json")


class AWPeerConfig(BaseModel):
    host: str = "127.0.0.1"
    port: int = 5600


class SystemConfig(BaseModel):
    language: str = "ja"
    activitywatch: AWPeerConfig = Field(default_factory=AWPeerConfig)
    day_start_source: str = "manual"  # "manual" or "aw"
    start_of_day: str = "00:00"  # HH:MM format
    # Legacy fields support if needed, but we migrate them away.
    model_config = ConfigDict(extra="allow")


class SettingsConfig(BaseModel):
    default_renderer: Optional[str] = None
    model_config = ConfigDict(extra="allow")  # Allow plugin specific settings


class CategoryRule(BaseModel):
    keyword: Union[str, List[str]]
    category: Optional[str] = None
    project: Optional[str] = None
    app: Optional[str] = None
    target: Optional[str] = None  # "app", "title", "url", or None (any)
    model_config = ConfigDict(extra="ignore")


class AppConfig(BaseModel):
    system: SystemConfig = Field(default_factory=SystemConfig)
    settings: SettingsConfig = Field(default_factory=SettingsConfig)
    rules: List[CategoryRule] = Field(default_factory=list)
    project_map: Dict[str, str] = Field(default_factory=dict)
    client_map: Dict[str, str] = Field(default_factory=dict)
    apps: Dict[str, Any] = Field(default_factory=dict)
    clients: Dict[str, Any] = Field(default_factory=dict)
    model_config = ConfigDict(extra="ignore")


class SettingsManager:
    _instance = None

    def __init__(self):
        self.config: AppConfig = AppConfig()
        self.is_loaded = False

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = SettingsManager()
        return cls._instance

    def load(self) -> AppConfig:
        """設定をロードします。ファイルが存在しない場合は既存の設定ファイルから統合・マイグレーションを行います。"""
        if self.is_loaded:
            return self.config

        if not os.path.exists(CONFIG_PATH):
            logger.info("config.json not found. Creating default config...")
            self.config = self._create_default_config()
        else:
            try:
                with open(CONFIG_PATH, encoding="utf-8") as f:
                    data = json.load(f)
                    # Create AppConfig from dict, validating it
                    # Note: Existing config might have extra keys (legacy).
                    # We rely on AppConfig(extra="ignore") to handle them,
                    # but we might want to preserve them for manual migration if needed.
                    # For now, explicit migration logic in _cleanup_before_save handles specific keys.
                    self.config = AppConfig(**data)
            except Exception as e:
                logger.error(f"Failed to load config.json: {e}")
                # Failed to load. Do NOT overwrite with empty dict.
                # If we have previous loaded config (i.e. we are reloading), keep it.
                if self.config and self.is_loaded:
                    return self.config
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
                # Dump model to dict/json.
                # model_dump(mode='json') handles serialization better than json.dump(model.dict())
                json_data = self.config.model_dump(mode="json")
                json.dump(json_data, tf, indent=2, ensure_ascii=False)
                temp_name = tf.name

            shutil.move(temp_name, CONFIG_PATH)
            logger.info("Successfully saved config.json")
        except Exception as e:
            logger.error(f"Failed to save config.json: {e}")
            raise

    def get(self, key: str, default: Any = None) -> Any:
        # Backward compatibility for direct access: manager.get("system")
        # We can implement __getitem__ on AppConfig too, but let's support .get() here.
        if hasattr(self.config, key):
            return getattr(self.config, key)
        return default

    def set(self, key: str, value: Any) -> None:
        if hasattr(self.config, key):
            setattr(self.config, key, value)
        else:
            # Maybe raise error or log warning?
            # For now, if dynamic, we might not support setting arbitrary top-level keys
            pass

    def _create_default_config(self) -> AppConfig:
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
                    cast(Dict[str, Any], default_config["system"]).update(preset["system"])
                if "settings" in preset:
                    default_config["settings"] = preset["settings"]
                if "rules" in preset:
                    default_config["rules"] = preset["rules"]
                if "apps" in preset:
                    default_config["apps"] = preset["apps"]
                logger.info(f"Loaded preset from {preset_path}")
            except Exception as e:
                logger.warning(f"Failed to load preset: {e}")

        # Create AppConfig instance from the merged default_config dict
        app_config = AppConfig(**default_config)

        # Save the new config
        try:
            os.makedirs(CONFIG_DIR, exist_ok=True)
            with open(CONFIG_PATH, "w", encoding="utf-8") as f:
                # Use model_dump to get clean dict
                json.dump(app_config.model_dump(mode="json"), f, indent=2, ensure_ascii=False)
            logger.info("Created default config.json")
        except Exception as e:
            logger.error(f"Failed to save default config.json: {e}")

        return app_config

    def _cleanup_before_save(self) -> bool:
        """保存前に不要なキーや一時的なキーを削除・整理します。変更があった場合はTrueを返します。"""
        modified = False
        # Access attributes instead of dict keys
        system = self.config.system

        # NOTE: With Pydantic, ephemeral keys might already be ignored/excluded via extra="ignore".
        # But we check semantic logical cleanup here.

        if hasattr(system, "aw_start_of_day"):
            delattr(system, "aw_start_of_day")
            # Ephemeral cleanup doesn't necessarily need auto-save, but it keeps file clean.
            # modified = True

        # Legacy keys (migrate if needed, then remove)
        if hasattr(system, "day_start_hour"):
            # If start_of_day is default/empty, but day_start_hour is set, migrate it
            day_hour = system.day_start_hour
            current_start = system.start_of_day

            if current_start == "00:00" and isinstance(day_hour, int) and day_hour != 0:
                system.start_of_day = f"{day_hour:02}:00"
                modified = True

            delattr(system, "day_start_hour")
            modified = True

        # Migrate legacy renderer names to IDs
        settings = self.config.settings
        default_renderer = settings.default_renderer
        legacy_map = {
            "Markdown Renderer": "aw_daily_reporter.plugins.renderer_markdown.MarkdownRendererPlugin",
            "Markdown レンダラー": "aw_daily_reporter.plugins.renderer_markdown.MarkdownRendererPlugin",
            "AI Context Renderer": "aw_daily_reporter.plugins.renderer_ai.AIRendererPlugin",
        }

        if default_renderer and default_renderer in legacy_map:
            new_id = legacy_map[default_renderer]
            settings.default_renderer = new_id
            logger.info(f"Migrated default_renderer from '{default_renderer}' to '{new_id}'")
            # self.config.settings is already a reference, so modification reflects in self.config
            modified = True

        return modified
