"""
core モジュールのユニットテスト
"""

import os
import tempfile
import unittest
from argparse import Namespace
from io import StringIO
from unittest.mock import MagicMock, patch

import pytest


class TestCmdReport(unittest.TestCase):
    """cmd_report 関数のテストケース"""

    @patch("aw_daily_reporter.core.TimelineGenerator")
    @patch("aw_daily_reporter.shared.settings_manager.SettingsManager")
    @patch("aw_daily_reporter.core.get_date_range")
    def test_report_markdown_format(self, mock_date_range, mock_settings, mock_generator):
        """Markdown形式でレポートを出力"""
        from aw_daily_reporter.core import cmd_report

        mock_date_range.return_value = (MagicMock(), MagicMock())
        mock_settings.get_instance.return_value.load.return_value = {
            "system": {"start_of_day": "00:00", "day_start_source": "manual"},
            "settings": {},
        }
        mock_generator.return_value.run.return_value = (
            {},
            [],
            [],
            {"Markdown Renderer": "# Test Report"},
        )

        args = Namespace(date=None, output=None, renderer="markdown", verbose=False)

        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            cmd_report(args)
            output = mock_stdout.getvalue()
            assert "# Test Report" in output

    @patch("aw_daily_reporter.core.TimelineGenerator")
    @patch("aw_daily_reporter.shared.settings_manager.SettingsManager")
    @patch("aw_daily_reporter.core.get_date_range")
    def test_report_json_format_stdout(self, mock_date_range, mock_settings, mock_generator):
        """JSON形式で標準出力に出力"""
        from aw_daily_reporter.core import cmd_report

        mock_date_range.return_value = (MagicMock(), MagicMock())
        mock_settings.get_instance.return_value.load.return_value = {
            "system": {"start_of_day": "00:00", "day_start_source": "manual"},
            "settings": {},
        }
        mock_generator.return_value.run.return_value = (
            {},
            [],
            [],
            {"json": '{"test": "data"}'},
        )

        args = Namespace(date=None, output=None, renderer="json", verbose=False)

        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            cmd_report(args)
            output = mock_stdout.getvalue()
            assert '{"test": "data"}' in output

    @patch("aw_daily_reporter.core.TimelineGenerator")
    @patch("aw_daily_reporter.shared.settings_manager.SettingsManager")
    @patch("aw_daily_reporter.core.get_date_range")
    def test_report_json_format_to_file(self, mock_date_range, mock_settings, mock_generator):
        """JSON形式でファイルに出力"""
        import json

        from aw_daily_reporter.core import cmd_report

        mock_date_range.return_value = (MagicMock(), MagicMock())
        mock_settings.get_instance.return_value.load.return_value = {
            "system": {"start_of_day": "00:00", "day_start_source": "manual"},
            "settings": {},
        }
        mock_generator.return_value.run.return_value = (
            {},
            [],
            [],
            {"json": '{"test": "file_output"}'},
        )

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            temp_path = f.name

        try:
            args = Namespace(date=None, output=temp_path, renderer="json", verbose=False)
            cmd_report(args)

            with open(temp_path, encoding="utf-8") as f:
                saved = json.load(f)
            assert saved["test"] == "file_output"
        finally:
            os.unlink(temp_path)

    @patch("aw_daily_reporter.core.TimelineGenerator")
    @patch("aw_daily_reporter.shared.settings_manager.SettingsManager")
    @patch("aw_daily_reporter.core.get_date_range")
    def test_report_uses_default_renderer(self, mock_date_range, mock_settings, mock_generator):
        """デフォルトレンダラーを使用"""
        from aw_daily_reporter.core import cmd_report

        mock_date_range.return_value = (MagicMock(), MagicMock())
        mock_settings.get_instance.return_value.load.return_value = {
            "system": {"start_of_day": "00:00", "day_start_source": "manual"},
            "settings": {"default_renderer": "AI Context Renderer"},
        }
        mock_generator.return_value.run.return_value = (
            {},
            [],
            [],
            {"Markdown Renderer": "# Markdown", "AI Context Renderer": "AI Output"},
        )

        args = Namespace(date=None, output=None, renderer=None, verbose=False)

        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            cmd_report(args)
            output = mock_stdout.getvalue()
            assert "AI Output" in output

    @patch("aw_daily_reporter.core.TimelineGenerator")
    @patch("aw_daily_reporter.shared.settings_manager.SettingsManager")
    @patch("aw_daily_reporter.core.get_date_range")
    def test_report_fallback_to_first_renderer(self, mock_date_range, mock_settings, mock_generator):
        """Markdownレンダラーがない場合は最初のレンダラーを使用"""
        from aw_daily_reporter.core import cmd_report

        mock_date_range.return_value = (MagicMock(), MagicMock())
        mock_settings.get_instance.return_value.load.return_value = {
            "system": {"start_of_day": "00:00", "day_start_source": "manual"},
            "settings": {},
        }
        mock_generator.return_value.run.return_value = (
            {},
            [],
            [],
            {"Custom Renderer": "Custom Output"},
        )

        args = Namespace(date=None, output=None, renderer="markdown", verbose=False)

        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            cmd_report(args)
            output = mock_stdout.getvalue()
            assert "Custom Output" in output

    @patch("aw_daily_reporter.shared.settings_manager.SettingsManager")
    @patch("aw_daily_reporter.core.get_date_range")
    def test_report_invalid_date_exits(self, mock_date_range, mock_settings):
        """無効な日付でsys.exit(1)"""
        from aw_daily_reporter.core import cmd_report

        mock_settings.get_instance.return_value.load.return_value = {
            "system": {"start_of_day": "00:00", "day_start_source": "manual"},
            "settings": {},
        }
        mock_date_range.side_effect = ValueError("Invalid date")

        args = Namespace(date="invalid", output=None, renderer="markdown", verbose=False)

        with pytest.raises(SystemExit) as ctx:
            cmd_report(args)
        assert ctx.value.code == 1

    @patch("aw_daily_reporter.timeline.client.AWClient")
    @patch("aw_daily_reporter.core.TimelineGenerator")
    @patch("aw_daily_reporter.shared.settings_manager.SettingsManager")
    @patch("aw_daily_reporter.core.get_date_range")
    def test_report_aw_day_start_source(self, mock_date_range, mock_settings, mock_generator, mock_client):
        """ActivityWatchから開始時刻を取得"""
        from aw_daily_reporter.core import cmd_report

        mock_date_range.return_value = (MagicMock(), MagicMock())
        mock_settings.get_instance.return_value.load.return_value = {
            "system": {"start_of_day": "00:00", "day_start_source": "aw"},
            "settings": {},
        }
        mock_client.return_value.get_setting.return_value = "04:00"
        mock_generator.return_value.run.return_value = ({}, [], [], {})

        args = Namespace(date=None, output=None, renderer="markdown", verbose=False)
        cmd_report(args)

        # get_date_range should be called with AW offset
        mock_date_range.assert_called_with(None, offset="04:00")

    @patch("aw_daily_reporter.timeline.client.AWClient")
    @patch("aw_daily_reporter.core.TimelineGenerator")
    @patch("aw_daily_reporter.shared.settings_manager.SettingsManager")
    @patch("aw_daily_reporter.core.get_date_range")
    def test_report_aw_day_start_fallback_on_none(self, mock_date_range, mock_settings, mock_generator, mock_client):
        """AW設定がNoneの場合はマニュアル設定にフォールバック"""
        from aw_daily_reporter.core import cmd_report

        mock_date_range.return_value = (MagicMock(), MagicMock())
        mock_settings.get_instance.return_value.load.return_value = {
            "system": {"start_of_day": "06:00", "day_start_source": "aw"},
            "settings": {},
        }
        mock_client.return_value.get_setting.return_value = None  # AW returns None
        mock_generator.return_value.run.return_value = ({}, [], [], {})

        args = Namespace(date=None, output=None, renderer="markdown", verbose=False)
        cmd_report(args)

        # Should fallback to manual setting
        mock_date_range.assert_called_with(None, offset="06:00")

    @patch("aw_daily_reporter.timeline.client.AWClient")
    @patch("aw_daily_reporter.core.TimelineGenerator")
    @patch("aw_daily_reporter.shared.settings_manager.SettingsManager")
    @patch("aw_daily_reporter.core.get_date_range")
    def test_report_aw_day_start_fallback_on_exception(
        self, mock_date_range, mock_settings, mock_generator, mock_client
    ):
        """AW取得で例外時はマニュアル設定にフォールバック"""
        from aw_daily_reporter.core import cmd_report

        mock_date_range.return_value = (MagicMock(), MagicMock())
        mock_settings.get_instance.return_value.load.return_value = {
            "system": {"start_of_day": "07:00", "day_start_source": "aw"},
            "settings": {},
        }
        mock_client.return_value.get_setting.side_effect = Exception("Connection failed")
        mock_generator.return_value.run.return_value = ({}, [], [], {})

        args = Namespace(date=None, output=None, renderer="markdown", verbose=False)
        cmd_report(args)

        # Should fallback to manual setting
        mock_date_range.assert_called_with(None, offset="07:00")


