"""
TimelineGenerator モジュールの追加ユニットテスト
"""

import unittest
from datetime import datetime, timedelta, timezone
from io import StringIO
from unittest.mock import MagicMock, patch

from aw_daily_reporter.timeline.models import TimelineItem


class TestTimelineGeneratorMethods(unittest.TestCase):
    """TimelineGenerator の各メソッドのテストケース"""

    @patch("aw_daily_reporter.timeline.generator.AWClient")
    def setUp(self, mock_client):
        from aw_daily_reporter.timeline.generator import TimelineGenerator

        self.generator = TimelineGenerator()
        self.base_time = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)

    def _create_item(
        self,
        offset_minutes: int,
        duration_minutes: int,
        category: str = "Coding",
        project: str = None,
        client_id: str = None,
    ) -> "TimelineItem":
        from aw_daily_reporter.timeline.models import TimelineItem

        data = {
            "timestamp": self.base_time + timedelta(minutes=offset_minutes),
            "duration": float(duration_minutes * 60),
            "app": "Code",
            "title": "TestTitle",
            "context": [],
            "category": category,
            "project": project,
            "source": "test",
        }
        if client_id:
            data["metadata"] = {"client": client_id}

        return TimelineItem(**data)

    def test_get_project_stats(self):
        """プロジェクト統計を正しく計算"""
        timeline = [
            self._create_item(0, 60, project="Project A"),
            self._create_item(60, 30, project="Project A"),
            self._create_item(90, 60, project="Project B"),
        ]

        stats = self.generator.get_project_stats(timeline)

        assert stats["Project A"] == 5400.0  # 90 minutes
        assert stats["Project B"] == 3600.0  # 60 minutes

    def test_get_project_stats_empty_timeline(self):
        """空のタイムラインで空の統計を返す"""
        stats = self.generator.get_project_stats([])
        assert stats == {}

    def test_get_client_stats_aggregates_by_non_billable(self):
        """クライアントIDがない場合はNon-billableに集約"""
        timeline = [
            self._create_item(0, 60),  # client_id なし
            self._create_item(60, 30),  # client_id なし
        ]

        from aw_daily_reporter.shared.constants import NON_BILLABLE_CLIENT

        stats = self.generator.get_client_stats(timeline)

        assert NON_BILLABLE_CLIENT in stats
        assert stats[NON_BILLABLE_CLIENT] == 5400.0

    def test_get_client_stats_excludes_afk(self):
        """AFKカテゴリのアイテムは除外される"""
        timeline = [
            self._create_item(0, 60, category="Coding"),
            self._create_item(60, 30, category="AFK"),  # これは除外
        ]

        stats = self.generator.get_client_stats(timeline)

        total = sum(stats.values())
        assert total == 3600.0  # AFKの30分は含まれない

    def test_get_client_stats_empty_timeline(self):
        """空のタイムラインで空の統計を返す"""
        stats = self.generator.get_client_stats([])
        assert stats == {}

    def test_get_top_unclassified_returns_sorted(self):
        """get_top_unclassifiedはソートされたリストを返す"""
        # このメソッドは全てのアイテムを集計する（Uncategorizedフィルタなし）
        timeline = [
            self._create_item(0, 60),
            self._create_item(60, 30),
            self._create_item(90, 120),
        ]

        top = self.generator.get_top_unclassified(timeline, limit=2)

        # 同じアプリ・タイトルなので1つに集約される
        assert len(top) == 1
        # 合計時間
        assert top[0]["duration"] == 12600.0  # 210 minutes

    def test_get_top_unclassified_respects_limit(self):
        """制限数に従う"""
        from aw_daily_reporter.timeline.models import TimelineItem

        timeline = [
            TimelineItem(
                timestamp=self.base_time,
                duration=60.0,
                app="App1",
                title="Title1",
                category="X",
                source="test",
                context=[],
            ),
            TimelineItem(
                timestamp=self.base_time,
                duration=30.0,
                app="App2",
                title="Title2",
                category="X",
                source="test",
                context=[],
            ),
            TimelineItem(
                timestamp=self.base_time,
                duration=120.0,
                app="App3",
                title="Title3",
                category="X",
                source="test",
                context=[],
            ),
        ]

        top = self.generator.get_top_unclassified(timeline, limit=2)

        assert len(top) == 2
        # 最も長い順
        assert top[0]["duration"] == 120.0
        assert top[1]["duration"] == 60.0


