"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR, { mutate } from "swr"
import { useTranslation } from "@/contexts/I18nContext"
import { api, fetcher } from "@/lib/api"

interface RendererOutputViewerProps {
  outputs: Record<string, string>
  rendererNames?: Record<string, string>
}

export function RendererOutputViewer({
  outputs,
  rendererNames,
}: RendererOutputViewerProps) {
  const keys = useMemo(() => Object.keys(outputs), [outputs])
  const [activeKey, setActiveKey] = useState(keys[0])

  // Define config type for SWR
  interface Config {
    settings?: {
      default_renderer?: string
    }
  }

  const { data: config } = useSWR<Config>("/api/settings", fetcher)
  const { t } = useTranslation()

  // Load initial active key from settings or default to first available
  useEffect(() => {
    if (
      config?.settings?.default_renderer &&
      keys.includes(config.settings.default_renderer)
    ) {
      setActiveKey(config.settings.default_renderer)
    }
  }, [config, keys])

  // Update active key if keys change and current is invalid
  useEffect(() => {
    if (!keys.includes(activeKey) && keys.length > 0) {
      setActiveKey(keys[0])
    }
  }, [keys, activeKey])

  const handleTabChange = async (key: string) => {
    setActiveKey(key)
    // Persist selection
    try {
      await api.patch("/api/settings", {
        settings: {
          default_renderer: key,
        },
      })
      // create mutated config for SWR update
      if (config) {
        mutate(
          "/api/settings",
          {
            ...config,
            settings: {
              ...config.settings,
              default_renderer: key,
            },
          },
          false,
        )
      }
    } catch (e) {
      console.error("Failed to save default renderer", e)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(outputs[activeKey])
    alert(t("Copied to clipboard!"))
  }

  if (keys.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-base-200 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {keys.map((key) => {
            const name = rendererNames?.[key] || key
            return (
              <button
                type="button"
                key={key}
                onClick={() => handleTabChange(key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  activeKey === key
                    ? "bg-primary/10 text-primary"
                    : "text-base-content/70 hover:bg-base-200"
                }`}
              >
                {name}
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="text-xs px-3 py-1.5 bg-base-200 hover:bg-base-300 text-base-content/80 rounded-md transition-colors font-medium ml-2 shrink-0"
        >
          {t("Copy")}
        </button>
      </div>
      <div className="relative">
        <pre className="p-4 bg-[#1e293b] text-slate-50 rounded-lg overflow-x-auto text-xs font-mono min-h-50 max-h-150 custom-scrollbar selection:bg-primary/30">
          {outputs[activeKey]}
        </pre>
      </div>
    </div>
  )
}
