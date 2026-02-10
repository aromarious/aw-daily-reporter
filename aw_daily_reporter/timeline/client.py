"""
ActivityWatchクライアントモジュール

ActivityWatch APIとの通信を行い、バケット情報やイベントデータを取得する
ラッパークラスを提供します。
"""

import socket
from datetime import datetime
from typing import Any, Dict, List

from aw_client import ActivityWatchClient
from aw_core import Event

from aw_daily_reporter.shared.logging import get_logger

logger = get_logger(__name__, scope="Client")

HOSTNAME = socket.gethostname()


class AWClient:
    """
    ActivityWatchクライアントモジュール

    ActivityWatch APIとの通信を行い、バケット情報やイベントデータを取得する
    ラッパークラスを提供します。
    """

    def __init__(self, client_name: str = "aw-daily-reporter-timeline", hostname: str = HOSTNAME):
        self.client: Any = None
        try:
            self.client = ActivityWatchClient(client_name, testing=False)
        except Exception as e:
            logger.warning(f"Warning: Failed to initialize ActivityWatchClient: {e}")
            pass
        self.hostname = hostname

    def get_setting(self, key: str) -> Any:
        if not self.client:
            return None
        try:
            # aw-client doesn't expose raw request easily for arbitrary endpoints,
            # so we access the internal session or use requests if needed.
            # But ActivityWatchClient has _get method (protected).
            resp = self.client._get(f"settings/{key}")
            if resp.status_code == 200:
                return resp.json()
            return None
        except Exception as e:
            logger.warning(f"Warning: Failed to fetch setting {key}: {e}")
            return None

    def get_buckets(self) -> Dict[str, str]:
        """
        設定に基づいてバケットIDを取得します。
        enabled_bucket_ids が空の場合は、現在のホスト名に関連する全バケットを返します。
        """
        if not self.client:
            return {}

        try:
            all_buckets = self.client.get_buckets()
        except Exception as e:
            logger.warning(f"Warning: Failed to connect to ActivityWatch (get_buckets): {e}")
            return {}

        # 設定から有効化するバケットIDのリストを取得
        from ..shared.settings_manager import ConfigStore

        config = ConfigStore.get_instance().load()
        enabled_bucket_ids = config.system.enabled_bucket_ids if config.system else []

        relevant_buckets = {}

        # "__DISABLED__" は全オフを表す特殊マーカー
        if enabled_bucket_ids and len(enabled_bucket_ids) == 1 and enabled_bucket_ids[0] == "__DISABLED__":
            # 全オフの場合は空の辞書を返す
            return {}
        elif enabled_bucket_ids:
            # 設定で指定されたバケットIDのみを返す
            for bucket_id in enabled_bucket_ids:
                if bucket_id in all_buckets:
                    # バケットIDをそのままキーとして使用
                    relevant_buckets[bucket_id] = bucket_id
        else:
            # 設定が空の場合は、現在のホスト名に関連する全バケットを返す
            for bid in all_buckets:
                # ホスト名でフィルタリング（ホスト名を含むバケット、またはホスト名なしのバケット）
                if f"_{self.hostname}" in bid or "_" not in bid:
                    # バケットIDをそのままキーとして使用
                    relevant_buckets[bid] = bid

        return relevant_buckets

    def fetch_events(self, start: datetime, end: datetime) -> Dict[str, List[Event]]:
        """
        指定された期間のイベントデータを全てのバケットから取得します。
        """
        buckets = self.get_buckets()
        if not buckets:
            return {}

        events_map = {}

        for btype, bid in buckets.items():
            try:
                events = self.client.get_events(bid, start=start, end=end)
                events_map[btype] = events
            except Exception as e:
                logger.warning(f"Warning: Failed to fetch bucket {bid}: {e}")
                events_map[btype] = []

        return events_map
