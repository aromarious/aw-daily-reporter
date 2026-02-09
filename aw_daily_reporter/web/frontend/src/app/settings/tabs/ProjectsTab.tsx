"use client"

import dynamic from "next/dynamic"
import { Card } from "@/components/Card"
import { useTranslation } from "@/contexts/I18nContext"
import type { FullConfig } from "../types"

// Dynamic Components for Projects Tab
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

  return (
    <Card title={t("Projects")} className="flex-1 w-full min-h-0">
      <div className="flex-1 overflow-y-auto pr-2 mt-2 custom-scrollbar min-h-125">
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-medium text-base-content mb-1 px-1">
              {t("Extraction Rules")}
            </h3>
            <p className="text-sm text-base-content/60 mb-4 px-1">
              {t("Default rules to extract project names from window titles.")}
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
        </div>
      </div>
    </Card>
  )
}
