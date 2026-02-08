"""
date_utils モジュールのユニットテスト
"""

import unittest
from datetime import datetime, timedelta

import pytest
from aw_daily_reporter.shared.date_utils import get_date_range


class TestGetDateRange(unittest.TestCase):
    """get_date_range 関数のテストケース"""

    def test_with_valid_date_string(self):
        """有効な日付文字列で開始・終了時刻を返す"""
        start, end = get_date_range("2025-01-15")
        assert start.year == 2025
        assert start.month == 1
        assert start.day == 15
        assert start.hour == 0
        assert start.minute == 0
        # 終了時刻は翌日の直前
        assert end.day == 15
        assert end.hour == 23
        assert end.minute == 59

    def test_with_offset(self):
        """オフセット付きで開始時刻が調整される"""
        start, end = get_date_range("2025-01-15", offset="04:00")
        assert start.hour == 4
        assert start.minute == 0
        # 終了は翌日04:00の直前 = 翌日03:59:59
        assert end.day == 16
        assert end.hour == 3
        assert end.minute == 59

    def test_with_minute_offset(self):
        """分単位のオフセットも正しく適用される"""
        start, end = get_date_range("2025-01-15", offset="04:30")
        assert start.hour == 4
        assert start.minute == 30

    def test_invalid_offset_defaults_to_zero(self):
        """無効なオフセットはデフォルト00:00にフォールバック"""
        start, end = get_date_range("2025-01-15", offset="invalid")
        assert start.hour == 0
        assert start.minute == 0

    def test_partial_offset_defaults_to_zero(self):
        """不完全なオフセットはデフォルト00:00にフォールバック"""
        start, end = get_date_range("2025-01-15", offset="04")
        assert start.hour == 0
        assert start.minute == 0

    def test_invalid_date_format_raises_error(self):
        """無効な日付形式はValueErrorを発生"""
        """無効な日付形式はValueErrorを発生"""
        with pytest.raises(ValueError, match="Invalid date format"):
            get_date_range("2025/01/15")

    def test_none_date_returns_today(self):
        """日付がNoneなら今日の範囲を返す"""
        start, end = get_date_range(None)
        now = datetime.now().astimezone()
        # 終了時刻は現在時刻に近い
        # 終了時刻は現在時刻に近い
        assert end.timestamp() == pytest.approx(now.timestamp(), abs=2)

    def test_none_date_returns_start_before_now(self):
        """日付がNoneなら開始時刻は現在時刻より前"""
        start, end = get_date_range(None, offset="00:00")
        now = datetime.now().astimezone()
        assert start <= now
        assert end <= now
        assert start >= now - timedelta(days=1, hours=1)

    def test_timezone_is_preserved(self):
        """タイムゾーン情報が保持される"""
        start, end = get_date_range("2025-01-15")
        assert start.tzinfo is not None
        assert end.tzinfo is not None

    def test_end_is_after_start(self):
        """終了時刻は開始時刻より後"""
        start, end = get_date_range("2025-01-15")
        assert end > start

    def test_range_is_approximately_24_hours(self):
        """範囲は約24時間"""
        start, end = get_date_range("2025-01-15")
        diff = end - start
        # 24時間 - 1マイクロ秒
        # 24時間 - 1マイクロ秒
        assert diff.total_seconds() == pytest.approx(86400 - 0.000001, abs=0.5)


if __name__ == "__main__":
    unittest.main()