class TestCmdPluginList(unittest.TestCase):
    """cmd_plugin_list 関数のテストケース"""

    @patch("aw_daily_reporter.plugins.manager.PluginManager")
    def test_plugin_list_output(self, mock_manager):
        """プラグイン一覧を出力"""
        from aw_daily_reporter.core import cmd_plugin_list

        mock_processor = MagicMock()
        mock_processor.name = "Test Processor"
        mock_scanner = MagicMock()
        mock_scanner.name = "Test Scanner"
        mock_renderer = MagicMock()
        mock_renderer.name = "Test Renderer"

        mock_manager.return_value.processors = [mock_processor]
        mock_manager.return_value.scanners = [mock_scanner]
        mock_manager.return_value.renderers = [mock_renderer]

        args = Namespace()

        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            cmd_plugin_list(args)
            output = mock_stdout.getvalue()
            assert "Test Processor" in output
            assert "Test Scanner" in output
            assert "Test Renderer" in output


class TestCmdPlugin(unittest.TestCase):
    """cmd_plugin 関数のテストケース"""

    @patch("aw_daily_reporter.core.cmd_plugin_list")
    def test_plugin_command_list(self, mock_list):
        """plugin list コマンドを実行"""
        from aw_daily_reporter.core import cmd_plugin

        args = Namespace(plugin_command="list")
        cmd_plugin(args)
        mock_list.assert_called_once_with(args)

    @patch("aw_daily_reporter.core.cmd_plugin_install")
    def test_plugin_command_install(self, mock_install):
        """plugin install コマンドを実行"""
        from unittest.mock import ANY

        from aw_daily_reporter.core import cmd_plugin

        args = Namespace(plugin_command="install", source="/path/to/plugin")
        cmd_plugin(args)
        mock_install.assert_called_once_with(args, ANY)

    @patch("aw_daily_reporter.core.cmd_plugin_remove")
    def test_plugin_command_remove(self, mock_remove):
        """plugin remove コマンドを実行"""
        from unittest.mock import ANY

        from aw_daily_reporter.core import cmd_plugin

        args = Namespace(plugin_command="remove", name="test-plugin")
        cmd_plugin(args)
        mock_remove.assert_called_once_with(args, ANY)

    def test_plugin_command_unknown(self):
        """不明なプラグインコマンドでメッセージを出力"""
        from aw_daily_reporter.core import cmd_plugin

        args = Namespace(plugin_command="unknown")

        with patch("sys.stdout", new_callable=StringIO):
            cmd_plugin(args)
            # Should not raise


