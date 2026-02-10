"""
ProjectExtractionProcessor のユニットテスト
"""

import unittest
from datetime import datetime, timezone

import pandas as pd

from aw_daily_reporter.plugins.processor_project_extractor import (
    ProjectExtractionProcessor,
)


class TestProjectExtractionProcessor(unittest.TestCase):
    """ProjectExtractionProcessor のテストケース"""

    def setUp(self):
        self.processor = ProjectExtractionProcessor()
        plugin_id = self.processor.plugin_id
        self.base_config = {
            "apps": {"editors": ["code", "vim", "emacs"]},
            "plugins": {plugin_id: {"project_extraction_patterns": [r"^(?P<project>.+?)\s*\|"]}},
        }

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
        result = self.processor.process(pd.DataFrame(), self.base_config)
        assert result.empty

    def test_no_editor_apps_config_extracts_with_default(self):
        """editor設定がなくてもデフォルト設定で抽出される"""
        config = {"apps": {}, "plugins": {}}
        item = {"app": "VS Code", "title": "MyProject | file.py", "project": None}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        assert result.iloc[0]["project"] == "MyProject "

    def test_extracts_project_from_editor_title(self):
        """エディタアプリのタイトルからプロジェクト名を抽出する"""
        item = {
            "app": "VS Code",
            "title": "MyProject | file.py",
            "timestamp": datetime.now(timezone.utc),
            "duration": 100,
            "project": None,
        }
        df = self._to_df([item])
        result = self.processor.process(df, self.base_config)
        assert result.iloc[0]["project"] == "MyProject"

    def test_skips_if_project_already_set(self):
        """プロジェクトが既に設定されている場合はスキップ"""
        item = {
            "app": "VS Code",
            "title": "NewProject | file.py",
            "project": "ExistingProject",
        }
        df = self._to_df([item])
        result = self.processor.process(df, self.base_config)
        assert result.iloc[0]["project"] == "ExistingProject"

    def test_skips_non_editor_apps(self):
        """デフォルトパターンではアプリ種別に関係なく抽出"""
        item = {"app": "Chrome", "title": "MyProject | docs", "project": None}
        df = self._to_df([item])
        result = self.processor.process(df, self.base_config)
        # パターンにマッチすれば抽出される
        assert result.iloc[0]["project"] == "MyProject"

    def test_no_match_leaves_project_none(self):
        """パターンにマッチしなければprojectはNoneのまま"""
        item = {"app": "VS Code", "title": "No pipe in this title", "project": None}
        df = self._to_df([item])
        result = self.processor.process(df, self.base_config)
        assert pd.isna(result.iloc[0]["project"]) or result.iloc[0]["project"] is None

    def test_fallback_pattern_when_none_configured(self):
        """パターン未設定時はデフォルトパターンを使用"""
        config = {
            "apps": {"editors": ["code"]},
            "plugins": {},  # no patterns
        }
        item = {"app": "VS Code", "title": "FallbackProject|file.py", "project": None}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        assert result.iloc[0]["project"] == "FallbackProject"

    def test_invalid_regex_pattern_is_skipped(self):
        """無効な正規表現パターンはスキップされる"""
        plugin_id = self.processor.plugin_id
        config = {
            "apps": {"editors": ["code"]},
            "plugins": {
                plugin_id: {
                    "project_extraction_patterns": [
                        r"[invalid(",  # 無効なパターン
                        r"^(?P<project>.+?)\|",  # 有効なパターン
                    ]
                }
            },
        }
        item = {"app": "VS Code", "title": "ValidProject|file.py", "project": None}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        assert result.iloc[0]["project"] == "ValidProject"

    def test_pattern_without_project_group_is_skipped(self):
        """'project'グループがないパターンはスキップ"""
        plugin_id = self.processor.plugin_id
        config = {
            "apps": {"editors": ["code"]},
            "plugins": {
                plugin_id: {
                    "project_extraction_patterns": [
                        r"^(.+?)\|",  # 'project'グループなし
                    ]
                }
            },
        }
        item = {"app": "VS Code", "title": "SomeProject|file.py", "project": None}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        assert pd.isna(result.iloc[0]["project"]) or result.iloc[0]["project"] is None

    def test_app_specific_patterns(self):
        """アプリごとのパターンが正しく適用されること"""
        plugin_id = self.processor.plugin_id
        config = {
            "plugins": {
                plugin_id: {
                    "project_extraction_patterns": {
                        "*": [r"^(?P<project>.+?)\|"],
                        "vs.*code": [r"^(?P<project>.+?)\s*-\s*Visual Studio Code"],
                        "chrome": [r"^(?P<project>.+?)\s*-\s*Google Chrome"],
                    }
                }
            },
        }

        items = [
            {"app": "VS Code", "title": "MyProject - Visual Studio Code", "project": None},
            {"app": "Chrome", "title": "MyProject - Google Chrome", "project": None},
            {"app": "Terminal", "title": "MyProject|zsh", "project": None},
        ]
        df = self._to_df(items)
        result = self.processor.process(df, config)

        # vs.*code pattern (正規表現でマッチ)
        assert result.iloc[0]["project"] == "MyProject"
        # chrome pattern
        assert result.iloc[1]["project"] == "MyProject"
        # * pattern
        assert result.iloc[2]["project"] == "MyProject"

    def test_app_filter_case_insensitive(self):
        """アプリ名の正規表現マッチングが大文字小文字を区別しないこと"""
        plugin_id = self.processor.plugin_id
        config = {
            "plugins": {plugin_id: {"project_extraction_patterns": {"vs.*code": [r"^(?P<project>.+?)\s*-"]}}},
        }

        items = [
            {"app": "VS Code", "title": "MyProject - file", "project": None},
            {"app": "vs code", "title": "MyProject - file", "project": None},
            {"app": "VSCODE", "title": "MyProject - file", "project": None},
        ]
        df = self._to_df(items)
        result = self.processor.process(df, config)

        assert result.iloc[0]["project"] == "MyProject"
        assert result.iloc[1]["project"] == "MyProject"
        assert result.iloc[2]["project"] == "MyProject"

    def test_backward_compatibility_list_format(self):
        """旧形式（list）が自動的に変換されること"""
        plugin_id = self.processor.plugin_id
        config = {
            "plugins": {
                plugin_id: {
                    "project_extraction_patterns": [r"^(?P<project>.+?)\|"]  # 旧形式
                }
            },
        }

        item = {"app": "VS Code", "title": "MyProject|file.py", "project": None}
        df = self._to_df([item])
        result = self.processor.process(df, config)
        assert result.iloc[0]["project"] == "MyProject"


if __name__ == "__main__":
    unittest.main()
