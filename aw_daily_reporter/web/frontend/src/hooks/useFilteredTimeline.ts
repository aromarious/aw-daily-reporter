import { useMemo } from "react"
import { isUncategorized } from "@/lib/colors"
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
      // プロジェクトフィルタ: "Uncategorized" の場合は isUncategorized() で判定
      let matchProject = true
      if (filter.project) {
        if (filter.project === "Uncategorized") {
          matchProject = isUncategorized(item.project)
        } else {
          matchProject = item.project === filter.project
        }
      }

      // カテゴリフィルタ: "Other" の場合は isUncategorized() で判定
      let matchCategory = true
      if (filter.category) {
        if (filter.category === "Other") {
          matchCategory = isUncategorized(item.category)
        } else {
          matchCategory = item.category === filter.category
        }
      }

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
