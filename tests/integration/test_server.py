"""
Flaskサーバーの統合テスト
"""

import unittest
from unittest.mock import MagicMock, patch


class TestServerIntegration(unittest.TestCase):
    """FlaskサーバーのAPIエンドポイントをテスト"""

    def setUp(self):
        # アプリケーションの作成
        from aw_daily_reporter.web.backend.app import create_app

        self.app = create_app({"TESTING": True, "DEBUG": True})
        self.client = self.app.test_client()

    def test_status(self):
        """/api/status エンドポイントのテスト"""
        response = self.client.get("/api/status")

        assert response.status_code == 200
        data = response.get_json()
        assert data["status"] == "ok"

    @patch("aw_daily_reporter.plugins.manager.PluginManager")
    def test_plugins_list(self, mock_manager):
        """/api/plugins エンドポイントのテスト"""
        # プラグインマネージャーのモック
        mock_processor = MagicMock()
        mock_processor.name = "Test Processor"
        mock_processor.plugin_id = "test-processor"
        mock_processor.description = "Test Description"
        mock_processor.__class__.__module__ = "aw_daily_reporter.plugins.test"

        # PluginManagerインスタンスのモック
        manager_instance = mock_manager.return_value
        manager_instance.processors = [mock_processor]
        manager_instance.scanners = []
        manager_instance.renderers = []

        response = self.client.get("/api/plugins")

        assert response.status_code == 200
        data = response.get_json()
        assert len(data) == 1
        assert data[0]["name"] == "Test Processor"

    @patch("aw_daily_reporter.web.backend.routes.TimelineGenerator")
    @patch("aw_daily_reporter.shared.settings_manager.SettingsManager")
    def test_timeline_generation(self, mock_settings, mock_generator):
        """/api/report エンドポイントのテスト (Timeline Generation)"""
        # URLパラメータで日付を指定
        date_str = "2025-01-01"

        # モックの設定
        mock_settings.get_instance.return_value.load.return_value = {}

        # generator.run returns: (report_data, timeline, snapshots, renderer_outputs)
        # TimelineGeneratorのインスタンスをモック
        generator_instance = mock_generator.return_value
        generator_instance.run.return_value = (
            {"category_stats": {}},
            [],
            [],
            {"Markdown": "# Report"},
        )

        response = self.client.get(f"/api/report?date={date_str}")

        assert response.status_code == 200
        data = response.get_json()

        # レスポンス構造の検証
        assert "timeline" in data
        assert "report" in data
        assert "category_stats" in data["report"]
        assert "renderer_outputs" in data


if __name__ == "__main__":
    unittest.main()
