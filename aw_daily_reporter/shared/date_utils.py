"""
日付ユーティリティモジュール

レポート対象となる日付範囲（開始・終了時刻）を計算するための
ユーティリティ関数を提供します。
"""

from datetime import datetime, timedelta
from typing import Tuple


def get_date_range(date_str: str = None, offset: str = "00:00") -> Tuple[datetime, datetime]:
    """
    指定された日付文字列（YYYY-MM-DD）から、その日の開始時刻と終了時刻を返します。
    date_str が None の場合は、今日の開始時刻から現在時刻までを返します。

    offset (str): "HH:MM" 形式のオフセット時刻 (デフォルト: "00:00")
    """
    try:
        hour_offset = int(offset.split(":")[0])
        minute_offset = int(offset.split(":")[1])
    except (ValueError, IndexError):
        hour_offset = 0
        minute_offset = 0

    # ローカルタイムゾーンに基づいた現在時刻
    now = datetime.now().astimezone()

    if date_str:
        try:
            # 日付をパース
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            # ローカルタイムゾーンを付与
            dt = dt.replace(tzinfo=now.tzinfo)

            # 指定日の開始時刻 (例: 2024-02-07 04:00:00)
            start = dt.replace(hour=hour_offset, minute=minute_offset, second=0, microsecond=0)

            # その「日」の終了時刻は、翌日の開始時刻の直前
            # start + 1 day - 1 microsecond
            end = start + timedelta(days=1) - timedelta(microseconds=1)

            return start, end
        except ValueError:
            raise ValueError("Invalid date format. Please use YYYY-MM-DD.") from None
    else:
        # デフォルト: 今日（現在まで）
        # 現在時刻が offset より前なら、実質的には「昨日」の扱い
        # 例: offset=04:00, now=02:00 -> 昨日の 04:00 から 今日の 02:00 まで (昨日のレポート)
        # 例: offset=04:00, now=05:00 -> 今日の 04:00 から 今日の 05:00 まで (今日のレポート)

        current_day_start = now.replace(hour=hour_offset, minute=minute_offset, second=0, microsecond=0)

        logical_date = now - timedelta(days=1) if now < current_day_start else now

        start = logical_date.replace(hour=hour_offset, minute=minute_offset, second=0, microsecond=0)
        end = now
        return start, end
