"use client"

import type { EChartsOption } from "echarts"
import { useChartTheme } from "@/hooks/useChartTheme"
import EChartsWrapper from "./EChartsWrapper"

interface TimelineEvent {
  name: string // タイトル or アプリ名
  category: string
  start: Date
  end: Date
}

interface ActivityTimelineProps {
  events: TimelineEvent[]
  onEventClick?: (event: TimelineEvent) => void
}

// カテゴリカラーマップ
const CATEGORY_COLORS: Record<string, string> = {
  Work: "#6366f1",
  Coding: "#22c55e",
  Communication: "#06b6d4",
  Break: "#f59e0b",
  Other: "#94a3b8",
}

function getColor(category: string): string {
  return CATEGORY_COLORS[category] || "#94a3b8"
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export default function ActivityTimeline({
  events,
  onEventClick,
}: ActivityTimelineProps) {
  const theme = useChartTheme()

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400">
        No timeline data
      </div>
    )
  }

  // ユニークなカテゴリを取得
  const categories = [...new Set(events.map((e) => e.category))]

  // カテゴリをY軸のインデックスとして使用
  const categoryIndex = new Map(categories.map((cat, idx) => [cat, idx]))

  // 時間範囲を取得
  const startTime = Math.min(...events.map((e) => e.start.getTime()))
  const endTime = Math.max(...events.map((e) => e.end.getTime()))

  // custom renderItem用のデータ生成
  const customData = events.map((event, index) => ({
    name: event.name,
    value: [
      categoryIndex.get(event.category),
      event.start.getTime(),
      event.end.getTime(),
      Math.round((event.end.getTime() - event.start.getTime()) / 60000), // 分
    ],
    itemStyle: {
      color: getColor(event.category),
    },
    event,
    index,
  }))

  const option: EChartsOption = {
    tooltip: {
      formatter: (params: unknown) => {
        const p = params as {
          data: {
            name: string
            value: [number, number, number, number]
            event: TimelineEvent
          }
        }
        const duration = p.data.value[3]
        const startStr = formatTime(new Date(p.data.value[1]))
        const endStr = formatTime(new Date(p.data.value[2]))
        return `<strong>${p.data.name}</strong><br/>
					${startStr} - ${endStr}<br/>
					Duration: ${duration} min<br/>
					Category: ${p.data.event.category}`
      },
      backgroundColor: theme.tooltipBackgroundColor,
      borderColor: theme.borderColor,
      borderWidth: 1,
      textStyle: {
        color: theme.tooltipTextColor,
      },
      extraCssText:
        "box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;",
    },
    grid: {
      left: "12%",
      right: "4%",
      top: "10%",
      bottom: "12%",
    },
    xAxis: {
      type: "time",
      min: startTime,
      max: endTime,
      axisLabel: {
        formatter: (value: number) => formatTime(new Date(value)),
        color: theme.subTextColor,
        fontSize: 10,
      },
      axisLine: {
        lineStyle: {
          color: theme.lineColor,
        },
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: theme.splitLineColor,
        },
      },
    },
    yAxis: {
      type: "category",
      data: categories,
      axisLine: {
        show: false,
      },
      axisLabel: {
        color: theme.subTextColor,
        fontSize: 11,
      },
      axisTick: {
        show: false,
      },
    },
    dataZoom: [
      {
        type: "slider",
        xAxisIndex: 0,
        filterMode: "weakFilter",
        height: 20,
        bottom: 0,
        start: 0,
        end: 100,
        handleIcon:
          "path://M10.7,11.9H9.3c-4.9,0.3-8.8,4.4-8.8,9.4c0,5,3.9,9.1,8.8,9.4h1.3c4.9-0.3,8.8-4.4,8.8-9.4C19.5,16.3,15.6,12.2,10.7,11.9z",
        handleSize: "80%",
        labelFormatter: "",
        borderColor: theme.borderColor,
        backgroundColor: theme.isDark ? "#334155" : "#f8fafc",
        dataBackground: {
          areaStyle: {
            color: theme.lineColor,
          },
        },
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            styleEmphasis?: () => Record<string, unknown>
          },
        ) => {
          const categoryIdx = api.value(0)
          const start = api.coord([api.value(1), categoryIdx])
          const end = api.coord([api.value(2), categoryIdx])
          const height = api.size([0, 1])[1] * 0.6

          const rectShape = {
            x: start[0],
            y: start[1] - height / 2,
            width: Math.max(end[0] - start[0], 2),
            height: height,
          }

          return {
            type: "rect",
            shape: rectShape,
            style: api.style(),
            styleEmphasis: api.styleEmphasis?.(),
          }
        },
        encode: {
          x: [1, 2],
          y: 0,
        },
        itemStyle: {
          borderRadius: 4,
        },
        data: customData,
      },
    ] as EChartsOption["series"],
  }

  const handleEvents = onEventClick
    ? {
        click: (params: unknown) => {
          const p = params as { data?: { event: TimelineEvent } }
          if (p.data?.event) {
            onEventClick(p.data.event)
          }
        },
      }
    : undefined

  return (
    <EChartsWrapper
      option={option}
      style={{ height: "200px", width: "100%" }}
      onEvents={handleEvents}
    />
  )
}
