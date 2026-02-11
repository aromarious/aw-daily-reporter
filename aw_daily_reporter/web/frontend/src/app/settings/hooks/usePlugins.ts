import { useEffect, useState } from "react"

export interface Plugin {
  plugin_id: string
  name: string
  type: string
  description: string
  source: string
  enabled: boolean
  required_settings?: string[]
}

export interface PluginsApiResponse {
  plugins: Plugin[]
  active_required_settings: string[]
}

/**
 * プラグイン情報を取得するカスタムフック
 */
export function usePlugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [activeRequiredSettings, setActiveRequiredSettings] = useState<
    string[]
  >([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/plugins")
      .then((r) => r.json())
      .then((data: PluginsApiResponse | Plugin[]) => {
        // 新しいレスポンス形式と古い形式の両方をサポート
        if (Array.isArray(data)) {
          setPlugins(data)
          setActiveRequiredSettings([])
        } else {
          setPlugins(data.plugins)
          setActiveRequiredSettings(data.active_required_settings || [])
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error("Failed to fetch plugins:", err)
        setLoading(false)
      })
  }, [])

  /**
   * 指定されたプラグインIDが有効かどうかをチェック
   */
  const isPluginEnabled = (pluginId: string): boolean => {
    const plugin = plugins.find((p) => p.plugin_id === pluginId)
    return plugin?.enabled ?? false
  }

  /**
   * 指定された設定キーが有効なプラグインに必要かどうかをチェック
   */
  const isSettingRequired = (settingKey: string): boolean => {
    return activeRequiredSettings.includes(settingKey)
  }

  return {
    plugins,
    loading,
    isPluginEnabled,
    activeRequiredSettings,
    isSettingRequired,
  }
}
