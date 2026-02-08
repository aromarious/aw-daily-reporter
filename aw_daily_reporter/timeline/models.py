"""
データモデル定義モジュール

タイムラインアイテム、カテゴリルール、作業統計などの
TypedDictベースのデータ構造を定義します。
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class CategoryRule(BaseModel):
    keyword: str
    category: Optional[str] = None
    project: Optional[str] = None
    app: Optional[str] = None
    target: Optional[str] = None
    model_config = ConfigDict(extra="ignore")


class TimelineItem(BaseModel):
    timestamp: datetime
    duration: float
    app: str
    title: str
    context: List[str] = []
    category: Optional[str] = None
    source: Optional[str] = None
    project: Optional[str] = None
    url: Optional[str] = None
    file: Optional[str] = None
    language: Optional[str] = None
    status: Optional[str] = None
    # Flexible metadata field using Dict[str, Any]
    metadata: Dict[str, Any] = {}
    model_config = ConfigDict(
        extra="allow"
    )  # Allow plugins to add extra fields freely if needed, though metadata is preferred.


class WorkStats(BaseModel):
    start: datetime
    end: datetime
    working_seconds: float
    break_seconds: float
    afk_seconds: Optional[float] = 0.0
