import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from aw_core import Event
from aw_daily_reporter.timeline.merger import TimelineMerger, events_to_df


class TestTimelineMerger(unittest.TestCase):
    """
    TimelineMerger (タイムラインマージ処理) のテスト。

    主な検証項目:
    - イベントリストからDataFrameへの変換
    - VSCodeイベントのFlood Fill（隙間埋め）処理
    - 異なるソース（Window, VSCode, Web）の統合ロジック
    """

    def setUp(self):
        self.clean_url_mock = MagicMock(side_effect=lambda x: x)
        self.merger = TimelineMerger(self.clean_url_mock)
        self.base_time = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)

    def _create_event(self, offset_minutes, duration_minutes, data=None):
        return Event(
            timestamp=self.base_time + timedelta(minutes=offset_minutes),
            duration=timedelta(minutes=duration_minutes),
            data=data or {},
        )

    # =========================================================================
    # events_to_df Tests
    # =========================================================================

    def test_events_to_df_converts_list_correctly(self):
        # Arrange
        events = [
            self._create_event(0, 10, {"app": "Code", "title": "File.py"}),
            self._create_event(20, 10, {"app": "Chrome", "url": "http://example.com"}),
        ]

        # Act
        df = events_to_df(events)

        # Assert
        assert not df.empty
        assert len(df) == 2
        assert list(df.columns[:5]) == ["timestamp", "duration", "end", "app", "title"]
        assert df.iloc[0]["app"] == "Code"
        assert df.iloc[1]["url"] == "http://example.com"

    def test_events_to_df_empty_list_returns_empty_df_with_columns(self):
        # Arrange & Act
        df = events_to_df([])

        # Assert
        assert df.empty
        assert "timestamp" in df.columns
        assert "app" in df.columns

    # =========================================================================
    # _flood_fill_gap Tests
    # =========================================================================

    def test_flood_fill_gap_fills_time_between_events(self):
        # Arrange
        # Event 1: 10:00-10:10
        # Event 2: 10:20-10:30
        # Gap: 10:10-10:20
        events = [
            self._create_event(0, 10, {"app": "Code"}),
            self._create_event(20, 10, {"app": "Code"}),
        ]
        df = events_to_df(events)

        # Act
        filled_df = self.merger._flood_fill_gap(df)

        # Assert
        # Gap should be filled. Event 1 end should be Event 2 start (10:20)
        row1 = filled_df.iloc[0]
        row2 = filled_df.iloc[1]

        # Row 1 duration should clearly be 20 mins now (10:00 to 10:20)
        assert row1["duration"].total_seconds() == 1200.0
        assert row1["end"] == row2["timestamp"]

    # =========================================================================
    # merge_timeline Tests
    # =========================================================================

    def test_merge_timeline_integrates_overlays(self):
        # Arrange
        # Window: 10:00-10:30 "Code - Project"
        # VSCode: 10:00-10:15 "file1.py", 10:15-10:30 "file2.py"
        window_events = [self._create_event(0, 30, {"app": "Code", "title": "Project"})]
        vscode_events = [
            self._create_event(0, 15, {"app": "Code", "file": "file1.py", "language": "python"}),
            self._create_event(15, 15, {"app": "Code", "file": "file2.py", "language": "python"}),
        ]

        events_map = {"window": window_events, "vscode": vscode_events}

        # Act
        timeline, _, _ = self.merger.merge_timeline(events_map)

        # Assert
        # Should be split into 2 items corresponding to VSCode events
        assert len(timeline) == 2

        assert "file1.py" in timeline[0]["context"][0]
        assert "file2.py" in timeline[1]["context"][0]

        assert timeline[0]["duration"] == 900.0  # 15 mins
        assert timeline[1]["duration"] == 900.0

    def test_filter_and_clip_by_segments(self):
        # Arrange
        # Event: 10:00-11:00
        events = [self._create_event(0, 60, {"app": "Code"})]
        df = events_to_df(events)

        # Segments:
        # 1. 10:10-10:20 (Clip middle)
        # 2. 10:50-11:10 (Clip end)
        segments = [
            (
                self.base_time + timedelta(minutes=10),
                self.base_time + timedelta(minutes=20),
            ),
            (
                self.base_time + timedelta(minutes=50),
                self.base_time + timedelta(minutes=70),
            ),
        ]

        # Act
        clipped = self.merger._filter_and_clip_by_segments(df, segments)

        # Assert
        assert len(clipped) == 2
        # Segment 1: 10 mins
        assert clipped.iloc[0]["duration"] == 600.0
        # Segment 2: 10:50-11:00 (10 mins, clipped at original event end)
        assert clipped.iloc[1]["duration"] == 600.0

    def test_merge_timeline_project_extraction(self):
        # Arrange
        # Window: 10:00-10:30 "Code"
        window_events = [self._create_event(0, 30, {"app": "Code", "title": "Project"})]

        # VSCode: 10:00-10:30 (Matches window)
        vscode_events = [
            self._create_event(
                0,
                30,
                {
                    "app": "Code",
                    "project": "MyProject",
                    "file": "main.py",
                    "language": "python",
                },
            )
        ]

        events_map = {"window": window_events, "vscode": vscode_events}

        # Act
        timeline, _, active_projects = self.merger.merge_timeline(events_map)

        # Assert
        assert "MyProject" in active_projects
        assert timeline[0]["project"] == "MyProject"

    def test_merge_timeline_web_overlays(self):
        # Arrange
        # Window: 10:00-10:30 "Chrome"
        window_events = [self._create_event(0, 30, {"app": "Chrome", "title": "GitHub"})]

        # Web: 10:05-10:25 "GitHub - Pull Request"
        web_events = [
            self._create_event(
                5,
                20,
                {
                    "app": "Chrome",
                    "url": "https://github.com/PR",
                    "title": "Pull Request",
                },
            )
        ]

        events_map = {"window": window_events, "aw-watcher-web": web_events}

        # Act
        timeline, _, _ = self.merger.merge_timeline(events_map)

        # Assert
        # Check Web overlay
        # Since Web covers 10:05-10:25, we expect a segment with the URL.
        web_segments = [t for t in timeline if t.get("url") == "https://github.com/PR"]
        assert len(web_segments) > 0
        assert web_segments[0]["url"] == "https://github.com/PR"


if __name__ == "__main__":
    unittest.main()