class TestCleanUrl(unittest.TestCase):
    """clean_url メソッドのテスト"""

    @patch("aw_daily_reporter.timeline.generator.AWClient")
    def setUp(self, mock_client):
        from aw_daily_reporter.timeline.generator import TimelineGenerator

        self.generator = TimelineGenerator()

    def test_clean_url_empty(self):
        """空のURLは空文字を返す"""
        assert self.generator.clean_url("") == ""
        assert self.generator.clean_url(None) == ""

    def test_clean_url_removes_query_string(self):
        """クエリ文字列を削除"""
        url = "https://example.com/page?param=value&other=123"
        cleaned = self.generator.clean_url(url)
        assert cleaned == "https://example.com/page"

    def test_clean_url_truncates_long_url(self):
        """長いURLは切り詰められる"""
        long_url = "https://example.com/" + "a" * 100
        cleaned = self.generator.clean_url(long_url)
        assert len(cleaned) == 60
        assert cleaned.endswith("...")

    def test_clean_url_preserves_short_url(self):
        """短いURLはそのまま"""
        url = "https://example.com"
        cleaned = self.generator.clean_url(url)
        assert cleaned == url


class TestGetLocalTz(unittest.TestCase):
    """_get_local_tz メソッドのテスト"""

    @patch("aw_daily_reporter.timeline.generator.AWClient")
    def test_returns_timezone(self, mock_client):
        """ローカルタイムゾーンを返す"""
        from aw_daily_reporter.timeline.generator import TimelineGenerator

        generator = TimelineGenerator()
        tz = generator._get_local_tz()

        assert tz is not None


class TestPrintTimelineDebug(unittest.TestCase):
    """print_timeline_debug メソッドのテスト"""

    @patch("aw_daily_reporter.timeline.generator.AWClient")
    def test_prints_timeline_info(self, mock_client):
        """タイムライン情報を出力"""
        from aw_daily_reporter.timeline.generator import TimelineGenerator

        generator = TimelineGenerator()
        base_time = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        from aw_daily_reporter.timeline.models import TimelineItem

        timeline = [
            TimelineItem(
                timestamp=base_time,
                duration=3600.0,
                app="Code",
                title="Working on project",
                context=["context1", "context2"],
                project="MyProject",
                source="test",
                category="Coding",
            )
        ]

        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            generator.print_timeline_debug(timeline)
            output = mock_stdout.getvalue()
            assert "Timeline Items:" in output
            assert "1 events" in output

    @patch("aw_daily_reporter.timeline.generator.AWClient")
    def test_prints_empty_timeline(self, mock_client):
        """空のタイムラインを出力"""
        from aw_daily_reporter.timeline.generator import TimelineGenerator

        generator = TimelineGenerator()

        with patch("sys.stdout", new_callable=StringIO) as mock_stdout:
            generator.print_timeline_debug([])
            output = mock_stdout.getvalue()
            assert "0 events" in output


