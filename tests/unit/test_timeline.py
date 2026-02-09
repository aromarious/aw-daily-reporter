import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from aw_daily_reporter.timeline import TimelineGenerator, TimelineItem


class TestTimelineGenerator(unittest.TestCase):
    """
    TimelineGenerator (コアロジック) のテスト。

    主な検証項目:
    - 勤務時間（始業・終業、実働、休憩、AFK）の計算ロジック
    - タイムライン生成時のデータ加工処理（URLクリーニングなど）
    """

    @patch("aw_daily_reporter.timeline.generator.AWClient")
    def setUp(self, mock_client):
        self.generator = TimelineGenerator()
        self.base_time = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)

    # =========================================================================
    # URL Cleaning Tests
    # =========================================================================

    def test_clean_url_parameters_removed(self):
        # Arrange
        url = "https://example.com/page?query=123&foo=bar"

        # Act
        cleaned = self.generator.clean_url(url)

        # Assert
        assert cleaned == "https://example.com/page"

    def test_clean_url_long_url_truncated(self):
        # Arrange
        long_url = "https://example.com/" + "a" * 100

        # Act
        cleaned = self.generator.clean_url(long_url)

        # Assert
        assert len(cleaned) <= 60
        assert cleaned.endswith("...")

    def test_clean_url_empty_input_returns_empty_string(self):
        # Arrange
        empty_url = ""
        none_url = None

        # Act & Assert
        assert self.generator.clean_url(empty_url) == ""
        assert self.generator.clean_url(none_url) == ""

    # =========================================================================
    # analyze_working_hours Tests (Test Design: T01 - T08)
    # =========================================================================

    def _create_item(
        self,
        offset_minutes: int,
        duration_minutes: int,
        category: str = "Coding",
        source: str = None,
    ) -> TimelineItem:
        return TimelineItem(
            timestamp=self.base_time + timedelta(minutes=offset_minutes),
            duration=float(duration_minutes * 60),
            app="Code",
            title="Work",
            context=[],
            category=category,
            source=source,
        )

    def test_analyze_working_hours_empty_timeline_returns_zero_stats(self):
        # T01: Empty Timeline -> All 0
        # Arrange
        timeline = []

        # Act
        stats = self.generator.analyze_working_hours(timeline, {})

        # Assert
        assert stats.working_seconds == 0.0
        assert stats.break_seconds == 0.0
        assert stats.afk_seconds == 0.0

    def test_analyze_working_hours_single_item_returns_duration(self):
        # T02: Single Item
        # Arrange
        timeline = [self._create_item(0, 60)]  # 1 hour work

        # Act
        stats = self.generator.analyze_working_hours(timeline, {})

        # Assert
        assert stats.working_seconds == 3600.0
        assert stats.break_seconds == 0.0

    def test_analyze_working_hours_with_gap_calculates_afk(self):
        # T03: Gap -> AFK (Implicit Break)
        # Arrange
        # 10:00-11:00 (Work), 12:00-13:00 (Work). Gap 11:00-12:00 (1h)
        timeline = [
            self._create_item(0, 60),  # 10:00-11:00
            self._create_item(120, 60),  # 12:00-13:00
        ]

        # Act
        stats = self.generator.analyze_working_hours(timeline, {})

        # Assert
        # Total span: 10:00 - 13:00 (3h = 10800s)
        # Active: 2h (7200s)
        # AFK (Gap): 1h (3600s)
        assert stats.working_seconds == 7200.0
        assert stats.afk_seconds == 3600.0
        assert stats.break_seconds == 3600.0

    def test_analyze_working_hours_with_afk_item_excludes_from_working(self):
        # T04: Explicit AFK item
        # Arrange
        # 10:00-11:00 (Work)
        # 11:00-11:30 (AFK Item)
        # 11:30-12:30 (Work)
        timeline = [
            self._create_item(0, 60),
            self._create_item(60, 30, category="AFK", source="AFK"),
            self._create_item(90, 60),
        ]

        # Act
        stats = self.generator.analyze_working_hours(timeline, {})

        # Assert
        # Total span: 10:00 - 12:30 (2.5h)
        # Working: 2h (1h + 1h)
        # AFK: 30m
        assert stats.working_seconds == 7200.0
        assert stats.afk_seconds == 1800.0

    def test_analyze_working_hours_overlapping_items_merges_duration(self):
        # T05: Overlap
        # Arrange
        # 10:00 - 11:00 (Work)
        # 10:30 - 11:30 (Work)
        # Merged: 10:00 - 11:30 (1.5h)
        timeline = [self._create_item(0, 60), self._create_item(30, 60)]

        # Act
        stats = self.generator.analyze_working_hours(timeline, {})

        # Assert
        assert stats.working_seconds == 5400.0  # 90 mins

    def test_analyze_working_hours_manual_break_category_counts_as_break(self):
        # T06: Manual Break Category
        # Arrange
        # 10:00-11:00 (Work), 11:00-11:30 (Lunch Break)
        timeline = [
            self._create_item(0, 60),
            self._create_item(60, 30, category="Lunch"),
        ]
        config = {"settings": {"break_categories": ["Lunch"]}}

        # Act
        stats = self.generator.analyze_working_hours(timeline, config)

        # Assert
        # Working: 1h? No, logic is Total Span - Break.
        # Total Span: 1.5h.
        # Break: 30m (Lunch) + 0m (Gap).
        # Working: 1h.
        assert stats.working_seconds == 3600.0
        assert stats.break_seconds == 1800.0

    def test_analyze_working_hours_exact_overlap_returns_single_duration(self):
        # T07: Exact Overlap
        # Arrange
        # 10:00-11:00 (Work A)
        # 10:00-11:00 (Work B)
        timeline = [self._create_item(0, 60), self._create_item(0, 60)]

        # Act
        stats = self.generator.analyze_working_hours(timeline, {})

        # Assert
        assert stats.working_seconds == 3600.0

    def test_analyze_working_hours_sub_item_overlap_ignored(self):
        # T08: Sub-item Overlap (B inside A)
        # Arrange
        # 10:00-12:00 (Work A)
        # 11:00-11:30 (Work B)
        timeline = [self._create_item(0, 120), self._create_item(60, 30)]

        # Act
        stats = self.generator.analyze_working_hours(timeline, {})

        # Assert
        assert stats.working_seconds == 7200.0  # 2h


if __name__ == "__main__":
    unittest.main()
