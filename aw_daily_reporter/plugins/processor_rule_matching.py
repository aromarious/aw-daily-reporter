"""
ルールマッチングプロセッサプラグイン

キーワードベースのルールに基づいてタイムラインアイテムに
カテゴリやプロジェクトを割り当てるプラグインを提供します。
"""

import logging
import re
from typing import Any

import pandas as pd
from pandera.typing import DataFrame

from ..shared.constants import DEFAULT_CATEGORY
from ..shared.i18n import _
from .base import ProcessorPlugin
from .schemas import TimelineSchema

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

    def process(self, df: DataFrame[TimelineSchema], config: dict[str, Any]) -> DataFrame[TimelineSchema]:
        logger.info(f"[Plugin] Running: {self.name}")

        if df.empty:
            return df

        df = df.copy()
        rules = config.get("rules", [])

        # categoryカラムを確保
        if "category" not in df.columns:
            df["category"] = DEFAULT_CATEGORY
        else:
            df["category"] = df["category"].fillna(DEFAULT_CATEGORY)

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

        # 各行を処理
        for idx in df.index:
            category = df.at[idx, "category"]
            if category != DEFAULT_CATEGORY:
                continue

            app = str(df.at[idx, "app"]).lower()
            title = str(df.at[idx, "title"]) if pd.notna(df.at[idx, "title"]) else ""
            context = df.at[idx, "context"] if isinstance(df.at[idx, "context"], list) else []

            # UI上部にあるルールを優先するため、逆順（下から上）に適用する
            for rule in reversed(rules):
                # Skip disabled rules (enabled defaults to True)
                if not rule.get("enabled", True):
                    continue

                if rule.get("app") and rule["app"].lower() not in app:
                    continue

                kw_raw = rule.get("keyword")
                if isinstance(kw_raw, list):
                    keywords = kw_raw
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
                    matched = bool(re.search(pattern, df.at[idx, "app"], flags))
                elif target == "title":
                    matched = bool(re.search(pattern, title, flags))
                elif target == "url":
                    urls = [c[len("URL: ") :] for c in context if c.startswith("URL: ")]
                    matched = any(re.search(pattern, u, flags) for u in urls)
                else:
                    # Combined match
                    active_window_text = f"{df.at[idx, 'app']} {title}"
                    context_text = ", ".join(context)
                    matched = bool(re.search(pattern, active_window_text, flags)) or bool(
                        re.search(pattern, context_text, flags)
                    )

                if matched:
                    # Apply category if rule has it (overwrite allowed)
                    if rule.get("category"):
                        category = rule["category"]

                    # Apply project if rule has it (overwrite allowed)
                    if rule.get("project"):
                        df.at[idx, "project"] = rule["project"]
                        context = list(context)  # mutate safely
                        context.append(f"Project: {rule['project']}")
                        df.at[idx, "context"] = context

                    # Store matched rule metadata
                    metadata = df.at[idx, "metadata"] or {}
                    metadata["matched_rule"] = {
                        "keyword": pattern,
                        "target": target or "any",
                        "rule_category": rule.get("category"),
                        "rule_project": rule.get("project"),
                    }
                    df.at[idx, "metadata"] = metadata

            df.at[idx, "category"] = category

        # 3. カテゴリ名のローカライズ
        cat_map = config.get("categories", {})
        if cat_map:
            df["category"] = df["category"].map(lambda c: cat_map.get(c, c))

        return df
