"""
プラグイン基底クラスモジュール

すべてのプラグインが継承する基底クラス(BasePlugin)と、
プロセッサ(ProcessorPlugin)、スキャナ(ScannerPlugin)、
レンダラ(RendererPlugin)の各種プラグインインターフェースを定義します。
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import TYPE_CHECKING, Any

from pandera.typing import DataFrame

from .schemas import TimelineSchema

if TYPE_CHECKING:
    from ..timeline.models import TimelineItem


class BasePlugin(ABC):
    """すべてのプラグインの基底クラス"""

    @property
    @abstractmethod
    def name(self) -> str:
        """プラグインの一意な名前（表示用・翻訳可能）"""
        pass

    @property
    def plugin_id(self) -> str:
        """プラグインの一意なID (モジュール名.クラス名)"""
        return f"{self.__class__.__module__}.{self.__class__.__name__}"

    @property
    def description(self) -> str:
        """プラグインの説明"""
        return ""

    @property
    def required_settings(self) -> list[str]:
        """プラグインが必要とする設定キーのリスト（AppConfigのトップレベルキー）"""
        return []


class ProcessorPlugin(BasePlugin):
    """タイムラインデータを加工するプラグイン"""

    @abstractmethod
    def process(self, df: DataFrame[TimelineSchema], config: dict[str, Any]) -> DataFrame[TimelineSchema]:
        """
        タイムラインDataFrameを加工して返します。

        Args:
            df: 加工対象のタイムラインDataFrame
            config: 設定情報

        Returns:
            DataFrame[TimelineSchema]: 加工後のタイムラインDataFrame
        """
        pass


class ScannerPlugin(BasePlugin):
    """外部リソースから情報を収集し、レポートに追加またはタイムラインへ統合するプラグイン"""

    @abstractmethod
    def scan(
        self,
        timeline: list[TimelineItem],
        start_time: datetime,
        end_time: datetime,
        config: dict[str, Any],
    ) -> list[str | TimelineItem]:
        """
        外部情報をスキャンして、レポートに追加する情報を返します。

        Args:
            timeline: スキャン対象のタイムライン
            start_time: 開始時間
            end_time: 終了時間
            config: 設定情報

        Returns:
            Union[List[str], List[TimelineItem]]: レポート末尾に追加するメッセージ、またはタイムラインに統合するアイテム
        """
        pass


class RendererPlugin(BasePlugin):
    """結果を特定のフォーマットで出力（表示・保存・送信）するプラグイン"""

    @abstractmethod
    def render(
        self,
        timeline: list[TimelineItem],
        report_data: dict[str, Any],
        config: dict[str, Any],
    ) -> str | None:
        """
        レポートを出力します。

        Args:
            timeline: タイムラインアイテムのリスト
            report_data: 統計情報やスキャンサマリーなどのレポート用データ
            config: 設定情報

        Returns:
            Optional[str]: 生成されたレポート文字列（Web表示用など）。Noneの場合は出力なし。
        """
        pass
