"""
プラグインマネージャーモジュール

プラグインの登録、読み込み、実行順序の管理を行います。
組み込みプラグイン（プロセッサ、スキャナ、レンダラ）とユーザープラグインの
両方をサポートし、設定に基づいた順序でパイプライン処理を実行します。
"""

from __future__ import annotations

import importlib
import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any

from .base import ProcessorPlugin, RendererPlugin, ScannerPlugin

if TYPE_CHECKING:
    from ..timeline.models import TimelineItem

from ..shared.i18n import _

logger = logging.getLogger(__name__)


class PluginManager:
    def __init__(self):
        from .config import load_plugin_config

        self.processors: list[ProcessorPlugin] = []
        self.scanners: list[ScannerPlugin] = []
        self.renderers: list[RendererPlugin] = []
        self.plugin_config = load_plugin_config()

    def _get_ordered_plugins(self, plugins: list[Any]) -> list[Any]:
        """
        設定に基づいてプラグインを並び替え、無効なものを除外する。
        未設定のプラグインがある場合は、デフォルト位置に追加して設定ファイルを更新する。
        """
        from .config import save_plugin_config

        # 1. 既存の設定があれば、その順序で取り出す
        # config keeps "plugin_id" (or "slug"/"name" for legacy)
        config_map = {}
        needs_migration = False  # Flag to force save if meaningful changes (like adding plugin_ids) are needed

        seen_ids_check = set()

        if self.plugin_config:
            for p in self.plugin_config:
                # plugin_idがなければnameからプラグインを探して設定
                if "plugin_id" not in p:
                    found = next((pl for pl in plugins if pl.name == p.get("name")), None)
                    if found:
                        p["plugin_id"] = found.plugin_id
                        needs_migration = True

                # Check for duplicates
                pid = p.get("plugin_id")
                if pid:
                    if pid in seen_ids_check:
                        needs_migration = True
                    seen_ids_check.add(pid)

                # Map config by plugin_id (preferred) or legacy key
                key = p.get("plugin_id") or p.get("name")
                config_map[key] = p

        ordered_plugins = []

        # 設定にあるものを追加
        if self.plugin_config:
            for cfg in self.plugin_config:
                cfg_id = cfg.get("plugin_id")
                cfg_slug = cfg.get("slug")  # Legacy
                cfg_name = cfg.get("name")  # Legacy

                # Find matching plugin instance
                found = None
                if cfg_id:
                    found = next((p for p in plugins if p.plugin_id == cfg_id), None)
                elif cfg_slug:
                    # Try to match by legacy slug map if we can't find by ID (though we should have migrated above)
                    # Actually we removed slug from plugins, so we can only match by ID now.
                    # But if we successfully migrated it in the loop above, cfg needs to be read from the updated p?
                    # The loop above updated the dict objects in self.plugin_config references.
                    # So cfg["plugin_id"] should be set if migration worked.
                    pass
                elif cfg_name:
                    # Legacy fallback: match by name
                    found = next((p for p in plugins if p.name == cfg_name), None)

                if found and cfg.get("enabled", True):
                    ordered_plugins.append(found)

        # 2. 設定にない（新規検出された）プラグインを特定
        # Plugins that are NOT in config_map (checked by plugin_id)
        new_plugins = []
        for p in plugins:
            if p.plugin_id not in config_map:
                # Also check legacy keys in config_map just in case extraction failed but it's there
                # (unlikely if migration logic is sound)
                new_plugins.append(p)

        # 新規がある場合、または設定ファイル自体がない場合は設定を生成・更新
        if new_plugins or not self.plugin_config or needs_migration:
            # 新規プラグインのデフォルト順序決定
            # AFK Processing は処理の性質上、先頭であることが望ましい
            afk_pid = "aw_daily_reporter.plugins.processor_afk.AFKProcessor"
            afk_plugin = next((p for p in new_plugins if p.plugin_id == afk_pid), None)

            # リスト構築
            new_config_list = list(self.plugin_config) if self.plugin_config else []

            # AFKが新規なら、設定の先頭に挿入
            if afk_plugin:
                new_plugins.remove(afk_plugin)
                new_config_list.insert(0, {"plugin_id": afk_plugin.plugin_id, "enabled": True})
                if afk_plugin not in ordered_plugins:
                    ordered_plugins.insert(0, afk_plugin)

            # Project Extraction が新規なら、Project Mapping の前に挿入を試みる
            extractor_pid = "aw_daily_reporter.plugins.processor_project_extractor.ProjectExtractionProcessor"
            extractor_plugin = next((p for p in new_plugins if p.plugin_id == extractor_pid), None)

            mapping_pid = "aw_daily_reporter.plugins.processor_project_mapping.ProjectMappingProcessor"

            if extractor_plugin:
                new_plugins.remove(extractor_plugin)

                # 挿入位置を探す
                target_index = -1
                for i, item in enumerate(new_config_list):
                    # Check by ID
                    pid = item.get("plugin_id")
                    # Also check legacy name just in case
                    n = item.get("name")
                    if pid == mapping_pid or n in [
                        "Project Mapping",
                        "プロジェクトマッピング",
                    ]:
                        target_index = i
                        break

                if target_index >= 0:
                    new_config_list.insert(
                        target_index,
                        {"plugin_id": extractor_plugin.plugin_id, "enabled": True},
                    )
                else:
                    new_config_list.append({"plugin_id": extractor_plugin.plugin_id, "enabled": True})

                ordered_plugins.append(extractor_plugin)

            # その他の新規は末尾に追加
            for p in new_plugins:
                new_config_list.append({"plugin_id": p.plugin_id, "enabled": True})
                ordered_plugins.append(p)

            # Dedup config list by plugin_id (keep first occurrence)
            seen_ids = set()
            deduped_config = []
            for item in new_config_list:
                s = item.get("plugin_id")
                if s:
                    if s in seen_ids:
                        continue
                    seen_ids.add(s)

                # Cleanup legacy keys if plugin_id is present
                if s:
                    if "slug" in item:
                        del item["slug"]
                    if "name" in item:
                        del item["name"]  # Cleanup name

                deduped_config.append(item)
            new_config_list = deduped_config

            # 設定ファイルに書き込み (永続化)
            try:
                save_plugin_config(new_config_list)
                logger.info("Updated plugins.json with info.")
                # メモリ上の設定も更新
                self.plugin_config = new_config_list
            except Exception as e:
                logger.error(f"Failed to auto-update plugins.json: {e}")

        else:
            # 新規がない場合でも、ordered_plugins には「設定で有効かつ存在するもの」しか入っていない。
            pass

        return ordered_plugins

    def register_processor(self, processor: ProcessorPlugin):
        self.processors.append(processor)
        logger.info(_("Registered Processor: {}").format(processor.name))

    def register_scanner(self, scanner: ScannerPlugin):
        self.scanners.append(scanner)
        logger.info(_("Registered Scanner: {}").format(scanner.name))

    def register_renderer(self, renderer: RendererPlugin):
        self.renderers.append(renderer)
        logger.info(_("Registered Renderer: {}").format(renderer.name))

    def load_builtin_plugins(self):
        """組み込みプラグインの読み込み"""
        # 遅延インポートで循環参照を回避
        from .processor_afk import AFKProcessor
        from .processor_compression import CompressionProcessor
        from .processor_project_extractor import ProjectExtractionProcessor
        from .processor_project_mapping import ProjectMappingProcessor
        from .processor_rule_matching import RuleMatchingProcessor
        from .renderer_ai import AIRendererPlugin
        from .renderer_markdown import MarkdownRendererPlugin
        from .scanner_git import GitScanner

        # スキャナ
        self.register_scanner(GitScanner())

        # プロセッサ (実行順序が重要)
        self.register_processor(AFKProcessor())
        self.register_processor(RuleMatchingProcessor())
        self.register_processor(ProjectExtractionProcessor())
        self.register_processor(ProjectMappingProcessor())
        self.register_processor(CompressionProcessor())

        # レンダラ
        self.register_renderer(MarkdownRendererPlugin())
        self.register_renderer(AIRendererPlugin())
        from .renderer_json import JSONRendererPlugin

        self.register_renderer(JSONRendererPlugin())

        # ユーザープラグインも読み込む
        self.load_user_plugins()

    def sync_plugins(self):
        """
        全プラグインをスキャンし、設定ファイルにないものがあれば追加して保存する。
        """
        # _get_ordered_plugins は副作用として新規プラグインを検出し、保存するロジックを含んでいる。
        # したがって、すべてのプラグインを渡してこれを呼び出せばよい。

        if not self.processors and not self.scanners and not self.renderers:
            self.load_builtin_plugins()

        all_plugins = self.processors + self.scanners + self.renderers
        # 呼び出すだけで同期される
        self._get_ordered_plugins(all_plugins)

    def load_user_plugins(self):
        """ユーザーディレクトリからプラグインを読み込む"""
        import os
        import sys

        plugin_dir = os.path.expanduser("~/.config/aw-daily-reporter/plugins")
        if not os.path.exists(plugin_dir):
            return

        sys.path.append(plugin_dir)

        for filename in os.listdir(plugin_dir):
            if filename.endswith(".py") and not filename.startswith("__"):
                module_name = filename[:-3]
                try:
                    module = importlib.import_module(module_name)

                    # Find and register plugin classes
                    for _name, obj in vars(module).items():
                        if isinstance(obj, type):
                            if issubclass(obj, ProcessorPlugin) and obj is not ProcessorPlugin:
                                self.register_processor(obj())
                            elif issubclass(obj, ScannerPlugin) and obj is not ScannerPlugin:
                                self.register_scanner(obj())
                            elif issubclass(obj, RendererPlugin) and obj is not RendererPlugin:
                                self.register_renderer(obj())

                except Exception as e:
                    logger.warning(f"Failed to load user plugin {filename}: {e}")

        sys.path.remove(plugin_dir)

    def install_plugin(self, source: str) -> None:
        """プラグインをインストール (URL またはファイルパス)"""
        import os
        import shutil
        import urllib.request
        from urllib.parse import urlparse

        plugin_dir = os.path.expanduser("~/.config/aw-daily-reporter/plugins")
        os.makedirs(plugin_dir, exist_ok=True)

        try:
            if source.startswith("http://") or source.startswith("https://"):
                # URL install
                filename = os.path.basename(urlparse(source).path)
                if not filename.endswith(".py"):
                    raise ValueError("URL must end with .py")

                target_path = os.path.join(plugin_dir, filename)
                urllib.request.urlretrieve(source, target_path)
                logger.info(_("Installed plugin from URL to {}").format(target_path))
            else:
                # Local file install
                if not os.path.isfile(source):
                    raise FileNotFoundError(f"File not found: {source}")
                if not source.endswith(".py"):
                    raise ValueError("Source must be a .py file")

                filename = os.path.basename(source)
                target_path = os.path.join(plugin_dir, filename)
                shutil.copy(source, target_path)
                logger.info(_("Installed plugin from file to {}").format(target_path))

        except Exception as e:
            logger.error(_("Failed to install plugin: {}").format(e))
            raise

    def remove_plugin(self, name: str) -> None:
        """プラグインを削除 (名前指定)"""
        import os

        # 名前指定だが、実体はファイルなので、ファイルを探す必要がある。
        # 単純化のため、name.py を探すか、全スキャンするか。
        # ここでは name.py を削除対象とする。

        plugin_dir = os.path.expanduser("~/.config/aw-daily-reporter/plugins")
        target_path = os.path.join(plugin_dir, f"{name}.py")

        if os.path.exists(target_path):
            os.remove(target_path)
            logger.info(_("Removed plugin: {}").format(target_path))
        else:
            logger.warning(_("Plugin file not found: {}").format(target_path))
            # Try searching by loaded plugin name?
            # But we might not have loaded it yet.

    def run_processors(self, timeline: list[dict[str, Any]], config: dict[str, Any]) -> list[dict[str, Any]]:
        """すべてのプロセッサを実行 (設定順)"""
        result = timeline
        processors_to_run = self._get_ordered_plugins(self.processors)
        for processor in processors_to_run:
            result = processor.process(result, config)
        return result

    def run_processors_with_snapshots(
        self, timeline: list[dict[str, Any]], config: dict[str, Any]
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """
        すべてのプロセッサを実行し、各段階のスナップショットも返す

        Returns:
            (final_timeline, snapshots)
            snapshots: List of { "name": "ProcessorName", "timeline": [items...] }
        """
        import copy

        current_timeline = timeline
        snapshots = []

        # Initial state
        snapshots.append(
            {
                "name": "Raw Data",
                "timeline": copy.deepcopy(current_timeline),
                "plugin": "Context Merger",
            }
        )

        processors_to_run = self._get_ordered_plugins(self.processors)
        for processor in processors_to_run:
            current_timeline = processor.process(current_timeline, config)
            snapshots.append(
                {
                    "name": f"After {processor.name}",
                    "timeline": copy.deepcopy(current_timeline),
                    "plugin": processor.name,
                }
            )

        return current_timeline, snapshots

    def run_scanners(
        self,
        timeline: list[TimelineItem],
        start_time: Any,
        end_time: Any,
        config: dict[str, Any],
    ) -> dict[str, list[Any]]:
        """
        すべてのスキャナを実行し、結果を分類して返します。 (設定順)

        Returns:
            Dict[str, List[Any]]: {"summary": List[str], "items": List[TimelineItem]}
        """
        results: dict[str, list[Any]] = {"summary": [], "items": []}
        scanners_to_run = self._get_ordered_plugins(self.scanners)

        for scanner in scanners_to_run:
            scan_result = scanner.scan(timeline, start_time, end_time, config)
            if not scan_result:
                continue

            # 戻り値の型によって振り分け (Mixed types supported)
            scanner_summary_added = False
            for item in scan_result:
                if isinstance(item, str):
                    if not scanner_summary_added:
                        results["summary"].append(f"\n# {scanner.name}")
                        scanner_summary_added = True
                    results["summary"].append(item)
                elif isinstance(item, dict):
                    results["items"].append(item)
        return results

    def run_pipeline_with_snapshots(
        self,
        timeline: list[TimelineItem],
        start_time: datetime,
        end_time: datetime,
        config: dict[str, Any],
        include_snapshots: bool = False,
    ) -> tuple[list[TimelineItem], list[dict[str, Any]], list[str]]:
        """
        すべてのプラグイン（スキャナとプロセッサ）を設定順に実行し、各段階のスナップショットも返す。

        Args:
            include_snapshots: Trueの場合、各段階のタイムラインをdeepcopyして保持（パフォーマンス影響大）

        Returns:
            (final_timeline, snapshots, scan_summary)
        """
        import copy

        current_timeline = timeline
        snapshots = []
        scan_summary = []

        # Initial state
        if include_snapshots:
            snapshots.append(
                {
                    "name": "Raw Data",
                    "timeline": copy.deepcopy(current_timeline),
                    "plugin": "Context Merger",
                }
            )

        # Merge and sort all plugins
        all_plugins = self._get_ordered_plugins(self.processors + self.scanners)

        for plugin in all_plugins:
            # check type
            # logger.debug(msg)

            if isinstance(plugin, ScannerPlugin):
                try:
                    scan_result = plugin.scan(current_timeline, start_time, end_time, config)
                    if not scan_result:
                        # Snapshot even if no change? Yes, to show flow.
                        pass
                    else:
                        # 戻り値の型によって振り分け (Mixed types supported)
                        scanner_summary_added = False
                        for item in scan_result:
                            if isinstance(item, str):
                                if not scanner_summary_added:
                                    scan_summary.append(f"\n# {plugin.name}")
                                    scanner_summary_added = True
                                scan_summary.append(item)
                            elif isinstance(item, dict):
                                current_timeline.append(item)

                        # 時系列順序の保証 (Scanner追加後は必ずソート)
                        # 変更があった場合のみソート (items added)
                        if any(isinstance(i, dict) for i in scan_result):
                            current_timeline.sort(key=lambda x: x["timestamp"])
                except Exception as e:
                    logger.error(f"Plugin {plugin.name} failed during scan: {e}")
                    scan_summary.append(f"\n# {plugin.name} (Failed): {e}")

            elif isinstance(plugin, ProcessorPlugin):
                try:
                    current_timeline = plugin.process(current_timeline, config)
                except Exception as e:
                    logger.error(f"Plugin {plugin.name} failed during process: {e}")
                    # Keep previous timeline if failed

            if include_snapshots:
                snapshots.append(
                    {
                        "name": f"After {plugin.name}",
                        "timeline": copy.deepcopy(current_timeline),
                        "plugin": plugin.name,
                    }
                )

        return current_timeline, snapshots, scan_summary

    def run_renderers(
        self,
        timeline: list[TimelineItem],
        report_data: dict[str, Any],
        config: dict[str, Any],
    ) -> dict[str, str]:
        """すべてのレンダラを実行し、出力を収集して返す (設定順)"""
        renderers_to_run = self._get_ordered_plugins(self.renderers)
        outputs = {}
        for renderer in renderers_to_run:
            try:
                output = renderer.render(timeline, report_data, config)
                if output:
                    outputs[renderer.plugin_id] = output
            except Exception as e:
                logger.error(f"Renderer {renderer.name} failed: {e}")
                outputs[renderer.plugin_id] = f"Error rendering: {e}"
        return outputs
