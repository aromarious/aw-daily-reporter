"""
プロジェクトマッピングプロセッサプラグイン

設定に基づいてプロジェクト名を置換・統合し、
クライアント情報を割り当てるプラグインを提供します。
"""

import logging
import re
from typing import Any

import pandas as pd
from pandera.typing import DataFrame

from ..shared.i18n import _
from .base import ProcessorPlugin
from .schemas import TimelineSchema

logger = logging.getLogger(__name__)


class ProjectMappingProcessor(ProcessorPlugin):
    """
    設定に基づいてプロジェクト名を置換・統合するプラグイン。

    config.json の project_map セクションを参照し、
    正規表現にマッチしたプロジェクト名を指定された名前に変更します。
    """

    @property
    def name(self) -> str:
        return _("Project Mapping")

    @property
    def description(self) -> str:
        return _("Maps project names and assigns clients based on regular expressions.")

    @property
    def required_settings(self) -> list[str]:
        return ["project_map", "client_map", "clients"]

    def process(self, df: DataFrame[TimelineSchema], config: dict[str, Any]) -> DataFrame[TimelineSchema]:
        logger.info(f"[Plugin] Running: {self.name}")

        if df.empty:
            return df

        project_map = config.get("project_map", {})
        client_map = config.get("client_map", {})
        clients = config.get("clients", {})

        # マップがなければ何もしない
        if not project_map and not client_map:
            return df

        df = df.copy()

        # contextカラムを確保（NaN値も空リストに置換）
        if "context" not in df.columns:
            df["context"] = [[] for _ in range(len(df))]
        else:
            df["context"] = df["context"].apply(lambda x: x if isinstance(x, list) else [])

        # metadataカラムを確保（NaN値も空辞書に置換）
        if "metadata" not in df.columns:
            df["metadata"] = [{} for _ in range(len(df))]
        else:
            df["metadata"] = df["metadata"].apply(lambda x: x if isinstance(x, dict) else {})

        # コンパイル済みの正規表現ルールリストを作成
        all_patterns = set(project_map.keys()) | set(client_map.keys())

        compiled_rules = []
        for pattern in all_patterns:
            target_project = project_map.get(pattern, "")
            target_client_id = client_map.get(pattern, "")
            try:
                compiled_rules.append((re.compile(pattern, re.IGNORECASE), target_project, target_client_id))
            except re.error:
                continue

        # projectが設定されている行のみ処理
        for idx in df.index:
            project = df.at[idx, "project"]
            if not project or pd.isna(project):
                continue

            for regex, target_project, target_client_id in compiled_rules:
                if regex.search(project):
                    # 1. Project Renaming
                    if target_project:
                        df.at[idx, "project"] = target_project

                    # 2. Client Assignment
                    if target_client_id and target_client_id in clients:
                        metadata = df.at[idx, "metadata"] or {}
                        metadata["client"] = target_client_id
                        df.at[idx, "metadata"] = metadata

                        # Add to context
                        client_name = clients[target_client_id].get("name", target_client_id)
                        context = df.at[idx, "context"]
                        if not isinstance(context, list):
                            context = []
                        context = list(context) + [f"Client: {client_name}"]
                        df.at[idx, "context"] = context

                    # 最初のマッチで終了
                    break

        return df
