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
        try:
            self.client = ActivityWatchClient(client_name, testing=False)
        except Exception as e:
            # This rarely fails as it just sets up the object, but essentially indicates library issue
            logger.warning(f"Warning: Failed to initialize ActivityWatchClient: {e}")
            self.client = None
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
        現在のホスト名に基づいて、関連するバケットIDを特定します。
        """
        if not self.client:
            return {}

        try:
            all_buckets = self.client.get_buckets()
        except Exception as e:
            logger.warning(f"Warning: Failed to connect to ActivityWatch (get_buckets): {e}")
            return {}

        relevant_buckets = {}

        # Fixed mappings
        type_prefix_map = {
            "window": f"aw-watcher-window_{self.hostname}",
            "afk": f"aw-watcher-afk_{self.hostname}",
            "vscode": f"aw-watcher-vscode_{self.hostname}",
        }

        for btype, bid in type_prefix_map.items():
            if bid in all_buckets:
                relevant_buckets[btype] = bid

        # Dynamic mapping for web watchers
        for bid in all_buckets:
            if bid.startswith("aw-watcher-web") and bid.endswith(f"_{self.hostname}"):
                # e.g. aw-watcher-web-chrome_hostname -> web-chrome
                # or just use the bid as keys, but we want to aggregate them later.
                # Let's use the full bid as key for clarity in aggregation step,
                # or map them to 'web-chrome', 'web-safari', etc.
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
