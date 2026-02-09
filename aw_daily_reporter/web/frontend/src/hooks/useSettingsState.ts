"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import useSWR, { mutate } from "swr"
import type { FullConfig, Rule, Tab } from "@/app/settings/types"
import { useTranslation } from "@/contexts/I18nContext"
import { useToast } from "@/contexts/ToastContext"
import { fetcher } from "@/lib/api"

export function useSettingsState() {
  const { t, setLanguage } = useTranslation()
  const { showToast } = useToast()

  // Tab State
  const [activeTab, setActiveTabState] = useState<Tab>("general")

  // Config Data
  const {
    data: config,
    error: configError,
    isLoading: configLoading,
  } = useSWR<FullConfig>("/api/settings", fetcher)

  // Initialization State
  const [mounted, setMounted] = useState(false)
  const [localConfig, setLocalConfig] = useState({
    rules: [] as Rule[],
    projectMap: {} as Record<string, string>,
    clientMap: {} as Record<string, string>,
    extractionPatterns: [] as string[],
    categoryList: [] as string[],
  })

  // Setters helpers
  const setLocalRules = (rules: Rule[]) =>
    setLocalConfig((prev) => ({ ...prev, rules }))
  const setLocalProjectMap = (projectMap: Record<string, string>) =>
    setLocalConfig((prev) => ({ ...prev, projectMap }))
  const setLocalClientMap = (clientMap: Record<string, string>) =>
    setLocalConfig((prev) => ({ ...prev, clientMap }))
  const setLocalExtractionPatterns = (extractionPatterns: string[]) =>
    setLocalConfig((prev) => ({ ...prev, extractionPatterns }))
  const setLocalCategoryList = (categoryList: string[]) =>
    setLocalConfig((prev) => ({ ...prev, categoryList }))

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync language from config
  useEffect(() => {
    if (config?.system?.language) {
      setLanguage(config.system.language as "en" | "ja")
    }
  }, [config?.system?.language, setLanguage])

  // Initialize local states from config
  useEffect(() => {
    if (config) {
      setLocalConfig({
        rules: config.rules || [],
        projectMap: config.project_map || {},
        clientMap: config.client_map || {},
        extractionPatterns: config.settings?.project_extraction_patterns || [],
        categoryList: config.settings?.category_list || [],
      })
    }
  }, [config])

  // Tab sync with URL hash
  const getTabFromHash = useCallback((): Tab => {
    if (typeof window === "undefined") return "general"
    const hash = window.location.hash.slice(1)
    const VALID_TABS: Tab[] = [
      "general",
      "categories",
      "projects",
      "rules",
      "plugins",
      "advanced",
    ]
    return VALID_TABS.includes(hash as Tab) ? (hash as Tab) : "general"
  }, [])

  useEffect(() => {
    setActiveTabState(getTabFromHash())
  }, [getTabFromHash])

  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab)
    window.location.hash = tab
  }

  // Save Logic
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const performSave = useCallback(
    async (configToSave: FullConfig, showNotification: boolean) => {
      try {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configToSave),
        })
        mutate("/api/settings")
        if (showNotification) showToast(t("Configuration saved!"))
        return true
      } catch (_err) {
        console.error("Save failed", _err)
        if (showNotification) showToast(t("Failed to save settings"), "error")
        return false
      }
    },
    [showToast, t],
  )

  const debouncedSave = useCallback(
    (configToSave: FullConfig, showNotification: boolean) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        performSave(configToSave, showNotification)
      }, 1000)
    },
    [performSave], // performSave dependencies are internal or stable
  )

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
            rules: localConfig.rules,
            project_map: localConfig.projectMap,
            client_map: localConfig.clientMap,
          }
        : null)
    if (!configToSave) return false

    if (immediate) {
      return performSave(configToSave, showNotification)
    }

    debouncedSave(configToSave, showNotification)
    return true
  }

  return {
    activeTab,
    setActiveTab,
    config,
    configError,
    configLoading,
    mounted,
    localRules: localConfig.rules,
    setLocalRules,
    localProjectMap: localConfig.projectMap,
    setLocalProjectMap,
    localClientMap: localConfig.clientMap,
    setLocalClientMap,
    localExtractionPatterns: localConfig.extractionPatterns,
    setLocalExtractionPatterns,
    localCategoryList: localConfig.categoryList,
    setLocalCategoryList,
    handleSaveConfig,
  }
}
