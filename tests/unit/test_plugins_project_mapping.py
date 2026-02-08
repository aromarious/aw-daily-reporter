"""
ProjectMappingProcessor のユニットテスト
"""

import unittest

import pandas as pd

from aw_daily_reporter.plugins.processor_project_mapping import ProjectMappingProcessor


class TestProjectMappingProcessor(unittest.TestCase):
    """ProjectMappingProcessor のテストケース"""

    def setUp(self):
        self.processor = ProjectMappingProcessor()

    def _to_df(self, items: list) -> pd.DataFrame:
        """TimelineItemのリストをDataFrameに変換"""
        if not items:
            return pd.DataFrame()
        return pd.DataFrame(items)

    def test_name_and_description(self):
        """name と description プロパティが文字列を返すこと"""
        assert isinstance(self.processor.name, str)
        assert isinstance(self.processor.description, str)

    def test_empty_timeline_returns_empty_list(self):
        """空のタイムラインは空のDataFrameを返す"""
        config = {"project_map": {}, "client_map": {}, "clients": {}}
        result = self.processor.process(pd.DataFrame(), config)
        assert result.empty

    def test_no_maps_returns_unchanged(self):
        """マップがなければタイムラインは変更されない"""
        config = {}
        item = {"project": "MyProject", "metadata": {}}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        assert result.iloc[0]["project"] == "MyProject"

    def test_project_renaming(self):
        """プロジェクト名を置換する"""
        config = {
            "project_map": {"^old-.*": "new-project"},
            "client_map": {},
            "clients": {},
        }
        item = {"project": "old-project-name", "metadata": {}}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        assert result.iloc[0]["project"] == "new-project"

    def test_empty_target_keeps_original_name(self):
        """空の置換先は元の名前を維持"""
        config = {
            "project_map": {"^keep-.*": ""},  # 空文字は置換しない
            "client_map": {"^keep-.*": "client1"},
            "clients": {"client1": {"name": "Client One"}},
        }
        item = {"project": "keep-this-name", "metadata": {}, "context": []}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        assert result.iloc[0]["project"] == "keep-this-name"
        meta = result.iloc[0]["metadata"]
        assert isinstance(meta, dict)
        assert meta.get("client") == "client1"

    def test_client_assignment(self):
        """クライアントを割り当てる"""
        config = {
            "project_map": {},
            "client_map": {"^client-proj-.*": "acme"},
            "clients": {"acme": {"name": "ACME Corp"}},
        }
        item = {"project": "client-proj-123", "metadata": {}, "context": []}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        meta = result.iloc[0]["metadata"]
        assert isinstance(meta, dict)
        assert meta.get("client") == "acme"
        ctx = result.iloc[0]["context"]
        assert isinstance(ctx, list)
        assert "Client: ACME Corp" in ctx

    def test_client_not_in_clients_ignored(self):
        """clients に存在しないクライアントIDは無視"""
        config = {
            "project_map": {},
            "client_map": {"^proj-.*": "unknown_client"},
            "clients": {},  # クライアント定義なし
        }
        item = {"project": "proj-123", "metadata": {}, "context": []}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        meta = result.iloc[0]["metadata"]
        assert isinstance(meta, dict)
        assert "client" not in meta

    def test_skips_items_without_project(self):
        """プロジェクトがないアイテムはスキップ"""
        config = {
            "project_map": {".*": "should-not-match"},
            "client_map": {},
            "clients": {},
        }
        item = {"project": None, "metadata": {}}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        assert pd.isna(result.iloc[0]["project"]) or result.iloc[0]["project"] is None

    def test_multiple_patterns_match_stops_at_first(self):
        """複数パターンがマッチしても最初のマッチで処理終了"""
        config = {
            "project_map": {"^test-proj$": "renamed-project"},
            "client_map": {"^test-proj$": "client1"},
            "clients": {"client1": {"name": "Client One"}},
        }
        item = {"project": "test-proj", "metadata": {}, "context": []}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        # 両方の処理（リネームとクライアント割当）が行われる
        assert result.iloc[0]["project"] == "renamed-project"
        meta = result.iloc[0]["metadata"]
        assert isinstance(meta, dict)
        assert meta.get("client") == "client1"

    def test_invalid_regex_is_skipped(self):
        """無効な正規表現はスキップ"""
        config = {
            "project_map": {"[invalid(": "bad", "^valid-.*": "good"},
            "client_map": {},
            "clients": {},
        }
        item = {"project": "valid-project", "metadata": {}}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        assert result.iloc[0]["project"] == "good"

    def test_project_and_client_combined(self):
        """プロジェクト置換とクライアント割当を同時に行う"""
        config = {
            "project_map": {"^internal-.*": "Internal Work"},
            "client_map": {"^internal-.*": "internal"},
            "clients": {"internal": {"name": "Internal"}},
        }
        item = {"project": "internal-task", "metadata": {}, "context": []}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        assert result.iloc[0]["project"] == "Internal Work"
        meta = result.iloc[0]["metadata"]
        assert isinstance(meta, dict)
        assert meta.get("client") == "internal"


if __name__ == "__main__":
    unittest.main()
