export type Tab =
  | "general"
  | "categories"
  | "projects"
  | "rules"
  | "apps"
  | "plugins"
  | "datasources"
  | "advanced"

export interface Rule {
  keyword: string | string[]
  category: string
  project: string
  target?: string
  app?: string
  enabled?: boolean
}

export interface Plugin {
  plugin_id: string
  name: string
  enabled: boolean
  type?: string
  description?: string
  source?: "Built-in" | "User" | "Unknown"
}

export interface SystemConfig {
  language?: string
  timezone?: string
  activitywatch?: {
    host?: string
    port?: number
  }
  day_start_hour?: number // Deprecated but kept for compatibility
  day_start_source?: "manual" | "aw"
  start_of_day?: string
  aw_start_of_day?: string // Injected from backend
  enabled_bucket_ids?: string[] // Data source bucket filter
  // システム全体の設定
  default_renderer?: string
  category_list?: string[]
  category_colors?: Record<string, string>
  break_categories?: string[]
  report?: {
    output_dir?: string
  }
}

// プラグイン設定のコンテナ型（プラグインID: 設定オブジェクト）
export interface PluginConfig {
  [pluginId: string]: any
}

// プロジェクト抽出パターンの型
export type ExtractionPatterns = Record<string, string[]> | string[]

// プロジェクト抽出プラグインの設定型
export interface ProjectExtractorConfig {
  project_extraction_patterns?: ExtractionPatterns
}

// 後方互換性のため SettingsConfig を残すが、使用は非推奨
/** @deprecated Use system.* or plugins[pluginId].* instead */
export interface SettingsConfig {
  afk_system_apps?: string[]
  break_categories?: string[]
  category_list?: string[]
  category_colors?: Record<string, string>
  ai_prompt?: string
  default_renderer?: string
  project_extraction_patterns?: string[]
}

export interface FullConfig {
  system: SystemConfig
  plugins: PluginConfig
  plugin_order?: string[] // プラグインの表示順序
  settings?: SettingsConfig // 後方互換性のため残す
  rules: Rule[]
  categories: Record<string, string>
  project_map: Record<string, string>
  project_map_order?: string[] // プロジェクトマップのキー順序
  client_map?: Record<string, string> // Regex -> ClientID
  clients?: Record<string, { name: string; rate: number }>
  project_metadata?: Record<string, { client: string }>
}
