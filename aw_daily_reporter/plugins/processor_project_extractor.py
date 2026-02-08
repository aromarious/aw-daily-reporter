"""
プロジェクト抽出プロセッサプラグイン

ウィンドウタイトルから正規表現を用いてプロジェクト名を抽出する
プラグインを提供します。
"""

import logging
import re
from typing import Any, Dict, List, Optional

from ..shared.i18n import _
from ..timeline.models import TimelineItem
from .base import ProcessorPlugin

logger = logging.getLogger(__name__)


class ProjectExtractionProcessor(ProcessorPlugin):
    """
    タイトルから正規表現を用いてプロジェクト名を抽出するプラグイン。
    エディタアプリのみを対象とし、プロジェクトマッピングの前に実行されます。
    """

    @property
    def name(self) -> str:
        return _("Project Extraction")

    @property
    def description(self) -> str:
        return _("Extracts project names from window titles using configured patterns (Editors only).")

    def process(self, timeline: List[TimelineItem], config: Dict[str, Any]) -> List[TimelineItem]:
        logger.info(f"[Plugin] Running: {self.name}")

        editor_apps = config.get("apps", {}).get("editors", [])
        if not editor_apps:
            return timeline

        extraction_patterns = config.get("settings", {}).get("project_extraction_patterns", [])
        if not extraction_patterns:
            # Fallback default if not in config? Use generic pipe pattern as a safe default
            extraction_patterns = [r"^(?P<project>.+?)\|"]

        for item in timeline:
            # Skip if project is already set (e.g. by source)
            if item.get("project"):
                continue

            app_lower = item.get("app", "").lower()
            is_editor = any(e in app_lower for e in editor_apps)

            if is_editor:
                project = self._extract_project_from_title(item.get("title", ""), extraction_patterns)
                if project:
                    item["project"] = project

        return timeline

    def _extract_project_from_title(self, title: str, patterns: List[str]) -> Optional[str]:
        for pattern in patterns:
            try:
                match = re.search(pattern, title)
                if match:
                    return match.group("project")
            except (re.error, IndexError):
                continue
        return None
