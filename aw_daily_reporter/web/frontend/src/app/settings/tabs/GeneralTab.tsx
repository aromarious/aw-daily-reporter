"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/Card"
import { PLUGIN_IDS } from "@/constants/pluginIds"
import { useTranslation } from "@/contexts/I18nContext"
import { usePlugins } from "../hooks/usePlugins"
import type { FullConfig, Rule } from "../types"

interface GeneralTabProps {
  config: FullConfig
  localRules: Rule[]
  handleSaveConfig: (
    newConfig: FullConfig | null,
    showNotification?: boolean,
    immediate?: boolean,
  ) => Promise<boolean>
  setLanguage: (lang: "en" | "ja") => void
  theme: string | undefined
  setTheme: (theme: string) => void
  mounted: boolean
}

export default function GeneralTab({
  config,
  localRules,
  handleSaveConfig,
  setLanguage,
  theme,
  setTheme,
  mounted,
}: GeneralTabProps) {
  const { t } = useTranslation()
  const { isPluginEnabled } = usePlugins()

  // AI Renderer プラグインの有効状態を確認
  const isAIRendererEnabled = isPluginEnabled(PLUGIN_IDS.RENDERER_AI)

  // ローカル state で入力値を管理（controlled component の問題を回避）
  const [localTimezone, setLocalTimezone] = useState(
    config.system?.timezone || "",
  )
  const [localHost, setLocalHost] = useState(
    config.system?.activitywatch?.host || "",
  )
  const [localPort, setLocalPort] = useState(
    config.system?.activitywatch?.port || 5600,
  )
  const [localDayStartHour, setLocalDayStartHour] = useState(
    config.system?.day_start_hour ?? 4,
  )
  const [localReportDir, setLocalReportDir] = useState(
    config.system?.report?.output_dir || "",
  )

  // config が変更されたらローカル state を同期
  useEffect(() => {
    setLocalTimezone(config.system?.timezone || "")
    setLocalHost(config.system?.activitywatch?.host || "")
    setLocalPort(config.system?.activitywatch?.port || 5600)
    setLocalDayStartHour(config.system?.day_start_hour ?? 4)
    setLocalReportDir(config.system?.report?.output_dir || "")
  }, [config])

  if (!config.system) return null

  return (
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
                  handleSaveConfig({
                    ...config,
                    rules: localRules,
                    system: {
                      ...config.system,
                      language: newLang,
                    },
                  })
                  setLanguage(newLang as "en" | "ja")
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

          <div>
            <label
              htmlFor="sys-timezone"
              className="block text-sm font-medium text-base-content/80 mb-1"
            >
              {t("Timezone")}{" "}
              <span className="text-xs text-base-content/40 font-normal ml-1">
                (Used by: Date Utils)
              </span>
            </label>
            <input
              id="sys-timezone"
              type="text"
              className="input input-bordered w-full"
              value={localTimezone}
              onChange={(e) => setLocalTimezone(e.target.value)}
              onBlur={(e) =>
                handleSaveConfig({
                  ...config,
                  rules: localRules,
                  system: {
                    ...config.system,
                    timezone: e.target.value,
                  },
                })
              }
            />
          </div>

          <div>
            <label
              htmlFor="sys-host"
              className="block text-sm font-medium text-base-content/80 mb-1"
            >
              ActivityWatch Host
            </label>
            <div className="flex gap-2">
              <input
                id="sys-host"
                type="text"
                className="input input-bordered flex-1"
                placeholder="localhost"
                value={localHost}
                onChange={(e) => setLocalHost(e.target.value)}
                onBlur={(e) =>
                  handleSaveConfig({
                    ...config,
                    system: {
                      ...config.system,
                      activitywatch: {
                        ...config.system.activitywatch,
                        host: e.target.value,
                      },
                    },
                  })
                }
              />
              <input
                type="number"
                className="input input-bordered w-32"
                placeholder="5600"
                value={localPort}
                onChange={(e) => setLocalPort(Number(e.target.value))}
                onBlur={(e) =>
                  handleSaveConfig({
                    ...config,
                    system: {
                      ...config.system,
                      activitywatch: {
                        ...config.system.activitywatch,
                        port: Number(e.target.value),
                      },
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      </Card>

      <Card title={t("Review Settings")} className="mt-6">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="day-start-source"
              className="block text-sm font-medium text-base-content/80 mb-1"
            >
              Day Start Time Source
            </label>
            <select
              id="day-start-source"
              className="select select-bordered w-full"
              value={config.system.day_start_source || "manual"}
              onChange={(e) =>
                handleSaveConfig({
                  ...config,
                  system: {
                    ...config.system,
                    day_start_source: e.target.value as "manual" | "aw",
                  },
                })
              }
            >
              <option value="manual">Manual Configuration</option>
              <option value="aw">ActivityWatch (aw-server)</option>
            </select>
            <p className="text-xs text-base-content/60 mt-1">
              "Manual" uses the hour below. "ActivityWatch" fetches the
              day-start time from the AW server (usually 4:00 AM).
            </p>
          </div>

          {config.system.day_start_source === "aw" && (
            <div className="p-3 bg-base-200 rounded text-sm text-base-content/80">
              Current AW Start of Day:{" "}
              <span className="font-mono font-bold">
                {config.system.aw_start_of_day || "Unknown"}
              </span>
            </div>
          )}

          <div
            className={
              config.system.day_start_source === "aw" ? "opacity-50" : ""
            }
          >
            <label
              htmlFor="sys-daystart"
              className="block text-sm font-medium text-base-content/80 mb-1"
            >
              Day Start Hour (0-23)
            </label>
            <input
              id="sys-daystart"
              type="number"
              className="input input-bordered w-full"
              min={0}
              max={23}
              disabled={config.system.day_start_source === "aw"}
              value={localDayStartHour}
              onChange={(e) => setLocalDayStartHour(Number(e.target.value))}
              onBlur={(e) =>
                handleSaveConfig({
                  ...config,
                  system: {
                    ...config.system,
                    day_start_hour: Number(e.target.value),
                  },
                })
              }
            />
          </div>

          <div>
            <label
              htmlFor="report-dir"
              className="block text-sm font-medium text-base-content/80 mb-1"
            >
              Report Output Directory
            </label>
            <input
              id="report-dir"
              type="text"
              className="input input-bordered w-full"
              value={localReportDir}
              onChange={(e) => setLocalReportDir(e.target.value)}
              onBlur={(e) =>
                handleSaveConfig({
                  ...config,
                  system: {
                    ...config.system,
                    report: {
                      ...config.system.report,
                      output_dir: e.target.value,
                    },
                  },
                })
              }
            />
          </div>
        </div>
      </Card>

      {/* AI Prompt Settings Block */}
      {isAIRendererEnabled && (
        <Card title={t("AI Report Settings")} className="mt-6">
          <label
            htmlFor="ai-prompt"
            className="block text-sm font-medium text-base-content/80 mb-1"
          >
            {t("Custom Prompt")}
          </label>
          <p className="text-xs text-base-content/60 mb-2">
            {t(
              "Instructions for the AI when generating the daily report. You can define the tone, focus areas, or specific formatting requirements.",
            )}
          </p>
          <textarea
            id="ai-prompt"
            className="textarea textarea-bordered w-full h-32 leading-relaxed"
            placeholder={t(
              "e.g., 'Focus on coding activities and provide a summary of the most used languages.'",
            )}
            value={config.plugins?.[PLUGIN_IDS.RENDERER_AI]?.ai_prompt || ""}
            onChange={(e) =>
              handleSaveConfig({
                ...config,
                plugins: {
                  ...config.plugins,
                  [PLUGIN_IDS.RENDERER_AI]: {
                    ...config.plugins?.[PLUGIN_IDS.RENDERER_AI],
                    ai_prompt: e.target.value,
                  },
                },
              })
            }
          />
        </Card>
      )}
    </div>
  )
}
