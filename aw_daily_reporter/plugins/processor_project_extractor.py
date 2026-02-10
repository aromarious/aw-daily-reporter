"""
プロジェクト抽出プロセッサプラグイン

ウィンドウタイトルから正規表現を用いてプロジェクト名を抽出する
プラグインを提供します。
"""

import logging
import os
import re
from typing import Any, Optional

from pandera.typing import DataFrame

from ..shared.i18n import _
from .base import ProcessorPlugin
from .schemas import TimelineSchema

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

    @property
    def required_settings(self) -> list[str]:
        return ["settings"]

    def process(self, df: DataFrame[TimelineSchema], config: dict[str, Any]) -> DataFrame[TimelineSchema]:
        logger.info(f"[Plugin] Running: {self.name}")

        if df.empty:
            return df

        extraction_patterns = config.get("settings", {}).get("project_extraction_patterns", [])
        if not extraction_patterns:
            # Fallback default if not in config? Use generic pipe pattern as a safe default
            extraction_patterns = [r"^(?P<project>.+?)\|"]

        # 最初に1回だけコピーを作成（以降は直接変更）
        df = df.copy()

        # projectカラムを確保
        if "project" not in df.columns:
            df["project"] = None

        # projectが未設定の行のみ処理
        mask = df["project"].isna() | (df["project"] == "")
        if not mask.any():
            return df

        # titleからプロジェクトを抽出
        df.loc[mask, "project"] = df.loc[mask, "title"].apply(
            lambda title: self._extract_project_from_title(title or "", extraction_patterns)
        )

        return df

    def _extract_project_from_title(self, title: str, patterns: list[str]) -> Optional[str]:
        for pattern in patterns:
            try:
                match = re.search(pattern, title)
                if match:
                    project = match.group("project")
                    if project:
                        # If it's an absolute path, take the basename
                        if os.path.isabs(project):
                            return os.path.basename(project)
                        return project
            except (re.error, IndexError):
                continue
        return None
