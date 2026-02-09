import type {
  CustomSeriesRenderItemAPI,
  CustomSeriesRenderItemParams,
  EChartsOption,
} from "echarts"
import { useTheme } from "next-themes"
import { useMemo } from "react"
import type {
  Snapshot,
  TimelineItem,
} from "@/components/pipeline/SnapshotTimeline"

// Categories
const CATEGORY_COLORS: Record<string, string> = {
  Work: "#6366f1",
  Coding: "#22c55e",
  Communication: "#06b6d4",
  Break: "#f59e0b",
  Research: "#8b5cf6",
  Meeting: "#ec4899",
  Admin: "#f97316",
  Learning: "#14b8a6",
  Uncategorized: "#94a3b8",
  Other: "#64748b",
  "Integrated Data": "#64748b",
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

function getColor(item: TimelineItem): string {
  const category = item.category

  if (category === "Source: AFK") {
    if (item.title === "afk") return "#94a3b8"
    if (item.title === "not-afk") return "#4ade80"
  }

  if (
    category &&
    category !== "Uncategorized" &&
    !category.startsWith("Source:")
  ) {
    if (CATEGORY_COLORS[category]) {
      return CATEGORY_COLORS[category]
    }
    return `hsl(${hashCode(category) % 360}, 60%, 50%)`
  }

  let seed = item.app || item.title || "unknown"

  if (
    category &&
    (category.includes("VSCode") || item.app === "Code") &&
    item.project
  ) {
    seed = item.project
  } else if (
    category &&
    (category.includes("Web") ||
      item.app === "Chrome" ||
      item.app === "Safari") &&
    item.url
  ) {
    try {
      seed = new URL(item.url).hostname
    } catch {
      seed = item.url
    }
  }

  return `hsl(${hashCode(seed) % 360}, 65%, ${category === "Source: Window" ? "60%" : "50%"})`
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// Render tooltip sections
function renderTooltipHeader(
  item: TimelineItem,
  startStr: string,
  endStr: string,
  duration: number,
) {
  let html = `<div class="flex justify-between items-start mb-2 pb-1 border-b border-base-content/10">`
  html += `<div class="flex flex-col">`
  html += `<span class="font-bold text-sm text-base-content">${item.app}</span>`
  html += `<span class="text-[10px] text-base-content/40 font-medium">${startStr} - ${endStr}</span>`
  html += `</div>`
  html += `<span class="text-[10px] bg-base-200 px-1.5 py-0.5 rounded text-base-content/60 font-medium whitespace-nowrap">${duration} min</span>`
  html += `</div>`
  return html
}

function renderTooltipBadges(item: TimelineItem) {
  let html = `<div class="flex flex-wrap gap-1.5 mb-2.5">`
  if (item.project) {
    html += `<span class="inline-flex items-center px-1.5 py-0.5 bg-primary/10 text-primary rounded border border-primary/20 shadow-sm text-[10px] font-medium">📂 ${item.project}</span>`
  }
  if (item.category) {
    html += `<span class="inline-flex items-center px-1.5 py-0.5 bg-success/10 text-success rounded border border-success/20 shadow-sm text-[10px] font-medium">🏷️ ${item.category}</span>`
  }
  if (item.metadata?.client) {
    html += `<span class="inline-flex items-center px-1.5 py-0.5 bg-warning/10 text-warning rounded border border-warning/20 shadow-sm text-[10px] font-medium">💼 ${item.metadata.client}</span>`
  }
  if (item.status) {
    html += `<span class="inline-flex items-center px-1.5 py-0.5 bg-base-200 text-base-content/60 rounded border border-base-content/10 text-[10px]">Signal: ${item.status}</span>`
  }
  html += `</div>`
  return html
}

function renderTooltipDetails(item: TimelineItem) {
  const hasDetails = item.url || item.file || item.language
  if (!hasDetails) return ""

  let html = `<div class="space-y-1.5 pt-2 border-t border-base-content/10 text-[11px]">`
  if (item.language) {
    html += `<div class="flex gap-2 items-start"><span class="shrink-0 text-base-content/40 w-8">Lang</span><span class="font-mono text-base-content/80 bg-base-200 px-1 rounded">${item.language}</span></div>`
  }
  if (item.file) {
    const parts = item.file.split("/")
    const filename = parts.pop()
    const path = parts.join("/")
    html += `<div class="flex gap-2 items-start"><span class="shrink-0 text-base-content/40 w-8">File</span><div class="break-all"><span class="font-semibold text-base-content/90">${filename}</span> <span class="text-base-content/40 text-[10px] block leading-tight">${path}</span></div></div>`
  }
  if (item.url) {
    html += `<div class="flex gap-2 items-start"><span class="shrink-0 text-base-content/40 w-8">URL</span><span class="break-all text-primary underline decoration-primary/30">${item.url.slice(0, 100)}${item.url.length > 100 ? "..." : ""}</span></div>`
  }
  html += `</div>`
  return html
}

function tooltipFormatter(params: unknown) {
  const p = params as {
    data: {
      item: TimelineItem
      value: [number, number, number, number]
    }
  }
  const item = p.data?.item
  if (!item) return ""

  const duration = Math.round(item.duration / 60)
  const startStr = formatTime(new Date(p.data.value[1] as number))
  const endStr = formatTime(new Date(p.data.value[2] as number))

  let html = `<div class="font-sans text-xs text-base-content/80 max-w-[320px]">`
  html += renderTooltipHeader(item, startStr, endStr, duration)
  html += `<div class="mb-3 leading-snug text-base-content/90 wrap-break-word font-medium">${item.title.length > 200 ? `${item.title.slice(0, 200)}...` : item.title}</div>`
  html += renderTooltipBadges(item)
  html += renderTooltipDetails(item)
  html += `</div>`
  return html
}

function processSourceItems(
  items: TimelineItem[],
  categoryToIndex: Record<string, number>,
) {
  const data: {
    value: [number, number, number, number]
    itemStyle: { color: string }
    item: TimelineItem
  }[] = []

  items.forEach((item) => {
    const start = new Date(item.timestamp).getTime()
    if (Number.isNaN(start)) return
    const end = start + item.duration * 1000
    const idx = categoryToIndex[item.category || ""] ?? 0
    const color = getColor(item)

    data.push({
      value: [idx, start, end, item.duration],
      itemStyle: { color },
      item,
    })
  })
  return data
}

function getAttributeColor(attrKey: string, val: string, item: TimelineItem) {
  if (attrKey === "category") return getColor(item)
  if (attrKey === "app") return `hsl(${hashCode(String(val)) % 360}, 65%, 50%)`
  if (attrKey === "project")
    return `hsl(${hashCode(String(val)) % 360}, 70%, 45%)`
  if (attrKey === "client")
    return `hsl(${hashCode(String(val)) % 360}, 55%, 60%)`
  return `hsl(${hashCode(String(val)) % 360}, 60%, 55%)`
}

function processAttributeItems(
  items: TimelineItem[],
  attrMap: { key: string; label: string }[],
) {
  const data: {
    value: [number, number, number, number]
    itemStyle: { color: string }
    item: TimelineItem
  }[] = []

  items.forEach((item) => {
    const start = new Date(item.timestamp).getTime()
    if (Number.isNaN(start)) return
    const end = start + item.duration * 1000

    attrMap.forEach((attr, idx) => {
      if (attr.key === "separator") return

      const val =
        attr.key === "client"
          ? item.metadata?.client
          : item[attr.key as keyof TimelineItem]

      if (val && val !== "None" && val !== "Unknown" && val !== "No Title") {
        const color = getAttributeColor(attr.key, String(val), item)
        data.push({
          value: [idx, start, end, item.duration],
          itemStyle: { color },
          item,
        })
      }
    })
  })
  return data
}

interface ChartDataItem {
  value: [number, number, number, number]
  itemStyle: { color: string }
  item: TimelineItem
}

function generateChartOption(
  chartData: ChartDataItem[],
  categories: string[],
  timeRange: [number, number],
  isDark: boolean,
  isSourceStage: boolean,
  attrMap: { key: string; label: string }[],
): EChartsOption {
  if (chartData.length === 0) return {}

  const separatorIdx = attrMap.findIndex((a) => a.key === "separator")
  const markLineData = separatorIdx > 0 ? [{ yAxis: separatorIdx }] : []

  return {
    tooltip: {
      formatter: tooltipFormatter,
      backgroundColor: isDark
        ? "rgba(30, 41, 59, 0.95)"
        : "rgba(255, 255, 255, 0.95)",
      borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "#e2e8f0",
      textStyle: { color: isDark ? "#e2e8f0" : "#334155" },
      appendToBody: true,
    },
    grid: { left: "10%", right: "5%", top: 10, bottom: 20 },
    xAxis: {
      type: "time",
      min: timeRange[0],
      max: timeRange[1],
      axisLabel: {
        formatter: (value: number) => formatTime(new Date(value)),
        color: isDark ? "#94a3b8" : "#64748b",
        fontSize: 10,
      },
      axisLine: { lineStyle: { color: isDark ? "#334155" : "#e2e8f0" } },
      splitLine: {
        show: true,
        lineStyle: { color: isDark ? "#334155" : "#f1f5f9" },
      },
    },
    yAxis: {
      type: "category",
      data: categories,
      inverse: true,
      axisLine: { show: false },
      axisLabel: { color: isDark ? "#94a3b8" : "#64748b", fontSize: 10 },
      axisTick: { show: false },
    },
    series: [
      {
        type: "custom",
        renderItem: (
          _params: CustomSeriesRenderItemParams,
          api: CustomSeriesRenderItemAPI,
        ) => {
          const categoryIdx = api.value(0) as number
          const start = api.coord([api.value(1), categoryIdx])
          const end = api.coord([api.value(2), categoryIdx])
          const height = (api.size?.([0, 1]) as number[])?.[1] * 0.7 || 20
          return {
            type: "rect",
            shape: {
              x: start[0],
              y: start[1] - height / 2,
              width: Math.max(end[0] - start[0], 2),
              height: height,
              r: 3,
            },
            style: { fill: api.visual("color") },
          }
        },
        encode: { x: [1, 2], y: 0 },
        itemStyle: { borderRadius: 3 },
        data: chartData,
        markLine: !isSourceStage
          ? {
              symbol: ["none", "none"],
              silent: true,
              z: -1,
              label: { show: false },
              lineStyle: {
                color: isDark ? "#475569" : "#94a3b8",
                type: "dashed",
                width: 1,
                opacity: 0.5,
              },
              data: markLineData,
            }
          : undefined,
      },
    ],
  }
}

interface UseSnapshotTimelineProps {
  snapshot: Snapshot
  height?: number
  domainStart?: number
  domainEnd?: number
}

export function useSnapshotTimeline({
  snapshot,
  height = 150,
  domainStart,
  domainEnd,
}: UseSnapshotTimelineProps) {
  const stageName = snapshot.name || ""
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const isSourceStage =
    stageName.includes("Raw Data Sources") || stageName.includes("Clipped")

  const { chartData, timeRange, categories, attrMap } = useMemo(() => {
    const items = snapshot.timeline || []
    let categories: string[] = []
    const categoryToIndex: Record<string, number> = {}
    let attrMap: { key: string; label: string }[] = []

    if (isSourceStage) {
      const uniqueSources = new Set<string>()
      items.forEach((item) => {
        if (
          item.category &&
          !Number.isNaN(new Date(item.timestamp).getTime())
        ) {
          uniqueSources.add(item.category)
        }
      })
      const sourceList = Array.from(uniqueSources).sort((a, b) => {
        if (a.includes("AFK")) return -1
        if (b.includes("AFK")) return 1
        return a.localeCompare(b)
      })
      categories = sourceList
      sourceList.forEach((s, i) => {
        categoryToIndex[s] = i
      })
    } else {
      attrMap = [
        { key: "app", label: "App" },
        { key: "title", label: "Title" },
        { key: "url", label: "URL" },
        { key: "file", label: "File" },
        { key: "language", label: "Language" },
        { key: "separator", label: "" },
        { key: "project", label: "Project" },
        { key: "category", label: "Category" },
        { key: "client", label: "Client" },
      ]
      categories = attrMap.map((a) => a.label)
    }

    let finalMin = domainStart
    let finalMax = domainEnd
    if (
      items.length > 0 &&
      (finalMin === undefined || finalMax === undefined)
    ) {
      const timestamps = items.map((item) => new Date(item.timestamp).getTime())
      const ends = items.map(
        (item) => new Date(item.timestamp).getTime() + item.duration * 1000,
      )
      if (finalMin === undefined) finalMin = Math.min(...timestamps)
      if (finalMax === undefined) finalMax = Math.max(...ends)
    }

    if (items.length === 0) {
      return {
        chartData: [],
        timeRange: [finalMin || 0, finalMax || 0],
        categories,
        attrMap: [],
      }
    }

    const data = isSourceStage
      ? processSourceItems(items, categoryToIndex)
      : processAttributeItems(items, attrMap)

    return {
      chartData: data,
      timeRange: [finalMin || 0, finalMax || 0],
      categories,
      attrMap,
    }
  }, [snapshot.timeline, domainStart, domainEnd, isSourceStage])

  const actualHeight = Math.max(height, categories.length * 30 + 50)

  const option = useMemo(() => {
    return generateChartOption(
      chartData,
      categories,
      timeRange as [number, number],
      isDark,
      isSourceStage,
      attrMap,
    )
  }, [chartData, categories, timeRange, isDark, isSourceStage, attrMap])

  return { option, actualHeight }
}
