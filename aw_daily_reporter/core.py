"""
コアロジックモジュール

日報生成のためのメインエントリポイント。
サブコマンド構成: report, serve, plugin
"""

import argparse
import sys

from .shared.date_utils import get_date_range
from .shared.i18n import _
from .shared.logging import get_logger, setup_logging
from .timeline.generator import TimelineGenerator

logger = get_logger(__name__, scope="Core")


def cmd_report(args) -> None:
    """レポートを生成"""
    # Load config to determine day start source
    from .shared.settings_manager import SettingsManager

    config = SettingsManager.get_instance().load()
    system_config = config.get("system", {})
    day_start_source = system_config.get("day_start_source", "manual")
    manual_start_of_day = system_config.get("start_of_day", "00:00")

    # Fallback for old config using day_start_hour (int) - Removed as SettingsManager handles migration
    # Logic simplified to rely on start_of_day
    pass

    offset = manual_start_of_day

    if day_start_source == "aw":
        from .timeline.client import AWClient

        try:
            # Try to get from AW
            aw_client = AWClient()
            aw_setting = aw_client.get_setting("startOfDay")
            if aw_setting:
                offset = aw_setting
            else:
                logger.warning(
                    f"Failed to fetch startOfDay from ActivityWatch. "
                    f"Falling back to manual setting: {manual_start_of_day}"
                )
        except Exception as e:
            logger.warning(
                f"Error fetching startOfDay from ActivityWatch: {e}. "
                f"Falling back to manual setting: {manual_start_of_day}"
            )

    try:
        start, end = get_date_range(args.date, offset=offset)
    except ValueError as e:
        logger.error(f"{e}")
        sys.exit(1)

    generator = TimelineGenerator()

    # 出力形式に応じて処理
    renderer_name = args.renderer

    # 1. タイムライン生成 (レンダラも実行して出力をキャプチャ)
    # report, timeline, snapshots, renderer_outputs = generator.run(...)
    _, _, _, outputs = generator.run(start, end, suppress_timeline=not args.verbose, capture_renderers=True)

    # Load logic for CLI default
    from .shared.settings_manager import SettingsManager

    config = SettingsManager.get_instance().load()
    default_renderer = config.get("settings", {}).get("default_renderer")

    selected_output = None

    # 1. 指定がある場合
    if renderer_name:
        # 完全一致 (ID)
        if renderer_name in outputs:
            selected_output = outputs[renderer_name]
        else:
            # 前方・後方一致や略称検索
            # e.g. "ai" -> "aw_daily_reporter.plugins.renderer_ai.AIRendererPlugin"
            # "markdown" -> "aw_daily_reporter.plugins.renderer_markdown.MarkdownRendererPlugin"
            candidates = []
            for pid in outputs:
                # Check if renderer_name is part of the ID (case insensitive)
                # "renderer_ai" vs "ai"
                if renderer_name.lower() in pid.lower():
                    candidates.append(pid)

            if candidates:
                # 複数マッチした場合は、最短のものか、あるいは最初のものを採用
                # "renderer_ai" matches "ai"
                # "renderer_markdown" matches "markdown"

                # 優先度: "renderer_{name}" の形式に近いもの
                best_match = candidates[0]
                # もし "renderer_<renderer_name>" があればそれを優先
                for c in candidates:
                    if f"renderer_{renderer_name}".lower() in c.lower():
                        best_match = c
                        break

                selected_output = outputs[best_match]
            else:
                logger.warning(f"Renderer '{renderer_name}' not found. Available: {list(outputs.keys())}")

    # 2. デフォルト設定がある場合
    if selected_output is None and default_renderer and default_renderer in outputs:
        selected_output = outputs[default_renderer]

    # 3. フォールバック (Markdown)
    if selected_output is None and "aw_daily_reporter.plugins.renderer_markdown.MarkdownRendererPlugin" in outputs:
        selected_output = outputs["aw_daily_reporter.plugins.renderer_markdown.MarkdownRendererPlugin"]

    # 4. 最終フォールバック (何でもいいから出す)
    if selected_output is None and outputs:
        selected_output = list(outputs.values())[0]

    if selected_output:
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(selected_output)
        else:
            print(selected_output)  # Report output remains as print for stdout piping


