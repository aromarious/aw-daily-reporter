"use client"

import clsx from "clsx"
import {
  Cpu,
  Database,
  FolderGit2,
  ListFilter,
  Settings,
  Tag,
} from "lucide-react"

import { useTheme } from "next-themes"
import { NoSSR } from "@/app/settings/_components/NoSSR"
import { useTranslation } from "@/contexts/I18nContext"
import { useSettingsState } from "@/hooks/useSettingsState"
import CategoriesTab from "./tabs/CategoriesTab"
import DataSourcesTab from "./tabs/DataSourcesTab"
import GeneralTab from "./tabs/GeneralTab"
import PluginsTab from "./tabs/PluginsTab"
import ProjectsTab from "./tabs/ProjectsTab"
import RulesTab from "./tabs/RulesTab"
import type { Tab } from "./types"

// Helpers
export default function SettingsPage() {
  const { t, setLanguage } = useTranslation()
  const {
    activeTab,
    setActiveTab,
    config,
    configError,
    configLoading,
    mounted,
    localRules,
    setLocalRules,
    localProjectMap,
    setLocalProjectMap,
    localClientMap,
    setLocalClientMap,
    localExtractionPatterns,
    setLocalExtractionPatterns,
    localCategoryList,
    setLocalCategoryList,
    handleSaveConfig,
  } = useSettingsState()

  const { theme, setTheme } = useTheme()

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
            <TabButton
              id="datasources"
              icon={Database}
              label={t("Data Sources")}
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

            {activeTab === "datasources" && (
              <DataSourcesTab
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
