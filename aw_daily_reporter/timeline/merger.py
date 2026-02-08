"""
タイムラインマージモジュール

複数のデータソース（Window、VSCode、Web、AFK）からのイベントを
統合されたタイムラインに変換する機能を提供します。
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, List, Tuple

import pandas as pd
from aw_core import Event

from ..shared.constants import UNKNOWN_APP
from .models import TimelineItem

NO_TITLE = "No Title"

logger = logging.getLogger(__name__)


def events_to_df(events: List[Event]) -> pd.DataFrame:
    """
    ActivityWatchのイベントリストをPandas DataFrameに変換します。
    """
    if not events:
        return pd.DataFrame(
            columns=[
                "timestamp",
                "duration",
                "end",
                "app",
                "title",
                "url",
                "status",
                "file",
                "language",
                "project",
            ]
        )

    data: List[Dict[str, Any]] = []
    for e in events:
        # e.data is already a dict, but we want to flatten it
        row = {
            "timestamp": e.timestamp,
            "duration": e.duration,
            "end": e.timestamp + e.duration,
        }
        if e.data:
            row.update(e.data)
        data.append(row)

    df = pd.DataFrame(data)
    if not df.empty:
        df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
        df["end"] = pd.to_datetime(df["end"], utc=True)
        df.sort_values("timestamp", inplace=True)

        # Enforce column order (time-series friendly)
        base_cols = ["timestamp", "duration", "end", "app", "title"]
        ordered_cols = [c for c in base_cols if c in df.columns] + [c for c in df.columns if c not in base_cols]
        df = df[ordered_cols]

    return df


class TimelineMerger:
    def __init__(self, clean_url_func: Callable[[str], str]):
        self.clean_url = clean_url_func
        self.debug_snapshots: List[Dict[str, Any]] = []

    def _safe_val(self, val):
        return val if pd.notna(val) else None

    def _get_local_tz(self) -> timezone:
        return datetime.now().astimezone().tzinfo

    def _df_to_items(self, df: pd.DataFrame, source_name: str, use_category: bool = False) -> List[TimelineItem]:
        items: List[TimelineItem] = []
        if df.empty:
            return items
        for _, row in df.iterrows():
            # timestamp might be string or datetime depending on pandas version/ops
            ts = row["timestamp"]
            if not isinstance(ts, datetime):
                ts = pd.to_datetime(ts).to_pydatetime()
            elif isinstance(ts, pd.Timestamp):
                ts = ts.to_pydatetime()

            # context generation
            val_dur = row["duration"]
            if hasattr(val_dur, "total_seconds"):
                val_dur = val_dur.total_seconds()

            title = str(row.get("title", ""))
            if not title and "status" in row:
                title = str(row.get("status"))
            if not title:
                title = NO_TITLE

            items.append(
                {
                    "timestamp": ts,
                    "duration": float(val_dur),
                    "app": str(row.get("app", UNKNOWN_APP)),
                    "title": title,
                    "url": self._safe_val(row.get("url")),
                    "file": self._safe_val(row.get("file")),
                    "language": self._safe_val(row.get("language")),
                    "status": self._safe_val(row.get("status")),
                    "category": f"Source: {source_name}" if use_category else None,
                    "source": source_name,
                    "project": self._safe_val(row.get("project")),
                    "context": [],
                }
            )
        return items

    def _filter_and_clip_by_segments(
        self, df: pd.DataFrame, segments: List[Tuple[pd.Timestamp, pd.Timestamp]]
    ) -> pd.DataFrame:
        if df.empty or not segments:
            return pd.DataFrame(columns=df.columns)

        clipped_list: List[pd.DataFrame] = []
        for seg_start, seg_end in segments:
            # Ensure segments are also UTC for comparison if they aren't
            s_start = seg_start if seg_start.tzinfo else seg_start.replace(tzinfo=timezone.utc)
            s_end = seg_end if seg_end.tzinfo else seg_end.replace(tzinfo=timezone.utc)

            mask = (df["timestamp"] < s_end) & (df["end"] > s_start)
            subset = df.loc[mask].copy()
            if subset.empty:
                continue
            subset["timestamp"] = subset["timestamp"].apply(lambda x, s=s_start: max(x, s))
            subset["end"] = subset["end"].apply(lambda x, e=s_end: min(x, e))
            subset["duration"] = (subset["end"] - subset["timestamp"]).dt.total_seconds()
            subset = subset[subset["duration"] > 0]
            clipped_list.append(subset)

        if not clipped_list:
            return pd.DataFrame(columns=df.columns)
        return pd.concat(clipped_list).sort_values("timestamp").reset_index(drop=True)

    """
    Merges the timeline events into a list of TimelineItem objects.
    Args:
        events_map: A dictionary of event lists, where the keys are the event types and the values are the event lists.
    
    Returns:
        A tuple containing the merged timeline items, the merged segments, and the active projects.
    """
    # ... (imports and previous methods remain same)

    def merge_timeline(
        self, events_map: Dict[str, List[Event]], end_time: datetime = None
    ) -> Tuple[List[TimelineItem], List[Tuple[pd.Timestamp, pd.Timestamp]], set[str]]:
        self.debug_snapshots = []

        # 1. Convert to DF
        df_window = events_to_df(events_map.get("window", []))
        df_afk = events_to_df(events_map.get("afk", []))
        df_vscode = events_to_df(events_map.get("vscode", []))

        web_list = []
        for key, events in events_map.items():
            if key.startswith("aw-watcher-web"):
                web_list.extend(events)
        df_web = events_to_df(web_list)

        # 2. Snapshot
        self._create_raw_snapshot(df_window, df_vscode, df_web, df_afk)

        # Flood Fill VSCode events
        if not df_vscode.empty:
            df_vscode = self._flood_fill_gap(df_vscode, end_time)
            self._create_raw_snapshot(df_window, df_vscode, df_web, df_afk, name="Raw Data Sources (Filled)")

        # --- OPTIMIZATION START ---
        # Prepare IntervalIndex for fast lookup
        # We assume strict overlap logic, but pd.Interval is typically closed on one side.
        # We use closed='both' to catch any overlap, then filter if needed, but overlap check is robust.
        if not df_vscode.empty:
            df_vscode = df_vscode.copy()
            # Ensure timestamps are strictly increasing/valid for IntervalIndex? No, just valid intervals.
            # Convert to local/naive might be safer if mixing TZ, but everything implies UTC/aware.
            # Using arrays directly.
            # Note: IntervalIndex requires matching TZ.
            try:
                df_vscode.index = pd.IntervalIndex.from_arrays(df_vscode["timestamp"], df_vscode["end"], closed="both")
            except Exception as e:
                logger.warning(f"Failed to create VSCode IntervalIndex: {e}")

        if not df_web.empty:
            df_web = df_web.copy()
            try:
                df_web.index = pd.IntervalIndex.from_arrays(df_web["timestamp"], df_web["end"], closed="both")
            except Exception as e:
                logger.warning(f"Failed to create Web IntervalIndex: {e}")
        # --- OPTIMIZATION END ---

        # 3. Main Merge Loop
        timeline: List[TimelineItem] = []
        active_projects = set()

        if not df_window.empty:
            # Pre-calculate common strings to avoid str() calls in loop
            # However, iterrows is slow. For 2500 items it's "okay" (approx 0.1-0.3s),
            # but usually tuple processing is faster.
            # Optimization: Use itertuples()
            for row in df_window.itertuples(index=False):
                # row is a namedtuple. Access by attribute (column name)
                # We need to ensure columns exist. events_to_df guarantees specific columns.

                # itertuples yields timestamp as Pandas Timestamp, convert to pydatetime
                curr_start = row.timestamp.to_pydatetime()
                curr_end = row.end.to_pydatetime()

                # Check for app/title. safe getattr
                app_name = str(getattr(row, "app", "")).lower()
                str(getattr(row, "title", "")).lower()

                base_item: TimelineItem = {
                    "timestamp": curr_start,
                    "duration": 0.0,
                    "app": getattr(row, "app", UNKNOWN_APP),
                    "title": getattr(row, "title", NO_TITLE),
                    "context": [],
                    "category": None,
                    "source": "Window",
                    "project": None,
                    "url": None,
                    "file": None,
                    "language": None,
                    "status": None,
                }

                # Find Overlays
                overlays = self._find_overlays(
                    curr_start,
                    curr_end,
                    app_name,
                    getattr(row, "title", ""),
                    df_vscode,
                    df_web,
                )

                # Create Segments
                segments, projs = self._create_segments(curr_start, curr_end, base_item, overlays)
                timeline.extend(segments)
                active_projects.update(projs)

        # 4. Add AFK
        if not df_afk.empty:
            timeline.extend(self._df_to_items(df_afk, "AFK"))

        timeline.sort(key=lambda x: x["timestamp"])
        return timeline, [], active_projects

    def _create_raw_snapshot(self, df_window, df_vscode, df_web, df_afk, name="Raw Data Sources"):
        snapshot_raw = []
        snapshot_raw.extend(self._df_to_items(df_window, "Window", use_category=True))
        snapshot_raw.extend(self._df_to_items(df_vscode, "VSCode", use_category=True))
        snapshot_raw.extend(self._df_to_items(df_web, "Web", use_category=True))
        snapshot_raw.extend(self._df_to_items(df_afk, "AFK", use_category=True))
        snapshot_raw.sort(key=lambda x: x["timestamp"])
        self.debug_snapshots.append({"name": name, "timeline": snapshot_raw, "plugin": "Data Sources"})

    def _flood_fill_gap(self, df: pd.DataFrame, end_time: datetime = None) -> pd.DataFrame:
        """
        Extend each event's end time to the start time of the next event.
        Assumes that 'no event' means 'still working on the previous file'.
        """
        if df.empty:
            return df

        df = df.sort_values("timestamp").copy()

        # Shift timestamps back to fill 'end' of previous event
        # The next event's start time becomes this event's end time
        next_starts = df["timestamp"].shift(-1)

        # Fill the 'end' column with next_starts.
        # For the last event (where next_starts is NaT), extend to end_time if provided.
        if end_time:
            # Ensure end_time is clamped to now if it's in the future
            # (to prevent "future" usage visualization)
            now = datetime.now(end_time.tzinfo)
            # Basic clamping: if end_time is clearly in the future relative to now
            actual_end = end_time
            if end_time > now:
                actual_end = now

            fill_val = pd.Timestamp(actual_end)
            df["end"] = next_starts.fillna(fill_val)
        else:
            df["end"] = next_starts.fillna(df["end"])

        # Recalculate duration because _df_to_items uses 'duration', not 'end'
        df["duration"] = df["end"] - df["timestamp"]

        return df

    def _find_overlays(
        self,
        start: datetime,
        end: datetime,
        app_name: str,
        window_title: str,
        df_vscode: pd.DataFrame,
        df_web: pd.DataFrame,
    ) -> List[Dict]:
        overlays: List[Dict] = []

        # Helper params
        target_iv = pd.Interval(pd.Timestamp(start), pd.Timestamp(end), closed="both")

        # VSCode
        if any(x in app_name for x in ["code", "cursor", "antigravity", "windsurf"]):
            if not df_vscode.empty and isinstance(df_vscode.index, pd.IntervalIndex):
                # Fast Lookup
                try:
                    # overlaps returns boolean mask
                    mask = df_vscode.index.overlaps(target_iv)
                    # To be strict about original logic (t < end and e > start), overlaps(closed=both) is fine.
                    # But verifying strict inequality if needed.
                    # Generally IntervalIndex overlap is what we want.
                    if mask.any():
                        matched = df_vscode.loc[mask]
                        for _, v_row in matched.iterrows():
                            overlays.append(
                                {
                                    "type": "vscode",
                                    "start": v_row["timestamp"].to_pydatetime(),
                                    "end": v_row["end"].to_pydatetime(),
                                    "data": v_row,
                                }
                            )
                except KeyError:
                    pass  # Should not happen with boolean mask
            elif not df_vscode.empty:
                # Fallback to old slow logic if index creation failed
                mask = (df_vscode["timestamp"] < end) & (df_vscode["end"] > start)
                for _, v_row in df_vscode.loc[mask].iterrows():
                    overlays.append(
                        {
                            "type": "vscode",
                            "start": v_row["timestamp"].to_pydatetime(),
                            "end": v_row["end"].to_pydatetime(),
                            "data": v_row,
                        }
                    )

        # Web
        if any(b in app_name for b in ["chrome", "safari", "arc", "firefox", "edge", "browser"]):
            matched_web = pd.DataFrame()

            if not df_web.empty and isinstance(df_web.index, pd.IntervalIndex):
                try:
                    mask = df_web.index.overlaps(target_iv)
                    if mask.any():
                        matched_web = df_web.loc[mask]
                except KeyError:
                    pass
            elif not df_web.empty:
                mask = (df_web["timestamp"] < end) & (df_web["end"] > start)
                matched_web = df_web.loc[mask]

            # Heuristic (Fallback search - this is still slow but triggered rarely?)
            if matched_web.empty and window_title and not df_web.empty:
                s_start = start - timedelta(minutes=2)
                s_end = end + timedelta(minutes=2)

                # Range query on index if possible, otherwise slow fallback
                if isinstance(df_web.index, pd.IntervalIndex):
                    # IntervalIndex doesn't support simple range slice on values easily for "timestamp" column
                    # But we can query overlaps with the wide interval
                    wide_iv = pd.Interval(pd.Timestamp(s_start), pd.Timestamp(s_end), closed="both")
                    mask_wide = df_web.index.overlaps(wide_iv)
                    candidates = df_web.loc[mask_wide]
                else:
                    candidates = df_web[(df_web["timestamp"] >= s_start) & (df_web["timestamp"] <= s_end)]

                for _, c_row in candidates.iterrows():
                    web_t = str(c_row.get("title", ""))
                    if web_t and len(web_t) > 2 and web_t in str(window_title):
                        # If we find one, wrap it as DF
                        # construct safe single-row DF
                        matched_web = c_row.to_frame().T
                        break
                        break

            for _, w_row in matched_web.iterrows():
                overlays.append(
                    {
                        "type": "web",
                        "start": w_row["timestamp"].to_pydatetime(),
                        "end": w_row["end"].to_pydatetime(),
                        "data": w_row,
                    }
                )
        return overlays

    def _create_segments(
        self,
        start: datetime,
        end: datetime,
        base_item: TimelineItem,
        overlays: List[Dict],
    ) -> Tuple[List[TimelineItem], set[str]]:
        split_points = {start, end}
        for ov in overlays:
            s = max(start, ov["start"])
            e = min(end, ov["end"])
            if s < e:
                split_points.add(s)
                split_points.add(e)

        sorted_points = sorted(split_points)
        segments = []
        active_projects = set()

        for i in range(len(sorted_points) - 1):
            seg_start = sorted_points[i]
            seg_end = sorted_points[i + 1]
            seg_mid = seg_start + (seg_end - seg_start) / 2

            active_ovs = [ov for ov in overlays if ov["start"] <= seg_mid <= ov["end"]]

            item = base_item.copy()
            item["timestamp"] = seg_start
            item["duration"] = (seg_end - seg_start).total_seconds()
            item["context"] = []

            if item["duration"] < 0.1:
                continue

            for ov in active_ovs:
                data = ov["data"]
                if ov["type"] == "vscode":
                    item["context"].append(f"[VSCode] {data.get('file')} ({data.get('language')})")
                    if data.get("file"):
                        item["file"] = data.get("file")
                    if pd.notna(data.get("language")):
                        item["language"] = data.get("language")
                    proj = data.get("project")
                    if pd.notna(proj) and proj:
                        item["project"] = proj
                        item["context"].append(f"Project: {proj}")
                        active_projects.add(proj)
                elif ov["type"] == "web":
                    url = data.get("url")
                    if url:
                        cleaned_url = self.clean_url(url)
                        item["url"] = cleaned_url
                        item["context"].append(f"URL: {cleaned_url} ({data.get('title')})")
            segments.append(item)

        return segments, active_projects
