"use client"

import dynamic from "next/dynamic"
import { Card } from "@/components/Card"
import { PLUGIN_IDS } from "@/constants/pluginIds"
import { useTranslation } from "@/contexts/I18nContext"
import { usePlugins } from "../hooks/usePlugins"
import type { FullConfig } from "../types"

// Dynamic Components for Projects Tab
const ProjectMapList = dynamic(
  () => import("@/app/settings/_components/ProjectMapList"),
  {
    ssr: false,
  },
)
const ExtractionPatternList = dynamic(
  () => import("@/app/settings/_components/ExtractionPatternList"),
  { ssr: false },
)
const ClientList = dynamic(
  () => import("@/app/settings/_components/ClientList"),
  {
    ssr: false,
  },
)

interface ProjectsTabProps {
  config: FullConfig | undefined
  localExtractionPatterns: string[]
  setLocalExtractionPatterns: (patterns: string[]) => void
  localProjectMap: Record<string, string>
  setLocalProjectMap: (map: Record<string, string>) => void
  localClientMap: Record<string, string>
  setLocalClientMap: (map: Record<string, string>) => void
  handleSaveConfig: (
    newConfig: FullConfig | null,
    showNotification?: boolean,
    immediate?: boolean,
  ) => Promise<boolean>
}

export default function ProjectsTab({
  config,
  localExtractionPatterns,
  setLocalExtractionPatterns,
  localProjectMap,
  setLocalProjectMap,
  localClientMap,
  setLocalClientMap,
  handleSaveConfig,
}: ProjectsTabProps) {
  const { t } = useTranslation()
  const { isPluginEnabled } = usePlugins()

  // プラグインの有効状態を確認
  const isProjectExtractorEnabled = isPluginEnabled(
    PLUGIN_IDS.PROCESSOR_PROJECT_EXTRACTOR,
  )
  const isProjectMappingEnabled = isPluginEnabled(
    PLUGIN_IDS.PROCESSOR_PROJECT_MAPPING,
  )

  return (
    <Card title={t("Projects")} className="flex-1 w-full min-h-0">
      <div className="flex-1 overflow-y-auto pr-2 mt-2 custom-scrollbar min-h-125">
        <div className="space-y-8">
          {isProjectExtractorEnabled && (
            <>
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
                  <span className="font-medium">{t("Project Extraction")}</span>
                </p>
                <ExtractionPatternList
                  patterns={localExtractionPatterns}
                  onUpdate={async (newPatterns) => {
                    setLocalExtractionPatterns(newPatterns)
                    if (config) {
                      await handleSaveConfig(
                        {
                          ...config,
                          plugins: {
                            ...config.plugins,
                            [PLUGIN_IDS.PROCESSOR_PROJECT_EXTRACTOR]: {
                              ...config.plugins?.[
                                PLUGIN_IDS.PROCESSOR_PROJECT_EXTRACTOR
                              ],
                              project_extraction_patterns: newPatterns,
                            },
                          },
                        },
                        true,
                      )
                    }
                  }}
                />
              </div>
              <hr className="border-base-content/5" />
            </>
          )}
          {isProjectMappingEnabled && (
            <>
              <div>
                <h3 className="text-lg font-medium text-base-content mb-1 px-1">
                  {t("Clients")}
                </h3>
                <p className="text-sm text-base-content/60 mb-4 px-1">
                  {t("Manage client names.")}
                  <br />
                  {t("Used by:")}{" "}
                  <span className="font-medium">{t("Project Mapping")}</span>
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
                  <span className="font-medium">{t("Project Mapping")}</span>
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
            </>
          )}
          {!isProjectExtractorEnabled && !isProjectMappingEnabled && (
            <div className="text-center py-12 text-base-content/40">
              <p className="text-sm">
                {t(
                  "No project-related plugins are enabled. Enable them in the Plugins tab to configure project settings.",
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
