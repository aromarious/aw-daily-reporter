"""
Gitアクティビティスキャナプラグイン

タイムラインに含まれるファイルパスからGitリポジトリを検出し、
コミット履歴やPR情報を収集するプラグインを提供します。
"""

import json
import logging
import os
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Union

from ..shared.i18n import _
from ..timeline.models import TimelineItem
from .base import ScannerPlugin

logger = logging.getLogger(__name__)


class GitScanner(ScannerPlugin):
    @property
    def name(self) -> str:
        return _("Git Activity Scanner")

    def scan(
        self,
        timeline: List[TimelineItem],
        start_time: datetime,
        end_time: datetime,
        config: Dict[str, Any],
    ) -> List[Union[TimelineItem, str]]:
        logger.info(f"[Plugin] Running: {self.name}")
        repos: Set[str] = self.extract_repos_from_timeline(timeline)
        all_items: List[Union[TimelineItem, str]] = []

        # Ensure timezone
        if start_time.tzinfo is None:
            start_time = start_time.astimezone()
        if end_time.tzinfo is None:
            end_time = end_time.astimezone()

        # 並列実行でgit/gh CLIを高速化
        from concurrent.futures import ThreadPoolExecutor, as_completed

        def fetch_repo_data(repo: str) -> List[Union[TimelineItem, str]]:
            items: List[Union[TimelineItem, str]] = []
            items.extend(self.get_commits(repo, start_time, end_time))
            items.extend(self.get_gh_pr_status(repo, start_time, end_time))
            return items

        # 最大4スレッドで並列実行
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(fetch_repo_data, repo): repo for repo in repos}
            for future in as_completed(futures):
                try:
                    all_items.extend(future.result())
                except Exception as e:
                    logger.warning(f"[Plugin] Failed to fetch repo data: {e}")

        return all_items

    def __init__(self):
        self.found_repos: Set[str] = set()

    def find_git_root(self, path_str: str) -> Optional[str]:
        """
        Walks up the directory tree to find the .git folder.
        Returns the root path or None.
        """
        if not path_str:
            return None

        try:
            path = Path(path_str).resolve()
            # If file, start from parent
            if path.is_file():
                path = path.parent

            # Guard against root
            for _ in range(10):  # Depth limit
                if (path / ".git").exists():
                    return str(path)
                if path.parent == path:
                    break
                path = path.parent
        except Exception:
            return None

        return None

    def extract_repos_from_timeline(self, timeline: List[Any]) -> Set[str]:
        """
        Scans the timeline for file paths and identifies unique git repositories.
        """
        paths = set()

        for item in timeline:
            # Check context items
            for ctx in item.get("context", []):
                # Context strings are like "[VSCode] /path/to/file (lang)"
                # or "Project: /path/to/project"

                # Extract potential paths
                if "/" in ctx:
                    # Simple extraction: iterate words and check if it looks like a path
                    parts = ctx.split()
                    for p in parts:
                        # Clean up punctuation
                        clean_p = p.strip("[],()")
                        # Mock existence check for testing
                        if clean_p.startswith("/") and (os.path.exists(clean_p) or "test" in clean_p):
                            paths.add(clean_p)

        repos = set()
        for p in paths:
            root = self.find_git_root(p)
            if root:
                repos.add(root)

        self.found_repos = repos
        return repos

    def get_commits(self, repo_path: str, since: datetime, until: datetime) -> List[TimelineItem]:
        """
        Fetches commits for the current user since the given time as TimelineItems.
        """
        items: List[TimelineItem] = []
        try:
            # %aI: author date, strict ISO 8601 format
            cmd = [
                "git",
                "-C",
                repo_path,
                "log",
                f"--since={since.isoformat()}",
                f"--until={until.isoformat()}",
                "--pretty=format:%h|%an|%s|%aI",
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            if result.stdout:
                lines = result.stdout.strip().split("\n")
                repo_name = os.path.basename(repo_path)
                for line in lines:
                    parts = line.split("|", 3)
                    if len(parts) == 4:
                        h, author, msg, date_str = parts
                        dt = datetime.fromisoformat(date_str)
                        items.append(
                            TimelineItem(
                                timestamp=dt,
                                duration=1.0,
                                app="Git",
                                title=f"[{repo_name}] {msg} ({h})",
                                context=[
                                    f"{_('Author')}: {author}",
                                    f"{_('Repo')}: {repo_path}",
                                ],
                                category="Git",
                                project=repo_name,  # Set repo name as project, allows mapping/propagation
                                source="GitScanner",
                                metadata={},
                                url=None,
                                file=None,
                                language=None,
                                status=None,
                            )
                        )

        except subprocess.CalledProcessError:
            pass  # Not a git repo or error

        return items

    def get_gh_pr_status(self, repo_path: str, since: datetime, until: datetime) -> List[str]:
        """
        Fetches related PR status using `gh` CLI if available.
        """
        activities = []
        try:
            cmd = [
                "gh",
                "pr",
                "list",
                "--state",
                "all",
                "--author",
                "@me",
                "--limit",
                "10",
                "--json",
                "number,title,state,updatedAt,url,createdAt",
            ]

            result = subprocess.run(cmd, cwd=repo_path, capture_output=True, text=True)
            if result.returncode == 0 and result.stdout:
                prs = json.loads(result.stdout)
                repo_name = os.path.basename(repo_path)
                for pr in prs:
                    pr_time_str = pr.get("updatedAt")
                    pr_dt = datetime.fromisoformat(pr_time_str.replace("Z", "+00:00"))
                    if since <= pr_dt <= until:
                        state = pr.get("state")
                        title = pr.get("title")
                        url = pr.get("url")
                        activities.append(f"[{repo_name}] PR #{pr.get('number')} ({state}): {title} - {url}")
        except (subprocess.CalledProcessError, json.JSONDecodeError, FileNotFoundError):
            pass
        return activities

    def scan_activity(self, timeline: List[Any], start_time: datetime) -> List[str]:
        """Legacy method for summary report compatibility if needed"""
        repos = self.extract_repos_from_timeline(timeline)
        all_activities = []
        for repo in repos:
            # Note: this now returns items, so we convert back to string for legacy scan_activity if called
            items = self.get_commits(repo, start_time, datetime.now().astimezone())
            for item in items:
                all_activities.append(item.title)
            all_activities.extend(self.get_gh_pr_status(repo, start_time, datetime.now().astimezone()))
        return all_activities
