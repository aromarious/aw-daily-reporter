"""
ConfigStore モジュールのユニットテスト
"""

import json
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

import pytest


class TestConfigStore(unittest.TestCase):
    """ConfigStore クラスのテストケース"""

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
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        ConfigStore._instance = None

    def tearDown(self):
        """一時ディレクトリを削除"""
        self.config_dir_patcher.stop()
        self.config_path_patcher.stop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

        # シングルトンをリセット
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        ConfigStore._instance = None

    def test_get_instance_returns_singleton(self):
        """get_instanceがシングルトンを返す"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        instance1 = ConfigStore.get_instance()
        instance2 = ConfigStore.get_instance()

        assert instance1 is instance2

    def test_load_creates_default_when_no_file(self):
        """ファイルがない場合はデフォルト設定を作成"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        manager = ConfigStore()
        config = manager.load()

        assert config.system.language == "ja"
        assert config.system.language == "ja"
        # Preset "ja.json" is loaded, so rules should be present
        assert len(config.rules) > 0
        # Apps might be present from preset
        assert manager.is_loaded

    def test_load_reads_existing_file(self):
        """既存ファイルを読み込む"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        # テスト用の設定ファイルを作成
        test_config = {"system": {"language": "en"}, "rules": [{"keyword": "test", "category": "rule"}]}
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(test_config, f)

        manager = ConfigStore()
        config = manager.load()

        assert config.system.language == "en"
        assert config.rules[0].keyword == "test"
        assert config.rules[0].category == "rule"

    def test_load_caches_result(self):
        """loadは2回目以降キャッシュを返す"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        test_config = {"system": {"language": "ja"}}
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(test_config, f)

        manager = ConfigStore()
        config1 = manager.load()

        # ファイルを変更
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump({"system": {"language": "en"}}, f)

        config2 = manager.load()

        # キャッシュされているので同じ
        assert config1.system.language == config2.system.language

    def test_load_raises_on_invalid_json(self):
        """無効なJSONで例外を送出"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        with open(self.config_path, "w") as f:
            f.write("invalid json {{{")

        manager = ConfigStore()

        with pytest.raises(json.JSONDecodeError):
            manager.load()

    def test_save_writes_file(self):
        """saveがファイルに書き込む"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        manager = ConfigStore()
        # Use AppConfig with Pydantic
        # Note: We should ideally create AppConfig instance, but for save test,
        # modify default config is enough or assign new AppConfig
        from aw_daily_reporter.shared.settings_manager import AppConfig, SystemConfig

        manager.config = AppConfig(system=SystemConfig(language="fr"))
        manager.save()

        with open(self.config_path, encoding="utf-8") as f:
            saved = json.load(f)

        assert saved["system"]["language"] == "fr"

    def test_save_atomic_write(self):
        """saveがアトミックに書き込む"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        manager = ConfigStore()
        # config is initialized in __init__
        manager.save()

        # ファイルが正しく存在する
        assert os.path.exists(self.config_path)

    def test_get_returns_value(self):
        """getが値を返す"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        manager = ConfigStore()
        # Ensure config is loaded or initialized
        # For AppConfig, we must access existing fields
        assert manager.get("system") is not None

    def test_get_returns_default_for_missing_key(self):
        """getが存在しないキーにデフォルト値を返す"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        manager = ConfigStore()
        # Accessing non-existent attribute on AppConfig via get -> default
        assert manager.get("nonexistent") is None
        assert manager.get("nonexistent", "default") == "default"

    def test_set_updates_config(self):
        """setが設定を更新する"""
        # set() logic in ConfigStore only updates if attribute exists.
        # We can test updating 'system'
        from aw_daily_reporter.shared.settings_manager import ConfigStore, SystemConfig

        manager = ConfigStore()
        new_system = SystemConfig(language="fr")
        manager.set("system", new_system)

        assert manager.config.system.language == "fr"

    def test_cleanup_removes_ephemeral_keys(self):
        """_cleanup_before_saveが一時キーを削除"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        # Pydantic model with extra="ignore" already handles this during init if strict.
        # But here we are manually constructing the dict? No, we normally use AppConfig.
        # If we use AppConfig, we can't assign invalid keys unless extra="allow".
        # SystemConfig has extra="allow" now for legacy support (based on previous edits).
        # Let's verify cleanup specifically.

        manager = ConfigStore()
        # Manually inject attribute to simulate legacy load behavior if extra=allow
        manager.config.system.aw_start_of_day = "04:00"

        manager._cleanup_before_save()

        assert not hasattr(manager.config.system, "aw_start_of_day")

    def test_cleanup_migrates_legacy_day_start_hour(self):
        """_cleanup_before_saveがday_start_hourをマイグレート"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        manager = ConfigStore()
        # Inject legacy attribute
        manager.config.system.day_start_hour = 4

        manager._cleanup_before_save()

        assert manager.config.system.start_of_day == "04:00"
        assert not hasattr(manager.config.system, "day_start_hour")

    def test_cleanup_does_not_migrate_if_start_of_day_set(self):
        """start_of_dayが設定済みの場合はマイグレートしない"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        manager = ConfigStore()
        manager.config.system.start_of_day = "06:00"
        manager.config.system.day_start_hour = 4

        manager._cleanup_before_save()

        # start_of_dayは変わらない
        assert manager.config.system.start_of_day == "06:00"
        assert not hasattr(manager.config.system, "day_start_hour")

    def test_save_loads_clients(self):
        """clients設定が正しく保存・読み込みされる"""
        from aw_daily_reporter.shared.settings_manager import AppConfig, ConfigStore

        manager = ConfigStore()
        manager.config = AppConfig(clients={"client1": {"name": "Test Client"}})
        manager.save()

        # Reload to verify persistence
        # Reset instance to force reload from file
        ConfigStore._instance = None
        new_manager = ConfigStore()
        loaded_config = new_manager.load()

        assert "client1" in loaded_config.clients
        assert loaded_config.clients["client1"]["name"] == "Test Client"

    def test_save_loads_client_map(self):
        """client_map設定が正しく保存・読み込みされる"""
        from aw_daily_reporter.shared.settings_manager import AppConfig, ConfigStore

        manager = ConfigStore()
        manager.config = AppConfig(client_map={"^aw-.*": "client_aw"})
        manager.save()

        # Reload to verify persistence
        # Reset instance to force reload from file
        ConfigStore._instance = None
        new_manager = ConfigStore()
        loaded_config = new_manager.load()

        assert "^aw-.*" in loaded_config.client_map
        assert loaded_config.client_map["^aw-.*"] == "client_aw"


