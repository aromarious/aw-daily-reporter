import os
import sys
from unittest.mock import MagicMock

import pytest

# Ensure the project root is in the path for imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


@pytest.fixture
def mock_aw_client():
    from aw_client import ActivityWatchClient

    client = MagicMock(spec=ActivityWatchClient)
    return client


@pytest.fixture
def mock_settings():
    return {"day_start_hour": 4, "working_hours": {"start": 9, "end": 17}}
