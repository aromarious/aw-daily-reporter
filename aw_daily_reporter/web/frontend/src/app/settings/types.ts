export type Tab =
  | "general"
  | "categories"
  | "projects"
  | "rules"
  | "apps"
  | "plugins"
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
  report?: {
    output_dir?: string
  }
}

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
  settings: SettingsConfig
  rules: Rule[]
  categories: Record<string, string>
  project_map: Record<string, string>
  client_map?: Record<string, string> // Regex -> ClientID
  clients?: Record<string, { name: string; rate: number }>
  project_metadata?: Record<string, { client: string }>
}
