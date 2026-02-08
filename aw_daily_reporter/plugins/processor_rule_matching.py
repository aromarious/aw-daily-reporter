"""
ルールマッチングプロセッサプラグイン

キーワードベースのルールに基づいてタイムラインアイテムに
カテゴリやプロジェクトを割り当てるプラグインを提供します。
"""

import logging
import re
from typing import Any

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

        # ルールの正規表現を事前コンパイル（高速化）
        compiled_rules = []
        for rule in reversed(rules):
            if not rule.get("enabled", True):
                continue

            kw_raw = rule.get("keyword")
            if isinstance(kw_raw, list):
                keywords = kw_raw
            elif isinstance(kw_raw, str):
                keywords = [kw_raw]
            else:
                keywords = []

            valid_keywords = [kw for kw in keywords if kw and _is_valid_regex(kw)]
            if not valid_keywords:
                continue

            pattern = "|".join(valid_keywords)
            try:
                compiled = re.compile(pattern, re.IGNORECASE)
            except re.error:
                continue

            compiled_rules.append(
                {
                    "compiled": compiled,
                    "pattern": pattern,
                    "app_filter": rule.get("app", "").lower() if rule.get("app") else None,
                    "target": rule.get("target"),
                    "category": rule.get("category"),
                    "project": rule.get("project"),
                }
            )

        # データをリストに変換（df.at[]より高速）
        categories = df["category"].tolist()
        apps = df["app"].astype(str).str.lower().tolist()
        titles = df["title"].fillna("").astype(str).tolist()
        contexts = df["context"].tolist()
        metadatas = df["metadata"].tolist()
        projects = df["project"].tolist() if "project" in df.columns else [None] * len(df)

        # 各行を処理
        for i in range(len(df)):
            if categories[i] != DEFAULT_CATEGORY:
                continue

            app = apps[i]
            title = titles[i]
            context = contexts[i] if isinstance(contexts[i], list) else []

            for rule in compiled_rules:
                if rule["app_filter"] and rule["app_filter"] not in app:
                    continue

                target = rule["target"]
                compiled = rule["compiled"]
                matched = False

                if target == "app":
                    matched = bool(compiled.search(app))
                elif target == "title":
                    matched = bool(compiled.search(title))
                elif target == "url":
                    urls = [c[len("URL: ") :] for c in context if c.startswith("URL: ")]
                    matched = any(compiled.search(u) for u in urls)
                else:
                    # Combined match
                    active_window_text = f"{app} {title}"
                    context_text = ", ".join(context)
                    matched = bool(compiled.search(active_window_text)) or bool(compiled.search(context_text))

                if matched:
                    if rule["category"]:
                        categories[i] = rule["category"]

                    if rule["project"]:
                        projects[i] = rule["project"]
                        context = list(context)
                        context.append(f"Project: {rule['project']}")
                        contexts[i] = context

                    metadata = metadatas[i] or {}
                    metadata["matched_rule"] = {
                        "keyword": rule["pattern"],
                        "target": target or "any",
                        "rule_category": rule["category"],
                        "rule_project": rule["project"],
                    }
                    metadatas[i] = metadata

        # リストをDataFrameに戻す
        df["category"] = categories
        df["context"] = contexts
        df["metadata"] = metadatas
        if "project" in df.columns:
            df["project"] = projects

        # カテゴリ名のローカライズ
        cat_map = config.get("categories", {})
        if cat_map:
            df["category"] = df["category"].map(lambda c: cat_map.get(c, c))

        return df
