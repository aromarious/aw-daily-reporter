"use client"

import type { EChartsOption } from "echarts"
import EChartsWrapper from "@/components/echarts/EChartsWrapper"
import { useChartTheme } from "@/hooks/useChartTheme"
import { getCategoryColor, isUncategorized } from "@/lib/colors"

interface HourlyData {
  hour: number // 0-23
  categories: Record<string, number> // category -> seconds
}

interface HourlyActivityChartProps {
  data: HourlyData[]
  categories: string[]
  onCategoryClick?: (category: string) => void
}

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, "0")}:00`
}

export default function HourlyActivityChart({
  data,
  categories,
  onCategoryClick,
}: HourlyActivityChartProps) {
  const theme = useChartTheme()

  // 時間でソート
  const sortedData = [...data].sort((a, b) => a.hour - b.hour)
  const hours = sortedData.map((d) => formatHour(d.hour))

  // 未分類を最後にソート（スタック順で一番上に表示される）
  const sortedCategories = [...categories].sort((a, b) => {
    const aUncategorized = isUncategorized(a)
    const bUncategorized = isUncategorized(b)
    if (aUncategorized && !bUncategorized) return 1
    if (!aUncategorized && bUncategorized) return -1
    return 0
  })

  // 各カテゴリのシリーズを生成
  const series = sortedCategories.map((category) => ({
    name: category,
    type: "bar" as const,
    stack: "total",
    emphasis: {
      focus: "series" as const,
    },
    itemStyle: {
      color: getCategoryColor(category),
      borderRadius: [0, 0, 0, 0],
    },
    data: sortedData.map((d) => Math.round((d.categories[category] || 0) / 60)), // 分に変換
  }))

  // 最上部のシリーズの角丸を設定
  if (series.length > 0) {
    const lastSeries = series[series.length - 1]
    lastSeries.itemStyle.borderRadius = [4, 4, 0, 0]
  }

  const option: EChartsOption = {
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      backgroundColor: theme.tooltipBackgroundColor,
      borderColor: theme.borderColor,
      borderWidth: 1,
      textStyle: {
        color: theme.tooltipTextColor,
      },
      extraCssText:
        "box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-radius: 8px;",
      formatter: (params: unknown) => {
        const items = params as Array<{
          seriesName: string
          value: number
          color: string
          axisValue?: string
        }>
        if (!items.length) return ""

        const header = `<strong>${items[0].axisValue ?? ""}</strong><br/>`
        const content = items
          .filter((item) => item.value > 0)
          .map(
            (item) =>
              `<span style="display:inline-block;width:10px;height:10px;background:${item.color};border-radius:2px;margin-right:6px;"></span>${item.seriesName}: ${item.value}分`,
          )
          .join("<br/>")
        return header + content
      },
    },
    legend: {
      bottom: 0,
      textStyle: {
        color: theme.subTextColor,
        fontSize: 11,
      },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "15%",
      top: "5%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: hours,
      axisLine: {
        lineStyle: {
          color: theme.lineColor,
        },
      },
      axisLabel: {
        color: theme.subTextColor,
        fontSize: 10,
        interval: 1,
      },
      axisTick: {
        show: false,
      },
    },
    yAxis: {
      type: "value",
      name: "分",
      nameTextStyle: {
        color: theme.subTextColor,
        fontSize: 11,
      },
      axisLine: {
        show: false,
      },
      axisLabel: {
        color: theme.subTextColor,
        fontSize: 10,
      },
      splitLine: {
        lineStyle: {
          color: theme.splitLineColor,
        },
      },
    },
    series,
  }

  return (
    <EChartsWrapper
      option={option}
      style={{ height: "280px", width: "100%" }}
      onEvents={{
        click: (params: unknown) => {
          const p = params as { seriesName?: string }
          if (onCategoryClick && p.seriesName) {
            onCategoryClick(p.seriesName)
          }
        },
        legendselectchanged: (params: unknown, instance: unknown) => {
          const p = params as {
            name: string
            selected: Record<string, boolean>
          }
          const inst = instance as {
            dispatchAction: (payload: Record<string, unknown>) => void
          }
          const isSelected = p.selected[p.name]
          if (!isSelected) {
            inst.dispatchAction({
              type: "legendSelect",
              name: p.name,
            })
          }
        },
        highlight: (params: unknown, instance: unknown) => {
          const p = params as { seriesName?: string; name?: string }
          const inst = instance as {
            dispatchAction: (payload: Record<string, unknown>) => void
          }
          if (p.seriesName || p.name) {
            const name = p.seriesName || p.name
            if (name) {
              const seriesIndex = sortedCategories.indexOf(name)
              if (seriesIndex >= 0) {
                setTimeout(() => {
                  inst.dispatchAction({
                    type: "showTip",
                    seriesIndex: seriesIndex,
                    dataIndex: 0,
                  })
                }, 50)
              }
            }
          }
        },
        // downplayではツールチップを消さない（自然に消える）
      }}
    />
  )
}
