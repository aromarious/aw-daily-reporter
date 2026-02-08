# Add the project root to sys.path
import os
import sys
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from aw_daily_reporter.shared.date_utils import get_date_range


# Mock SettingsManager since importing it might trigger file loads
class MockSettingsManager:
    _instance = None

    def __init__(self):
        self.config = {}

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = MockSettingsManager()
        return cls._instance

    def load(self):
        return self.config


class TestDateUtils(unittest.TestCase):
    def setUp(self):
        # We need to patch where it is IMPORTED in date_utils, not where it is defined
        # But wait, date_utils imports it inside the function.
        # So we patch 'aw_daily_reporter.date_utils.SettingsManager'

        self.settings_patcher = patch("aw_daily_reporter.settings_manager.SettingsManager")
        self.mock_settings_cls = self.settings_patcher.start()
        self.mock_settings_instance = MagicMock()
        self.mock_settings_cls.get_instance.return_value = self.mock_settings_instance

        self.mock_config = {"system": {"day_start_hour": 0}}
        self.mock_settings_instance.load.return_value = self.mock_config

    def tearDown(self):
        self.settings_patcher.stop()

    def test_default_day_start_0(self):
        # Case 1: Default (0:00 start), date_str provided
        # 2024-02-07 00:00:00 -> 2024-02-07 23:59:59...
        start, end = get_date_range("2024-02-07")
        assert start.hour == 0
        assert start.day == 7
        assert end.hour == 23
        assert end.day == 7

    def test_day_start_4_with_date_str(self):
        # Case 2: 4:00 start, date_str provided
        self.mock_config["system"]["day_start_hour"] = 4

        start, end = get_date_range("2024-02-07")
        # Start: 2024-02-07 04:00:00
        # If date_str is provided, it starts at 4:00 on that day
        assert start.year == 2024
        assert start.month == 2
        assert start.day == 7
        assert start.hour == 4

        # End: 2024-02-08 03:59:59...
        # It should end at 4:00 next day (exclusive)
        assert end.year == 2024
        assert end.month == 2
        assert end.day == 8
        assert end.hour == 3  # 3:59...

    @patch("aw_daily_reporter.date_utils.datetime")
    def test_day_start_4_today_case_after_start(self, mock_datetime):
        # Case 3: 4:00 start, date_str=None (Today)
        # Current time: 05:00 (After day start)
        self.mock_config["system"]["day_start_hour"] = 4

        # Mock now() to return 2024-02-07 05:00:00
        # We need to construct a timezone-aware datetime because get_date_range uses astimezone()
        # But for testing, we can just make now() return a naive datetime if date_utils wasn't using astimezone().
        # date_utils uses datetime.now().astimezone().
        # Let's mock it to return a fixed aware datetime.

        fixed_now = datetime(2024, 2, 7, 5, 0, 0).astimezone()
        mock_datetime.now.return_value = fixed_now

        # We need to ensure strptime works because it's called inside even if we date_str=None? No.
        # But if we patch datetime class, we lose original strptime.

        # Restore strptime
        mock_datetime.strptime = datetime.strptime

        start, end = get_date_range(None)

        # Should be today's report
        # Start: 2024-02-07 04:00:00
        assert start.day == 7
        assert start.hour == 4

        # End: Now (2024-02-07 05:00:00)
        assert end == fixed_now

    @patch("aw_daily_reporter.date_utils.datetime")
    def test_day_start_4_today_case_before_start(self, mock_datetime):
        # Case 4: 4:00 start, date_str=None (Today)
        # Current time: 02:00 (Before day start -> Should be considered yesterday's report)
        self.mock_config["system"]["day_start_hour"] = 4

        fixed_now = datetime(2024, 2, 7, 2, 0, 0).astimezone()
        mock_datetime.now.return_value = fixed_now
        mock_datetime.strptime = datetime.strptime

        start, end = get_date_range(None)

        # Should be yesterday's report (2024-02-06)
        # Start: 2024-02-06 04:00:00
        assert start.day == 6
        assert start.hour == 4

        # End: Now (2024-02-07 02:00:00)
        assert end == fixed_now


if __name__ == "__main__":
    unittest.main()
