import subprocess
import unittest
from datetime import datetime
from unittest.mock import MagicMock, patch

from aw_daily_reporter.plugins.scanner_git import GitScanner


class TestGitScanner(unittest.TestCase):
    """
    GitScanner プラグインのテスト。

    主な検証項目:
    - `git log` コマンド出力のパース処理（コミットハッシュ、メッセージ、日時）
    - リポジトリルート検出ロジック（.gitフォルダの探索）
    - 外部コマンド実行（subprocess）のモック化による動作確認
    """

    def setUp(self):
        self.scanner = GitScanner()

    # =========================================================================
    # find_git_root Tests
    # =========================================================================

    @patch("aw_daily_reporter.plugins.scanner_git.Path")
    def test_find_git_root_valid_path_returns_root(self, mock_path):
        # Arrange
        path_str = "/Users/test/project/src"
        mock_path_obj = MagicMock()
        mock_path.return_value.resolve.return_value = mock_path_obj

        # Simulate directory structure: src -> project (ROOT)
        # src/.git -> doesn't exist
        # project/.git -> exists
        mock_path_obj.is_file.return_value = False

        # Iteration 1 (src)
        mock_path_obj.__truediv__.return_value.exists.return_value = False
        # Parent is project
        mock_parent = MagicMock()
        mock_path_obj.parent = mock_parent

        # Iteration 2 (project)
        mock_parent.__truediv__.return_value.exists.return_value = True  # .git exists
        mock_parent.__str__.return_value = "/Users/test/project"

        # Act
        root = self.scanner.find_git_root(path_str)

        # Assert
        assert root == "/Users/test/project"

    def test_find_git_root_none_input_returns_none(self):
        # Arrange & Act & Assert
        assert self.scanner.find_git_root(None) is None
        assert self.scanner.find_git_root("") is None

    # =========================================================================
    # extract_repos_from_timeline Tests
    # =========================================================================

    def test_extract_repos_valid_context_returns_unique_repos(self):
        # Arrange
        timeline = [
            {
                "context": [
                    "[VSCode] /Users/test/project/file.py (python)",
                    "Project: /Users/test/other_project",
                ]
            }
        ]

        with patch.object(self.scanner, "find_git_root") as mock_find:
            # Set up side effects for find_git_root to return specific roots for specific paths
            def side_effect(path):
                if "other_project" in path:
                    return "/Users/test/other_project"
                if "project" in path:
                    return "/Users/test/project"
                return None

            mock_find.side_effect = side_effect

            # Act
            repos = self.scanner.extract_repos_from_timeline(timeline)

            # Assert
            assert len(repos) == 2
            assert "/Users/test/project" in repos
            assert "/Users/test/other_project" in repos

    # =========================================================================
    # get_commits Tests (Test Design: G01 - G03)
    # =========================================================================

    @patch("aw_daily_reporter.plugins.scanner_git.subprocess.run")
    def test_get_commits_valid_output_returns_parsed_items(self, mock_run):
        # G01: Valid Output
        # Arrange
        mock_run.return_value = subprocess.CompletedProcess(
            args=[],
            returncode=0,
            stdout=(
                "a1b2c3d|Tester|Fix bug|2023-01-01T10:00:00+00:00\ne5f6g7h|Tester|Add feature|2023-01-01T12:00:00+00:00"
            ),
            stderr="",
        )

        # Act
        commits = self.scanner.get_commits("/path/to/repo", datetime.now(), datetime.now())

        # Assert
        assert len(commits) == 2
        assert commits[0]["title"] == "[repo] Fix bug (a1b2c3d)"
        assert commits[1]["title"] == "[repo] Add feature (e5f6g7h)"

    @patch("aw_daily_reporter.plugins.scanner_git.subprocess.run")
    def test_get_commits_empty_output_returns_empty_list(self, mock_run):
        # G02: Empty Output
        # Arrange
        mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=0, stdout="", stderr="")

        # Act
        commits = self.scanner.get_commits("/path/to/repo", datetime.now(), datetime.now())

        # Assert
        assert len(commits) == 0

    @patch("aw_daily_reporter.plugins.scanner_git.subprocess.run")
    def test_get_commits_command_failure_returns_empty_list_no_error(self, mock_run):
        # G03: Command Failure (e.g. not a git repo)
        # Arrange
        mock_run.side_effect = subprocess.CalledProcessError(128, ["git", "log"])

        # Act
        commits = self.scanner.get_commits("/path/to/repo", datetime.now(), datetime.now())

        # Assert
        assert len(commits) == 0


if __name__ == "__main__":
    unittest.main()