def cmd_serve(args) -> None:
    """Web UI を起動"""
    import os
    import shutil
    import subprocess

    from .web.backend.app import create_app

    frontend_process = None

    # 実行パスの基準ディレクトリ
    base_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_dir = os.path.join(base_dir, "web", "frontend")

    # 開発モード判定: frontend/package.json が存在するか
    is_dev_env = os.path.exists(os.path.join(frontend_dir, "package.json"))

    # フロントエンドの起動 (開発環境かつ--no-frontendが指定されていない場合)
    # Flaskのデバッグモード(リローダー)使用時は、親プロセスではなく子プロセスでのみフロントエンドを起動する
    should_start_frontend = is_dev_env and not args.no_frontend

    # デバッグモードの判定
    # 開発環境ならデフォルトTrue, --no-debugならFalse
    args.debug = is_dev_env
    if args.no_debug:
        args.debug = False

    if args.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        should_start_frontend = False

    server_logger = get_logger(__name__ + ".server", scope="Server")

    if should_start_frontend:
        # パッケージマネージャの判定 (pnpm優先)
        pm = "npm"
        if os.path.exists(os.path.join(frontend_dir, "pnpm-lock.yaml")) and shutil.which("pnpm"):
            pm = "pnpm"

        server_logger.info(f"Starting frontend in {frontend_dir} using {pm}...")
        try:
            # 環境変数でポートを指定 (Next.js は PORT 環境変数を参照する)
            # 開発モードではフロントエンドは 5601 で起動する
            env = os.environ.copy()
            env["PORT"] = "5601"
            # pnpm/npm の実行コンテキストを強制的にフロントエンドディレクトリにする
            env["INIT_CWD"] = frontend_dir

            frontend_process = subprocess.Popen([pm, "run", "dev"], cwd=frontend_dir, env=env)
        except Exception as e:
            server_logger.error(f"Failed to start frontend: {e}")
            server_logger.error("Failed to start frontend. Please run it manually.")

    # ポートの決定
    # 指定がある場合はそれを使用
    # 指定がなく、開発モード(フロントエンド起動)の場合は 5602 (バックエンド用)
    # 指定がなく、静的配信モード(インストール版など)の場合は 5601 (単一ポート)
    if args.port is None:
        if is_dev_env and not args.no_frontend:
            args.port = 5602
        else:
            args.port = 5601

    app = create_app()

    url = f"http://{args.host}:{args.port}"
    # dev mode && frontend running -> open frontend URL (5601)
    open_url = f"http://{args.host}:5601" if is_dev_env and not args.no_frontend else url

    server_logger.info(f"Starting Web API at {url}")

    if frontend_process:
        server_logger.info("Frontend is starting... usually at http://localhost:5601")
    elif is_dev_env and not args.no_frontend:
        # Frontend process failed to start but we tried
        server_logger.info(
            "For UI, please run 'npm run dev' (usually http://localhost:5601) in aw_daily_reporter/web/frontend"
        )
    else:
        # Static serving mode
        server_logger.info("Serving static frontend from backend.")

    # ブラウザを自動で開く
    if not args.no_open:
        import webbrowser
        from threading import Timer

        def open_browser():
            webbrowser.open(open_url)

        Timer(3, open_browser).start()

    args_debug = getattr(args, "debug", False)

    try:
        if args_debug:
            app.run(host=args.host, port=args.port, debug=True)
        else:
            try:
                from waitress import serve

                server_logger.info(f"Starting production server (Waitress) at {url}")
                serve(app, host=args.host, port=args.port)
            except ImportError:
                server_logger.warning("Waitress not found. Falling back to Flask development server.")
                app.run(host=args.host, port=args.port, debug=False)
    finally:
        if frontend_process:
            server_logger.info("Stopping frontend...")
            frontend_process.terminate()
            frontend_process.wait()


def cmd_plugin(args) -> None:
    """プラグイン管理"""
    plugin_logger = get_logger(__name__ + ".plugin", scope="Plugin")
    if args.plugin_command == "list":
        cmd_plugin_list(args)
    elif args.plugin_command == "install":
        cmd_plugin_install(args, plugin_logger)
    elif args.plugin_command == "remove":
        cmd_plugin_remove(args, plugin_logger)
    else:
        plugin_logger.error(_("Unknown plugin command. Use: list, install, remove"))


def cmd_plugin_list(args) -> None:
    """インストール済みプラグイン一覧"""
    from .plugins.manager import PluginManager

    manager = PluginManager()
    manager.load_builtin_plugins()

    print(_("Installed plugins:"))
    for p in manager.processors:
        print(f"  [Processor] {p.name} ({p.plugin_id})")
    for s in manager.scanners:
        print(f"  [Scanner] {s.name} ({s.plugin_id})")
    for r in manager.renderers:
        print(f"  [Renderer] {r.name} ({r.plugin_id})")


