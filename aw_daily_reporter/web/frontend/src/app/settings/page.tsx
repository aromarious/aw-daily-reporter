"use client"

import clsx from "clsx"
import {
  Cpu,
  FileJson,
  FolderGit2,
  ListFilter,
  Settings,
  Tag,
} from "lucide-react"

import { useTheme } from "next-themes"
import React, { useCallback, useEffect, useState } from "react"
import useSWR, { mutate } from "swr"
import { NoSSR } from "@/components/NoSSR"
import { useTranslation } from "@/contexts/I18nContext"
import AdvancedTab from "./tabs/AdvancedTab"
import CategoriesTab from "./tabs/CategoriesTab"
import GeneralTab from "./tabs/GeneralTab"
import PluginsTab from "./tabs/PluginsTab"
import ProjectsTab from "./tabs/ProjectsTab"
import RulesTab from "./tabs/RulesTab"
import type { FullConfig, Rule, Tab } from "./types"

// Helpers
const fetcher = (url: string) => fetch(url).then((r) => r.json())

const VALID_TABS: Tab[] = [
  "general",
  "categories",
  "projects",
  "rules",
  "plugins",
  "advanced",
]

function getTabFromHash(): Tab {
  if (typeof window === "undefined") return "general"
  const hash = window.location.hash.slice(1)
  return VALID_TABS.includes(hash as Tab) ? (hash as Tab) : "general"
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

  // Local States for Optimistic UI / Editing
  const [localRules, setLocalRules] = useState<Rule[]>([])
  const [localProjectMap, setLocalProjectMap] = useState<
    Record<string, string>
  >({})
  const [localClientMap, setLocalClientMap] = useState<Record<string, string>>(
    {},
  )
  const [localExtractionPatterns, setLocalExtractionPatterns] = useState<
    string[]
  >([])
  const [localCategoryList, setLocalCategoryList] = useState<string[]>([])

  // Initialize local states from config
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

  // Toast Notification
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

  // Save Config Logic
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

  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const debouncedSave = useCallback(
    (configToSave: FullConfig, showNotification: boolean) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
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
      {/* Toast Notification */}
      {toast && (
        <div
          className={clsx(
            "fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all",
            toast.type === "success"
              ? "bg-green-500 text-white"
              : "bg-red-500 text-white",
          )}
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
            {activeTab === "general" && config && (
              <GeneralTab
                config={config}
                localRules={localRules}
                handleSaveConfig={handleSaveConfig}
                setLanguage={setLanguage}
                theme={theme}
                setTheme={setTheme}
                mounted={mounted}
              />
            )}

            {activeTab === "categories" && config && (
              <CategoriesTab
                config={config}
                localRules={localRules}
                localCategoryList={localCategoryList}
                setLocalCategoryList={setLocalCategoryList}
                handleSaveConfig={handleSaveConfig}
              />
            )}

            {activeTab === "projects" && (
              <ProjectsTab
                config={config}
                localExtractionPatterns={localExtractionPatterns}
                setLocalExtractionPatterns={setLocalExtractionPatterns}
                localProjectMap={localProjectMap}
                setLocalProjectMap={setLocalProjectMap}
                localClientMap={localClientMap}
                setLocalClientMap={setLocalClientMap}
                handleSaveConfig={handleSaveConfig}
              />
            )}

            {activeTab === "rules" && (
              <RulesTab
                config={config}
                localRules={localRules}
                setLocalRules={setLocalRules}
                handleSaveConfig={handleSaveConfig}
              />
            )}

            {activeTab === "plugins" && <PluginsTab />}

            {activeTab === "advanced" && (
              <AdvancedTab
                config={config}
                handleSaveConfig={handleSaveConfig}
              />
            )}
          </div>
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
