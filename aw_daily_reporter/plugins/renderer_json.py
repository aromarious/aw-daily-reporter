"""
JSONレンダラプラグイン

アクティビティレポートをJSON形式で出力するプラグインを提供します。
"""

import json
from datetime import datetime
from typing import Any, Dict, List

from ..shared.i18n import _
from ..shared.logging import get_logger
from ..timeline.models import TimelineItem
from .base import RendererPlugin

logger = get_logger(__name__, scope="Plugin")


class JSONRendererPlugin(RendererPlugin):
    """結果をJSON形式で標準出力に表示するプラグイン"""

    @property
    def name(self) -> str:
        return "JSON Renderer"

    @property
    def description(self) -> str:
        return _("Renders the activity report in JSON format.")

    def render(
        self,
        timeline: List[TimelineItem],
        report_data: Dict[str, Any],
        config: Dict[str, Any],
    ) -> str:
        logger.debug(f"Running: {self.name}")

        # Combine data into a structured object
        output_data = {
            "meta": {
                "generated_at": datetime.now().isoformat(),
                "date": report_data.get("date"),
                "renderer": self.plugin_id,
            },
            "stats": {
                "work": report_data.get("work_stats"),
                "categories": report_data.get("category_stats"),
                "projects": report_data.get("project_stats"),
                "clients": report_data.get("client_stats"),
            },
            "timeline": timeline,
            "scan_summary": report_data.get("scan_summary"),
        }

        class DateTimeEncoder(json.JSONEncoder):
            def default(self, o):
                if isinstance(o, datetime):
                    return o.isoformat()
                return super().default(o)

        return json.dumps(output_data, cls=DateTimeEncoder, ensure_ascii=False, indent=2)