def cmd_plugin_install(args, logger) -> None:
    """プラグインをインストール"""
    from .plugins.manager import PluginManager

    manager = PluginManager()
    try:
        manager.install_plugin(args.source)
        logger.info(_("Plugin installed successfully."))
    except Exception as e:
        logger.error(f"Failed to install plugin: {e}")
        sys.exit(1)


def cmd_plugin_remove(args, logger) -> None:
    """プラグインをアンインストール"""
    from .plugins.manager import PluginManager

    manager = PluginManager()
    try:
        manager.remove_plugin(args.name)
        logger.info(_("Plugin removed successfully."))
    except Exception as e:
        logger.error(f"Failed to remove plugin: {e}")
        sys.exit(1)


def main() -> None:
    """
    aw-daily-reporter のメインエントリポイント。
    サブコマンド: report, serve, plugin
    """
    setup_logging()

    # バージョン情報の取得
    try:
        from importlib.metadata import PackageNotFoundError, version

        try:
            __version__ = version("aw-daily-reporter")
        except PackageNotFoundError:
            __version__ = "unknown"
    except ImportError:
        __version__ = "unknown"

    parser = argparse.ArgumentParser(
        prog="aw-daily-reporter",
        description=_("Generate daily activity reports from ActivityWatch data."),
    )

    parser.add_argument(
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
        help=_("Show version number and exit."),
    )

    subparsers = parser.add_subparsers(dest="command", help=_("Available commands"))

    # report コマンド
    report_parser = subparsers.add_parser("report", help=_("Generate timeline report"))
    report_parser.add_argument(
        "-d",
        "--date",
        type=str,
        help=_("Date to generate report for (YYYY-MM-DD). Defaults to today."),
    )
    report_parser.add_argument("-o", "--output", type=str, help=_("Output file path. Defaults to stdout."))
    report_parser.add_argument(
        "-r",
        "--renderer",
        type=str,
        default=None,
        help=_("Output renderer (e.g., 'markdown', 'json', 'ai'). Defaults to configured renderer or markdown."),
    )
    report_parser.add_argument("-v", "--verbose", action="store_true", help=_("Show detailed timeline output."))
    report_parser.set_defaults(func=cmd_report)

    # serve コマンド
    serve_parser = subparsers.add_parser("serve", help=_("Start Web UI"))
    serve_parser.add_argument(
        "-p",
        "--port",
        type=int,
        default=None,
        help=_("Port number for Web UI. Defaults to 5602 in dev mode, 5601 in static mode."),
    )
    serve_parser.add_argument(
        "--host",
        type=str,
        default="127.0.0.1",
        help=_("Host to bind. Defaults to 127.0.0.1."),
    )
    serve_parser.add_argument("--no-open", action="store_true", help=_("Do not open browser automatically."))
    serve_parser.add_argument(
        "--no-frontend",
        action="store_true",
        help=_("Do not start frontend automatically."),
    )
    serve_parser.add_argument("--no-debug", action="store_true", help=_("Disable Flask debug mode (hot reload)."))
    serve_parser.set_defaults(func=cmd_serve)

    # plugin コマンド
    plugin_parser = subparsers.add_parser("plugin", help=_("Manage plugins"))
    plugin_subparsers = plugin_parser.add_subparsers(dest="plugin_command")

    plugin_list_parser = plugin_subparsers.add_parser("list", help=_("List installed plugins"))
    plugin_list_parser.set_defaults(func=cmd_plugin)

    plugin_install_parser = plugin_subparsers.add_parser("install", help=_("Install a plugin"))
    plugin_install_parser.add_argument("source", help=_("Plugin source (URL or local path)"))
    plugin_install_parser.set_defaults(func=cmd_plugin)

    plugin_remove_parser = plugin_subparsers.add_parser("remove", help=_("Remove a plugin"))
    plugin_remove_parser.add_argument("name", help=_("Plugin name to remove"))
    plugin_remove_parser.set_defaults(func=cmd_plugin)

    args = parser.parse_args()

    # サブコマンドなしの場合はデフォルトで serve を実行
    if args.command is None:
        args.command = "serve"
        # serve command defaults
        args.port = None
        args.host = "127.0.0.1"
        args.no_open = False
        args.no_frontend = False
        args.no_debug = False
        cmd_serve(args)
    elif hasattr(args, "func"):
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
