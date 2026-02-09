"""
APIルート定義モジュール

レポート取得、設定管理、プラグイン管理などのRESTful APIエンドポイントを
Flask Blueprintとして定義します。
"""

import dataclasses
import gettext
import json
import math
from datetime import datetime

from flask import Blueprint, jsonify, request
from pydantic import BaseModel

from aw_daily_reporter.shared.logging import get_logger

from ...shared.constants import DEFAULT_CATEGORY, DEFAULT_PROJECT, UNCATEGORIZED_KEYWORDS
from ...shared.date_utils import get_date_range
from ...shared.settings_manager import SettingsManager
from ...timeline.generator import TimelineGenerator

bp = Blueprint("main", __name__)
logger = get_logger(__name__, scope="API")


def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    if dataclasses.is_dataclass(obj):
        return dataclasses.asdict(obj)
    if isinstance(obj, BaseModel):
        return obj.model_dump(mode="json")
    raise TypeError(f"Type {type(obj)} not serializable")


def sanitize_for_json(obj):
    """Recursively convert NaN/Inf floats to None before JSON encoding."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    elif isinstance(obj, datetime):
        return obj.isoformat()
    elif dataclasses.is_dataclass(obj):
        return sanitize_for_json(dataclasses.asdict(obj))
    elif isinstance(obj, BaseModel):
        return sanitize_for_json(obj.model_dump(mode="json"))
    return obj


def _format_aw_time(setting):
    """Format ActivityWatch time setting to HH:MM string."""
    if not setting:
        return "00:00"
    if isinstance(setting, dict):
        h = setting.get("hour", 0)
        m = setting.get("minute", 0)
        return f"{h:02}:{m:02}"
    if isinstance(setting, int):
        return f"{setting:02}:00"
    if isinstance(setting, str):
        if ":" in setting:
            return setting
        try:
            h = int(setting)
            return f"{h:02}:00"
        except ValueError:
            pass
    return "00:00"


@bp.route("/api/status")
def status():
    return jsonify({"status": "ok"})


@bp.route("/api/constants")
def get_constants():
    """フロントエンドと共有する定数を返す"""

    return jsonify(
        {
            "uncategorized_keywords": UNCATEGORIZED_KEYWORDS,
            "default_category": DEFAULT_CATEGORY,
            "default_project": DEFAULT_PROJECT,
        }
    )


@bp.route("/api/report")
def get_report():
    date_str = request.args.get("date")

    # Load config to determine day start source
    day_start_source = "manual"
    manual_start_of_day = "00:00"
    system_config = {}

    try:
        from ...shared.settings_manager import SettingsManager

        config_obj = SettingsManager.get_instance().load()
        config = config_obj.model_dump(mode="json") if hasattr(config_obj, "model_dump") else config_obj
        system_config = config.get("system", {})
        day_start_source = system_config.get("day_start_source", "manual")
        manual_start_of_day = system_config.get("start_of_day", "00:00")
    except Exception as e:
        logger.warning(f"Warning: Failed to load settings in get_report: {e}")
        # Proceed with defaults

    # Fallback for old config using day_start_hour (int)
    day_start_hour_int = system_config.get("day_start_hour", 0)
    if manual_start_of_day == "00:00" and day_start_hour_int != 0:
        manual_start_of_day = f"{day_start_hour_int:02}:00"

    offset = manual_start_of_day

    if day_start_source == "aw":
        from ...timeline.client import AWClient

        try:
            # Try to get from AW
            aw_client = AWClient()
            aw_setting = aw_client.get_setting("startOfDay")
            if aw_setting:
                offset = _format_aw_time(aw_setting)
            else:
                logger.warning(
                    f"Warning: Failed to fetch startOfDay from ActivityWatch. "
                    f"Falling back to manual setting: {manual_start_of_day}"
                )
        except Exception as e:
            logger.warning(
                f"Warning: Error fetching startOfDay from ActivityWatch: {e}. "
                f"Falling back to manual setting: {manual_start_of_day}"
            )

    try:
        start, end = get_date_range(date_str, offset=offset)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    generator = TimelineGenerator()
    try:
        # Stop printing logic in web app
        report_data, timeline, snapshots, renderer_outputs = generator.run(
            start,
            end,
            suppress_timeline=True,
            skip_renderers=True,
            capture_renderers=True,
        )
        # Simplify timeline for frontend if needed, or just send it all
        renderer_names = {r.plugin_id: r.name for r in generator.plugin_manager.renderers}

        return (
            json.dumps(
                sanitize_for_json(
                    {
                        "report": report_data,
                        "timeline": timeline,
                        "snapshots": snapshots,
                        "renderer_outputs": renderer_outputs,
                        "renderer_names": renderer_names,
                    }
                ),
                default=json_serial,
            ),
            200,
            {"Content-Type": "application/json"},
        )
    except Exception as e:
        logger.error(f"Error in get_report: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@bp.route("/api/preview", methods=["POST"])
def preview_report():
    data = request.json
    date_str = data.get("date")
    config = data.get("config")

    if not config:
        return jsonify({"error": "Config is required"}), 400

    try:
        start, end = get_date_range(date_str)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    generator = TimelineGenerator()
    try:
        # Run with override config
        report_data, timeline, snapshots = generator.run(
            start,
            end,
            suppress_timeline=True,
            skip_renderers=True,
            override_config=config,
        )

        return (
            json.dumps(
                sanitize_for_json(
                    {
                        "report": report_data,
                        "timeline": timeline,
                        "snapshots": snapshots,
                    }
                ),
                default=json_serial,
            ),
            200,
            {"Content-Type": "application/json"},
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@bp.route("/api/pipeline/preview", methods=["POST"])
def pipeline_preview():
    """
    パイプラインデバッガー用: 指定ステージのBefore/Afterデータを返す

    Request:
    {
        "date": "2024-02-02",
        "stage": 1,  // 0=Raw, 1=After Categorize, 2=After Project, etc.
        "config": { ... }  // オプション: カスタム設定
    }

    Response:
    {
        "stages": [...],
        "before": { "name": "...", "timeline": [...] },
        "after": { "name": "...", "timeline": [...] },
        "diff": { ... }
    }
    """
    data = request.json
    date_str = data.get("date")
    stage_index = data.get("stage", 1)
    config = data.get("config")
    include_snapshots = data.get("include_snapshots", False)

    try:
        # Load config to determine day start source (copied from get_report)
        day_start_source = "manual"
        manual_start_of_day = "00:00"
        system_config = {}

        try:
            from ...shared.settings_manager import SettingsManager

            loaded_config_obj = SettingsManager.get_instance().load()
            loaded_config = (
                loaded_config_obj.model_dump(mode="json")
                if hasattr(loaded_config_obj, "model_dump")
                else loaded_config_obj
            )
            system_config = loaded_config.get("system", {})
            day_start_source = system_config.get("day_start_source", "manual")
            manual_start_of_day = system_config.get("start_of_day", "00:00")
        except Exception as e:
            logger.warning(f"Warning: Failed to load settings in pipeline_preview: {e}")

        # Fallback for old config using day_start_hour (int)
        day_start_hour_int = system_config.get("day_start_hour", 0)
        if manual_start_of_day == "00:00" and day_start_hour_int != 0:
            manual_start_of_day = f"{day_start_hour_int:02}:00"

        offset = manual_start_of_day

        if day_start_source == "aw":
            from ...timeline.client import AWClient

            try:
                # Try to get from AW
                aw_client = AWClient()
                aw_setting = aw_client.get_setting("startOfDay")
                if aw_setting:
                    offset = _format_aw_time(aw_setting)
            except Exception as e:
                logger.warning(f"Warning: Error fetching startOfDay from ActivityWatch in pipeline_preview: {e}. ")

        start, end = get_date_range(date_str, offset=offset)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 400

    generator = TimelineGenerator()
    try:
        # Run with optional config override
        if config:
            _, _, snapshots, _ = generator.run(
                start,
                end,
                suppress_timeline=True,
                skip_renderers=True,
                override_config=config,
                include_snapshots=include_snapshots,
            )
        else:
            _, _, snapshots, _ = generator.run(
                start, end, suppress_timeline=True, skip_renderers=True, include_snapshots=include_snapshots
            )

        def _get_item_attr(item, key, default=None):
            if isinstance(item, dict):
                return item.get(key, default)
            return getattr(item, key, default)

        # Build stage summaries
        stages = []
        for i, snap in enumerate(snapshots):
            timeline = snap.get("timeline", [])
            categorized = sum(1 for item in timeline if _get_item_attr(item, "category"))
            with_project = sum(1 for item in timeline if _get_item_attr(item, "project"))
            total_duration = sum(_get_item_attr(item, "duration", 0) for item in timeline)

            stages.append(
                {
                    "index": i,
                    "name": snap["name"],
                    "item_count": len(timeline),
                    "categorized_count": categorized,
                    "project_count": with_project,
                    "total_duration": total_duration,
                }
            )

        # Get before/after for selected stage
        stage_index = max(0, min(stage_index, len(snapshots) - 1))

        before_index = max(0, stage_index - 1)
        after_index = stage_index

        before_snap = snapshots[before_index] if before_index < len(snapshots) else None
        after_snap = snapshots[after_index] if after_index < len(snapshots) else None

        # Calculate diff
        diff = {"category_changes": {}, "project_changes": {}}
        if before_snap and after_snap:
            before_cats = {}
            after_cats = {}
            for item in before_snap.get("timeline", []):
                cat = _get_item_attr(item, "category") or DEFAULT_CATEGORY
                before_cats[cat] = before_cats.get(cat, 0) + 1
            for item in after_snap.get("timeline", []):
                cat = _get_item_attr(item, "category") or DEFAULT_CATEGORY
                after_cats[cat] = after_cats.get(cat, 0) + 1

            all_cats = set(before_cats.keys()) | set(after_cats.keys())
            for cat in all_cats:
                change = after_cats.get(cat, 0) - before_cats.get(cat, 0)
                if change != 0:
                    diff["category_changes"][cat] = change

        return (
            json.dumps(
                sanitize_for_json(
                    {
                        "stages": stages,
                        "before": before_snap,
                        "after": after_snap,
                        "diff": diff,
                        "selected_stage": stage_index,
                        "snapshots": snapshots,
                    }
                ),
                default=json_serial,
            ),
            200,
            {"Content-Type": "application/json"},
        )

    except Exception as e:
        logger.error(f"Error in pipeline_preview: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@bp.route("/api/settings", methods=["GET", "POST", "PATCH"])
def handle_settings():

    manager = SettingsManager.get_instance()

    if request.method == "GET":
        config_obj = manager.load()
        config = config_obj.model_dump(mode="json") if hasattr(config_obj, "model_dump") else config_obj

        # Inject current AW setting for UI display
        if config.get("system", {}).get("day_start_source") == "aw":
            try:
                from ...timeline.client import AWClient

                aw_client = AWClient()
                aw_setting = aw_client.get_setting("startOfDay")
                if aw_setting:
                    config["system"]["aw_start_of_day"] = _format_aw_time(aw_setting)
            except Exception as e:
                logger.warning(f"[API] Failed to fetch startOfDay for settings UI: {e}")

        return jsonify(config)

    elif request.method == "POST":
        try:
            from ...shared.settings_manager import AppConfig

            new_config = request.json
            # Ensure we store AppConfig object
            manager.config = AppConfig(**new_config)
            manager.save()
            return jsonify({"status": "saved"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    elif request.method == "PATCH":
        try:
            # Partial update (recursive merge)
            patch_data = request.json
            current_config_obj = manager.load()
            current_config = (
                current_config_obj.model_dump(mode="json")
                if hasattr(current_config_obj, "model_dump")
                else current_config_obj
            )

            def deep_update(target, source):
                for k, v in source.items():
                    if isinstance(v, dict) and k in target and isinstance(target[k], dict):
                        deep_update(target[k], v)
                    else:
                        target[k] = v

            from ...shared.settings_manager import AppConfig

            deep_update(current_config, patch_data)
            # Re-validate and store as AppConfig
            manager.config = AppConfig(**current_config)
            manager.save()
            return jsonify({"status": "patched"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500


@bp.route("/api/plugins", methods=["GET", "POST"])
def handle_plugins():
    from ...plugins.config import save_plugin_config
    from ...plugins.manager import PluginManager

    manager = PluginManager()
    # Ensure all available plugins (built-in + user) are loaded and synced with config
    manager.sync_plugins()

    # Create map by plugin_id for easy lookup
    plugin_map = {p.plugin_id: p for p in manager.processors + manager.scanners + manager.renderers}

    if request.method == "GET":
        response_list = []

        # 1. Add plugins based on config order
        # This ensures the order from the config is respected
        if manager.plugin_config:
            for cfg_entry in manager.plugin_config:
                plugin_id = cfg_entry.get("plugin_id")

                if plugin_id and plugin_id in plugin_map:
                    p = plugin_map[plugin_id]

                    # Determine plugin type
                    p_type = "unknown"
                    if p in manager.processors:
                        p_type = "processor"
                    elif p in manager.scanners:
                        p_type = "scanner"
                    elif p in manager.renderers:
                        p_type = "renderer"

                    source_type = "Built-in" if p.__class__.__module__.startswith("aw_daily_reporter") else "User"

                    response_list.append(
                        {
                            "plugin_id": p.plugin_id,
                            "name": p.name,
                            "type": p_type,
                            "description": p.description,
                            "source": source_type,
                            "enabled": cfg_entry.get("enabled", True),
                        }
                    )
                    # Remove from map to track what's left (plugins not in config yet)
                    if plugin_id in plugin_map:
                        del plugin_map[plugin_id]

        # 2. Append remaining plugins (defaults, not in config yet)
        # These are plugins that exist but haven't been explicitly configured/ordered by the user.
        # We add them at the end, typically enabled by default.
        remaining_plugins = sorted(plugin_map.values(), key=lambda x: x.name)

        for p in remaining_plugins:
            # Determine plugin type
            p_type = "unknown"
            if p in manager.processors:
                p_type = "processor"
            elif p in manager.scanners:
                p_type = "scanner"
            elif p in manager.renderers:
                p_type = "renderer"

            source_type = "Built-in" if p.__class__.__module__.startswith("aw_daily_reporter") else "User"

            response_list.append(
                {
                    "plugin_id": p.plugin_id,
                    "name": p.name,
                    "type": p_type,
                    "description": p.description,
                    "source": source_type,
                    "enabled": True,  # Default enabled for new plugins
                }
            )

        return jsonify(response_list)

    elif request.method == "POST":
        # Save plugin config (ordering and enabled state)
        # Expected: [{"plugin_id": "...", "enabled": true, "name": "..."}]
        new_config = request.json

        # Validate and clean config
        cleaned_config = []
        for item in new_config:
            if "plugin_id" not in item:
                logger.warning(f"Skipping config item due to missing 'plugin_id': {item}")
                continue

            # Verify plugin exists
            if item["plugin_id"] not in plugin_map:
                logger.warning(f"Trying to save config for unknown plugin: {item['plugin_id']}")
                continue

            plugin_map[item["plugin_id"]]

            cleaned_config.append({"plugin_id": item["plugin_id"], "enabled": item.get("enabled", True)})

        try:
            from aw_daily_reporter.plugins.config import save_plugin_config

            save_plugin_config(cleaned_config)
            # Update manager's in-memory config too
            manager.plugin_config = cleaned_config
            return jsonify({"status": "success"})
        except Exception as e:
            logger.error(f"Error saving plugin config: {e}")
            return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/api/translations")
def get_translations():
    lang = request.args.get("lang")
    from ...shared.i18n import get_translator

    # Force loading a specific translator to get access to catalog if possible
    # Ideally we should use gettext, but generic python gettext might not expose it easily in a dict format
    # unless we parse the MO/PO or rely on fallback.
    # Actually, GNUTranslations has _catalog (dict) in Python implementation.

    translator = get_translator(lang)

    # Access private _catalog if available (implementation detail of gettext)
    # Or load manually if needed. For now, let's try to peek _catalog.
    if isinstance(translator, gettext.GNUTranslations):
        pass

    # If using NullTranslations, it means no translation found or English fallback.
    # We might want to send a basic set of keys for English or just empty if we rely on keys as defaults.
    # However, frontend needs actual strings.
    # Better approach: Define a list of keys used in Frontend and translate them on the fly.

    frontend_keys = [
        "Daily Report",
        "Working Hours",
        "Break Time",
        "Time Distribution (Base: Working Hours)",
        "Project Distribution",
        "Suggestions for Unclassified items (add rules for these)",
        "Dashboard",
        "Configs",
        "Plugins",
        "Report for",
        "Total Duration",
        "Timeline",
        "Categorization Rules",
        "Save Config",
        "Installed Plugins",
        "Detailed Activity Log",
    ]

    translations = {}
    for key in frontend_keys:
        translations[key] = translator.gettext(key)

    return jsonify(translations)
