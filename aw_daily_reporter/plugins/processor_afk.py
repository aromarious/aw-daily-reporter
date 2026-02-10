"""
AFK処理プロセッサプラグイン

ActivityWatchのAFK（離席）イベントを処理し、
ユーザーがアクティブだった期間のみを抽出するプラグインを提供します。
"""

import logging
from typing import Any, Tuple

import pandas as pd
from pandera.typing import DataFrame

from ..shared.i18n import _
from .base import ProcessorPlugin
from .schemas import TimelineSchema

logger = logging.getLogger(__name__)


class AFKProcessor(ProcessorPlugin):
    """
    AFK（離席）処理を行うプロセッサプラグイン。

    入力: merger.pyで作成されたタイムラインDataFrame
        （Windowイベントを軸にVSCodeとWebをマージしたタイムライン＋AFK watcherイベント）
    出力: AFK期間を除去した、アクティブなイベントのみのタイムラインDataFrame

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

    @property
    def required_settings(self) -> list[str]:
        return ["plugins"]

    def process(self, df: DataFrame[TimelineSchema], config: dict[str, Any]) -> DataFrame[TimelineSchema]:
        logger.info(f"[Plugin] Running: {self.name}")
        if df.empty:
            return df

        # Get system apps from config or use default
        system_apps = set(self.SYSTEM_APPS)
        plugin_config = config.get("plugins", {}).get(self.plugin_id, {})
        configured_apps = plugin_config.get("afk_system_apps", [])
        if configured_apps:
            system_apps = {a.lower() for a in configured_apps}

        logger.info(f"[AFK] Input: {len(df)} items")

        # 最初に1回だけコピーを作成（以降は直接変更）
        df = df.copy()

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
        is_from_afk_source: pd.Series = pd.Series([False] * len(df), index=df.index)
        if "source" in df.columns:
            is_from_afk_source = df["source"] == "AFK"

        # Source=AFK で status=not-afk の場合は「ユーザーがアクティブ」と判定
        is_status_not_afk: pd.Series = pd.Series([False] * len(df), index=df.index)
        if "status" in df.columns:
            is_status_not_afk = df["status"] == "not-afk"
        is_active_from_afk_source: pd.Series = is_from_afk_source & is_status_not_afk

        # df_active: AFKソース由来のイベントを除外（app 情報がないため）
        # すでにdfがコピー済みなのでここはコピー不要だが、サブセットなのでコピーが必要
        df_active: pd.DataFrame = df[~is_from_afk_source].copy()

        # ========================================
        # Step 3: タイムラインの再構成
        # ========================================
        df_active = df_active.sort_values("timestamp").reset_index(drop=True)

        # Flatten active timeline: Overlaps are resolved by trimming the start of the later event
        if not df_active.empty:
            # NumPy配列で直接操作（pandas .at[]より高速）
            # datetime64[ns, UTC]型のままvaluesを取得
            timestamps = df_active["timestamp"].values.copy()
            ends = df_active["end"].values

            for i in range(1, len(timestamps)):
                if timestamps[i] < ends[i - 1]:
                    timestamps[i] = ends[i - 1]

            # タイムゾーン情報を保持したままSeriesに戻す
            df_active["timestamp"] = pd.Series(timestamps, index=df_active.index, dtype=df_active["timestamp"].dtype)
            df_active["duration"] = (df_active["end"] - df_active["timestamp"]).dt.total_seconds()
            # 有効なdurationのみ保持
            df_active = df_active[df_active["duration"] > 0]

        # not-afk イベントからアクティブ範囲を作成
        df_not_afk_events = df[is_active_from_afk_source]
        active_ranges: list[Tuple[pd.Timestamp, pd.Timestamp]] = []

        if not df_not_afk_events.empty:
            df_not_afk_events = df_not_afk_events.sort_values("timestamp")
            for row in df_not_afk_events.itertuples():
                start = row.timestamp
                end = row.end
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
        for row in df_active.itertuples():
            split_points.add(row.timestamp)
            split_points.add(row.end)

        for start, end in active_ranges:
            split_points.add(start)
            split_points.add(end)

        sorted_points = sorted(split_points)

        # アクティブ範囲をNumPy配列に変換してバイナリサーチで高速化
        import bisect

        import numpy as np

        if active_ranges:
            # active_rangesをソートして開始時刻の配列を作成（int64ナノ秒で統一）
            sorted_ranges = sorted(active_ranges, key=lambda x: x[0])
            range_starts_ns = np.array([r[0].value for r in sorted_ranges], dtype="int64")
            range_ends_ns = np.array([r[1].value for r in sorted_ranges], dtype="int64")

            def is_in_active(t: pd.Timestamp) -> bool:
                # バイナリサーチで候補範囲を特定（O(log n)）
                t_ns = t.value
                idx = bisect.bisect_right(range_starts_ns, t_ns) - 1
                return idx >= 0 and range_starts_ns[idx] <= t_ns < range_ends_ns[idx]
        else:

            def is_in_active(t: pd.Timestamp) -> bool:
                return False

        # df_activeのtimestamp/endをNumPy配列に変換（高速検索用）
        if not df_active.empty:
            # datetime64をint64（ナノ秒）に変換して比較を高速化
            # pd.Timestamp.valueはナノ秒を返すのでapplyで取得
            active_timestamps = df_active["timestamp"].apply(lambda x: x.value).values
            active_ends = df_active["end"].apply(lambda x: x.value).values
            active_rows = df_active.to_dict("records")
        else:
            active_timestamps = []
            active_ends = []
            active_rows = []

        # セグメントごとに処理
        final_rows = []

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

            # Activeイベントを検索（NumPy配列で高速検索）
            seg_mid_ns = seg_mid.value  # ナノ秒に変換
            for j, row_dict in enumerate(active_rows):
                if active_timestamps[j] <= seg_mid_ns < active_ends[j]:
                    new_row = row_dict.copy()
                    new_row["timestamp"] = seg_start
                    new_row["duration"] = dur
                    new_row.pop("end", None)
                    final_rows.append(new_row)

        # ========================================
        # Step 5: 最終クリーンアップ
        # ========================================
        if not final_rows:
            return pd.DataFrame(columns=df.columns)

        result_df = pd.DataFrame(final_rows)

        # システムアプリを除外
        if "app" in result_df.columns:
            app_lower = result_df["app"].str.lower()
            mask = ~app_lower.isin(system_apps)
            system_app_count = (~mask).sum()
            if system_app_count > 0:
                logger.info(f"[AFK] Filtered out {system_app_count} system app events")
            result_df = result_df[mask]

        # NaN値をNoneに変換（オプションフィールド用）
        optional_cols = ["project", "file", "language", "url", "title", "status", "category"]
        for col in optional_cols:
            if col in result_df.columns:
                result_df[col] = result_df[col].where(pd.notna(result_df[col]), None)

        # end列を削除（最終出力には不要）
        if "end" in result_df.columns:
            result_df = result_df.drop(columns=["end"])

        logger.info(f"[AFK] Output: {len(result_df)} items")
        return result_df
