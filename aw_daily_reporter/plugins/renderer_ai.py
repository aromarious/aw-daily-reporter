"""
AI向けレンダラプラグイン

LLMによる要約に最適化された、トークン効率の良い
高密度テキスト形式でアクティビティログを出力するプラグインを提供します。
"""

import logging
from datetime import datetime
from typing import Any, Dict, List

from ..shared.constants import DEFAULT_CATEGORY
from ..shared.i18n import _
from ..timeline.models import TimelineItem
from .base import RendererPlugin

logger = logging.getLogger(__name__)


class AIRendererPlugin(RendererPlugin):
    """LLMによる要約に最適化された、高密度テキスト形式で出力するレンダラ"""

    @property
    def name(self) -> str:
        return _("AI Context Renderer")

    @property
    def description(self) -> str:
        return _("Renders a token-efficient, dense text log optimized for AI summarization.")

    def render(
        self,
        timeline: List[TimelineItem],
        report_data: Dict[str, Any],
        config: Dict[str, Any],
    ) -> str:
        logger.info(f"[Plugin] Running: {self.name}")
        lines = []

        # 0. System Prompt (from Settings)
        # config layout is assumed to be { "settings": { "ai_prompt": "..." } } or flattened by manager?
        # Based on settings_manager.py, config passed here is likely the full unified config.
        # But wait, Manager calls plugin.render(..., config).
        # In manager.py: renderer.render(..., config=self.config_manager.load())
        # So config is the full dict.

        settings = config.get("settings", {})
        ai_prompt = settings.get("ai_prompt", "")
        if not ai_prompt:
            # Fallback: check root (in case of manual config edit)
            ai_prompt = config.get("ai_prompt", "")
        if ai_prompt:
            lines.append(ai_prompt)
            lines.append("")
            lines.append("---")
            lines.append("Below is the activity log:")
            lines.append("")

        # 1. 最小限のヘッダー
        date_str = report_data.get("date", datetime.now().strftime("%Y-%m-%d"))
        lines.append(f"Date: {date_str}")

        work_stats = report_data.get("work_stats", {})
        working_seconds = work_stats.get("working_seconds", 0)
        h = int(working_seconds / 3600)
        m = int((working_seconds % 3600) / 60)
        lines.append(f"Total Work: {h}h {m}m")
        lines.append("")  # Spacer

        # 2. Git Activity (Commits + PRs)
        # Extract Git items from timeline to show them in summary instead
        git_items = [item for item in timeline if item.app == "Git"]
        non_git_timeline = [item for item in timeline if item.app != "Git"]

        scan_summary = report_data.get("scan_summary", [])

        if git_items or scan_summary:
            lines.append("-- Git Activity --")
            # PRs (from scan_summary)
            if scan_summary:
                lines.extend(scan_summary)

            # Commits (from timeline)
            if git_items:
                for item in git_items:
                    # item['title'] contains "[Repo] Msg (Hash)"
                    lines.append(f"Commit: {item.title}")

            lines.append("")

        # 3. タイムライン (Time | Cat | App | Title | Dur)
        # ヘッダーはつけない（AIなら推測可能だが、一応1行つけてもいいかも。今回は省略して密度優先）

        for item in non_git_timeline:
            ts = item.timestamp.astimezone().strftime("%H:%M")
            duration_min = int(item.duration / 60)
            if duration_min < 1:
                duration_min = 1  # 1分未満は1分とする

            category = item.category or DEFAULT_CATEGORY
            app = item.app
            title = item.title

            # コンテキスト（Projectなど）があれば追加
            context_parts = []
            if item.project:
                context_parts.append(f"Proj:{item.project}")

            # AppとTitleで十分文脈が通じる場合が多いので、Projectはオプションにするか、重要度で決める
            # ここではシンプルに App | Title (Duration) とする

            line = f"{ts} | {category} | {app} | {title} | {duration_min}m"
            if context_parts:
                line += f" | {', '.join(context_parts)}"

            lines.append(line)

        lines.append("")

        # 4. 集計データ (Category) - 検証用として有用
        category_stats = report_data.get("category_stats", {})
        if working_seconds > 0:
            lines.append("-- Category Stats --")
            for cat, seconds in sorted(category_stats.items(), key=lambda x: x[1], reverse=True):
                if seconds < 60:
                    continue
                lines.append(
                    f"{cat}: {int(seconds / 3600)}h {int((seconds % 3600) / 60)}m "
                    f"({int((seconds / working_seconds) * 100)}%)"
                )
            lines.append("")

        # 5. 集計データ (Project)
        project_stats = report_data.get("project_stats", {})
        if working_seconds > 0:
            lines.append("-- Project Stats --")
            for proj, seconds in sorted(project_stats.items(), key=lambda x: x[1], reverse=True):
                if seconds < 60:
                    continue
                lines.append(
                    f"{proj}: {int(seconds / 3600)}h {int((seconds % 3600) / 60)}m "
                    f"({int((seconds / working_seconds) * 100)}%)"
                )

        return "\n".join(lines)
