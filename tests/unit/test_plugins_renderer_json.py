"""
JSONRendererPlugin のユニットテスト
"""

import json
import unittest
from datetime import datetime, timezone

from aw_daily_reporter.plugins.renderer_json import JSONRendererPlugin
from aw_daily_reporter.timeline.models import TimelineItem, WorkStats


class TestJSONRendererPlugin(unittest.TestCase):
    """JSONRendererPlugin のテストケース"""

    def setUp(self):
        self.renderer = JSONRendererPlugin()
        self.base_config = {"settings": {}}
        self.base_report_data = {
            "date": "2025-01-15",
            "work_stats": {
                "working_seconds": 3600,
                "break_seconds": 900,
                "start": "2025-01-15T09:00:00+00:00",
                "end": "2025-01-15T18:00:00+00:00",
            },
            "category_stats": {},
            "project_stats": {},
            "client_stats": {},
            "scan_summary": [],
        }

    def test_name_and_description(self):
        """name と description プロパティが文字列を返すこと"""
        assert isinstance(self.renderer.name, str)
        assert isinstance(self.renderer.description, str)

    def test_renders_valid_json(self):
        """有効な JSON が出力される"""
        result = self.renderer.render([], self.base_report_data, self.base_config)
        # JSON として解析可能
        data = json.loads(result)
        assert isinstance(data, dict)

    def test_json_contains_meta_section(self):
        """meta セクションが含まれる"""
        result = self.renderer.render([], self.base_report_data, self.base_config)
        data = json.loads(result)
        assert "meta" in data
        assert "generated_at" in data["meta"]
        assert data["meta"]["date"] == "2025-01-15"

    def test_json_contains_stats_section(self):
        """stats セクションが含まれる"""
        result = self.renderer.render([], self.base_report_data, self.base_config)
        data = json.loads(result)
        assert "stats" in data
        assert "work" in data["stats"]
        assert "categories" in data["stats"]
        assert "projects" in data["stats"]
        assert "clients" in data["stats"]

    def test_json_contains_timeline_section(self):
        """timeline セクションが含まれる"""
        timeline = [
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
                duration=1800,
                category="Coding",
                app="VS Code",
                title="main.py",
                project=None,
                context=[],
                source="test",
            )
        ]
        result = self.renderer.render(timeline, self.base_report_data, self.base_config)
        data = json.loads(result)
        assert "timeline" in data
        assert len(data["timeline"]) == 1
        assert data["timeline"][0]["app"] == "VS Code"

    def test_json_contains_scan_summary(self):
        """scan_summary が含まれる"""
        report_data = {
            **self.base_report_data,
            "scan_summary": ["PR #123: Fix bug"],
        }
        result = self.renderer.render([], report_data, self.base_config)
        data = json.loads(result)
        assert "scan_summary" in data
        assert data["scan_summary"] == ["PR #123: Fix bug"]

    def test_empty_timeline_renders_empty_array(self):
        """空のタイムラインでは空配列が出力される"""
        result = self.renderer.render([], self.base_report_data, self.base_config)
        data = json.loads(result)
        assert data["timeline"] == []

    def test_datetime_serialization(self):
        """datetime オブジェクトが ISO 形式でシリアライズされる"""
        timeline = [
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 30, 0, tzinfo=timezone.utc),
                duration=120,
                category="Test",
                app="App",
                title="Title",
                project=None,
                context=[],
                source="test",
            )
        ]
        result = self.renderer.render(timeline, self.base_report_data, self.base_config)
        data = json.loads(result)
        # timestamp が ISO 形式の文字列として含まれる
        assert "2025-01-15T10:30:00" in data["timeline"][0]["timestamp"]

    # --- Issue #29: Pydantic モデルとの互換性テスト ---

    def test_work_stats_from_generator_format(self):
        """generator.py が model_dump() で生成した辞書形式で正しく動作すること（Issue #29）"""
        # Arrange: generator.py が work_stats.model_dump() で生成する形式
        work_stats = WorkStats(
            start=datetime(2025, 1, 15, 9, 0, tzinfo=timezone.utc),
            end=datetime(2025, 1, 15, 18, 0, tzinfo=timezone.utc),
            working_seconds=7200,
            break_seconds=1800,
            afk_seconds=0,
        )
        report_data = {
            **self.base_report_data,
            "work_stats": work_stats.model_dump(),
        }

        # Act: レンダリングを実行
        result = self.renderer.render([], report_data, self.base_config)

        # Assert: JSON として解析可能で、work_stats が正しく含まれる
        data = json.loads(result)
        assert data["stats"]["work"]["working_seconds"] == 7200
        assert data["stats"]["work"]["break_seconds"] == 1800

    def test_work_stats_missing(self):
        """work_stats が report_data に存在しない場合のエラーハンドリング"""
        # Arrange: work_stats を含まない report_data
        report_data = {
            "date": "2025-01-15",
            "category_stats": {},
            "project_stats": {},
            "client_stats": {},
            "scan_summary": [],
        }

        # Act: レンダリングを実行
        result = self.renderer.render([], report_data, self.base_config)

        # Assert: エラーにならず、work_stats が None として含まれる
        data = json.loads(result)
        assert data["stats"]["work"] is None

    def test_category_stats_rendered(self):
        """カテゴリ統計が正しく出力される"""
        report_data = {
            **self.base_report_data,
            "category_stats": {"Coding": 3600, "Meeting": 1800},
        }
        result = self.renderer.render([], report_data, self.base_config)
        data = json.loads(result)
        assert data["stats"]["categories"]["Coding"] == 3600
        assert data["stats"]["categories"]["Meeting"] == 1800

    def test_project_stats_rendered(self):
        """プロジェクト統計が正しく出力される"""
        report_data = {
            **self.base_report_data,
            "project_stats": {"ProjectA": 3600, "ProjectB": 1800},
        }
        result = self.renderer.render([], report_data, self.base_config)
        data = json.loads(result)
        assert data["stats"]["projects"]["ProjectA"] == 3600
        assert data["stats"]["projects"]["ProjectB"] == 1800

    def test_client_stats_rendered(self):
        """クライアント統計が正しく出力される"""
        report_data = {
            **self.base_report_data,
            "client_stats": {"ClientA": 3600, "ClientB": 1800},
        }
        result = self.renderer.render([], report_data, self.base_config)
        data = json.loads(result)
        assert data["stats"]["clients"]["ClientA"] == 3600
        assert data["stats"]["clients"]["ClientB"] == 1800


if __name__ == "__main__":
    unittest.main()
