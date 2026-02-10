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

from ..shared.i18n import _
from .base import ProcessorPlugin, RendererPlugin, ScannerPlugin

if TYPE_CHECKING:
    from ..timeline.models import TimelineItem

logger = logging.getLogger(__name__)


class PluginManager:
    def __init__(self):
        from ..shared.settings_manager import ConfigStore

        self.processors: list[ProcessorPlugin] = []
        self.scanners: list[ScannerPlugin] = []
        self.renderers: list[RendererPlugin] = []
        self.config_store = ConfigStore.get_instance()
        self.config_store.load()  # 設定をロード（マイグレーションも実行）

    def _get_ordered_plugins(self, plugins: list[Any]) -> list[Any]:
        """
        設定に基づいてプラグインを並び替え、無効なものを除外する。
        未設定のプラグインがある場合は、デフォルト位置に追加して設定ファイルを更新する。
        """
        # config.json の plugins から設定を取得
        plugins_model = self.config_store.config.plugins
        plugins_config = plugins_model.model_dump() if hasattr(plugins_model, "model_dump") else {}

        # プラグインIDをキーとしたマップを作成（enabled 状態と順序を保持）
        config_map = {}
        plugin_order = []  # 設定での順序を保持

        for plugin_id, plugin_settings in plugins_config.items():
            if isinstance(plugin_settings, dict):
                config_map[plugin_id] = plugin_settings
                plugin_order.append(plugin_id)
            else:
                # 古い形式（dictでない場合）はスキップ
                logger.warning(f"Invalid plugin settings for {plugin_id}: {plugin_settings}")

        ordered_plugins = []

        # 1. 設定にあるプラグインを順序通りに追加（enabled のみ）
        for plugin_id in plugin_order:
            plugin_settings = config_map.get(plugin_id, {})
            enabled = plugin_settings.get("enabled", True)

            if enabled:
                # プラグインインスタンスを検索
                found = next((p for p in plugins if p.plugin_id == plugin_id), None)
                if found:
                    ordered_plugins.append(found)

        # 2. 設定にない（新規検出された）プラグインを特定
        new_plugins = [p for p in plugins if p.plugin_id not in config_map]

        # 新規プラグインがある場合、設定に追加
        if new_plugins:
            # 新規プラグインのデフォルト順序決定
            afk_pid = "aw_daily_reporter.plugins.processor_afk.AFKProcessor"
            afk_plugin = next((p for p in new_plugins if p.plugin_id == afk_pid), None)

            # AFKが新規なら、設定の先頭に挿入
            if afk_plugin:
                new_plugins.remove(afk_plugin)
                plugins_config[afk_plugin.plugin_id] = {"enabled": True}
                plugin_order.insert(0, afk_plugin.plugin_id)
                if afk_plugin not in ordered_plugins:
                    ordered_plugins.insert(0, afk_plugin)

            # Project Extraction が新規なら、Project Mapping の前に挿入
            extractor_pid = "aw_daily_reporter.plugins.processor_project_extractor.ProjectExtractionProcessor"
            extractor_plugin = next((p for p in new_plugins if p.plugin_id == extractor_pid), None)
            mapping_pid = "aw_daily_reporter.plugins.processor_project_mapping.ProjectMappingProcessor"

            if extractor_plugin:
                new_plugins.remove(extractor_plugin)
                plugins_config[extractor_plugin.plugin_id] = {"enabled": True}

                # Project Mapping の前に挿入
                if mapping_pid in plugin_order:
                    target_index = plugin_order.index(mapping_pid)
                    plugin_order.insert(target_index, extractor_plugin.plugin_id)
                else:
                    plugin_order.append(extractor_plugin.plugin_id)

                ordered_plugins.append(extractor_plugin)

            # その他の新規プラグインは末尾に追加
            for p in new_plugins:
                plugins_config[p.plugin_id] = {"enabled": True}
                plugin_order.append(p.plugin_id)
                ordered_plugins.append(p)

            # 設定を保存
            try:
                # plugins_config を ConfigStore に反映
                for plugin_id, settings in plugins_config.items():
                    setattr(self.config_store.config.plugins, plugin_id, settings)

                self.config_store.save()
                logger.info("Updated plugin settings in config.json")
            except Exception as e:
                logger.error(f"Failed to auto-update plugin config: {e}")

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
                urllib.request.urlretrieve(source, target_path)  # nosemgrep  # noqa: E501
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

        import pandas as pd

        # List[TimelineItem] → DataFrame に変換（最初のみ）
        # model_dump() handles serialization of nested models if any
        current_df = pd.DataFrame([t.model_dump() for t in timeline]) if timeline else pd.DataFrame()
        snapshots = []
        scan_summary = []

        # Initial state
        if include_snapshots:
            snapshots.append(
                {
                    "name": "Raw Data",
                    "timeline": copy.deepcopy(timeline),
                    "plugin": "Context Merger",
                }
            )

        # Merge and sort all plugins
        all_plugins = self._get_ordered_plugins(self.processors + self.scanners)

        for plugin in all_plugins:
            if isinstance(plugin, ScannerPlugin):
                # ScannerはList[dict]を必要とする
                current_list = current_df.to_dict("records") if not current_df.empty else []
                try:
                    scan_result = plugin.scan(current_list, start_time, end_time, config)
                    if scan_result:
                        # 戻り値の型によって振り分け (Mixed types supported)
                        scanner_summary_added = False
                        new_items: list[dict[str, Any]] = []
                        for item in scan_result:
                            if isinstance(item, str):
                                if not scanner_summary_added:
                                    scan_summary.append(f"\n# {plugin.name}")
                                    scanner_summary_added = True
                                scan_summary.append(item)
                            elif isinstance(item, dict):
                                new_items.append(item)

                        # 新しいアイテムがあればDataFrameに追加
                        if new_items:
                            new_df = pd.DataFrame(new_items)
                            current_df = pd.concat([current_df, new_df], ignore_index=True)
                            # 時系列順序の保証
                            if "timestamp" in current_df.columns:
                                current_df = current_df.sort_values("timestamp").reset_index(drop=True)
                except Exception as e:
                    logger.error(f"Plugin {plugin.name} failed during scan: {e}")
                    scan_summary.append(f"\n# {plugin.name} (Failed): {e}")

            elif isinstance(plugin, ProcessorPlugin):
                # ProcessorはDataFrameを直接処理
                try:
                    current_df = plugin.process(current_df, config)
                except Exception as e:
                    logger.error(f"Plugin {plugin.name} failed during process: {e}")
                    # Keep previous DataFrame if failed

            if include_snapshots:
                snapshot_list = current_df.to_dict("records") if not current_df.empty else []
                snapshots.append(
                    {
                        "name": f"After {plugin.name}",
                        "timeline": copy.deepcopy(snapshot_list),
                        "plugin": plugin.name,
                    }
                )

        # DataFrame → List[dict] に変換（最後のみ）
        if current_df.empty:
            final_timeline = []
        else:
            # timestampカラムをpython datetimeに変換（numpy/pandas Timestampから）
            if "timestamp" in current_df.columns:
                current_df = current_df.copy()
                current_df["timestamp"] = current_df["timestamp"].apply(
                    lambda x: x.to_pydatetime() if hasattr(x, "to_pydatetime") else x
                )
            from ..timeline.models import TimelineItem

            final_timeline = [TimelineItem(**rec) for rec in current_df.to_dict("records")]
        return final_timeline, snapshots, scan_summary

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