class TestCmdPluginInstall(unittest.TestCase):
    """cmd_plugin_install 関数のテストケース"""

    @patch("aw_daily_reporter.plugins.manager.PluginManager")
    def test_install_success(self, mock_manager):
        """プラグインを正常にインストール"""
        from aw_daily_reporter.core import cmd_plugin_install

        args = Namespace(source="/path/to/plugin")
        mock_logger = MagicMock()

        with patch("sys.stdout", new_callable=StringIO):
            cmd_plugin_install(args, mock_logger)

        mock_manager.return_value.install_plugin.assert_called_once_with("/path/to/plugin")

    @patch("aw_daily_reporter.plugins.manager.PluginManager")
    def test_install_failure_exits(self, mock_manager):
        """プラグインインストール失敗でsys.exit(1)"""
        from aw_daily_reporter.core import cmd_plugin_install

        mock_manager.return_value.install_plugin.side_effect = Exception("Install failed")
        args = Namespace(source="/path/to/plugin")
        mock_logger = MagicMock()

        with pytest.raises(SystemExit) as ctx, patch("sys.stdout", new_callable=StringIO):
            cmd_plugin_install(args, mock_logger)
        assert ctx.value.code == 1


class TestCmdPluginRemove(unittest.TestCase):
    """cmd_plugin_remove 関数のテストケース"""

    @patch("aw_daily_reporter.plugins.manager.PluginManager")
    def test_remove_success(self, mock_manager):
        """プラグインを正常に削除"""
        from aw_daily_reporter.core import cmd_plugin_remove

        args = Namespace(name="test-plugin")
        mock_logger = MagicMock()

        with patch("sys.stdout", new_callable=StringIO):
            cmd_plugin_remove(args, mock_logger)

        mock_manager.return_value.remove_plugin.assert_called_once_with("test-plugin")

    @patch("aw_daily_reporter.plugins.manager.PluginManager")
    def test_remove_failure_exits(self, mock_manager):
        """プラグイン削除失敗でsys.exit(1)"""
        from aw_daily_reporter.core import cmd_plugin_remove

        mock_manager.return_value.remove_plugin.side_effect = Exception("Remove failed")
        args = Namespace(name="test-plugin")
        mock_logger = MagicMock()

        with pytest.raises(SystemExit) as ctx, patch("sys.stdout", new_callable=StringIO):
            cmd_plugin_remove(args, mock_logger)
        assert ctx.value.code == 1


