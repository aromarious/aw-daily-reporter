"use client"

import { Clock, CupSoda } from "lucide-react"

import { Card } from "@/components/Card"
import { useTranslation } from "@/contexts/I18nContext"
import { formatDuration } from "@/lib/date"

interface DashboardStatsProps {
  report: {
    work_stats?: {
      working_seconds?: number
      break_seconds?: number
      afk_seconds?: number
    }
  }
}

export function DashboardStats({ report }: DashboardStatsProps) {
  const { t } = useTranslation()

  const workStats = report.work_stats || {}
  const workingSeconds = workStats.working_seconds || 0
  const breakSeconds = workStats.break_seconds || 0
  const afkSeconds = workStats.afk_seconds || 0
  const totalSeconds = workingSeconds + breakSeconds

  const workDurationStr = formatDuration(workingSeconds)
  const afkDurationStr = formatDuration(afkSeconds)
  const nonWorkSeconds = Math.max(0, breakSeconds - afkSeconds)
  const nonWorkDurationStr = formatDuration(nonWorkSeconds)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title={t("Working Hours")} className="relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 text-base-content opacity-5 mix-blend-normal pointer-events-none">
          <Clock size={180} strokeWidth={1.5} />
        </div>
        <div className="relative z-10">
          <div className="text-2xl font-bold text-base-content">
            {workDurationStr}
          </div>
          <div className="text-sm text-base-content/60">
            {totalSeconds > 0
              ? ((workingSeconds / totalSeconds) * 100).toFixed(1)
              : 0}
            {t("% of total")}
          </div>
        </div>
      </Card>
      <Card title={t("Break Time")} className="relative overflow-hidden">
        <div className="absolute -right-10 -bottom-8 text-base-content opacity-5 mix-blend-normal pointer-events-none">
          <CupSoda size={180} strokeWidth={1.5} />
        </div>
        <div className="relative z-10">
          <div className="text-2xl font-bold text-base-content/80">
            {formatDuration(breakSeconds)}
          </div>
          <div className="text-xs text-base-content/60 mt-1 flex gap-3">
            <span title={t("AFK Time")}>
              {t("AFK Time")}: {afkDurationStr}
            </span>
            <span
              className="border-l border-base-content/20 pl-3"
              title={t("Other non-work time")}
            >
              {t("Other non-work time")}: {nonWorkDurationStr}
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
