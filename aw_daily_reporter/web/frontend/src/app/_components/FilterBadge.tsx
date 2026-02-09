"use client"

import { X } from "lucide-react"
import { useTranslation } from "@/contexts/I18nContext"

interface FilterBadgeProps {
  filter: {
    project?: string
    category?: string
    client?: string
  } | null
  clearFilter: () => void
}

export function FilterBadge({ filter, clearFilter }: FilterBadgeProps) {
  const { t } = useTranslation()

  if (!filter) return null

  return (
    <div className="flex items-center gap-2 px-1">
      <span className="text-sm text-base-content/70">{t("Filtering:")}</span>
      {filter.project && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
          {t("Project")}: {filter.project}
        </span>
      )}
      {filter.category && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          {t("Category")}: {filter.category}
        </span>
      )}
      {filter.client && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
          {t("Client")}: {filter.client}
        </span>
      )}
      <button
        type="button"
        onClick={clearFilter}
        className="p-0.5 rounded hover:bg-base-200 text-base-content/50"
        title={t("Clear filter")}
      >
        <X size={14} />
      </button>
    </div>
  )
}
