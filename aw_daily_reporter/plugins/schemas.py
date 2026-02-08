"""
Timelineデータのスキーマ定義モジュール

panderaを使用してDataFrameのスキーマを型安全に定義します。
"""

from typing import Optional

import pandas as pd
import pandera.pandas as pa
from pandera.typing import Series


class TimelineSchema(pa.DataFrameModel):
    """タイムラインアイテムのDataFrameスキーマ"""

    timestamp: Series[pd.Timestamp]
    duration: Series[float]
    app: Series[str]
    title: Series[str]
    # オプションフィールド（nullable）
    category: Optional[Series[str]] = pa.Field(nullable=True, default=None)
    project: Optional[Series[str]] = pa.Field(nullable=True, default=None)
    source: Optional[Series[str]] = pa.Field(nullable=True, default=None)
    end: Optional[Series[pd.Timestamp]] = pa.Field(nullable=True, default=None)

    class Config:
        # 未定義のカラムを許可（拡張性のため）
        strict = False
        coerce = True
