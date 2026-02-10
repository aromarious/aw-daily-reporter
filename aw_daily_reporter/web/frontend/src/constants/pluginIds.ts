// プラグインIDの定数定義
export const PLUGIN_IDS = {
  PROCESSOR_PROJECT_EXTRACTOR:
    "aw_daily_reporter.plugins.processor_project_extractor.ProjectExtractionProcessor",
  PROCESSOR_AFK: "aw_daily_reporter.plugins.processor_afk.AFKProcessor",
  RENDERER_MARKDOWN:
    "aw_daily_reporter.plugins.renderer_markdown.MarkdownRendererPlugin",
  RENDERER_AI: "aw_daily_reporter.plugins.renderer_ai.AIRendererPlugin",
} as const
