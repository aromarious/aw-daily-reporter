"""
プロジェクトマッピングプロセッサプラグイン

設定に基づいてプロジェクト名を置換・統合し、
クライアント情報を割り当てるプラグインを提供します。
"""

import logging
import re
from typing import Any, Dict, List

from ..shared.i18n import _
from ..timeline.models import TimelineItem
from .base import ProcessorPlugin

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

    def process(self, timeline: List[TimelineItem], config: Dict[str, Any]) -> List[TimelineItem]:
        logger.info(f"[Plugin] Running: {self.name}")
        project_map = config.get("project_map", {})
        client_map = config.get("client_map", {})
        clients = config.get("clients", {})

        # マップがなければ何もしない（ただし、片方だけある場合もあるのでOR条件）
        if not project_map and not client_map:
            return timeline

        # コンパイル済みの正規表現ルールリストを作成
        # project_mapのキー(regex)をベースにするが、client_mapにしかないキーがある場合はそれも網羅する必要がある。
        # ProjectMapList UIでは両方同時に保存されるためキーセットは基本的に同じだが、安全のため和集合を取る。
        all_patterns = set(project_map.keys()) | set(client_map.keys())

        compiled_rules = []
        for pattern in all_patterns:
            target_project = project_map.get(pattern, "")
            target_client_id = client_map.get(pattern, "")
            try:
                compiled_rules.append((re.compile(pattern), target_project, target_client_id))
            except re.error:
                continue

        for item in timeline:
            project = item.get("project")
            if not project:
                continue

            for regex, target_project, target_client_id in compiled_rules:
                if regex.search(project):
                    # 1. Project Renaming
                    # Empty target means "keep original name"
                    if target_project:
                        item["project"] = target_project

                    # 2. Client Assignment
                    if target_client_id and target_client_id in clients:
                        curr_meta = item.get("metadata", {})
                        curr_meta["client"] = target_client_id
                        item["metadata"] = curr_meta

                        # Add to context
                        client_name = clients[target_client_id].get("name", target_client_id)
                        item["context"] = item.get("context", []) + [f"Client: {client_name}"]

                    # 最初のマッチで終了
                    break

        return timeline
