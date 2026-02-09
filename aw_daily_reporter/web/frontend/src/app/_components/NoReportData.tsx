"use client"

import { AlertCircle, RefreshCw } from "lucide-react"
import { useTranslation } from "@/contexts/I18nContext"

interface NoReportDataProps {
  data: unknown
}

export function NoReportData({ data }: NoReportDataProps) {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
      <div className="bg-base-100 p-6 rounded-xl shadow-sm border border-warning/20 max-w-md w-full">
        <div className="flex items-center gap-3 text-warning mb-4">
          <AlertCircle size={24} />
          <h2 className="font-semibold text-lg">{t("No Report Data")}</h2>
        </div>
        <p className="text-base-content/70 mb-4">
          {t("The server returned a response, but it contains no report data.")}
        </p>
        <div className="bg-base-200 p-3 rounded-lg text-xs font-mono text-base-content/60 overflow-auto max-h-48">
          {JSON.stringify(data, null, 2)}
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="w-full mt-4 py-2.5 bg-neutral text-neutral-content rounded-lg hover:bg-neutral/90 transition-colors font-medium flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} />
          {t("Reload")}
        </button>
      </div>
    </div>
  )
}
