"use client"

import { Save } from "lucide-react"
import { useEffect, useState } from "react"
import { Card } from "@/components/Card"
import { useTranslation } from "@/contexts/I18nContext"
import type { FullConfig } from "../types"

interface AdvancedTabProps {
  config: FullConfig | undefined
  handleSaveConfig: (
    newConfig: FullConfig | null,
    showNotification?: boolean,
    immediate?: boolean,
  ) => Promise<boolean>
}

export default function AdvancedTab({
  config,
  handleSaveConfig,
}: AdvancedTabProps) {
  const { t } = useTranslation()
  const [advancedJson, setAdvancedJson] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)

  // Initialize Advanced JSON
  useEffect(() => {
    if (config) {
      setAdvancedJson(JSON.stringify(config, null, 2))
      setJsonError(null)
    }
  }, [config])

  const handleSaveAdvanced = () => {
    try {
      const parsed = JSON.parse(advancedJson)
      handleSaveConfig(parsed)
      setJsonError(null)
    } catch (e) {
      setJsonError((e as Error).message)
    }
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <Card
        title={t("Advanced Editor")}
        className="flex-1 flex flex-col min-h-0"
      >
        <div className="flex-1 flex flex-col min-h-0">
          <p className="text-sm text-base-content/60 mb-2 px-1">
            {t("Directly edit the JSON configuration.")}
            <br />
            <span className="text-warning">
              {t("Warning: Incorrect structure may break the application.")}
            </span>
          </p>
          <div className="flex-1 relative border rounded-lg overflow-hidden border-base-content/20">
            <textarea
              className="absolute inset-0 w-full h-full p-4 font-mono text-sm bg-base-200/50 resize-none focus:outline-none"
              value={advancedJson}
              onChange={(e) => setAdvancedJson(e.target.value)}
              spellCheck={false}
            />
          </div>
          {jsonError && (
            <div className="text-red-500 text-sm mt-2 font-medium px-1">
              Error: {jsonError}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleSaveAdvanced}
              className="btn btn-primary btn-sm gap-2"
              disabled={!!jsonError}
            >
              <Save size={16} />
              {t("Save Configuration")}
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
