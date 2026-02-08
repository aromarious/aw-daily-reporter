"use client"

import clsx from "clsx"

import {
  AlertCircle,
  Cpu,
  FileJson,
  FileText,
  FolderGit2,
  GripVertical,
  ListFilter,
  Plus,
  Radar,
  Save,
  Settings,
  Tag,
} from "lucide-react"

import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import React, { useCallback, useEffect, useState } from "react"
import useSWR, { mutate } from "swr"
import { Card } from "@/components/Card"
import CategoryList from "@/components/CategoryList"
import { NoSSR } from "@/components/NoSSR"
import { useTranslation } from "@/contexts/I18nContext"

// Helpers
const fetcher = (url: string) => fetch(url).then((r) => r.json())

// Dynamic Components
const RuleList = dynamic(() => import("@/components/RuleList"), { ssr: false })
const ProjectMapList = dynamic(() => import("@/components/ProjectMapList"), {
  ssr: false,
})
const ExtractionPatternList = dynamic(
  () => import("@/components/ExtractionPatternList"),
  { ssr: false },
)
const ClientList = dynamic(() => import("@/components/ClientList"), {
  ssr: false,
})
const RuleModal = dynamic(() => import("@/components/RuleModal"), {
  ssr: false,
})

type Tab =
  | "general"
  | "categories"
  | "projects"
  | "rules"
  | "apps"
  | "plugins"
  | "advanced"

const VALID_TABS: Tab[] = [
  "general",
  "categories", // New
  "projects",
  "rules", // Renamed from "Categorization Rules" in UI but id kept for simplicity if desired, or better kept as rules
  "plugins",
  "advanced",
]

function getTabFromHash(): Tab {
  if (typeof window === "undefined") return "general"
  const hash = window.location.hash.slice(1)
  return VALID_TABS.includes(hash as Tab) ? (hash as Tab) : "general"
}

interface Rule {
  keyword: string | string[]
  category: string
  project: string
  target?: string
  app?: string
  enabled?: boolean
}

interface Plugin {
  plugin_id: string
  name: string
  enabled: boolean
  type?: string
  description?: string
  source?: "Built-in" | "User" | "Unknown"
}

