"""
タイムライン圧縮プロセッサプラグイン

連続する類似のタイムラインアイテムを集約し、
可読性を向上させるプラグインを提供します。
"""

import logging
from typing import Any, Dict, List, Optional

from ..shared.i18n import _
from ..timeline.models import TimelineItem
from .base import ProcessorPlugin

logger = logging.getLogger(__name__)


class CompressionProcessor(ProcessorPlugin):
    """
    タイムラインの項目を圧縮・集約するプラグイン。

    同一プロジェクト内での連続したエディタ操作や、連続する会議イベントなどを
    1つの項目に統合することで、タイムラインの可読性を向上させます。
    """

    @property
    def name(self) -> str:
        return _("Timeline Aggregation")

    @property
    def description(self) -> str:
        return _("Compresses and aggregates consecutive similar timeline items.")

    def process(self, timeline: List[TimelineItem], config: Dict[str, Any]) -> List[TimelineItem]:
        logger.info(f"[Plugin] Running: {self.name}")
        if not timeline:
            return timeline

        if not timeline:
            return timeline

        meeting_apps = config.get("apps", {}).get("meetings", [])

        compressed: List[TimelineItem] = []
        current_group: Optional[Dict] = None

        for item in timeline:
            app_lower = item.get("app", "").lower()
            project = item.get("project")
            category = item.get("category")

            # Determine if this item belongs to the current group
            # Condition: Same Project AND Same Category
            if current_group and current_group.get("project") == project and current_group.get("category") == category:
                # --- MERGE ---
                current_group["duration"] += item["duration"]

                # Context accumulation (unique)
                for ctx in item.get("context", []):
                    if ctx not in current_group["context"]:
                        current_group["context"].append(ctx)

                # Metadata merging (preserve client if not already set)
                item_meta = item.get("metadata") or {}
                if item_meta:
                    curr_meta = current_group.get("metadata") or {}
                    # Preserve client assignment (first one wins)
                    if "client" not in curr_meta and "client" in item_meta:
                        curr_meta["client"] = item_meta["client"]
                    current_group["metadata"] = curr_meta

                # File extraction (Data-driven)
                f = item.get("file")
                if f:
                    current_group["_files"].add(f)

                # TODO: ミーティングを特別扱いしない、設定ファイルからappsを削除する
                is_meeting = any(m in app_lower for m in meeting_apps)
                if is_meeting:
                    # Title improvement for meetings (keep existing logic if needed or simplify)
                    cur_t, new_t = current_group["title"], item.get("title", "")

                    def is_generic(t):
                        return any(x in t.lower() for x in meeting_apps + ["waiting", "unknown"])

                    if is_generic(cur_t) and not is_generic(new_t):
                        current_group["title"] = new_t

            else:
                # --- FINALIZE OLD & START NEW ---
                if current_group:
                    self._finalize_group(current_group)
                    compressed.append(current_group)

                # Initial Title Strategy
                new_title = item.get("title", "")
                if project:
                    # Data-driven title rewriting
                    if item.get("file"):
                        # Generic project title since individual file details are in context
                        new_title = _("【{project}】(Multiple file edits)").format(project=project)
                    elif category:
                        # Generalize for any category (Browsing, Meeting, etc.)
                        new_title = _("【{project}】({category})").format(project=project, category=category)

                current_group = {
                    "timestamp": item["timestamp"],
                    "duration": item["duration"],
                    "app": item["app"],
                    "title": new_title,
                    "context": list(item.get("context", [])),
                    "category": category,
                    "project": project,
                    "metadata": dict(item.get("metadata") or {}),
                    "url": item.get("url"),
                    "file": item.get("file"),
                    "language": item.get("language"),
                    "_files": set(),
                }

                # Initial extraction for the first item
                f = item.get("file")
                if f:
                    current_group["_files"].add(f)

        if current_group:
            self._finalize_group(current_group)
            compressed.append(current_group)

        return compressed

    def _finalize_group(self, group: Dict[str, Any]):
        if "_files" in group and group["_files"]:
            files_str = ", ".join(sorted(group["_files"]))
            label = _("Edited files")
            group["context"].append(f"{label}: {files_str}")
        for k in ["_files"]:
            group.pop(k, None)
