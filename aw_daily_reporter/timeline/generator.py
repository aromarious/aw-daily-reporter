"""
タイムライン生成モジュール

ActivityWatch のイベントデータを取得し、マージ、整形、Markdown レポートとして出力するためのクラスを提供します。
リファクタリングにより、ロジックは aw_daily_reporter.timeline パッケージに分割されました。
"""

import argparse
import json
import os
import socket
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

if sys.version_info < (3, 9):
    import importlib_resources as resources  # type: ignore
else:
    import importlib.resources as resources  # type: ignore
import pandas as pd
from aw_core import Event
from tabulate import tabulate

from ..plugins.manager import PluginManager
from ..shared import setup_logging
from ..shared.constants import DEFAULT_PROJECT, NON_BILLABLE_CLIENT
from ..shared.date_utils import get_date_range
from ..shared.i18n import _
from ..shared.logging import get_logger
from .client import AWClient
from .merger import TimelineMerger
from .models import TimelineItem, WorkStats
from .processor import TimelineStatsCalculator

logger = get_logger(__name__, scope="Timeline")


HOSTNAME = socket.gethostname()


class TimelineGenerator:
    def __init__(self, bucket_bucket_prefix: str = "aw-watcher-", hostname: str = HOSTNAME):
        self.hostname = hostname
        self.client_wrapper = AWClient("aw-daily-reporter", hostname=self.hostname)
        self.merger = TimelineMerger(self.clean_url)
        self.stats_calculator = TimelineStatsCalculator()

        # Performance logger
        self.perf_logger = get_logger(__name__ + ".perf", scope="PERF")

        self.plugin_manager = PluginManager()
        # デフォルトのプラグインを登録
        try:
            self.plugin_manager.load_builtin_plugins()
        except Exception as e:
            logger.error(f"Failed to load builtin plugins: {e}")

        self.bucket_prefix = bucket_bucket_prefix
        self.merged_segments: List[Tuple[pd.Timestamp, pd.Timestamp]] = []
        self.active_projects: set[str] = set()
        self.config: Dict[str, Any] = {}

    def run(
        self,
        start: datetime,
        end: datetime,
        suppress_timeline: bool = False,
        skip_renderers: bool = False,
        override_config: Optional[Dict[str, Any]] = None,
        capture_renderers: bool = False,
    ) -> Tuple[Dict[str, Any], List[TimelineItem], List[Dict[str, Any]], Dict[str, str]]:
        """データを取得し、加工パイプラインを実行してレポートを出力します。"""
        import time

        t_total_start = time.perf_counter()

        if suppress_timeline:
            os.environ["AW_SUPPRESS_TIMELINE"] = "1"

        logger.debug(f"Range {start} - {end}")

        # ActivityWatchから関連するバケットのイベントを取得 (events)
        t_fetch_start = time.perf_counter()
        events = self.fetch_events(start, end)
        self.perf_logger.debug(f"fetch_events took {time.perf_counter() - t_fetch_start:.3f}s")

        # タイムラインの生成：重複の排除、アクティブセグメントの算出、およびクリッピング処理 (events -> timeline)
        t_merge_start = time.perf_counter()
        timeline = self.merge_timeline(events, end)
        self.perf_logger.debug(
            f"merge_timeline took {time.perf_counter() - t_merge_start:.3f}s (items: {len(timeline)})"
        )
        logger.debug(f"Merged timeline item count: {len(timeline)}")

        # Merger段階のスナップショットを保持
        initial_snapshots = self.merger.debug_snapshots.copy()

        # 設定とルールの読み込み
        if override_config:
            self.config = override_config
        else:
            self.config = load_config()

        # 処理パイプラインの実行 (Snapshotsを収集)
        # スキャナとプロセッサを混在させた統一パイプラインで実行
        t_pipeline_start = time.perf_counter()
        timeline, snapshots, scan_summary = self.plugin_manager.run_pipeline_with_snapshots(
            timeline, start, end, self.config
        )
        self.perf_logger.debug(f"plugin_pipeline took {time.perf_counter() - t_pipeline_start:.3f}s")

        # Merger段階のスナップショットを先頭に追加
        snapshots = initial_snapshots + snapshots

        # 統計情報の計算 (レポート表示用)
        t_stats_start = time.perf_counter()
        stats = self.stats_calculator.calculate_category_stats(timeline, self.config.get("rules", []))
        self.perf_logger.debug(f"stats_calculation took {time.perf_counter() - t_stats_start:.3f}s")

        # 最終的なソート (プラグインで追加されたものを含めて時系列にする)
        timeline.sort(key=lambda x: x["timestamp"])

        # Ensure all items are within the requested time range (Clipping)
        # This prevents events starting days ago (e.g. long AFK) from inflating the total duration
        t_clip_start = time.perf_counter()
        clipped_timeline = []
        for item in timeline:
            i_start = item["timestamp"]
            # Ensure timezone awareness for comparison
            if i_start.tzinfo is None:
                i_start = i_start.replace(tzinfo=timezone.utc)

            i_duration = item["duration"]
            i_end = i_start + timedelta(seconds=i_duration)

            # Skip if completely outside
            if i_end <= start or i_start >= end:
                continue

            # Clip
            new_start = max(i_start, start)
            new_end = min(i_end, end)
            new_duration = (new_end - new_start).total_seconds()

            if new_duration > 0:
                item["timestamp"] = new_start
                item["duration"] = new_duration
                clipped_timeline.append(item)
        timeline = clipped_timeline
        self.perf_logger.debug(f"clipping took {time.perf_counter() - t_clip_start:.3f}s")

        logger.debug(f"Final timeline items: {len(timeline)}")
        if not suppress_timeline:
            self.print_timeline_debug(timeline, step_name="Step 4: Final Processing Result")

        work_stats = self.analyze_working_hours(timeline, self.config)

        # レポートデータの集約
        unclassified_items = [item for item in timeline if not item.get("project") and item.get("category") != "AFK"]
        unclassified_summary = self.get_top_unclassified(unclassified_items)

        report_data = {
            "date": start.strftime("%Y-%m-%d"),
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "category_stats": stats,
            "project_stats": self.get_project_stats(timeline),
            "client_stats": self.get_client_stats(timeline),
            "clients": self.config.get("clients", {}),  # For billing calculations
            "work_stats": work_stats,
            "scan_summary": scan_summary,
            "unclassified_summary": unclassified_summary,
        }

        renderer_outputs = {}
        # レンダラ（出力プラグイン）の実行
        if not skip_renderers or capture_renderers:
            t_render_start = time.perf_counter()
            renderer_outputs = self.plugin_manager.run_renderers(timeline, report_data, self.config)
            self.perf_logger.debug(f"renderers took {time.perf_counter() - t_render_start:.3f}s")

        self.perf_logger.debug(f"Total run took {time.perf_counter() - t_total_start:.3f}s")
        return report_data, timeline, snapshots, renderer_outputs

    def get_buckets(self) -> Dict[str, str]:
        return self.client_wrapper.get_buckets()

    def fetch_events(self, start: datetime, end: datetime) -> Dict[str, List[Event]]:
        return self.client_wrapper.fetch_events(start, end)

    def clean_url(self, url: str) -> str:
        if not url:
            return ""
        if "?" in url:
            url = url.split("?")[0]
        if len(url) > 60:
            url = url[:57] + "..."
        return url

    def _get_local_tz(self) -> timezone:
        return datetime.now().astimezone().tzinfo

    def merge_timeline(self, events_map: Dict[str, List[Event]], end_time: datetime = None) -> List[TimelineItem]:
        timeline, segments, projects = self.merger.merge_timeline(events_map, end_time)
        self.merged_segments = segments
        self.active_projects = projects
        return timeline

    def print_timeline_debug(
        self,
        timeline: List[TimelineItem],
        step_name: str = "Step 3: Merged Context (Overlay Result)",
    ) -> None:
        local_tz = self._get_local_tz()
        print(f"\n=== ✨ {step_name} ===")
        print(f"Timeline Items: {len(timeline)} events")
        debug_view = []
        for t in timeline:
            ts_str = t["timestamp"].astimezone(local_tz).strftime("%H:%M:%S")
            ctx_str = (
                "\n".join(t["context"])[:100] + "..." if len("\n".join(t["context"])) > 100 else "\n".join(t["context"])
            )
            debug_view.append(
                {
                    "time": ts_str,
                    "app": t["app"][:20],
                    "project": t.get("project") or "",
                    "title": t["title"][:40],
                    "context (overlay)": ctx_str,
                }
            )
        if debug_view:
            print(tabulate(debug_view, headers="keys", tablefmt="simple"))
        print("")

    def get_project_stats(self, timeline: List[TimelineItem]) -> Dict[str, float]:
        p_stats: Dict[str, float] = {}
        for item in timeline:
            proj = item.get("project") or DEFAULT_PROJECT
            if item.get("category") == "AFK":
                continue
            p_stats[proj] = p_stats.get(proj, 0.0) + item["duration"]
        return p_stats

    def get_client_stats(self, timeline: List[TimelineItem]) -> Dict[str, float]:
        c_stats: Dict[str, float] = {}
        clients = self.config.get("clients", {})
        for item in timeline:
            # MetadataからクライアントIDを取得
            client_id = (item.get("metadata") or {}).get("client")
            if item.get("category") == "AFK":
                continue

            # クライアントIDを名前に解決
            if client_id and client_id in clients:
                client_name = clients[client_id].get("name", client_id)
            else:
                client_name = NON_BILLABLE_CLIENT

            c_stats[client_name] = c_stats.get(client_name, 0.0) + item["duration"]
        return c_stats

    def analyze_working_hours(self, timeline: List[TimelineItem], config: Dict[str, Any]) -> WorkStats:
        return self.stats_calculator.analyze_working_hours(timeline, self.merged_segments, config)

    def get_top_unclassified(self, items: List[TimelineItem], limit: int = 5) -> List[Dict[str, Any]]:
        """Unclassifiedなアイテムの中から、時間の長いトップ項目を返します。"""
        counts: Dict[str, float] = {}
        for item in items:
            key = f"{item['app']}: {item['title'][:40]}"
            counts[key] = counts.get(key, 0.0) + item["duration"]

        sorted_keys = sorted(counts.items(), key=lambda x: x[1], reverse=True)
        return [{"key": k, "duration": d} for k, d in sorted_keys[:limit]]