interface SystemConfig {
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

interface SettingsConfig {
  afk_system_apps?: string[]
  break_categories?: string[]
  category_list?: string[]
  category_colors?: Record<string, string>
  ai_prompt?: string
  default_renderer?: string
  project_extraction_patterns?: string[]
}

interface FullConfig {
  system: SystemConfig
  settings: SettingsConfig
  rules: Rule[]
  categories: Record<string, string>
  project_map: Record<string, string>
  client_map?: Record<string, string> // Regex -> ClientID
  clients?: Record<string, { name: string; rate: number }>
  project_metadata?: Record<string, { client: string }>
}

export default function SettingsPage() {
  const { t, setLanguage } = useTranslation()
  const [activeTab, setActiveTabState] = useState<Tab>("general")

  // URLハッシュとタブ状態を同期
  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab)
    window.location.hash = tab
  }

  // 初期読み込み時にURLハッシュからタブを復元
  useEffect(() => {
    setActiveTabState(getTabFromHash())
  }, [])

  // Config Data (Global)
  const {
    data: config,
    error: configError,
    isLoading: configLoading,
  } = useSWR<FullConfig>("/api/settings", fetcher)

  // Theme
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync language from config when loaded
  useEffect(() => {
    if (config?.system?.language) {
      setLanguage(config.system.language as "en" | "ja")
    }
  }, [config?.system?.language, setLanguage])

  const [localRules, setLocalRules] = useState<Rule[]>([])
  const [localProjectMap, setLocalProjectMap] = useState<
    Record<string, string>
  >({})
  const [localClientMap, setLocalClientMap] = useState<Record<string, string>>(
    {},
  )

  // Project Extraction Patterns
  const [localExtractionPatterns, setLocalExtractionPatterns] = useState<
    string[]
  >([])

  // Category List
  const [localCategoryList, setLocalCategoryList] = useState<string[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  // トースト通知用
  const [toast, setToast] = useState<{
    message: string
    type: "success" | "error"
  } | null>(null)
  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({ message, type })
      setTimeout(() => setToast(null), 3000)
    },
    [],
  )

  // --- Tab: Advanced State ---
  const [advancedJson, setAdvancedJson] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Initialize local rules
  useEffect(() => {
    if (config) {
      if (config.rules) setLocalRules(config.rules)
      setLocalProjectMap(config.project_map || {})
      setLocalClientMap(config.client_map || {})
      setLocalExtractionPatterns(
        config.settings?.project_extraction_patterns || [],
      )
      setLocalCategoryList(config.settings?.category_list || [])
    }
  }, [config])

  // Initialize Advanced JSON
  useEffect(() => {
    if (config && activeTab === "advanced") {
      setAdvancedJson(JSON.stringify(config, null, 2))
      setJsonError(null)
    }
  }, [config, activeTab])

  // --- Tab: Plugins State ---
  const [plugins, setPlugins] = useState<Plugin[]>([])
  // Load plugins on tab switch
  useEffect(() => {
    if (activeTab === "plugins") {
      fetch("/api/plugins")
        .then((r) => r.json())
        .then((data) => setPlugins(data))
        .catch(console.error)
    }
  }, [activeTab])

  // DnD State
  const [draggedPluginIndex, setDraggedPluginIndex] = useState<number | null>(
    null,
  )
  const [draggedRuleIndex, setDraggedRuleIndex] = useState<number | null>(null)

  // --- Actions ---

  // Save Config (Universal) - returns success status
  const handleSaveConfig = async (
    newConfig: FullConfig | null = null,
    showNotification = false,
    immediate = false,
  ): Promise<boolean> => {
    const configToSave =
      newConfig ||
      (config
        ? {
            ...config,
            rules: localRules,
            project_map: localProjectMap,
            client_map: localClientMap,
          }
        : null)
    if (!configToSave) return false

    // Immediate save (e.g. for toggles or deletes)
    if (immediate) {
      return performSave(configToSave, showNotification)
    }

    // Debounced save
    debouncedSave(configToSave, showNotification)
    return true
  }

  const performSave = async (
    configToSave: FullConfig,
    showNotification: boolean,
  ) => {
    try {
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(configToSave),
      })
      mutate("/api/settings") // Revalidate global config
      if (showNotification) showToast(t("Configuration saved!"))
      return true
    } catch (_err) {
      console.error("Save failed", _err)
      if (showNotification) showToast(t("Failed to save settings"), "error")
      return false
    }
  }

  // Debounce logic
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const debouncedSave = useCallback(
    (configToSave: FullConfig, showNotification: boolean) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        /**
         * performSave is not in the dependency array
         * because it is an async function defined inside handleSaveConfig
         * which is recreated on every render.
         *
         * To fix this properly, we should wrap performSave in useCallback
         * or move it inside debouncedSave.
         *
         * However, moving performSave inside causes scope issues with showToast and mutate.
         * Best way is to use a ref for performSave or ignore the dependency if we're sure.
         *
         * Let's move performSave logic inside here or use a static ref.
         */
        // Direct fetch here to avoid dependency issues with performSave
        const saveAction = async () => {
          try {
            await fetch("/api/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(configToSave),
            })
            mutate("/api/settings")
            if (showNotification) showToast(t("Configuration saved!"))
          } catch (_err) {
            console.error("Save failed", _err)
            if (showNotification)
              showToast(t("Failed to save settings"), "error")
          }
        }
        saveAction()
      }, 1000)
    },
    [showToast, t],
  )

  // Advanced JSON Save
  const handleSaveAdvanced = () => {
    try {
      const parsed = JSON.parse(advancedJson)
      handleSaveConfig(parsed)
      setJsonError(null)
    } catch (e) {
      setJsonError((e as Error).message)
    }
  }

  // Plugin Actions
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
      alert("Failed to save plugins")
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

  // Rule DnD Handlers
  const handleRuleDragStart = (event: React.DragEvent, index: number) => {
    setDraggedRuleIndex(index)
    event.dataTransfer.effectAllowed = "move"
  }

  const handleRuleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  const handleRuleDrop = async (event: React.DragEvent, dropIndex: number) => {
    event.preventDefault()

    if (draggedRuleIndex === null || draggedRuleIndex === dropIndex) return

    const newRules = [...localRules]
    const [movedRule] = newRules.splice(draggedRuleIndex, 1)
    newRules.splice(dropIndex, 0, movedRule)

    setLocalRules(newRules)
    setDraggedRuleIndex(null)
    // 即座に保存
    if (config) {
      await handleSaveConfig({ ...config, rules: newRules }, true)
    }
  }

  const handleRuleDragEnd = () => {
    setDraggedRuleIndex(null)
  }

  // Rule Actions
  const handleAddRule = () => {
    setEditingIndex(null)
    setModalOpen(true)
  }
  const handleEditRule = (index: number) => {
    setEditingIndex(index)
    setModalOpen(true)
  }
  const handleDeleteRule = async (index: number) => {
    const newRules = [...localRules]
    newRules.splice(index, 1)
    setLocalRules(newRules)
    // 即座に保存
    if (config) {
      await handleSaveConfig({ ...config, rules: newRules }, true)
    }
  }
  const handleToggleRule = async (index: number) => {
    const newRules = [...localRules]
    newRules[index] = {
      ...newRules[index],
      enabled: !(newRules[index].enabled !== false),
    }
    setLocalRules(newRules)
    // 即座に保存
    if (config) {
      await handleSaveConfig({ ...config, rules: newRules }, true)
    }
  }
  const handleSaveRule = async (rule: Rule) => {
    const newRules = [...localRules]
    if (editingIndex !== null) newRules[editingIndex] = rule
    else newRules.unshift(rule)
    setLocalRules(newRules)
    // 即座に保存
    if (config) {
      await handleSaveConfig({ ...config, rules: newRules }, true)
    }
  }

  // 全ルールをオン/オフ
  const handleToggleAllRules = async (enabled: boolean) => {
    const newRules = localRules.map((rule) => ({
      ...rule,
      enabled,
    }))
    setLocalRules(newRules)
    if (config) {
      await handleSaveConfig({ ...config, rules: newRules }, true)
    }
  }

  // 全ルールが有効かどうか
  const allRulesEnabled =
    localRules.length > 0 && localRules.every((r) => r.enabled !== false)

  if (configLoading)
    return (
      <NoSSR>
        <div className="p-8 text-center text-base-content/60">
          {t("Loading settings...")}
        </div>
      </NoSSR>
    )
  if (configError)
    return (
      <NoSSR>
        <div className="p-8 text-center text-red-500">
          {t("Failed to load settings")}
        </div>
      </NoSSR>
    )

  return (
    <NoSSR>
      {/* トースト通知 */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}
      <div className="container mx-auto px-6 py-8 min-h-screen flex flex-col">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-base-content">
              {t("Settings")}
            </h1>
            <p className="text-base-content/60 text-sm">
              {t("Manage configuration, rules, and plugins")}
            </p>
          </div>
        </div>

        <div className="flex flex-1 gap-6 items-start">
          {/* Sidebar Navigation */}
          <div
            className="w-56 flex flex-col gap-1 shrink-0 sticky top-8"
            role="tablist"
          >
            <TabButton
              id="general"
              icon={Settings}
              label={t("General")}
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <hr className="my-2 border-base-content/10" />
            <TabButton
              id="categories"
              icon={Tag}
              label={t("Category Settings")}
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <TabButton
              id="projects"
              icon={FolderGit2}
              label={t("Projects")}
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <TabButton
              id="rules"
              icon={ListFilter}
              label={t("Categorization Rules")}
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <hr className="my-2 border-base-content/10" />
            <TabButton
              id="plugins"
              icon={Cpu}
              label={t("Plugins")}
              activeTab={activeTab}
              onClick={setActiveTab}
            />
            <div className="flex-1" />
            <TabButton
              id="advanced"
              icon={FileJson}
              label={t("Advanced Editor")}
              activeTab={activeTab}
              onClick={setActiveTab}
            />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col w-full min-w-0">
            {/* PROJECTS TAB */}
            {activeTab === "projects" && (
              <Card title={t("Projects")} className="flex-1 w-full min-h-0">
                <div className="flex-1 overflow-y-auto pr-2 mt-2 custom-scrollbar min-h-125">
                  <div className="space-y-8">
                    <div>
                      <h3 className="text-lg font-medium text-base-content mb-1 px-1">
                        {t("Extraction Rules")}
                      </h3>
                      <p className="text-sm text-base-content/60 mb-4 px-1">
                        {t(
                          "Default rules to extract project names from window titles.",
                        )}
                        <br />
                        {t("Only applied for")} <strong>{t("Editor")}</strong>
                        <br />
                        {t("Used by:")}{" "}
                        <span className="font-medium">
                          {t("Project Extraction")}
                        </span>
                      </p>
                      <ExtractionPatternList
                        patterns={localExtractionPatterns}
                        onUpdate={async (newPatterns) => {
                          setLocalExtractionPatterns(newPatterns)
                          if (config) {
                            await handleSaveConfig(
                              {
                                ...config,
                                settings: {
                                  ...config.settings,
                                  project_extraction_patterns: newPatterns,
                                },
                              },
                              true,
                            )
                          }
                        }}
                      />
                    </div>
                    <hr className="border-base-content/5" />
                    <div>
                      <h3 className="text-lg font-medium text-base-content mb-1 px-1">
                        {t("Clients")}
                      </h3>
                      <p className="text-sm text-base-content/60 mb-4 px-1">
                        {t("Manage client names.")}
                        <br />
                        {t("Used by:")}{" "}
                        <span className="font-medium">
                          {t("Project Mapping")}
                        </span>
                      </p>
                      <ClientList
                        clients={config?.clients || {}}
                        onChange={async (newClients) => {
                          if (config) {
                            await handleSaveConfig(
                              { ...config, clients: newClients },
                              true,
                            )
                          }
                        }}
                      />
                    </div>
                    <hr className="border-base-content/5" />
                    <div>
                      <h3 className="text-lg font-medium text-base-content mb-1 px-1">
                        {t("Project Mappings")}
                      </h3>
                      <p className="text-sm text-base-content/60 mb-4 px-1">
                        {t(
                          "Normalize project names (grouping or renaming) and assign clients.",
                        )}
                        <br />
                        {t("Used by:")}{" "}
                        <span className="font-medium">
                          {t("Project Mapping")}
                        </span>
                      </p>
                      <ProjectMapList
                        projectMap={localProjectMap}
                        clientMap={localClientMap}
                        clients={config?.clients || {}}
                        onUpdate={async (newMap, newClientMap) => {
                          setLocalProjectMap(newMap)
                          setLocalClientMap(newClientMap)
                          if (config) {
                            await handleSaveConfig(
                              {
                                ...config,
                                project_map: newMap,
                                client_map: newClientMap,
                              },
                              true,
                            )
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* RULES TAB */}
            {activeTab === "rules" && (
              <Card
                title={t("Categorization Rules")}
                className="flex-1 w-full min-h-0"
              >
                <div className="flex-1 overflow-y-auto pr-2 mt-2 custom-scrollbar min-h-125">
                  <p className="text-sm text-base-content/60 mb-4 px-1">
                    {t("Manage categorization rules")}
                    <br />
                    {t("Used by:")}{" "}
                    <span className="font-medium">
                      {t("Categorization Rules")}
                    </span>
                  </p>
                  {/* Action Bar: Add + Toggle All */}
                  <div className="flex gap-3 mb-4">
                    <button
                      type="button"
                      onClick={handleAddRule}
                      className="flex-1 py-2 border-2 border-dashed border-base-content/20 rounded-lg text-base-content/60 font-medium hover:border-primary hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={18} /> {t("Add New Rule")}
                    </button>
                    {/* Toggle All Button */}
                    {localRules.length > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          className="toggle toggle-sm border-base-content/20 bg-base-300 text-white checked:border-primary checked:bg-indigo-400 checked:text-white"
                          checked={allRulesEnabled}
                          onChange={() =>
                            handleToggleAllRules(!allRulesEnabled)
                          }
                        />
                        <span className="text-sm text-base-content/70 font-medium">
                          {allRulesEnabled ? t("All On") : t("All Off")}
                        </span>
                      </label>
                    )}
                  </div>
                  <RuleList
                    rules={localRules}
                    onEdit={handleEditRule}
                    onDelete={handleDeleteRule}
                    onToggle={handleToggleRule}
                    onDragStart={handleRuleDragStart}
                    onDragOver={handleRuleDragOver}
                    onDrop={handleRuleDrop}
                    onDragEnd={handleRuleDragEnd}
                    draggedIndex={draggedRuleIndex}
                  />
                </div>
              </Card>
            )}

            {/* GENERAL TAB */}
            {activeTab === "general" && config?.system && (
              <div className="h-full overflow-y-auto pr-4 space-y-6">
                <Card title={t("System Settings")}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="sys-lang"
                          className="block text-sm font-medium text-base-content/80 mb-1"
                        >
                          {t("Language")}{" "}
                          <span className="text-xs text-base-content/40 font-normal ml-1">
                            (Used by: I18N)
                          </span>
                        </label>
                        <select
                          id="sys-lang"
                          className="select select-bordered w-full"
                          value={config.system.language || "ja"}
                          onChange={(e) => {
                            const newLang = e.target.value
                            if (config) {
                              handleSaveConfig({
                                ...config,
                                rules: localRules,
                                system: {
                                  ...config.system,
                                  language: newLang,
                                },
                              })
                              setLanguage(newLang as "en" | "ja")
                            }
                          }}
                        >
                          <option value="ja">Japanese</option>
                          <option value="en">English</option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="sys-theme"
                          className="block text-sm font-medium text-base-content/80 mb-1"
                        >
                          {t("Theme")}
                        </label>
                        <select
                          id="sys-theme"
                          className="select select-bordered w-full"
                          value={mounted ? theme : "system"}
                          onChange={(e) => setTheme(e.target.value)}
                        >
                          <option value="system">{t("System Default")}</option>
                          <option value="light">{t("Light")}</option>
                          <option value="dark">{t("Dark")}</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label
                          htmlFor="sys-daysource"
                          className="block text-sm font-medium text-base-content/80 mb-1"
                        >
                          {t("Day Start Source")}
                        </label>
                        <select
                          id="sys-daysource"
                          className="select select-bordered w-full mb-2"
                          value={config.system.day_start_source || "manual"}
                          onChange={(e) => {
                            const newSource = e.target.value as "manual" | "aw"
                            if (config) {
                              handleSaveConfig({
                                ...config,
                                rules: localRules,
                                system: {
                                  ...config.system,
                                  day_start_source: newSource,
                                },
                              })
                            }
                          }}
                        >
                          <option value="manual">{t("Manual")}</option>
                          <option value="aw">
                            {t("Sync with ActivityWatch")}
                          </option>
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="sys-daystart"
                          className="block text-sm font-medium text-base-content/80 mb-1"
                        >
                          {t("Day Start Time")}
                        </label>
                        <input
                          id="sys-daystart"
                          type="time"
                          className={clsx(
                            "input input-bordered w-full",
                            config.system.day_start_source === "aw" &&
                              "cursor-not-allowed",
                          )}
                          readOnly={config.system.day_start_source === "aw"}
                          value={
                            config.system.day_start_source === "aw"
                              ? config.system.aw_start_of_day || ""
                              : config.system.start_of_day || "00:00"
                          }
                          placeholder={
                            config.system.day_start_source === "aw"
                              ? "Loading..."
                              : ""
                          }
                          onChange={(e) => {
                            if (config) {
                              // Update local state smoothly?
                              // For now direct save
                              handleSaveConfig({
                                ...config,
                                rules: localRules,
                                system: {
                                  ...config.system,
                                  start_of_day: e.target.value,
                                },
                              })
                            }
                          }}
                        />
                        {config.system.day_start_source === "aw" && (
                          <p className="text-xs text-base-content/60 mt-1">
                            {t(
                              "Retrieved from ActivityWatch settings (startOfDay)",
                            )}
                            {config.system.aw_start_of_day &&
                              `: ${config.system.aw_start_of_day}`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
                <Card title={t("ActivityWatch Connection")}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="aw-host"
                        className="block text-sm font-medium text-base-content/80 mb-1"
                      >
                        {t("Host")}
                      </label>
                      <input
                        id="aw-host"
                        type="text"
                        className="w-full px-3 py-2 border border-base-content/20 rounded-md bg-transparent text-base-content"
                        defaultValue={
                          config.system.activitywatch?.host || "127.0.0.1"
                        }
                        onBlur={(e) =>
                          config &&
                          handleSaveConfig({
                            ...config,
                            rules: localRules,
                            system: {
                              ...config.system,
                              activitywatch: {
                                ...(config.system.activitywatch || {}),
                                host: e.target.value,
                              },
                            },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="aw-port"
                        className="block text-sm font-medium text-base-content/80 mb-1"
                      >
                        Port
                      </label>
                      <input
                        id="aw-port"
                        type="number"
                        className="w-full px-3 py-2 border border-base-content/20 rounded-md bg-transparent text-base-content"
                        defaultValue={config.system.activitywatch?.port || 5600}
                        onBlur={(e) =>
                          config &&
                          handleSaveConfig({
                            ...config,
                            rules: localRules,
                            system: {
                              ...config.system,
                              activitywatch: {
                                ...(config.system.activitywatch || {}),
                                port: parseInt(e.target.value, 10),
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </Card>
                <Card title={t("AI Renderer Settings")}>
                  <div className="space-y-4">
                    <div>
                      <label
                        htmlFor="ai-prompt"
                        className="block text-sm font-medium text-base-content/80 mb-1"
                      >
                        {t("System Prompt")}{" "}
                        <span className="text-xs text-base-content/40 font-normal ml-1">
                          {t("(Used by: AI Context Renderer)")}
                        </span>
                      </label>
                      <textarea
                        id="ai-prompt"
                        className="w-full px-3 py-2 border border-base-content/20 rounded-md font-mono text-sm min-h-30"
                        placeholder={t(
                          "Enter custom instructions for the AI renderer...",
                        )}
                        defaultValue={config.settings?.ai_prompt || ""}
                        onBlur={(e) =>
                          config &&
                          handleSaveConfig({
                            ...config,
                            rules: localRules,
                            settings: {
                              ...config.settings,
                              ai_prompt: e.target.value,
                            },
                          })
                        }
                      />
                      <p className="text-xs text-base-content/60 mt-1">
                        {t(
                          "Custom instructions injected at the beginning of the AI Context Renderer output.",
                        )}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* CATEGORIES TAB (New) */}
            {activeTab === "categories" && config?.settings && (
              <div className="h-full overflow-y-auto pr-4 space-y-6">
                <Card title={t("Category List")}>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <p className="text-sm text-base-content/60">
                        {t("Manage the list of known categories.")}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const categoriesFromRules = Array.from(
                            new Set(
                              localRules.map((r) => r.category).filter(Boolean),
                            ),
                          )
                          const newCategories = Array.from(
                            new Set([
                              ...localCategoryList,
                              ...categoriesFromRules,
                            ]),
                          )
                          setLocalCategoryList(newCategories)
                          if (config) {
                            handleSaveConfig(
                              {
                                ...config,
                                settings: {
                                  ...config.settings,
                                  category_list: newCategories,
                                },
                              },
                              true,
                              true,
                            )
                          }
                        }}
                        className="btn btn-xs btn-ghost gap-1 opacity-70 hover:opacity-100"
                        title={t("Import categories used in existing rules")}
                      >
                        <ListFilter size={12} />
                        {t("Import from Rules")}
                      </button>
                    </div>
                    <CategoryList
                      categories={localCategoryList}
                      rules={localRules}
                      onChange={async (newCategories, newColors, newBreaks) => {
                        setLocalCategoryList(newCategories)
                        if (config) {
                          await handleSaveConfig(
                            {
                              ...config,
                              settings: {
                                ...config.settings,
                                category_list: newCategories,
                                category_colors: newColors,
                                break_categories: newBreaks,
                              },
                            },
                            true,
                          )
                        }
                      }}
                      initialColors={config?.settings?.category_colors}
                      initialBreakCategories={
                        config?.settings?.break_categories
                      }
                    />
                  </div>
                </Card>
              </div>
            )}

            {/* APPS TAB (Renamed from Logic, excludes Break Categories) */}
            {/* PLUGINS TAB */}
            {activeTab === "plugins" && (
              <div className="h-full overflow-y-auto pr-4 space-y-4">
                <Card title={t("Installed Plugins")}>
                  <ul className="space-y-3">
                    {plugins
                      .filter((p) => p.type !== "renderer")
                      .map((p, idx) => (
                        <li
                          key={p.plugin_id}
                          draggable
                          onDragStart={(event) => handleDragStart(event, idx)}
                          onDragOver={handleDragOver}
                          onDrop={(event) => handleDrop(event, idx)}
                          onDragEnd={handleDragEnd}
                          className={clsx(
                            "flex items-center justify-between p-3 bg-base-200 rounded-lg border border-base-content/5 transition-all hover:border-base-content/20",
                            draggedPluginIndex === idx
                              ? "opacity-50 border-dashed border-primary"
                              : "",
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {/* Toggle - same position as RuleList */}
                            <button
                              type="button"
                              onClick={() => {
                                const newPlugins = [...plugins]
                                newPlugins[idx].enabled =
                                  !newPlugins[idx].enabled
                                savePlugins(newPlugins)
                              }}
                              className={clsx(
                                "w-10 h-5 rounded-full relative transition-colors shrink-0",
                                p.enabled ? "bg-primary" : "bg-base-300",
                              )}
                              title={p.enabled ? t("Enabled") : t("Disabled")}
                            >
                              <span
                                className={clsx(
                                  "absolute left-0 top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                                  p.enabled
                                    ? "translate-x-5"
                                    : "translate-x-0.5",
                                )}
                              />
                            </button>
                            <div
                              className="cursor-move p-2 text-base-content/40 hover:text-base-content/70"
                              title="Drag to reorder"
                            >
                              <GripVertical size={20} />
                            </div>
                            <div className="p-2 bg-base-100 rounded-md shadow-xs border border-base-content/5">
                              {p.type === "processor" && (
                                <Cpu size={18} className="text-primary" />
                              )}
                              {p.type === "scanner" && (
                                <Radar size={18} className="text-success" />
                              )}
                              {p.type === "renderer" && (
                                <FileText size={18} className="text-warning" />
                              )}
                            </div>
                            <div
                              className={clsx(
                                p.enabled ? "opacity-100" : "opacity-50",
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium text-base-content">
                                  {p.name}
                                </h3>
                                <span
                                  className={clsx(
                                    "text-[10px] px-1.5 py-0.5 rounded-full font-medium border",
                                    p.type === "processor" &&
                                      "bg-primary/10 text-primary border-primary/20",
                                    p.type === "scanner" &&
                                      "bg-success/10 text-success border-success/20",
                                    p.type === "renderer" &&
                                      "bg-warning/10 text-warning border-warning/20",
                                    ![
                                      "processor",
                                      "scanner",
                                      "renderer",
                                    ].includes(p.type || "") &&
                                      "bg-base-200 text-base-content/60 border-base-content/10",
                                  )}
                                >
                                  {t(p.type || "")}
                                </span>
                                {p.source && (
                                  <span
                                    className={clsx(
                                      "text-[10px] px-1.5 py-0.5 rounded-full font-medium border",
                                      p.source === "User"
                                        ? "bg-warning/10 text-warning border-warning/20"
                                        : "bg-base-200 text-base-content/60 border-base-content/10",
                                    )}
                                  >
                                    {t(p.source)}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-base-content/60 mt-0.5">
                                {p.description || "No description"}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                  </ul>
                </Card>
              </div>
            )}

            {/* ADVANCED TAB */}
            {activeTab === "advanced" && config && (
              <div className="flex-1 pr-4 flex flex-col min-h-0">
                <Card
                  title={t("Raw Configuration (JSON)")}
                  className="flex-1 flex flex-col min-h-150 relative"
                >
                  <div className="absolute top-4 right-4 z-10">
                    <button
                      type="button"
                      onClick={handleSaveAdvanced}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-md hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <Save size={14} /> {t("Save")}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <AlertCircle size={12} /> {t("Direct JSON editing")}
                    </p>
                    {jsonError && (
                      <p className="text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded">
                        {t("Invalid JSON")}: {jsonError}
                      </p>
                    )}
                  </div>
                  <textarea
                    className={clsx(
                      "flex-1 w-full font-mono text-sm p-4 bg-neutral text-neutral-content rounded-lg mb-4 resize-none focus:ring-2 focus:ring-indigo-500 focus:outline-none",
                      jsonError ? "border-2 border-red-500" : "border-0",
                    )}
                    value={advancedJson}
                    onChange={(e) => setAdvancedJson(e.target.value)}
                  />
                </Card>
              </div>
            )}
          </div>

          <RuleModal
            key={`modal-${modalOpen}-${editingIndex}`}
            isOpen={modalOpen}
            initialRule={
              editingIndex !== null ? localRules[editingIndex] : null
            }
            onClose={() => setModalOpen(false)}
            onSave={handleSaveRule}
            categoryList={localCategoryList}
            onDelete={
              editingIndex !== null
                ? () => {
                    handleDeleteRule(editingIndex)
                    setModalOpen(false)
                  }
                : undefined
            }
          />
        </div>
      </div>
    </NoSSR>
  )
}

const TabButton = ({
  id,
  icon: Icon,
  label,
  activeTab,
  onClick,
}: {
  id: Tab
  icon: React.ElementType
  label: string
  activeTab: Tab
  onClick: (id: Tab) => void
}) => (
  <button
    type="button"
    onClick={() => onClick(id)}
    className={clsx(
      "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors text-left",
      activeTab === id
        ? "bg-primary/10 text-primary shadow-xs"
        : "text-base-content/70 hover:bg-base-200 hover:text-base-content",
    )}
  >
    <Icon size={16} />
    {label}
  </button>
)
