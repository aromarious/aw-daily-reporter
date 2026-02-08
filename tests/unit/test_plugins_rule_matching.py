import unittest
from datetime import datetime

from aw_daily_reporter.plugins.processor_rule_matching import RuleMatchingProcessor
from aw_daily_reporter.shared.constants import DEFAULT_CATEGORY
from aw_daily_reporter.timeline.models import TimelineItem


class TestRuleMatchingProcessor(unittest.TestCase):
    """
    RuleMatchingProcessor (カテゴリ分類) のテスト。

    主な検証項目:
    - キーワードルールに基づいたカテゴリ（Coding, Communication等）の付与
    - ルールにマッチしない項目のデフォルトカテゴリ（Uncategorized）への分類
    """

    def setUp(self):
        self.processor = RuleMatchingProcessor()

    def test_categorize_timeline(self):
        rules = [
            {"keyword": "VSCode", "category": "Coding"},
            {"keyword": "Slack", "category": "Communication"},
        ]
        config = {"rules": rules}

        # Mock timeline items
        timeline: list[TimelineItem] = [
            {
                "timestamp": datetime.now(),
                "duration": 60,
                "app": "Code",
                "title": "project - VSCode",
                "context": [],
                "category": None,
            },
            {
                "timestamp": datetime.now(),
                "duration": 30,
                "app": "Slack",
                "title": "General",
                "context": [],
                "category": None,
            },
            {
                "timestamp": datetime.now(),
                "duration": 10,
                "app": "Unknown",
                "title": "Something",
                "context": [],
                "category": None,
            },
        ]

        processed_timeline = self.processor.process(timeline, config)

        assert processed_timeline[0]["category"] == "Coding"
        assert processed_timeline[1]["category"] == "Communication"
        # Default behavior: if no match, category becomes DEFAULT_CATEGORY
        assert processed_timeline[2]["category"] == DEFAULT_CATEGORY