class TestMain(unittest.TestCase):
    """main 関数のテストケース"""

    @patch("aw_daily_reporter.core.cmd_serve")
    @patch("aw_daily_reporter.core.setup_logging")
    def test_main_no_args_runs_serve(self, mock_logging, mock_serve):
        """引数なしでserveコマンドを実行"""
        from aw_daily_reporter.core import main

        with patch("sys.argv", ["aw-daily-reporter"]):
            main()

        mock_serve.assert_called_once()

    @patch("aw_daily_reporter.core.setup_logging")
    def test_main_version_flag(self, mock_logging):
        """--versionフラグでバージョンを表示"""
        from aw_daily_reporter.core import main

        with patch("sys.argv", ["aw-daily-reporter", "--version"]):
            with pytest.raises(SystemExit) as ctx:
                main()
            assert ctx.value.code == 0

    @patch("aw_daily_reporter.core.cmd_serve")
    @patch("aw_daily_reporter.core.setup_logging")
    def test_main_serve_command(self, mock_logging, mock_serve):
        """serveコマンドを実行"""
        from aw_daily_reporter.core import main

        with patch("sys.argv", ["aw-daily-reporter", "serve", "--no-frontend", "--no-open"]):
            main()

        mock_serve.assert_called_once()

    @patch("aw_daily_reporter.core.cmd_plugin")
    @patch("aw_daily_reporter.core.setup_logging")
    def test_main_plugin_list_command(self, mock_logging, mock_plugin):
        """plugin listコマンドを実行"""
        from aw_daily_reporter.core import main

        with patch("sys.argv", ["aw-daily-reporter", "plugin", "list"]):
            main()

        mock_plugin.assert_called_once()


if __name__ == "__main__":
    unittest.main()
