"""
データモデル定義モジュール

タイムラインアイテム、カテゴリルール、作業統計などの
TypedDictベースのデータ構造を定義します。
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, TypedDict


class CategoryRule(TypedDict):
    keyword: str
    category: Optional[str]
    project: Optional[str]
    app: Optional[str]  # If set, this rule only applies to this app
    target: Optional[str]  # "app", "title", "url", or None (any)


class TimelineItem(TypedDict):
    timestamp: datetime
    duration: float
    app: str
    title: str
    context: List[str]
    category: Optional[str]  # Added in categorization step
    source: Optional[str]  # Data source identifier (e.g. "AFK", "Window")
    project: Optional[str]  # Explicit project name (extracted or propagated)
    url: Optional[str]
    file: Optional[str]
    language: Optional[str]
    status: Optional[str]
    metadata: Dict[str, Any]  # Plugin specific metadata


class WorkStats(TypedDict):
    start: datetime
    end: datetime
    working_seconds: float
    break_seconds: float
    afk_seconds: Optional[float]
