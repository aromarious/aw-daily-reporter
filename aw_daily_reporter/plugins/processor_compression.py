"""
タイムライン圧縮プロセッサプラグイン

連続する類似のタイムラインアイテムを集約し、
可読性を向上させるプラグインを提供します。
"""

import logging
from typing import Any, Optional, Set

import pandas as pd
from pandera.typing import DataFrame

from ..shared.i18n import _
from .base import ProcessorPlugin
from .schemas import TimelineSchema

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

    @property
    def required_settings(self) -> list[str]:
        return ["apps"]

    def process(self, df: DataFrame[TimelineSchema], config: dict[str, Any]) -> DataFrame[TimelineSchema]:
        logger.info(f"[Plugin] Running: {self.name}")

        if df.empty:
            return df

        meeting_apps = config.get("apps", {}).get("meetings", [])

        compressed_rows = []
        current_group: Optional[dict] = None
        current_files: Set[str] = set()

        for row in df.itertuples():
            app_lower = str(getattr(row, "app", "")).lower()
            project = getattr(row, "project", None)
            category = getattr(row, "category", None)

            # NaN値をNoneに変換
            if pd.isna(project):
                project = None
            if pd.isna(category):
                category = None

            # Determine if this item belongs to the current group
            # Git items should never be merged to preserve individual commits
            is_git = row.app == "Git"
            if (
                not is_git
                and current_group
                and current_group.get("project") == project
                and current_group.get("category") == category
            ):
                # --- MERGE ---
                current_group["duration"] += row.duration

                # Context accumulation (unique)
                row_context = getattr(row, "context", None)
                if isinstance(row_context, list):
                    for ctx in row_context:
                        if isinstance(ctx, str) and ctx not in current_group["context"]:
                            current_group["context"].append(ctx)

                # Metadata merging (preserve client if not already set)
                row_meta = getattr(row, "metadata", None)
                if isinstance(row_meta, dict) and row_meta:
                    curr_meta = current_group.get("metadata") or {}
                    if "client" not in curr_meta and "client" in row_meta:
                        curr_meta["client"] = row_meta["client"]
                    current_group["metadata"] = curr_meta

                # File extraction
                f = getattr(row, "file", None)
                if isinstance(f, str) and f:
                    current_files.add(f)

                # Meeting title improvement
                is_meeting = any(m in app_lower for m in meeting_apps)
                if is_meeting:
                    cur_t = current_group["title"]
                    new_t = getattr(row, "title", "") or ""

                    def is_generic(t: str) -> bool:
                        return any(x in t.lower() for x in meeting_apps + ["waiting", "unknown"])

                    if is_generic(cur_t) and not is_generic(new_t):
                        current_group["title"] = new_t

            else:
                # --- FINALIZE OLD & START NEW ---
                if current_group:
                    self._finalize_group(current_group, current_files)
                    compressed_rows.append(current_group)

                # Initial Title Strategy
                new_title = getattr(row, "title", "") or ""
                if project and not is_git:
                    if getattr(row, "file", None):
                        new_title = _("【{project}】(Multiple file edits)").format(project=project)
                    elif category:
                        new_title = _("【{project}】({category})").format(project=project, category=category)

                row_context = getattr(row, "context", None)
                row_meta = getattr(row, "metadata", None)

                # contextは文字列のみ保持（NaN値を除外）
                context_list = []
                if isinstance(row_context, list):
                    context_list = [c for c in row_context if isinstance(c, str)]

                current_group = {
                    "timestamp": row.timestamp,
                    "duration": row.duration,
                    "app": row.app,
                    "title": new_title,
                    "context": context_list,
                    "category": category,
                    "project": project,
                    "metadata": dict(row_meta) if isinstance(row_meta, dict) else {},
                    "url": getattr(row, "url", None),
                    "file": getattr(row, "file", None),
                    "language": getattr(row, "language", None),
                }
                current_files = set()

                # Initial extraction for the first item
                f = getattr(row, "file", None)
                if isinstance(f, str) and f:
                    current_files.add(f)

        if current_group:
            self._finalize_group(current_group, current_files)
            compressed_rows.append(current_group)

        if not compressed_rows:
            return pd.DataFrame(columns=df.columns)

        return pd.DataFrame(compressed_rows)

    def _finalize_group(self, group: dict, files: Set[str]) -> None:
        # filesから文字列以外の値を除去（NaN等）
        valid_files = {f for f in files if isinstance(f, str) and f}
        if valid_files:
            files_str = ", ".join(sorted(valid_files))
            label = _("Edited files")
            group["context"].append(f"{label}: {files_str}")
