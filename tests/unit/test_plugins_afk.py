import unittest
from datetime import datetime, timedelta, timezone

from aw_daily_reporter.plugins.processor_afk import AFKProcessor
from aw_daily_reporter.timeline.models import TimelineItem


class TestAFKProcessor(unittest.TestCase):
    """
    AFKProcessor (AFK処理) のテスト。

    主な検証項目:
    - AFKイベントが存在しない場合のフォールバック動作
    - not-afk イベントに基づいたアクティブ時間の抽出（AFK期間の除去）
    - システムアプリ（loginwindow等）の除外
    - 重複したイベントの平坦化（Flatten）ロジック
    """

    def setUp(self):
        self.processor = AFKProcessor()
        self.base_time = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)

    def _create_item(
        self,
        offset_minutes: int,
        duration_minutes: int,
        app: str = "Code",
        source: str = "Window",
        status: str = None,
    ) -> TimelineItem:
        return {
            "timestamp": self.base_time + timedelta(minutes=offset_minutes),
            "duration": float(duration_minutes * 60),
            "app": app,
            "title": "Work",
            "context": [],
            "category": "Coding",
            "source": source,
            "status": status,
            # Processor requires these keys to exist even if None for some logic
            "project": None,
            "file": None,
            "language": None,
            "url": None,
        }

    def test_process_empty_timeline_returns_empty_list(self):
        assert self.processor.process([], {}) == []

    def test_process_no_afk_events_keeps_content(self):
        # Scenario: No AFK watcher data provided. Should keep content.
        timeline = [self._create_item(0, 60, app="Code")]

        result = self.processor.process(timeline, {})

        assert len(result) == 1
        assert result[0]["app"] == "Code"
        assert result[0]["duration"] == 3600.0

    def test_process_filters_out_afk_periods(self):
        # Scenario:
        # Content: 10:00-11:00 (Code)
        # AFK Stream:
        #   10:00-10:20: not-afk (Active)
        #   10:20-10:30: afk (Inactive)
        #   10:30-11:00: not-afk (Active)

        content_item = self._create_item(0, 60, app="Code")  # 10:00-11:00

        afk_items = [
            # 10:00-10:20 Active
            self._create_item(0, 20, source="AFK", status="not-afk", app="aw-watcher-afk"),
            # 10:20-10:30 Inactive (implied by gap or explicit afk status logic?)
            # The logic relies on "not-afk" ranges.
            # If "afk" status event exists, it just doesn't contribute to active range.
            self._create_item(20, 10, source="AFK", status="afk", app="aw-watcher-afk"),
            # 10:30-11:00 Active
            self._create_item(30, 30, source="AFK", status="not-afk", app="aw-watcher-afk"),
        ]

        timeline = [content_item] + afk_items

        result = self.processor.process(timeline, {})

        # Expect split:
        # 1. 10:00-10:20 (20m)
        # 2. 10:30-11:00 (30m)
        assert len(result) == 2
        assert result[0]["duration"] == 1200.0
        assert result[1]["duration"] == 1800.0

        # Verify timestamps
        assert result[0]["timestamp"] == self.base_time
        assert result[1]["timestamp"] == self.base_time + timedelta(minutes=30)

    def test_process_removes_system_apps(self):
        # Scenario: loginwindow event
        timeline = [self._create_item(0, 10, app="loginwindow")]

        result = self.processor.process(timeline, {})
        assert len(result) == 0

    def test_process_flattens_overlapping_content(self):
        # Scenario: Overlapping content events
        # Event A: 10:00-10:10
        # Event B: 10:05-10:15
        # AFK: Active 10:00-10:20

        items = [
            self._create_item(0, 10, app="AppA"),
            self._create_item(5, 10, app="AppB"),
            self._create_item(0, 60, source="AFK", status="not-afk"),  # Active
        ]

        result = self.processor.process(items, {})

        # Expected Flatten Logic
        # (Prioritizes earlier start? Code says: if start < last_end: start = last_end)
        # A: 10:00-10:10.
        # B: Starts 10:05. Modified Start -> 10:10. Ends 10:15.

        assert len(result) == 2

        # Item 1: AppA, 10:00-10:10
        assert result[0]["app"] == "AppA"
        assert result[0]["duration"] == 600.0

        # Item 2: AppB, 10:10-10:15 (5 mins)
        assert result[1]["app"] == "AppB"
        assert result[1]["duration"] == 300.0
        assert result[1]["timestamp"] == self.base_time + timedelta(minutes=10)


if __name__ == "__main__":
    unittest.main()
