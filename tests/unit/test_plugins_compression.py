import unittest
from datetime import datetime, timedelta

from aw_daily_reporter.plugins.processor_compression import CompressionProcessor
from aw_daily_reporter.timeline.models import TimelineItem


class TestCompressionProcessor(unittest.TestCase):
    """
    CompressionProcessor (タイムライン圧縮) のテスト。

    主な検証項目:
    - 同一プロジェクト・同一カテゴリの連続項目のマージ処理
    - マージ時のコンテキスト情報（編集ファイル名など）の維持・統合
    - 異なるプロジェクト間でのマージ（混入）防止
    """

    def setUp(self):
        self.processor = CompressionProcessor()
        self.config = {
            "apps": {
                "editors": ["code", "vim"],
                "browsers": ["chrome", "firefox"],
                "meetings": ["zoom", "teams"],
            }
        }

    def test_compress_editor_items(self):
        now = datetime.now()
        timeline: list[TimelineItem] = [
            {
                "timestamp": now,
                "duration": 60,
                "app": "Code",
                "title": "file1.py",
                "project": "my-project",
                "category": "Coding",
                "file": "file1.py",
                "context": [],
            },
            {
                "timestamp": now + timedelta(seconds=60),
                "duration": 120,
                "app": "Code",
                "title": "file2.py",
                "project": "my-project",
                "category": "Coding",
                "file": "file2.py",
                "context": [],
            },
        ]

        compressed = self.processor.process(timeline, self.config)

        assert len(compressed) == 1
        assert compressed[0]["duration"] == 180
        assert compressed[0]["project"] == "my-project"
        # Check if files info is in context
        context_str = str(compressed[0]["context"])
        assert "file1.py" in context_str
        assert "file2.py" in context_str

    def test_no_compress_different_project(self):
        now = datetime.now()
        timeline: list[TimelineItem] = [
            {
                "timestamp": now,
                "duration": 60,
                "app": "Code",
                "title": "file1.py",
                "project": "project-A",
                "category": "Coding",
                "context": [],
            },
            {
                "timestamp": now + timedelta(seconds=60),
                "duration": 60,
                "app": "Code",
                "title": "file2.py",
                "project": "project-B",  # Different project
                "category": "Coding",
                "context": [],
            },
        ]

        compressed = self.processor.process(timeline, self.config)
        assert len(compressed) == 2
