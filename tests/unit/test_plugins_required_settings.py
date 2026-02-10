"""
プラグインの required_settings プロパティのテスト

各プラグインが正しい設定キーを宣言していること、
基底クラスのデフォルト動作を検証します。
"""

import unittest

from aw_daily_reporter.plugins.base import BasePlugin, ProcessorPlugin
from aw_daily_reporter.plugins.processor_afk import AFKProcessor
from aw_daily_reporter.plugins.processor_compression import CompressionProcessor
from aw_daily_reporter.plugins.processor_project_extractor import ProjectExtractionProcessor
from aw_daily_reporter.plugins.processor_project_mapping import ProjectMappingProcessor
from aw_daily_reporter.plugins.processor_rule_matching import RuleMatchingProcessor
from aw_daily_reporter.plugins.renderer_ai import AIRendererPlugin
from aw_daily_reporter.plugins.renderer_json import JSONRendererPlugin
from aw_daily_reporter.plugins.renderer_markdown import MarkdownRendererPlugin
from aw_daily_reporter.plugins.scanner_git import GitScanner


class TestBasePluginRequiredSettings(unittest.TestCase):
    """BasePlugin の required_settings デフォルト動作のテスト"""

    def test_default_required_settings_returns_empty_list(self):
        """デフォルトでは空リストを返す"""

        # Arrange: 最小限の具象クラスを定義
        class MinimalPlugin(ProcessorPlugin):
            @property
            def name(self) -> str:
                return "Minimal"

            def process(self, df, config):
                return df

        plugin = MinimalPlugin()

        # Act
        result = plugin.required_settings

        # Assert
        assert result == []
        assert isinstance(result, list)

    def test_required_settings_is_property(self):
        """required_settings がプロパティとして定義されている"""

        # Assert
        assert isinstance(BasePlugin.required_settings, property)


class TestProcessorPluginRequiredSettings(unittest.TestCase):
    """各プロセッサプラグインの required_settings テスト"""

    def test_afk_processor_requires_settings(self):
        """AFKProcessor は plugins キーを必要とする"""
        # Arrange
        plugin = AFKProcessor()

        # Act & Assert
        assert plugin.required_settings == ["plugins"]

    def test_compression_processor_requires_apps(self):
        """CompressionProcessor は apps キーを必要とする"""
        # Arrange
        plugin = CompressionProcessor()

        # Act & Assert
        assert plugin.required_settings == ["apps"]

    def test_project_extraction_processor_requires_settings(self):
        """ProjectExtractionProcessor は plugins キーを必要とする"""
        # Arrange
        plugin = ProjectExtractionProcessor()

        # Act & Assert
        assert plugin.required_settings == ["plugins"]

    def test_project_mapping_processor_requires_maps(self):
        """ProjectMappingProcessor は project_map, client_map, clients キーを必要とする"""
        # Arrange
        plugin = ProjectMappingProcessor()

        # Act & Assert
        assert plugin.required_settings == ["project_map", "client_map", "clients"]
        assert len(plugin.required_settings) == 3

    def test_rule_matching_processor_requires_rules(self):
        """RuleMatchingProcessor は rules キーを必要とする"""
        # Arrange
        plugin = RuleMatchingProcessor()

        # Act & Assert
        assert plugin.required_settings == ["rules"]


class TestScannerPluginRequiredSettings(unittest.TestCase):
    """スキャナプラグインの required_settings テスト"""

    def test_git_scanner_requires_nothing(self):
        """GitScanner は設定を必要としない"""
        # Arrange
        plugin = GitScanner()

        # Act & Assert
        assert plugin.required_settings == []


class TestRendererPluginRequiredSettings(unittest.TestCase):
    """レンダラプラグインの required_settings テスト"""

    def test_markdown_renderer_requires_settings(self):
        """MarkdownRendererPlugin は system キーを必要とする"""
        # Arrange
        plugin = MarkdownRendererPlugin()

        # Act & Assert
        assert plugin.required_settings == ["system"]

    def test_json_renderer_requires_nothing(self):
        """JSONRendererPlugin は設定を必要としない"""
        # Arrange
        plugin = JSONRendererPlugin()

        # Act & Assert
        assert plugin.required_settings == []

    def test_ai_renderer_requires_settings(self):
        """AIRendererPlugin は plugins キーを必要とする"""
        # Arrange
        plugin = AIRendererPlugin()

        # Act & Assert
        assert plugin.required_settings == ["plugins"]


class TestRequiredSettingsConsistency(unittest.TestCase):
    """required_settings の一貫性テスト"""

    def test_all_required_settings_are_valid_config_keys(self):
        """すべてのプラグインの required_settings が有効な AppConfig キーである"""
        # Arrange
        valid_keys = {"system", "plugins", "rules", "project_map", "client_map", "apps", "clients"}
        all_plugins = [
            AFKProcessor(),
            CompressionProcessor(),
            ProjectExtractionProcessor(),
            ProjectMappingProcessor(),
            RuleMatchingProcessor(),
            GitScanner(),
            MarkdownRendererPlugin(),
            JSONRendererPlugin(),
            AIRendererPlugin(),
        ]

        # Act & Assert
        for plugin in all_plugins:
            for key in plugin.required_settings:
                assert key in valid_keys, (
                    f"{plugin.__class__.__name__}.required_settings に無効なキー '{key}' が含まれています"
                )

    def test_required_settings_returns_new_list_each_call(self):
        """required_settings は呼び出しごとに新しいリストを返す（ミュータブル安全性）"""
        # Arrange
        plugin = ProjectMappingProcessor()

        # Act
        list1 = plugin.required_settings
        list2 = plugin.required_settings

        # Assert
        assert list1 == list2
        assert list1 is not list2


if __name__ == "__main__":
    unittest.main()
