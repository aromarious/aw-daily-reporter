"""
タイムライン統計計算モジュール

タイムラインデータからカテゴリ別の時間や作業時間統計を
計算するクラスを提供します。
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple

import pandas as pd

from ..shared.constants import DEFAULT_CATEGORY
from .models import CategoryRule, TimelineItem, WorkStats


class TimelineStatsCalculator:
    """以前のロジック（主に統計計算）を維持するための互換性クラス。加工はプラグインへ移行。"""

    def __init__(self):
        pass

    def calculate_category_stats(self, timeline: List[TimelineItem], rules: List[CategoryRule]) -> Dict[str, float]:
        """タイムラインアイテムからカテゴリ別の合計時間を計算します。"""
        stats: Dict[str, float] = {}
        for item in timeline:
            cat = item.category or DEFAULT_CATEGORY
            stats[cat] = stats.get(cat, 0.0) + item.duration
        return stats

    def analyze_working_hours(
        self,
        timeline: List[TimelineItem],
        merged_segments: List[Tuple[pd.Timestamp, pd.Timestamp]],
        config: Dict[str, Any],
    ) -> WorkStats:
        # 1. Determine Start/End of the reporting period
        if not timeline:
            now = datetime.now().astimezone()
            return {
                "start": now,
                "end": now,
                "working_seconds": 0.0,
                "break_seconds": 0.0,
                "afk_seconds": 0.0,
            }

        start = min(item.timestamp for item in timeline)
        end = max(item.timestamp + timedelta(seconds=item.duration) for item in timeline)
        total_span = (end - start).total_seconds()

        break_categories = config.get("settings", {}).get("break_categories", [])

        # 2. Filter out explicit AFK events to        # "Active Time" (events that are NOT AFK)
        # Note: Some active events might have category="AFK"
        # (though category might not be assigned yet depending on flow)
        # Assuming merger puts source="AFK"
        active_items = [item for item in timeline if item.source != "AFK" and item.app != "afk"]

        # 3. Calculate merged duration of active items (Active Duration)
        # Sort by start time
        active_items.sort(key=lambda x: x.timestamp)

        merged_duration = 0.0
        if active_items:
            # Merge intervals
            curr_start = active_items[0].timestamp
            curr_end = curr_start + timedelta(seconds=active_items[0].duration)

            for item in active_items[1:]:
                next_start = item.timestamp
                next_end = next_start + timedelta(seconds=item.duration)

                if next_start < curr_end:
                    # Overlap, extend end if needed
                    curr_end = max(curr_end, next_end)
                else:
                    # No overlap, add current segment and start new
                    merged_duration += (curr_end - curr_start).total_seconds()
                    curr_start = next_start
                    curr_end = next_end

            # Add last segment
            merged_duration += (curr_end - curr_start).total_seconds()

        # 4. AFK Duration = Total Span - Active Duration (Gaps in timeline)
        afk_seconds = max(0.0, total_span - merged_duration)

        # 5. Calculate        # Exclude AFK (and optionally events that are categorized as Break)
        # Note: AFK events are usually distinct in source to be precise,
        # but active_items shouldn't overlap much in standard merger?
        # Standard merger merges everything sequential. But VSCode/Web overlays might be separate?
        # The merger logic creates non-overlapping segments for Window/VSCode/Web.
        # But let's stick to simple sum for categories as they are attributes of segments.
        # However, if we defined AFK as gaps, then Non-Work is Active Time that is Break Category.

        # Simple sum of duration for break items in active_items
        # (Assuming active_items from merger don't overlap significantly
        # or we accept double counting for stats if they do)
        # So simple sum is fine for merged timeline items.

        manual_break_seconds = sum(item.duration for item in active_items if item.category in break_categories)

        # 6. Total Break = AFK + Manual Break
        total_break_seconds = afk_seconds + manual_break_seconds

        # 7. Working Seconds = Total Span - Total Break
        working_seconds = max(0.0, total_span - total_break_seconds)

        return {
            "start": start,
            "end": end,
            "working_seconds": working_seconds,
            "break_seconds": total_break_seconds,
            "afk_seconds": afk_seconds,
        }
