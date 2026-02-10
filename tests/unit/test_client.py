"""
AWClient モジュールのユニットテスト
"""

import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, Mock, patch

from aw_daily_reporter.timeline.client import AWClient


class TestAWClient(unittest.TestCase):
    """AWClient クラスのテストケース"""

    @patch("aw_daily_reporter.timeline.client.ActivityWatchClient")
    def test_init_creates_client(self, mock_aw_client):
        """初期化時にActivityWatchClientが作成される"""
        client = AWClient("test-client")
        mock_aw_client.assert_called_once_with("test-client", testing=False)
        assert client.client is not None

    @patch("aw_daily_reporter.timeline.client.ActivityWatchClient")
    def test_get_setting_success(self, mock_aw_client):
        """設定値を正常に取得できる"""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = "04:00"
        mock_aw_client.return_value._get.return_value = mock_response

        client = AWClient()
        result = client.get_setting("startOfDay")

        assert result == "04:00"
        mock_aw_client.return_value._get.assert_called_with("settings/startOfDay")

    @patch("aw_daily_reporter.timeline.client.ActivityWatchClient")
    def test_get_setting_not_found(self, mock_aw_client):
        """設定値が見つからない場合はNoneを返す"""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_aw_client.return_value._get.return_value = mock_response

        client = AWClient()
        result = client.get_setting("nonexistent")

        assert result is None

    @patch("aw_daily_reporter.timeline.client.ActivityWatchClient")
    def test_get_setting_exception(self, mock_aw_client):
        """例外発生時はNoneを返す"""
        mock_aw_client.return_value._get.side_effect = Exception("Connection error")

        client = AWClient()
        result = client.get_setting("startOfDay")

        assert result is None

    @patch("aw_daily_reporter.shared.settings_manager.ConfigStore")
    @patch("aw_daily_reporter.timeline.client.ActivityWatchClient")
    def test_get_buckets_filters_by_hostname(self, mock_aw_client, mock_config_store):
        """バケットがホスト名でフィルタリングされる"""
        # ConfigStore のモック設定
        mock_config = Mock()
        mock_config.system.enabled_bucket_ids = []
        mock_config_store.get_instance.return_value.load.return_value = mock_config

        mock_aw_client.return_value.get_buckets.return_value = {
            "aw-watcher-window_testhost": {},
            "aw-watcher-afk_testhost": {},
            "aw-watcher-window_otherhost": {},
            "aw-watcher-web-chrome_testhost": {},
        }

        client = AWClient(hostname="testhost")
        buckets = client.get_buckets()

        assert "aw-watcher-window_testhost" in buckets
        assert "aw-watcher-afk_testhost" in buckets
        assert "aw-watcher-web-chrome_testhost" in buckets
        assert "aw-watcher-window_otherhost" not in buckets

    @patch("aw_daily_reporter.shared.settings_manager.ConfigStore")
    @patch("aw_daily_reporter.timeline.client.ActivityWatchClient")
    def test_get_buckets_vscode(self, mock_aw_client, mock_config_store):
        """VSCode バケットが正しく取得される"""
        # ConfigStore のモック設定
        mock_config = Mock()
        mock_config.system.enabled_bucket_ids = []
        mock_config_store.get_instance.return_value.load.return_value = mock_config

        mock_aw_client.return_value.get_buckets.return_value = {
            "aw-watcher-vscode_testhost": {},
        }

        client = AWClient(hostname="testhost")
        buckets = client.get_buckets()

        assert "aw-watcher-vscode_testhost" in buckets
        assert buckets["aw-watcher-vscode_testhost"] == "aw-watcher-vscode_testhost"

    @patch("aw_daily_reporter.shared.settings_manager.ConfigStore")
    @patch("aw_daily_reporter.timeline.client.ActivityWatchClient")
    def test_fetch_events_returns_events_map(self, mock_aw_client, mock_config_store):
        """イベントを正しく取得する"""
        # ConfigStore のモック設定
        mock_config = Mock()
        mock_config.system.enabled_bucket_ids = []
        mock_config_store.get_instance.return_value.load.return_value = mock_config

        mock_event = MagicMock()
        mock_aw_client.return_value.get_buckets.return_value = {
            "aw-watcher-window_testhost": {},
        }
        mock_aw_client.return_value.get_events.return_value = [mock_event]

        client = AWClient(hostname="testhost")
        start = datetime(2025, 1, 1, tzinfo=timezone.utc)
        end = datetime(2025, 1, 2, tzinfo=timezone.utc)

        events_map = client.fetch_events(start, end)

        assert "aw-watcher-window_testhost" in events_map
        assert events_map["aw-watcher-window_testhost"] == [mock_event]

    @patch("aw_daily_reporter.shared.settings_manager.ConfigStore")
    @patch("aw_daily_reporter.timeline.client.ActivityWatchClient")
    def test_fetch_events_handles_error(self, mock_aw_client, mock_config_store):
        """バケット取得エラー時は空リストを返す"""
        # ConfigStore のモック設定
        mock_config = Mock()
        mock_config.system.enabled_bucket_ids = []
        mock_config_store.get_instance.return_value.load.return_value = mock_config

        mock_aw_client.return_value.get_buckets.return_value = {
            "aw-watcher-window_testhost": {},
        }
        mock_aw_client.return_value.get_events.side_effect = Exception("API Error")

        client = AWClient(hostname="testhost")
        start = datetime(2025, 1, 1, tzinfo=timezone.utc)
        end = datetime(2025, 1, 2, tzinfo=timezone.utc)

        events_map = client.fetch_events(start, end)

        assert "aw-watcher-window_testhost" in events_map
        assert events_map["aw-watcher-window_testhost"] == []


if __name__ == "__main__":
    unittest.main()
