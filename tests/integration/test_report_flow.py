"""
TimelineGenerator レポート生成フローの統合テスト
"""

import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

from aw_core import Event

from aw_daily_reporter.timeline.generator import TimelineGenerator


class TestReportFlowIntegration(unittest.TestCase):
    """レポート生成フロー全体の統合テスト"""

    @patch("aw_daily_reporter.timeline.generator.AWClient")
    @patch("aw_daily_reporter.shared.settings_manager.ConfigStore")
    def test_generator_run_flow(self, mock_settings, mock_client):
        """
        データ取得 -> マージ -> レンダリング までの一連の流れを検証
        """
        # 1. 設定のモック
        mock_settings.get_instance.return_value.load.return_value = {
            "system": {"start_of_day": "00:00"},
            "settings": {},
            "rules": [],
            "apps": {},
        }

        # 2. AWClientのデータモック
        base_time = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)

        # バケット一覧
        mock_client.return_value.get_buckets.return_value = {
            "aw-watcher-window_test": {"type": "currentwindow"},
            "aw-watcher-afk_test": {"type": "afk"},
        }

        # イベントデータ
        mock_client.return_value.fetch_events.return_value = {
            "window": [
                Event(
                    **{
                        "timestamp": base_time,
                        "duration": 3600.0,
                        "data": {"app": "Code", "title": "project.py - Editor"},
                    }
                )
            ],
            "afk": [],
        }

        # 3. Generatorの実行
        generator = TimelineGenerator(hostname="test")

        # プラグインマネージャーをモックしてMarkdownレンダラーを注入
        mock_renderer = MagicMock()
        mock_renderer.name = "Markdown Renderer"
        mock_renderer.plugin_id = "Markdown Renderer"
        mock_renderer.render.return_value = "# Daily Report"
        generator.plugin_manager.renderers = [mock_renderer]

        start = base_time
        end = base_time.replace(hour=18)

        # print出力を抑制しつつ実行
        with patch("builtins.print"):
            report_data, timeline, snapshots, renderer_outputs = generator.run(
                start, end, suppress_timeline=True, capture_renderers=True
            )

        # 4. 検証

        # タイムラインが生成されているか
        assert len(timeline) > 0
        assert timeline[0].app == "Code"

        # レポートデータ（統計）の検証
        report_data.get("category_stats", {})
        # カテゴリ分類はルールがないので Uncategorized になるはず（またはデフォルト設定による）

        # レンダラー出力の検証
        assert "Markdown Renderer" in renderer_outputs
        md_output = renderer_outputs["Markdown Renderer"]
        assert "# Daily Report" in md_output


if __name__ == "__main__":
    unittest.main()
