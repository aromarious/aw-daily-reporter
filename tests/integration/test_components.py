from unittest.mock import patch

from aw_daily_reporter.plugins.manager import PluginManager
from aw_daily_reporter.timeline.generator import TimelineGenerator


@patch("aw_daily_reporter.timeline.generator.AWClient")
def test_components_initialization(mock_client):
    """
    コンポーネント初期化の統合スモークテスト。

    TimelineGenerator や PluginManager が依存関係を含めて正しくインスタンス化できるか、
    最小限の構成で検証します。
    """
    generator = TimelineGenerator()
    assert generator is not None

    manager = PluginManager()
    assert manager is not None
