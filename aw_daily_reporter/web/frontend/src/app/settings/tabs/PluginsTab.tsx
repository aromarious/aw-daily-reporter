"use client"

import * as LucideIcons from "lucide-react"
import { GripVertical } from "lucide-react"
import type React from "react"
import { useEffect, useState } from "react"
import { Card } from "@/components/Card"
import { useTranslation } from "@/contexts/I18nContext"
import type { Plugin } from "../types"

export default function PluginsTab() {
  const { t } = useTranslation()
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [draggedPluginIndex, setDraggedPluginIndex] = useState<number | null>(
    null,
  )

  // Load plugins on mount
  useEffect(() => {
    fetch("/api/plugins")
      .then((r) => r.json())
      .then((data) => setPlugins(data))
      .catch(console.error)
  }, [])

  const savePlugins = async (newPlugins: Plugin[]) => {
    const payload = newPlugins.map((p) => ({
      plugin_id: p.plugin_id,
      enabled: p.enabled,
    }))
    try {
      await fetch("/api/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      setPlugins(newPlugins)
    } catch (_err) {
      console.error("Plugin save failed", _err)
      alert(t("Failed to save plugins"))
    }
  }

  // DnD Handlers
  const handleDragStart = (event: React.DragEvent, index: number) => {
    setDraggedPluginIndex(index)
    event.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault() // Necessary to allow dropping
    event.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (event: React.DragEvent, dropIndex: number) => {
    event.preventDefault()

    if (draggedPluginIndex === null || draggedPluginIndex === dropIndex) return

    // Separate visible (non-renderer) and hidden (renderer) plugins
    const visiblePlugins = plugins.filter((p) => p.type !== "renderer")
    const hiddenPlugins = plugins.filter((p) => p.type === "renderer")

    // Reorder visible plugins
    const newVisiblePlugins = [...visiblePlugins]
    const [movedPlugin] = newVisiblePlugins.splice(draggedPluginIndex, 1)
    newVisiblePlugins.splice(dropIndex, 0, movedPlugin)

    // Merge back: visible first, then hidden (renderers usually don't depend on order relative to processors)
    const newPlugins = [...newVisiblePlugins, ...hiddenPlugins]

    setPlugins(newPlugins)
    savePlugins(newPlugins)
    setDraggedPluginIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedPluginIndex(null)
  }

  // 種別ごとのアイコンと色を取得するヘルパー関数
  const getPluginStyle = (type?: string) => {
    switch (type) {
      case "processor":
        return { Icon: LucideIcons.Settings, color: "text-blue-500" }
      case "scanner":
        return { Icon: LucideIcons.ScanSearch, color: "text-green-500" }
      case "renderer":
        return { Icon: LucideIcons.FileText, color: "text-purple-500" }
      default:
        return { Icon: LucideIcons.Cpu, color: "text-primary/70" }
    }
  }

  return (
    <Card title={t("Plugins")} className="flex-1 w-full min-h-0">
      <div className="flex-1 overflow-y-auto pr-2 mt-2 custom-scrollbar min-h-125">
        <p className="text-sm text-base-content/60 mb-4 px-1">
          {t("Enable/Disable plugins and change processing order.")}
        </p>
        <ul className="space-y-2">
          {plugins
            .filter((p) => p.type !== "renderer")
            .map((p, idx) => (
              <li
                key={p.plugin_id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  draggedPluginIndex === idx
                    ? "opacity-50 border-dashed border-primary bg-primary/5"
                    : "border-base-content/10 bg-base-100 hover:border-base-content/20"
                } transition-all`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="cursor-grab active:cursor-grabbing text-base-content/30 hover:text-base-content/60">
                    <GripVertical size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2 truncate">
                      {(() => {
                        const { Icon, color } = getPluginStyle(p.type)
                        return (
                          <Icon size={16} className={`${color} shrink-0`} />
                        )
                      })()}
                      <span className="truncate" title={p.plugin_id}>
                        {p.name || p.plugin_id}
                      </span>
                    </div>
                    {p.description && (
                      <div className="text-xs text-base-content/50 truncate mt-0.5 max-w-md">
                        {p.description}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  {p.source && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-base-200 text-base-content/60 rounded border border-base-content/5">
                      {p.source}
                    </span>
                  )}
                  <input
                    type="checkbox"
                    className="toggle toggle-sm border-base-content/20 bg-base-300 text-white checked:border-primary checked:bg-indigo-400 checked:text-white"
                    checked={p.enabled}
                    onChange={() => {
                      const newPlugins = plugins.map((pl) =>
                        pl.plugin_id === p.plugin_id
                          ? { ...pl, enabled: !pl.enabled }
                          : pl,
                      )
                      setPlugins(newPlugins)
                      savePlugins(newPlugins)
                    }}
                  />
                </div>
              </li>
            ))}
        </ul>
        {plugins.length === 0 && (
          <div className="text-center py-8 text-base-content/40 text-sm">
            {t("No plugins found")}
          </div>
        )}
      </div>
    </Card>
  )
}
