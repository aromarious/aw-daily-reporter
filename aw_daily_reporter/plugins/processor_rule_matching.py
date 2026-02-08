"""
ルールマッチングプロセッサプラグイン

キーワードベースのルールに基づいてタイムラインアイテムに
カテゴリやプロジェクトを割り当てるプラグインを提供します。
"""

import logging
import re
from typing import Any, Dict, List

from ..shared.constants import DEFAULT_CATEGORY
from ..shared.i18n import _
from ..timeline.models import TimelineItem
from .base import ProcessorPlugin

logger = logging.getLogger(__name__)


def _is_valid_regex(pattern: str) -> bool:
    """正規表現が有効かどうかを検査する"""
    try:
        re.compile(pattern)
        return True
    except re.error:
        return False


class RuleMatchingProcessor(ProcessorPlugin):
    """
    タイムラインの各項目を、設定されたルールに基づいてカテゴリとプロジェクトを設定するプラグイン。

    ルールマッチング:
    - キーワードがマッチした場合、ルールに設定されたカテゴリやプロジェクトを適用
    - 複数のルールがマッチした場合、後のルールが優先される
    """

    @property
    def name(self) -> str:
        return _("Rule Matching")

    @property
    def description(self) -> str:
        return _("Assigns categories and projects based on keyword matching rules.")

    def process(self, timeline: List[TimelineItem], config: Dict[str, Any]) -> List[TimelineItem]:
        logger.info(f"[Plugin] Running: {self.name}")
        rules = config.get("rules", [])
        for item in timeline:
            category = item.get("category") or DEFAULT_CATEGORY

            # 1. ルールマッチング
            if category == DEFAULT_CATEGORY:
                app_lower = item["app"].lower()  # Keep for app property check compatibility

                # UI上部にあるルールを優先するため、逆順（下から上）に適用する
                # (後から適用されたものが上書きするため、リスト先頭のルールを最後に適用する)
                for rule in reversed(rules):
                    # Skip disabled rules (enabled defaults to True)
                    if not rule.get("enabled", True):
                        continue

                    if rule.get("app") and rule["app"].lower() not in app_lower:
                        continue

                    kw_raw = rule.get("keyword")
                    if isinstance(kw_raw, list):
                        keywords = kw_raw  # Use raw strings
                    elif isinstance(kw_raw, str):
                        keywords = [kw_raw]
                    else:
                        keywords = []

                    # 有効なキーワードのみフィルタリング
                    valid_keywords = [kw for kw in keywords if kw and _is_valid_regex(kw)]
                    if not valid_keywords:
                        continue

                    # キーワードを | で結合して1つの正規表現パターンに
                    pattern = "|".join(valid_keywords)
                    target = rule.get("target")
                    matched = False
                    flags = re.IGNORECASE

                    if target == "app":
                        matched = bool(re.search(pattern, item["app"], flags))
                    elif target == "title":
                        matched = bool(re.search(pattern, item["title"], flags))
                    elif target == "url":
                        urls = [c[len("URL: ") :] for c in item["context"] if c.startswith("URL: ")]
                        matched = any(re.search(pattern, u, flags) for u in urls)
                    else:
                        # Combined match
                        active_window_text = f"{item['app']} {item['title']}"
                        context_text = ", ".join(item["context"])
                        matched = bool(re.search(pattern, active_window_text, flags)) or bool(
                            re.search(pattern, context_text, flags)
                        )

                    if matched:
                        # Apply category if rule has it (overwrite allowed)
                        if rule.get("category"):
                            category = rule["category"]

                        # Apply project if rule has it (overwrite allowed)
                        if rule.get("project"):
                            item["project"] = rule["project"]
                            item["context"].append(f"Project: {rule['project']}")

                        # Store matched rule metadata
                        if "metadata" not in item or item["metadata"] is None:
                            item["metadata"] = {}
                        item["metadata"]["matched_rule"] = {
                            "keyword": pattern,
                            "target": target or "any",
                            "rule_category": rule.get("category"),
                            "rule_project": rule.get("project"),
                        }

                        # No break: Continue processing all rules to allow accumulation/overwriting
                        # Last matching rule wins for any specific property it sets.

            item["category"] = category

        # 3. カテゴリ名のローカライズ
        cat_map = config.get("categories", {})
        if cat_map:
            for item in timeline:
                raw_cat = item.get("category")
                if raw_cat and raw_cat in cat_map:
                    item["category"] = cat_map[raw_cat]

        return timeline
