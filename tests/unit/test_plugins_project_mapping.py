"""
ProjectMappingProcessor のユニットテスト
"""

import unittest

from aw_daily_reporter.plugins.processor_project_mapping import ProjectMappingProcessor


class TestProjectMappingProcessor(unittest.TestCase):
    """ProjectMappingProcessor のテストケース"""

    def setUp(self):
        self.processor = ProjectMappingProcessor()

    def test_name_and_description(self):
        """name と description プロパティが文字列を返すこと"""
        assert isinstance(self.processor.name, str)
        assert isinstance(self.processor.description, str)

    def test_empty_timeline_returns_empty_list(self):
        """空のタイムラインは空のリストを返す"""
        config = {"project_map": {}, "client_map": {}, "clients": {}}
        result = self.processor.process([], config)
        assert result == []

    def test_no_maps_returns_unchanged(self):
        """マップがなければタイムラインは変更されない"""
        config = {}
        item = {"project": "MyProject", "metadata": {}}
        result = self.processor.process([item], config)
        assert result[0]["project"] == "MyProject"

    def test_project_renaming(self):
        """プロジェクト名を置換する"""
        config = {
            "project_map": {"^old-.*": "new-project"},
            "client_map": {},
            "clients": {},
        }
        item = {"project": "old-project-name", "metadata": {}}
        result = self.processor.process([item], config)
        assert result[0]["project"] == "new-project"

    def test_empty_target_keeps_original_name(self):
        """空の置換先は元の名前を維持"""
        config = {
            "project_map": {"^keep-.*": ""},  # 空文字は置換しない
            "client_map": {"^keep-.*": "client1"},
            "clients": {"client1": {"name": "Client One"}},
        }
        item = {"project": "keep-this-name", "metadata": {}, "context": []}
        result = self.processor.process([item], config)
        assert result[0]["project"] == "keep-this-name"
        assert result[0]["metadata"]["client"] == "client1"

    def test_client_assignment(self):
        """クライアントを割り当てる"""
        config = {
            "project_map": {},
            "client_map": {"^client-proj-.*": "acme"},
            "clients": {"acme": {"name": "ACME Corp"}},
        }
        item = {"project": "client-proj-123", "metadata": {}, "context": []}
        result = self.processor.process([item], config)
        assert result[0]["metadata"]["client"] == "acme"
        assert "Client: ACME Corp" in result[0]["context"]

    def test_client_not_in_clients_ignored(self):
        """clients に存在しないクライアントIDは無視"""
        config = {
            "project_map": {},
            "client_map": {"^proj-.*": "unknown_client"},
            "clients": {},  # クライアント定義なし
        }
        item = {"project": "proj-123", "metadata": {}, "context": []}
        result = self.processor.process([item], config)
        assert "client" not in result[0]["metadata"]

    def test_skips_items_without_project(self):
        """プロジェクトがないアイテムはスキップ"""
        config = {
            "project_map": {".*": "should-not-match"},
            "client_map": {},
            "clients": {},
        }
        item = {"project": None, "metadata": {}}
        result = self.processor.process([item], config)
        assert result[0]["project"] is None

    def test_multiple_patterns_match_stops_at_first(self):
        """複数パターンがマッチしても最初のマッチで処理終了"""
        config = {
            "project_map": {"^test-proj$": "renamed-project"},
            "client_map": {"^test-proj$": "client1"},
            "clients": {"client1": {"name": "Client One"}},
        }
        item = {"project": "test-proj", "metadata": {}, "context": []}
        result = self.processor.process([item], config)
        # 両方の処理（リネームとクライアント割当）が行われる
        assert result[0]["project"] == "renamed-project"
        assert result[0]["metadata"]["client"] == "client1"

    def test_invalid_regex_is_skipped(self):
        """無効な正規表現はスキップ"""
        config = {
            "project_map": {"[invalid(": "bad", "^valid-.*": "good"},
            "client_map": {},
            "clients": {},
        }
        item = {"project": "valid-project", "metadata": {}}
        result = self.processor.process([item], config)
        assert result[0]["project"] == "good"

    def test_project_and_client_combined(self):
        """プロジェクト置換とクライアント割当を同時に行う"""
        config = {
            "project_map": {"^internal-.*": "Internal Work"},
            "client_map": {"^internal-.*": "internal"},
            "clients": {"internal": {"name": "Internal"}},
        }
        item = {"project": "internal-task", "metadata": {}, "context": []}
        result = self.processor.process([item], config)
        assert result[0]["project"] == "Internal Work"
        assert result[0]["metadata"]["client"] == "internal"


if __name__ == "__main__":
    unittest.main()
