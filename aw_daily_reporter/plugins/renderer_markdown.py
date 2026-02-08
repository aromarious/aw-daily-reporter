"""
Markdownレンダラプラグイン

アクティビティレポートをMarkdown形式で出力するプラグインを提供します。
"""

import os
from datetime import datetime
from typing import Any, Dict, List

from ..shared.constants import DEFAULT_CATEGORY
from ..shared.i18n import _
from ..shared.logging import get_logger
from ..timeline.models import TimelineItem
from .base import RendererPlugin

logger = get_logger(__name__, scope="Plugin")


class MarkdownRendererPlugin(RendererPlugin):
    """結果をMarkdown形式で標準出力に表示するプラグイン"""

    @property
    def name(self) -> str:
        return _("Markdown Renderer")

    @property
    def description(self) -> str:
        return _("Renders the activity report in Markdown format to standard output.")

    def render(
        self,
        timeline: List[TimelineItem],
        report_data: Dict[str, Any],
        config: Dict[str, Any],
    ) -> str:
        logger.debug(f"Running: {self.name}")
        output_lines = []

        def p(text: str = ""):
            output_lines.append(text)

        # 1. ヘッダー
        date_str = report_data.get("date", datetime.now().strftime("%Y-%m-%d"))
        title = _("Daily Report")
        p(f"\n==============================\n 📅 {title}: {date_str}\n==============================\n")

        # 2. タイムライン詳細
        if not os.getenv("AW_SUPPRESS_TIMELINE"):
            p(self._render_timeline(timeline))

        # 3. 稼働時間統計
        work_stats = report_data.get("work_stats", {})
        working_seconds = work_stats.get("working_seconds", 0)
        if working_seconds > 0:
            start_ts, end_ts = work_stats["start"], work_stats["end"]
            working_hours_label = _("Working Hours")
            p(
                f"\n⏰ {working_hours_label}: {start_ts.astimezone().strftime('%H:%M')} "
                f"- {end_ts.astimezone().strftime('%H:%M')}"
            )
            break_seconds = work_stats.get("break_seconds", 0)
            break_time_label = _("Break Time")
            p(f"☕ {break_time_label}: {int(break_seconds / 3600)}h {int((break_seconds % 3600) / 60)}m")

        # 4. カテゴリ別分布
        category_stats = report_data.get("category_stats", {})
        if working_seconds == 0:
            working_seconds = sum(category_stats.values())
        if working_seconds > 0:
            time_dist_label = _("Time Distribution (Base: Working Hours)")
            p(f"\n⏱️  {time_dist_label}:")
            break_cats = config.get("settings", {}).get("break_categories", [])

            # ソート: 未分類を最後に
            def sort_key(item):
                name, seconds = item
                is_uncat = name in [
                    "Uncategorized",
                    "Other",
                    "Unknown",
                    "未分類",
                    "その他",
                    "",
                ]
                return (is_uncat, -seconds)

            for cat, seconds in sorted(category_stats.items(), key=sort_key):
                if cat == "AFK" or cat in break_cats or (seconds / working_seconds) * 100 < 0.1:
                    continue
                p(
                    f"  - {cat}: {int(seconds / 3600)}h {int((seconds % 3600) / 60)}m "
                    f"({(seconds / working_seconds) * 100:.1f}%)"
                )

            # 5. プロジェクト別分布
            project_stats = report_data.get("project_stats", {})
            proj_dist_label = _("Project Distribution")
            p(f"\n📂  {proj_dist_label}:")
            for proj, seconds in sorted(project_stats.items(), key=sort_key):
                if seconds <= 0:
                    continue
                p(
                    f"  - {proj}: {int(seconds / 3600)}h {int((seconds % 3600) / 60)}m "
                    f"({(seconds / working_seconds) * 100:.1f}%)"
                )
            p("")

        # 6. スキャナサマリー
        scan_summary = report_data.get("scan_summary", [])
        for summary in scan_summary:
            p(summary)

        return "\n".join(output_lines)

    def _render_timeline(self, timeline: List[TimelineItem]) -> str:
        """
        タイムラインデータをAI分析用のコンパクトなMarkdownログ形式に整形します。
        """
        header = _("Detailed Activity Log")
        lines = [f"# {header}"]

        for item in timeline:
            ts = item.timestamp.astimezone().strftime("%H:%M:%S")
            duration = int(item.duration)
            category = item.category or DEFAULT_CATEGORY

            # Git イベントなどは duration が短くても表示する
            if duration < 5 and category != "Git":
                continue

            app = item.app
            title = item.title
            project = item.project

            context_list = set(item.context)
            if project:
                context_list.add(f"Project: {project}")
            context = ", ".join(context_list)

            # Simple icon mapping
            icon = "📝 "
            if category == "Git":
                icon = "🌱 "
            elif project:
                icon = "🚀 "
            elif category == "ミーティング":
                icon = "📹 "
            elif "Job" in category:
                icon = "💼 "
            elif "コーディング" in category:
                icon = "💻 "
            elif "Media" in category:
                icon = "📺 "
            elif "コミュニケーション" in category:
                icon = "💬 "
            elif "ブラウジング" in category:
                icon = "🌐 "
            elif "AFK" in category:
                icon = "💤 "

            line = f"- {ts} ({duration}s) | {icon}[{category}] | {app} | {title}"
            if context:
                line += f" | Context: {context}"

            lines.append(line)

        return "\n".join(lines)
