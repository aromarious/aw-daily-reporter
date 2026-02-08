---
trigger: glob
globs: *.py
---

# Python Project Rules

## Logging
- **Standards**: Refer to [Logging Standards](../../docs/logging.md) for detailed log level definitions and usage.
- **No `print()`**: Do not use `print()` statements for production code. Use the `logging` module.
- **Scoped Logging**: Use structured scopes in log messages to improve filterability.
    - Format: `logger.info("[Scope] Message")`
    - Common Scopes:
        - `[Server]`: Application startup/shutdown
        - `[API]`: Route handling and request processing
        - `[Core]`: Core application logic
        - `[Plugin]`: Plugin execution and lifecycle
        - `[PERF]`: Performance metrics (Must be `DEBUG` level)
- **Error Handling**: Do not leave bare `except:` blocks. Log the exception with `logger.error(..., exc_info=True)`.

## Type Hinting
- **Explicit Types**: Use specific types (`List[str]`, `Dict[str, Any]`, `Optional[int]`) over `Any` whenever possible.
- **Return Types**: Define return types for all functions.

## Testing
- **Run Tests on Change**: When modifying logic, you MUST run relevant tests and confirm they pass before reporting completion.
- **Add Tests on Addition**: When adding new logic, you MUST create corresponding tests to cover the new functionality.

## Internationalization (i18n)
- **Use `_()`**: Wrap all user-facing strings (logs, UI, reports) in `_()` from `aw_daily_reporter.shared.i18n`.
- **No Hardcoded English**: Do not hardcode English strings directly in output or UI elements.
- **Import**: Use `from ..shared.i18n import _` (relative) or `from aw_daily_reporter.shared.i18n import _` (absolute).

## General
- **Language**: All comments and documentation must be in Japanese.
