"""
Flaskアプリケーションモジュール

Web UIのバックエンドとなるFlaskアプリケーションを生成する
ファクトリ関数を提供します。
"""

import contextlib
import os

from flask import Flask

from aw_daily_reporter.shared.logging import get_logger

from .routes import bp as main_bp

logger = get_logger(__name__, scope="Server")


def create_app(test_config=None):
    logger.info("Initializing Flask app...")
    # ../frontend/out works relative to this file's directory (web/backend)
    # But it's safer to resolve it absolutely relative to __file__
    base_dir = os.path.dirname(os.path.abspath(__file__))
    frontend_out = os.path.join(base_dir, "../frontend/out")

    # Initialize Flask app with static folder pointing to frontend build output
    # static_url_path='' ensures static files are served from root (e.g. /favicon.ico)
    app = Flask(
        __name__,
        instance_relative_config=True,
        static_folder=frontend_out,
        static_url_path="",
    )

    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_mapping(
            SECRET_KEY="dev",
        )
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)

    # ensure the instance folder exists
    with contextlib.suppress(OSError):
        os.makedirs(app.instance_path)

    app.register_blueprint(main_bp)

    # Serve index.html for any unknown path (SPA support)
    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def catch_all(path):
        # API requests are handled by blueprint.
        # If it falls through here, check if it's a static file exists.
        # If static file exists, Flask's static handler would have caught it IF we didn't override behavior.
        # But wait, static_url_path='' makes Flask try to match static files first?
        # Actually with static_url_path='', Flask adds a route for static files at root.
        # However, checking persistence of 404s.

        # Let's keep it simple:
        # If the path exists in static folder, send it.
        # Otherwise send index.html.

        # Note: Flask's default static handler takes precedence if the file exists when static_url_path is set.
        # But we also need to be careful not to shadow API routes.
        # API routes are registered via blueprint, usually /api/...
        # So they should match first if they are specific.

        try:
            return app.send_static_file(path)
        except Exception:  # NotFound or other error
            return app.send_static_file("index.html")

    return app
