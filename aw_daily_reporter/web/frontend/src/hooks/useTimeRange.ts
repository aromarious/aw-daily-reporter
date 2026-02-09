import { useMemo } from "react"

interface ReportData {
  report?: {
    start_time?: string
    end_time?: string
    work_stats?: {
      start?: string
      end?: string
    }
  }
}

export function useTimeRange(data: ReportData | undefined) {
  return useMemo(() => {
    const report = data?.report
    const workStats = report?.work_stats

    const format = (iso: string) =>
      new Date(iso).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })

    // Try to use actual activity range first
    if (workStats?.start && workStats?.end) {
      return {
        start: format(workStats.start),
        end: format(workStats.end),
      }
    }

    if (report?.start_time && report?.end_time) {
      return {
        start: format(report.start_time),
        end: format(report.end_time),
      }
    }
    return null
  }, [data?.report])
}
