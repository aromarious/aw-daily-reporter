"""
SettingsManager モジュールのユニットテスト
"""

import json
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

import pytest


class TestSettingsManager(unittest.TestCase):
    """SettingsManager クラスのテストケース"""

    def setUp(self):
        """テスト用の一時ディレクトリを作成"""
        self.temp_dir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.temp_dir, "config.json")

        # パッチ対象のパスを設定
        self.config_dir_patcher = patch("aw_daily_reporter.shared.settings_manager.CONFIG_DIR", self.temp_dir)
        self.config_path_patcher = patch("aw_daily_reporter.shared.settings_manager.CONFIG_PATH", self.config_path)
        self.config_dir_patcher.start()
        self.config_path_patcher.start()

        # シングルトンをリセット
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        SettingsManager._instance = None

    def tearDown(self):
        """一時ディレクトリを削除"""
        self.config_dir_patcher.stop()
        self.config_path_patcher.stop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

        # シングルトンをリセット
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        SettingsManager._instance = None

    def test_get_instance_returns_singleton(self):
        """get_instanceがシングルトンを返す"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        instance1 = SettingsManager.get_instance()
        instance2 = SettingsManager.get_instance()

        assert instance1 is instance2

    def test_load_creates_default_when_no_file(self):
        """ファイルがない場合はデフォルト設定を作成"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        manager = SettingsManager()
        config = manager.load()

        assert "system" in config
        assert "rules" in config
        assert "apps" in config
        assert manager.is_loaded

    def test_load_reads_existing_file(self):
        """既存ファイルを読み込む"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        # テスト用の設定ファイルを作成
        test_config = {"system": {"language": "en"}, "rules": [{"test": "rule"}]}
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(test_config, f)

        manager = SettingsManager()
        config = manager.load()

        assert config["system"]["language"] == "en"
        assert config["rules"] == [{"test": "rule"}]

    def test_load_caches_result(self):
        """loadは2回目以降キャッシュを返す"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        test_config = {"system": {"language": "ja"}}
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(test_config, f)

        manager = SettingsManager()
        config1 = manager.load()

        # ファイルを変更
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump({"system": {"language": "en"}}, f)

        config2 = manager.load()

        # キャッシュされているので同じ
        assert config1["system"]["language"] == config2["system"]["language"]

    def test_load_raises_on_invalid_json(self):
        """無効なJSONで例外を送出"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        with open(self.config_path, "w") as f:
            f.write("invalid json {{{")

        manager = SettingsManager()

        with pytest.raises(json.JSONDecodeError):
            manager.load()

    def test_save_writes_file(self):
        """saveがファイルに書き込む"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        manager = SettingsManager()
        manager.config = {"system": {"language": "en"}, "rules": []}
        manager.save()

        with open(self.config_path, encoding="utf-8") as f:
            saved = json.load(f)

        assert saved["system"]["language"] == "en"

    def test_save_atomic_write(self):
        """saveがアトミックに書き込む"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        manager = SettingsManager()
        manager.config = {"test": "data"}
        manager.save()

        # ファイルが正しく存在する
        assert os.path.exists(self.config_path)

    def test_get_returns_value(self):
        """getが値を返す"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        manager = SettingsManager()
        manager.config = {"key1": "value1"}

        assert manager.get("key1") == "value1"

    def test_get_returns_default_for_missing_key(self):
        """getが存在しないキーにデフォルト値を返す"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        manager = SettingsManager()
        manager.config = {}

        assert manager.get("nonexistent") is None
        assert manager.get("nonexistent", "default") == "default"

    def test_set_updates_config(self):
        """setが設定を更新する"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        manager = SettingsManager()
        manager.config = {}
        manager.set("new_key", "new_value")

        assert manager.config["new_key"] == "new_value"

    def test_cleanup_removes_ephemeral_keys(self):
        """_cleanup_before_saveが一時キーを削除"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        manager = SettingsManager()
        manager.config = {
            "system": {
                "language": "ja",
                "aw_start_of_day": "04:00",  # 一時キー
            }
        }
        manager._cleanup_before_save()

        assert "aw_start_of_day" not in manager.config["system"]

    def test_cleanup_migrates_legacy_day_start_hour(self):
        """_cleanup_before_saveがday_start_hourをマイグレート"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        manager = SettingsManager()
        manager.config = {
            "system": {
                "language": "ja",
                "start_of_day": "00:00",
                "day_start_hour": 4,  # レガシーキー
            }
        }
        manager._cleanup_before_save()

        assert manager.config["system"]["start_of_day"] == "04:00"
        assert "day_start_hour" not in manager.config["system"]

    def test_cleanup_does_not_migrate_if_start_of_day_set(self):
        """start_of_dayが設定済みの場合はマイグレートしない"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        manager = SettingsManager()
        manager.config = {
            "system": {
                "language": "ja",
                "start_of_day": "06:00",  # 既に設定済み
                "day_start_hour": 4,
            }
        }
        manager._cleanup_before_save()

        # start_of_dayは変わらない
        assert manager.config["system"]["start_of_day"] == "06:00"
        assert "day_start_hour" not in manager.config["system"]


class TestCreateDefaultConfig(unittest.TestCase):
    """_create_default_config メソッドのテスト"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.temp_dir, "config.json")

        self.config_dir_patcher = patch("aw_daily_reporter.shared.settings_manager.CONFIG_DIR", self.temp_dir)
        self.config_path_patcher = patch("aw_daily_reporter.shared.settings_manager.CONFIG_PATH", self.config_path)
        self.config_dir_patcher.start()
        self.config_path_patcher.start()

        from aw_daily_reporter.shared.settings_manager import SettingsManager

        SettingsManager._instance = None

    def tearDown(self):
        self.config_dir_patcher.stop()
        self.config_path_patcher.stop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

        from aw_daily_reporter.shared.settings_manager import SettingsManager

        SettingsManager._instance = None

    def test_creates_config_with_preset_rules(self):
        """プリセットからルールを読み込む"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        manager = SettingsManager()
        config = manager._create_default_config()

        # プリセットにはルールが定義されているはず
        assert "rules" in config
        assert len(config["rules"]) > 0

    def test_creates_config_with_system_defaults(self):
        """システムデフォルト値が設定される"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        manager = SettingsManager()
        config = manager._create_default_config()

        assert "activitywatch" in config["system"]
        assert config["system"]["activitywatch"]["host"] == "127.0.0.1"
        assert config["system"]["activitywatch"]["port"] == 5600

    def test_saves_config_file(self):
        """設定ファイルを保存する"""
        from aw_daily_reporter.shared.settings_manager import SettingsManager

        manager = SettingsManager()
        manager._create_default_config()

        assert os.path.exists(self.config_path)


if __name__ == "__main__":
    unittest.main()
