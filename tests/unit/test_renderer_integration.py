"""
レンダラー統合テスト

TimelineItem のシリアライゼーションとレンダラーの動作をテストします。
"""

from datetime import datetime, timezone

import pandas as pd

from aw_daily_reporter.plugins.manager import PluginManager
from aw_daily_reporter.plugins.renderer_json import JSONRendererPlugin
from aw_daily_reporter.timeline.models import TimelineItem


class TestRendererIntegration:
    """レンダラーの統合テスト"""

    def test_timeline_item_with_timezone_aware_timestamp(self):
        """
        タイムゾーン情報を持つ datetime を含む TimelineItem が
        正しくシリアライズできることを確認

        Arrange: タイムゾーン付き datetime を持つ TimelineItem を作成
        Act: model_dump() でシリアライズ
        Assert: エラーが発生しない
        """
        # Arrange
        ts = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        item = TimelineItem(
            timestamp=ts,
            duration=300.0,
            app="TestApp",
            title="Test Title",
        )

        # Act & Assert
        result = item.model_dump()
        assert result["timestamp"] == ts

    def test_pandas_timestamp_to_timeline_item_conversion(self):
        """
        pandas Timestamp から TimelineItem への変換が正しく動作することを確認

        このテストは、manager.py の512-513行目の処理をテストします。

        Arrange: タイムゾーン付き pandas Timestamp を含む DataFrame を作成
        Act: to_pydatetime() で Python datetime に変換してから TimelineItem を作成
        Assert: エラーが発生せず、正しく変換される
        """
        # Arrange
        df = pd.DataFrame(
            {
                "timestamp": [pd.Timestamp("2024-01-01 12:00:00", tz="UTC")],
                "duration": [300.0],
                "app": ["TestApp"],
                "title": ["Test Title"],
            }
        )

        # Act: manager.py と同じ処理を実行
        df_copy = df.copy()
        df_copy["timestamp"] = df_copy["timestamp"].apply(
            lambda x: x.to_pydatetime() if hasattr(x, "to_pydatetime") else x
        )

        # TimelineItem に変換
        items = [TimelineItem(**rec) for rec in df_copy.to_dict("records")]

        # Assert
        assert len(items) == 1
        assert items[0].app == "TestApp"
        assert isinstance(items[0].timestamp, datetime)

    def test_json_renderer_with_timezone_aware_timeline(self):
        """
        タイムゾーン情報を持つ timeline を JSON レンダラーで出力できることを確認

        Arrange: タイムゾーン付き datetime を持つ TimelineItem のリストを作成
        Act: JSONRendererPlugin.render() を実行
        Assert: エラーが発生せず、JSON 文字列が返される
        """
        # Arrange
        ts = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        timeline = [
            TimelineItem(
                timestamp=ts,
                duration=300.0,
                app="TestApp",
                title="Test Title",
            )
        ]
        report_data = {
            "date": "2024-01-01",
            "work_stats": {},
            "category_stats": {},
            "project_stats": {},
            "client_stats": {},
        }
        config = {}

        renderer = JSONRendererPlugin()

        # Act
        output = renderer.render(timeline, report_data, config)

        # Assert
        assert output is not None
        assert isinstance(output, str)
        assert "TestApp" in output

    def test_run_renderers_with_pandas_timestamp_timeline(self):
        """
        pandas Timestamp から変換された timeline で run_renderers が動作することを確認

        これは実際のエラーが発生するシナリオをテストします。

        Arrange: pandas Timestamp から変換された TimelineItem のリストを作成
        Act: PluginManager.run_renderers() を実行
        Assert: エラーメッセージが含まれない
        """
        # Arrange: pandas Timestamp から変換
        df = pd.DataFrame(
            {
                "timestamp": [pd.Timestamp("2024-01-01 12:00:00", tz="UTC")],
                "duration": [300.0],
                "app": ["TestApp"],
                "title": ["Test Title"],
                "context": [[]],
            }
        )

        # manager.py と同じ処理
        df_copy = df.copy()
        df_copy["timestamp"] = df_copy["timestamp"].apply(
            lambda x: x.to_pydatetime() if hasattr(x, "to_pydatetime") else x
        )

        timeline = [TimelineItem(**rec) for rec in df_copy.to_dict("records")]

        report_data = {
            "date": "2024-01-01",
            "work_stats": {},
            "category_stats": {},
            "project_stats": {},
            "client_stats": {},
        }
        config = {}

        manager = PluginManager()
        manager.load_builtin_plugins()

        # Act
        outputs = manager.run_renderers(timeline, report_data, config)

        # Assert
        for plugin_id, output in outputs.items():
            assert not output.startswith("Error rendering:"), f"Renderer {plugin_id} failed: {output}"
