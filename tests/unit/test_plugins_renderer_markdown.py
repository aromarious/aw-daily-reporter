"""
MarkdownRendererPlugin のユニットテスト
"""

import os
import re
import unittest
from datetime import datetime, timezone

from aw_daily_reporter.plugins.renderer_markdown import MarkdownRendererPlugin
from aw_daily_reporter.timeline.models import TimelineItem


class TestMarkdownRendererPlugin(unittest.TestCase):
    """MarkdownRendererPlugin のテストケース"""

    def setUp(self):
        # 環境変数が設定されているとタイムラインが出力されないため削除
        if "AW_SUPPRESS_TIMELINE" in os.environ:
            del os.environ["AW_SUPPRESS_TIMELINE"]

        self.renderer = MarkdownRendererPlugin()
        self.base_config = {"settings": {"break_categories": []}}
        self.base_report_data = {
            "date": "2025-01-15",
            "work_stats": {
                "working_seconds": 3600,
                "break_seconds": 900,
                "start": datetime(2025, 1, 15, 9, 0, tzinfo=timezone.utc),
                "end": datetime(2025, 1, 15, 18, 0, tzinfo=timezone.utc),
            },
            "category_stats": {},
            "project_stats": {},
            "scan_summary": [],
        }

    def test_name_and_description(self):
        """name と description プロパティが文字列を返すこと"""
        assert isinstance(self.renderer.name, str)
        assert isinstance(self.renderer.description, str)

    def test_renders_header_with_date(self):
        """ヘッダーに日付が含まれる"""
        result = self.renderer.render([], self.base_report_data, self.base_config)
        assert "2025-01-15" in result
        assert "📅" in result

    def test_renders_working_hours(self):
        """稼働時間が表示される"""
        result = self.renderer.render([], self.base_report_data, self.base_config)
        assert "⏰" in result
        # 時刻はローカルタイムゾーンに変換されるため、存在確認のみ
        assert re.search(r"\d{2}:\d{2}", result)

    def test_renders_break_time(self):
        """休憩時間が表示される"""
        result = self.renderer.render([], self.base_report_data, self.base_config)
        assert "☕" in result
        assert "0h 15m" in result  # 900秒 = 15分

    def test_renders_category_distribution(self):
        """カテゴリ分布が表示される"""
        report_data = {
            **self.base_report_data,
            "category_stats": {"Coding": 1800, "Meeting": 900},
        }
        result = self.renderer.render([], report_data, self.base_config)
        assert "⏱️" in result
        assert "Coding:" in result
        assert "Meeting:" in result

    def test_afk_excluded_from_category_stats(self):
        """AFKカテゴリは統計から除外"""
        report_data = {
            **self.base_report_data,
            "category_stats": {"Coding": 1800, "AFK": 900},
        }
        result = self.renderer.render([], report_data, self.base_config)
        assert "Coding:" in result
        assert "AFK:" not in result

    def test_break_categories_excluded(self):
        """break_categoriesに含まれるカテゴリは除外"""
        config = {"settings": {"break_categories": ["Break", "Lunch"]}}
        report_data = {
            **self.base_report_data,
            "category_stats": {"Coding": 1800, "Lunch": 900},
        }
        result = self.renderer.render([], report_data, config)
        assert "Coding:" in result
        assert "Lunch:" not in result

    def test_renders_project_distribution(self):
        """プロジェクト分布が表示される"""
        report_data = {
            **self.base_report_data,
            "project_stats": {"ProjectA": 1800, "ProjectB": 900},
        }
        result = self.renderer.render([], report_data, self.base_config)
        assert "📂" in result
        assert "ProjectA:" in result
        assert "ProjectB:" in result

    def test_renders_scan_summary(self):
        """スキャンサマリーが表示される"""
        report_data = {**self.base_report_data, "scan_summary": ["PR #123: Bug fix"]}
        result = self.renderer.render([], report_data, self.base_config)
        assert "PR #123: Bug fix" in result

    def test_timeline_items_rendered(self):
        """タイムラインアイテムがレンダリングされる"""
        timeline = [
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
                duration=120,
                category="Coding",
                app="VS Code",
                title="main.py",
                project=None,
                context=[],
                source="test",
            )
        ]
        result = self.renderer.render(timeline, self.base_report_data, self.base_config)
        assert "VS Code" in result
        assert "main.py" in result

    def test_timeline_skips_short_non_git_items(self):
        """5秒未満の非Gitアイテムはスキップ"""
        timeline = [
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
                duration=3,  # 3秒
                category="Coding",
                app="VS Code",
                title="short.py",
                project=None,
                context=[],
                source="test",
            ),
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 31, tzinfo=timezone.utc),
                duration=3,  # 3秒だがGit
                category="Git",
                app="Git",
                title="commit",
                project=None,
                context=[],
                source="test",
            ),
        ]
        result = self.renderer.render(timeline, self.base_report_data, self.base_config)
        assert "short.py" not in result
        assert "commit" in result

    def test_timeline_shows_project_in_context(self):
        """プロジェクトがあればcontextに表示"""
        timeline = [
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
                duration=60,
                category="Coding",
                app="VS Code",
                title="file.py",
                project="MyProject",
                context=[],
                source="test",
            )
        ]
        result = self.renderer.render(timeline, self.base_report_data, self.base_config)
        assert "Project: MyProject" in result

    def test_icon_mapping_git(self):
        """Gitカテゴリには🌱アイコン"""
        timeline = [
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
                duration=10,
                category="Git",
                app="Git",
                title="commit",
                project=None,
                context=[],
                source="test",
            )
        ]
        result = self.renderer.render(timeline, self.base_report_data, self.base_config)
        assert "🌱" in result

    def test_icon_mapping_project(self):
        """プロジェクトがあれば🚀アイコン"""
        timeline = [
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
                duration=60,
                category="Coding",
                app="VS Code",
                title="file.py",
                project="MyProject",
                context=[],
                source="test",
            )
        ]
        result = self.renderer.render(timeline, self.base_report_data, self.base_config)
        assert "🚀" in result

    def test_icon_mapping_meeting(self):
        """ミーティングカテゴリには📹アイコン"""
        timeline = [
            TimelineItem(
                timestamp=datetime(2025, 1, 15, 10, 30, tzinfo=timezone.utc),
                duration=60,
                category="ミーティング",
                app="Zoom",
                title="Call",
                project=None,
                context=[],
                source="test",
            )
        ]
        result = self.renderer.render(timeline, self.base_report_data, self.base_config)
        assert "📹" in result

    def test_uncategorized_sorted_last(self):
        """未分類カテゴリは最後にソートされる"""
        report_data = {
            **self.base_report_data,
            "category_stats": {"Uncategorized": 900, "Coding": 1800, "Other": 600},
        }
        result = self.renderer.render([], report_data, self.base_config)
        # Codingが先に出て、Other/Uncategorizedが後
        coding_pos = result.find("Coding:")
        uncategorized_pos = result.find("Uncategorized:")
        other_pos = result.find("Other:")
        assert coding_pos < uncategorized_pos
        assert coding_pos < other_pos


if __name__ == "__main__":
    unittest.main()
