"""
AIRendererPlugin のユニットテスト
"""

import unittest
from datetime import datetime, timezone

from aw_daily_reporter.plugins.renderer_ai import AIRendererPlugin
from aw_daily_reporter.timeline.models import TimelineItem


class TestAIRendererPlugin(unittest.TestCase):
    """AIRendererPlugin のテストケース"""

    def setUp(self):
        self.renderer = AIRendererPlugin()
        self.base_config = {"settings": {}}
        self.base_report_data = {
            "date": "2025-01-15",
            "work_stats": {"working_seconds": 3600},
            "category_stats": {},
            "project_stats": {},
            "scan_summary": [],
        }

    def test_name_and_description(self):
        """name と description プロパティが文字列を返すこと"""
        assert isinstance(self.renderer.name, str)
        assert isinstance(self.renderer.description, str)

    def test_empty_timeline_renders_header_only(self):
        """空のタイムラインでもヘッダーは出力される"""
        result = self.renderer.render([], self.base_report_data, self.base_config)
        assert "Date: 2025-01-15" in result
        assert "Total Work: 1h 0m" in result

    def test_ai_prompt_included_when_configured(self):
        """ai_promptが設定されていれば出力に含まれる"""
        config = {"settings": {"ai_prompt": "You are a helpful assistant."}}
        result = self.renderer.render([], self.base_report_data, config)
        assert "You are a helpful assistant." in result
        assert "---" in result
        assert "Below is the activity log:" in result

    def test_ai_prompt_fallback_from_root(self):
        """settings.ai_promptがなくてもルートレベルのai_promptを使用"""
        config = {"ai_prompt": "Root level prompt", "settings": {}}
        result = self.renderer.render([], self.base_report_data, config)
        assert "Root level prompt" in result

    def test_timeline_items_rendered(self):
        """タイムラインアイテムが正しく出力される"""
        timeline = [
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
                duration=1800,  # 30分
                category="Coding",
                app="VS Code",
                title="main.py",
                project=None,
                context=[],
                source="test",
            )
        ]
        result = self.renderer.render(timeline, self.base_report_data, self.base_config)
        # タイムスタンプ、カテゴリ、アプリ、タイトル、時間が含まれる
        assert "Coding" in result
        assert "VS Code" in result
        assert "main.py" in result
        assert "30m" in result

    def test_timeline_with_project_shows_context(self):
        """プロジェクトがあればコンテキストに表示"""
        timeline = [
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
                duration=600,
                category="Coding",
                app="VS Code",
                title="file.py",
                project="MyProject",
                context=[],
                source="test",
            )
        ]
        result = self.renderer.render(timeline, self.base_report_data, self.base_config)
        assert "Proj:MyProject" in result

    def test_git_items_in_separate_section(self):
        """Gitアイテムは専用セクションに出力"""
        timeline = [
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
                duration=0,
                category="Git",
                app="Git",
                title="[repo] Commit message (abc123)",
                project=None,
                context=[],
                source="test",
            )
        ]
        result = self.renderer.render(timeline, self.base_report_data, self.base_config)
        assert "-- Git Activity --" in result
        assert "Commit:" in result

    def test_scan_summary_included(self):
        """scan_summaryが含まれる"""
        report_data = {
            **self.base_report_data,
            "scan_summary": ["PR #123: Fix bug", "PR #456: Add feature"],
        }
        result = self.renderer.render([], report_data, self.base_config)
        assert "-- Git Activity --" in result
        assert "PR #123: Fix bug" in result

    def test_category_stats_rendered(self):
        """カテゴリ統計が出力される"""
        report_data = {
            **self.base_report_data,
            "working_seconds": 7200,
            "work_stats": {"working_seconds": 7200},
            "category_stats": {"Coding": 3600, "Meeting": 1800},
        }
        result = self.renderer.render([], report_data, self.base_config)
        assert "-- Category Stats --" in result
        assert "Coding:" in result

    def test_project_stats_rendered(self):
        """プロジェクト統計が出力される"""
        report_data = {
            **self.base_report_data,
            "working_seconds": 7200,
            "work_stats": {"working_seconds": 7200},
            "project_stats": {"ProjectA": 3600, "ProjectB": 1800},
        }
        result = self.renderer.render([], report_data, self.base_config)
        assert "-- Project Stats --" in result
        assert "ProjectA:" in result

    def test_duration_less_than_1_min_shows_1m(self):
        """1分未満のdurationは1mとして表示"""
        timeline = [
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
                duration=30,  # 30秒
                category="Quick",
                app="App",
                title="Title",
                project=None,
                context=[],
                source="test",
            )
        ]
        result = self.renderer.render(timeline, self.base_report_data, self.base_config)
        assert "1m" in result

    def test_stats_skip_short_durations(self):
        """60秒未満のカテゴリ/プロジェクトは統計に含まない"""
        report_data = {
            **self.base_report_data,
            "work_stats": {"working_seconds": 3600},
            "category_stats": {"Short": 30, "Long": 1800},
            "project_stats": {"ShortProj": 30, "LongProj": 1800},
        }
        result = self.renderer.render([], report_data, self.base_config)
        assert "Long:" in result
        assert "Short:" not in result
        assert "LongProj:" in result
        assert "ShortProj:" not in result


if __name__ == "__main__":
    unittest.main()
