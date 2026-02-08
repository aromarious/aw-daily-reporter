"use client"

import type { EChartsOption } from "echarts"
import dynamic from "next/dynamic"
import { useMemo } from "react"

const EChartsWrapper = dynamic(
  () => import("@/components/echarts/EChartsWrapper"),
  { ssr: false },
)

interface TimelineItem {
  timestamp: string
  duration: number
  app: string
  title: string
  category?: string
  project?: string
}

interface Snapshot {
  name: string
  timeline: TimelineItem[]
}

interface TimelineComparisonProps {
  before: Snapshot | null
  after: Snapshot | null
}

// カテゴリカラーマップ
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

function getColor(item: TimelineItem): string {
  const category = item.category

  // 1. AFK: ステータスで色分け
  if (category === "Source: AFK") {
    if (item.title === "afk") return "#94a3b8" // Gray
    if (item.title === "not-afk") return "#4ade80" // Green
  }

  // 2. 既知のカテゴリ: 定義済みの色を使用（ただしUncategorizedは除く）
  if (
    category &&
    category !== "Uncategorized" &&
    !category.startsWith("Source:")
  ) {
    if (CATEGORY_COLORS[category]) {
      return CATEGORY_COLORS[category]
    }
    // 未定義のカテゴリはカテゴリ名でハッシュ
    return `hsl(${hashCode(category) % 360}, 60%, 50%)`
  }

  // 3. Source系やUncategorized: アプリ名で色分け（同じ帯でもアプリが違えば色を変える）
  // App名がない場合はタイトルを使う
  const seed = item.app || item.title || "unknown"
  return `hsl(${hashCode(seed) % 360}, 65%, ${category === "Source: Window" ? "60%" : "50%"})`
}

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export default function TimelineComparison({
  before,
  after,
}: TimelineComparisonProps) {
  const { beforeData, afterData, timeRange, categories } = useMemo(() => {
    const allItems = [...(before?.timeline || []), ...(after?.timeline || [])]

    if (allItems.length === 0) {
      return {
        beforeData: [],
        afterData: [],
        timeRange: [0, 0],
        categories: [],
      }
    }

    // Collect unique categories
    const catSet = new Set<string>()
    allItems.forEach((item) => {
      catSet.add(item.category || "Uncategorized")
    })
    const categories = Array.from(catSet).sort((a, b) => {
      // AFK is special, put it at the top (end of the list for Y axis)
      if (a === "Source: AFK") return 1
      if (b === "Source: AFK") return -1
      return a.localeCompare(b)
    })

    // Calculate time range
    const timestamps = allItems.map((item) =>
      new Date(item.timestamp).getTime(),
    )
    const ends = allItems.map(
      (item) => new Date(item.timestamp).getTime() + item.duration * 1000,
    )
    const minTime = Math.min(...timestamps)
    const maxTime = Math.max(...ends)

    // Convert to chart data format [categoryIndex, startTime, endTime, duration, originalItem]
    const convertToChartData = (items: TimelineItem[]) =>
      items.slice(0, 5000).map((item) => {
        const cat = item.category || "Uncategorized"
        const start = new Date(item.timestamp).getTime()
        const end = start + item.duration * 1000
        return {
          value: [categories.indexOf(cat), start, end, item.duration],
          itemStyle: { color: getColor(item) },
          item,
        }
      })

    return {
      beforeData: convertToChartData(before?.timeline || []),
      afterData: convertToChartData(after?.timeline || []),
      timeRange: [minTime, maxTime],
      categories,
    }
  }, [before, after])

  type ChartDataItem = {
    value: number[]
    itemStyle: { color: string }
    item: TimelineItem
  }

  const createOption = (
    data: ChartDataItem[],
    title: string,
  ): EChartsOption => ({
    title: {
      text: title,
      left: 10,
      top: 5,
      textStyle: {
        fontSize: 12,
        fontWeight: "normal",
        color: "#64748b",
      },
    },
    tooltip: {
      formatter: (params: unknown) => {
        const p = params as { data: { item: TimelineItem } }
        const item = p.data?.item
        if (!item) return ""
        const duration = Math.round(item.duration / 60)
        return `<strong>${item.app}</strong><br/>
					${item.title.slice(0, 50)}${item.title.length > 50 ? "..." : ""}<br/>
					Category: <strong>${item.category || "Uncategorized"}</strong><br/>
					Duration: ${duration} min`
      },
      backgroundColor: "rgba(255, 255, 255, 0.95)",
      borderColor: "#e2e8f0",
      textStyle: { color: "#334155" },
    },
    grid: {
      left: "10%",
      right: "5%",
      top: 35,
      bottom: 20,
    },
    xAxis: {
      type: "time",
      min: timeRange[0],
      max: timeRange[1],
      axisLabel: {
        formatter: (value: number) => formatTime(new Date(value)),
        color: "#64748b",
        fontSize: 10,
      },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      splitLine: { show: true, lineStyle: { color: "#f1f5f9" } },
    },
    yAxis: {
      type: "category",
      data: categories,
      axisLine: { show: false },
      axisLabel: { color: "#64748b", fontSize: 10 },
      axisTick: { show: false },
    },
    series: [
      {
        type: "custom",
        renderItem: (
          _params: unknown,
          api: {
            value: (idx: number) => number
            coord: (val: [number, number]) => [number, number]
            size: (val: [number, number]) => [number, number]
            style: () => Record<string, unknown>
          },
        ) => {
          const categoryIdx = api.value(0)
          const start = api.coord([api.value(1), categoryIdx])
          const end = api.coord([api.value(2), categoryIdx])
          const height = api.size([0, 1])[1] * 0.7

          return {
            type: "rect",
            shape: {
              x: start[0],
              y: start[1] - height / 2,
              width: Math.max(end[0] - start[0], 2),
              height: height,
            },
            style: api.style(),
          }
        },
        encode: {
          x: [1, 2],
          y: 0,
        },
        itemStyle: {
          borderRadius: 3,
        },
        data,
      },
    ] as EChartsOption["series"],
  })

  if (!before && !after) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400">
        Select a pipeline stage to compare
      </div>
    )
  }

  const height = Math.max(150, categories.length * 35 + 60)

  return (
    <div className="space-y-4">
      {/* Before */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white/50">
        <EChartsWrapper
          option={createOption(beforeData, `Before: ${before?.name || "N/A"}`)}
          style={{ height: `${height}px`, width: "100%" }}
        />
      </div>

      {/* After */}
      <div className="border border-indigo-200 rounded-xl overflow-hidden bg-indigo-50/30">
        <EChartsWrapper
          option={createOption(afterData, `After: ${after?.name || "N/A"}`)}
          style={{ height: `${height}px`, width: "100%" }}
        />
      </div>
    </div>
  )
}
