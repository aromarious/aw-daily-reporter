"""
AFK処理プロセッサプラグイン

ActivityWatchのAFK（離席）イベントを処理し、
ユーザーがアクティブだった期間のみを抽出するプラグインを提供します。
"""

import logging
from typing import Any, Dict, List, Tuple

import pandas as pd

from ..shared.i18n import _
from ..timeline.models import TimelineItem
from .base import ProcessorPlugin

logger = logging.getLogger(__name__)


class AFKProcessor(ProcessorPlugin):
    """
    AFK（離席）処理を行うプロセッサプラグイン。

    入力: merger.pyで作成されたタイムラインイベント
        （Windowイベントを軸にVSCodeとWebをマージしたタイムライン＋AFK watcherイベント）
    出力: AFK期間を除去した、アクティブなイベントのみのタイムライン

    処理フロー:
    1. タイムラインをAFKイベントと非AFKイベントに分離
    2. AFKイベントから連続したAFK期間を特定
    3. 非AFKイベントからAFK期間と重なる部分を除去
    """

    # AFK判定に使用する定数
    SYSTEM_APPS = frozenset({"loginwindow", "lockscreen", "screensaverengine"})

    @property
    def name(self) -> str:
        return _("AFK Processing")

    @property
    def description(self) -> str:
        return _("Filters and processes AFK items to determine active time.")

    def process(self, timeline: List[TimelineItem], config: Dict[str, Any]) -> List[TimelineItem]:
        logger.info(f"[Plugin] Running: {self.name}")
        if not timeline:
            return []

        # Get system apps from config or use default
        system_apps = set(self.SYSTEM_APPS)
        configured_apps = config.get("settings", {}).get("afk_system_apps", [])
        if configured_apps:
            system_apps = {a.lower() for a in configured_apps}

        # ========================================
        # Step 1: DataFrameへ変換と前処理
        # ========================================
        df = pd.DataFrame(timeline)
        if df.empty:
            return []

        logger.info(f"[AFK] Input: {len(timeline)} items")

        # タイムスタンプの型変換
        if not pd.api.types.is_datetime64_any_dtype(df["timestamp"]):
            df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

        # end列の確保
        if "end" not in df.columns:
            if "duration" in df.columns:
                df["end"] = df["timestamp"] + pd.to_timedelta(df["duration"], unit="s")
            else:
                df["end"] = df["timestamp"]

        if not pd.api.types.is_datetime64_any_dtype(df["end"]):
            df["end"] = pd.to_datetime(df["end"], utc=True)

        # ========================================
        # Step 2: タイムラインをAFKと非AFKに分離
        # ========================================

        # Sourceが "AFK" (aw-watcher-afk 由来) かどうか
        is_from_afk_source: pd.Series[bool] = pd.Series([False] * len(df), index=df.index)
        if "source" in df.columns:
            is_from_afk_source = df["source"] == "AFK"

        # Source=AFK で status=not-afk の場合は「ユーザーがアクティブ」と判定
        is_status_not_afk: pd.Series[bool] = pd.Series([False] * len(df), index=df.index)
        if "status" in df.columns:
            is_status_not_afk = df["status"] == "not-afk"
        is_active_from_afk_source: pd.Series[bool] = is_from_afk_source & is_status_not_afk

        # df_active: AFKソース由来のイベントを除外（app 情報がないため）
        df_active: pd.DataFrame = df[~is_from_afk_source].copy()

        # ========================================
        # Step 3: タイムラインの再構成
        # ========================================
        df_active = df_active.sort_values("timestamp")

        # Flatten active timeline: Overlaps are resolved by trimming the start of the later event
        if not df_active.empty:
            flat_items = []
            last_end = None

            for _, row in df_active.iterrows():
                start = row["timestamp"]
                end = row["end"]

                # If start is earlier than the end of the previous item, push it forward
                if last_end and start < last_end:
                    start = last_end

                # Add only if there is remaining duration
                if start < end:
                    active_row_dict = row.to_dict()
                    active_row_dict["timestamp"] = start
                    active_row_dict["duration"] = (end - start).total_seconds()
                    active_row_dict["end"] = end
                    flat_items.append(active_row_dict)
                    last_end = end

            df_active = pd.DataFrame(flat_items)

        # not-afk イベントからアクティブ範囲を作成
        df_not_afk_events = df[is_active_from_afk_source].copy()
        active_ranges: List[Tuple[pd.Timestamp, pd.Timestamp]] = []

        if not df_not_afk_events.empty:
            df_not_afk_events = df_not_afk_events.sort_values("timestamp")
            for _, row in df_not_afk_events.iterrows():
                start = row["timestamp"]
                end = row["end"]
                if active_ranges and start <= active_ranges[-1][1]:
                    active_ranges[-1] = (
                        active_ranges[-1][0],
                        max(active_ranges[-1][1], end),
                    )
                else:
                    active_ranges.append((start, end))
            logger.info(f"[AFK] Found {len(active_ranges)} active (not-afk) ranges")
        else:
            # not-afk イベントがない場合は、全てのイベントを残す（フォールバック）
            logger.info("[AFK] No not-afk events found, keeping all events")
            if not df_active.empty:
                active_ranges = [(df_active["timestamp"].min(), df_active["end"].max())]

        # 分割点を収集（全てpd.Timestampで統一）
        split_points = set()
        for _, row in df_active.iterrows():
            split_points.add(row["timestamp"])
            split_points.add(row["end"])

        for start, end in active_ranges:
            split_points.add(start)
            split_points.add(end)

        sorted_points = sorted(split_points)

        active_list = []
        for _, row in df_active.iterrows():
            active_row_dict = row.to_dict()
            # NaN処理
            for k, v in list(active_row_dict.items()):
                if isinstance(v, (list, tuple, dict)):
                    continue
                if pd.isna(v):
                    active_row_dict[k] = None
            active_list.append(active_row_dict)

        # アクティブ範囲内かチェックするヘルパー関数
        def is_in_active(t: pd.Timestamp) -> bool:
            return any(s <= t < e for s, e in active_ranges)

        # セグメントごとに処理
        final_items: List[Dict] = []

        for i in range(len(sorted_points) - 1):
            seg_start = sorted_points[i]
            seg_end = sorted_points[i + 1]
            seg_mid = seg_start + (seg_end - seg_start) / 2
            dur = (seg_end - seg_start).total_seconds()

            if dur < 0.1:
                continue

            # アクティブ範囲外ならスキップ（not-afk と重ならないイベントは除外）
            if not is_in_active(seg_mid):
                continue

            # Activeイベントを検索（重なっているもの全てを取得）
            for act in active_list:
                act_start = act["timestamp"]
                act_end = act["end"]
                if act_start <= seg_mid < act_end:
                    new_item = act.copy()
                    new_item["timestamp"] = seg_start
                    new_item["duration"] = dur
                    if "end" in new_item:
                        del new_item["end"]
                    final_items.append(new_item)

        # ========================================
        # Step 5: 最終クリーンアップ
        # ========================================
        valid_items = []
        system_app_count = 0
        for active_row_dict in final_items:
            # システムアプリ（loginwindowなど）のイベントを除外
            app_name = str(active_row_dict.get("app", "")).lower()
            if app_name in system_apps:
                system_app_count += 1
                continue

            # pd.Timestamp -> datetime
            if hasattr(active_row_dict["timestamp"], "to_pydatetime"):
                active_row_dict["timestamp"] = active_row_dict["timestamp"].to_pydatetime()

            if "end" in active_row_dict:
                del active_row_dict["end"]

            for key in [
                "project",
                "file",
                "language",
                "url",
                "title",
                "status",
                "category",
            ]:
                if key in active_row_dict and pd.isna(active_row_dict[key]):
                    active_row_dict[key] = None

            valid_items.append(active_row_dict)

        if system_app_count > 0:
            logger.info(f"[AFK] Filtered out {system_app_count} system app events")

        logger.info(f"[AFK] Output: {len(valid_items)} items")
        return valid_items
