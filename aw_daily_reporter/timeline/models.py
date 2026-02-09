"""
データモデル定義モジュール

タイムラインアイテム、カテゴリルール、作業統計などの
TypedDictベースのデータ構造を定義します。
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, field_validator


class CategoryRule(BaseModel):
    keyword: Union[str, List[str]]
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

    @field_validator("timestamp", mode="before")
    @classmethod
    def convert_pandas_timestamp(cls, v: Any) -> datetime:
        """
        pandas Timestamp を Python datetime に変換する

        pandas Timestamp の astimezone() は引数が必要だが、
        Python datetime の astimezone() は引数なしで呼べる。
        この不整合を解決するため、pandas Timestamp を検出して
        Python datetime に変換する。
        """
        if hasattr(v, "to_pydatetime"):
            # pandas Timestamp の場合は Python datetime に変換
            return v.to_pydatetime()
        return v


class WorkStats(BaseModel):
    start: datetime
    end: datetime
    working_seconds: float
    break_seconds: float
    afk_seconds: Optional[float] = 0.0

    @field_validator("start", "end", mode="before")
    @classmethod
    def convert_pandas_timestamp(cls, v: Any) -> datetime:
        """
        pandas Timestamp を Python datetime に変換する

        pandas Timestamp の astimezone() は引数が必要だが、
        Python datetime の astimezone() は引数なしで呼べる。
        この不整合を解決するため、pandas Timestamp を検出して
        Python datetime に変換する。
        """
        if hasattr(v, "to_pydatetime"):
            # pandas Timestamp の場合は Python datetime に変換
            return v.to_pydatetime()
        return v