class TestCreateDefaultConfig(unittest.TestCase):
    """_create_default_config メソッドのテスト"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.config_path = os.path.join(self.temp_dir, "config.json")

        self.config_dir_patcher = patch("aw_daily_reporter.shared.settings_manager.CONFIG_DIR", self.temp_dir)
        self.config_path_patcher = patch("aw_daily_reporter.shared.settings_manager.CONFIG_PATH", self.config_path)
        self.config_dir_patcher.start()
        self.config_path_patcher.start()

        from aw_daily_reporter.shared.settings_manager import ConfigStore

        ConfigStore._instance = None

    def tearDown(self):
        self.config_dir_patcher.stop()
        self.config_path_patcher.stop()
        shutil.rmtree(self.temp_dir, ignore_errors=True)

        from aw_daily_reporter.shared.settings_manager import ConfigStore

        ConfigStore._instance = None

    def test_creates_config_with_preset_rules(self):
        """プリセットからルールを読み込む"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        manager = ConfigStore()
        config = manager._create_default_config()

        # プリセットにはルールが定義されているはず
        # プリセットにはルールが定義されているはず
        assert len(config.rules) > 0

    def test_creates_config_with_system_defaults(self):
        """システムデフォルト値が設定される"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        manager = ConfigStore()
        config = manager._create_default_config()

        assert config.system.activitywatch.host == "127.0.0.1"
        assert config.system.activitywatch.port == 5600

    def test_saves_config_file(self):
        """設定ファイルを保存する"""
        from aw_daily_reporter.shared.settings_manager import ConfigStore

        manager = ConfigStore()
        manager._create_default_config()

        assert os.path.exists(self.config_path)


if __name__ == "__main__":
    unittest.main()