def load_builtin_config(lang: str = "ja") -> Dict[str, Any]:
    try:
        from .. import data as data_pkg

        preset_file = f"presets/{lang}.json"

        # フォールバック: 指定言語がなければ英語
        if hasattr(resources, "files"):
            ref = resources.files(data_pkg).joinpath(preset_file)
            if not ref.is_file():
                ref = resources.files(data_pkg).joinpath("presets/en.json")
        else:
            # 古い Python/importlib_resources 向け（簡易実装）
            if not resources.is_resource(data_pkg, preset_file):
                preset_file = "presets/en.json"

        if hasattr(resources, "files"):
            ref = resources.files(data_pkg).joinpath(preset_file)
            with ref.open("r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            with resources.open_text(data_pkg, preset_file) as f:
                data = json.load(f)

        return {
            "rules": data.get("rules", []),
            "apps": data.get("apps", {}),
            "settings": data.get("settings", {}),
        }

    except Exception as e:
        logger.warning(f"Failed to load builtin config for lang='{lang}': {e}")
    return {"rules": [], "apps": {}, "settings": {}}


def load_config() -> Dict[str, Any]:
    """
    設定を読み込みます (SettingsManagerへ委譲)。

    config.json を読み込み、統合された設定を返します。

    Returns:
        Unified Config Dictionary
    """
    from ..shared.settings_manager import SettingsManager

    return SettingsManager.get_instance().load()


def main() -> None:
    setup_logging()
    parser = argparse.ArgumentParser(description=_("Generate daily activity report (Timeline)."))
    parser.add_argument(
        "--date",
        type=str,
        help=_("Date to generate report for (YYYY-MM-DD). Defaults to today."),
    )
    # Timeline option is not supported by main generator script directly anymore
    # but kept for CLI compatibility if needed
    args = parser.parse_args()

    try:
        start, end = get_date_range(args.date)
    except ValueError as e:
        logger.error(e)
        sys.exit(1)

    generator = TimelineGenerator()
    # Capture renderers (true) but manual print if CLI needs it?
    # run() returns (report, timeline, snapshots, renderer_outputs)
    # By default capture_renderers=False, skip_renderers=False
    # -> plugins execute and outputs might be lost unless handled
    # Wait, earlier implementing run_renderers returned strings *and* modified PluginManager.
    # PluginManager.run_renderers now returns Dict.
    # We should print them here if we want CLI output.

    unused_report, unused_timeline, unused_snapshots, outputs = generator.run(start, end, capture_renderers=True)

    # Print outputs to stdout for CLI compatibility
    # Print outputs to stdout based on default_renderer setting
    # Load config to get preference
    from ..settings_manager import SettingsManager

    config = SettingsManager.get_instance().load()
    default_renderer = config.get("settings", {}).get("default_renderer")

    if default_renderer and default_renderer in outputs:
        # If default is set and available, use it
        print(outputs[default_renderer])
    elif "aw_daily_reporter.plugins.renderer_markdown.MarkdownRendererPlugin" in outputs:
        # Fallback to Markdown
        print(outputs["aw_daily_reporter.plugins.renderer_markdown.MarkdownRendererPlugin"])
    elif outputs:
        # Fallback to first available
        print(list(outputs.values())[0])


if __name__ == "__main__":
    main()

# 互換性のためのエイリアス
load_rules = load_config
