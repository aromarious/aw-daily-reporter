import { useEffect, useState } from "react"

export interface Plugin {
  plugin_id: string
  name: string
  type: string
  description: string
  source: string
  enabled: boolean
}

/**
 * プラグイン情報を取得するカスタムフック
 */
export function usePlugins() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/plugins")
      .then((r) => r.json())
      .then((data) => {
        setPlugins(data)
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

  return { plugins, loading, isPluginEnabled }
}