class TestTimelineGeneratorDelegation(unittest.TestCase):
    """TimelineGenerator の委譲メソッドのテスト"""

    @patch("aw_daily_reporter.timeline.generator.AWClient")
    def test_get_buckets_delegates(self, mock_client):
        """get_buckets がクライアントに委譲される"""
        from aw_daily_reporter.timeline.generator import TimelineGenerator

        mock_client.return_value.get_buckets.return_value = {"window": "bucket1"}

        generator = TimelineGenerator()
        result = generator.get_buckets()

        mock_client.return_value.get_buckets.assert_called_once()
        assert result == {"window": "bucket1"}

    @patch("aw_daily_reporter.timeline.generator.AWClient")
    def test_fetch_events_delegates(self, mock_client):
        """fetch_events がクライアントに委譲される"""
        from aw_daily_reporter.timeline.generator import TimelineGenerator

        mock_client.return_value.fetch_events.return_value = {"window": []}

        generator = TimelineGenerator()
        start = datetime(2025, 1, 1, tzinfo=timezone.utc)
        end = datetime(2025, 1, 2, tzinfo=timezone.utc)
        generator.fetch_events(start, end)

        mock_client.return_value.fetch_events.assert_called_once_with(start, end)


class TestMergeTimeline(unittest.TestCase):
    """merge_timeline メソッドのテスト"""

    @patch("aw_daily_reporter.timeline.generator.AWClient")
    def test_merge_timeline_delegates_to_merger(self, mock_client):
        """merge_timeline が Merger に委譲される"""
        from aw_daily_reporter.timeline.generator import TimelineGenerator

        generator = TimelineGenerator()

        # Merger をモック
        mock_result = ([], [], set())
        generator.merger.merge_timeline = MagicMock(return_value=mock_result)

        events_map = {"window": []}
        end_time = datetime(2025, 1, 2, tzinfo=timezone.utc)

        result = generator.merge_timeline(events_map, end_time)

        generator.merger.merge_timeline.assert_called_once_with(events_map, end_time)
        assert result == []


class TestLoadBuiltinConfig(unittest.TestCase):
    """load_builtin_config 関数のテスト"""

    def test_load_ja_config(self):
        """日本語設定を読み込む"""
        from aw_daily_reporter.timeline.generator import load_builtin_config

        config = load_builtin_config("ja")

        assert "rules" in config
        assert "apps" in config
        assert "settings" in config

    def test_load_en_config(self):
        """英語設定を読み込む"""
        from aw_daily_reporter.timeline.generator import load_builtin_config

        config = load_builtin_config("en")

        assert "rules" in config

    def test_load_nonexistent_lang_returns_defaults(self):
        """存在しない言語はデフォルト値を返す"""
        from aw_daily_reporter.timeline.generator import load_builtin_config

        config = load_builtin_config("nonexistent")

        assert config["rules"] == []
        assert config["apps"] == {}


class TestLoadConfig(unittest.TestCase):
    """load_config 関数のテスト"""

    @patch("aw_daily_reporter.shared.settings_manager.SettingsManager")
    def test_load_config_delegates_to_settings_manager(self, mock_settings):
        """load_config が SettingsManager に委譲される"""
        from aw_daily_reporter.timeline.generator import load_config

        mock_settings.get_instance.return_value.load.return_value = {"test": "config"}

        result = load_config()

        mock_settings.get_instance.assert_called_once()
        assert result == {"test": "config"}


class TestAnalyzeWorkingHours(unittest.TestCase):
    """analyze_working_hours メソッドのテスト"""

    @patch("aw_daily_reporter.timeline.generator.AWClient")
    def test_returns_working_hours_structure(self, mock_client):
        """作業時間分析の構造を返す"""
        from aw_daily_reporter.timeline.generator import TimelineGenerator

        generator = TimelineGenerator()
        base_time = datetime(2025, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        from aw_daily_reporter.timeline.models import TimelineItem

        timeline = [
            TimelineItem(
                timestamp=base_time,
                duration=3600.0,
                app="Code",
                title="Work",
                context=[],
                category="Coding",
                source="test",
            )
        ]
        config = {"settings": {}}

        result = generator.analyze_working_hours(timeline, config)

        assert isinstance(result, dict)


if __name__ == "__main__":
    unittest.main()
