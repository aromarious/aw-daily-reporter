import { useMemo } from "react"
import type { TimelineItem } from "@/types"

interface FilterState {
  project?: string
  category?: string
  client?: string
}

interface ReportData {
  clients?: Record<string, { name: string }>
}

export function useFilteredTimeline(
  timeline: TimelineItem[] | undefined,
  filter: FilterState | null,
  report: ReportData | undefined,
) {
  return useMemo(() => {
    if (!timeline) return []
    if (!filter) return timeline

    return timeline.filter((item) => {
      const matchProject =
        !filter.project || (item.project || "Uncategorized") === filter.project
      const matchCategory =
        !filter.category || (item.category || "Other") === filter.category

      let clientName = "Non-billable"
      if (
        item.metadata?.client &&
        report?.clients &&
        report.clients[item.metadata.client]
      ) {
        clientName = report.clients[item.metadata.client].name
      }

      const matchClient = !filter.client || clientName === filter.client
      return matchProject && matchCategory && matchClient
    })
  }, [timeline, filter, report])
}
