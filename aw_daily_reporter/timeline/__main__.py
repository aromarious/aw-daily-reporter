"""
タイムラインモジュール エントリポイント

`python -m aw_daily_reporter.timeline` として実行された場合に呼び出されるスクリプトです。
"""

from .generator import main

if __name__ == "__main__":
    main()
