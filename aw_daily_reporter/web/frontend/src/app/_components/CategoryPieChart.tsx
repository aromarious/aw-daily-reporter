"use client"

import type { EChartsOption } from "echarts"
import EChartsWrapper from "@/components/echarts/EChartsWrapper"
import { useChartTheme } from "@/hooks/useChartTheme"
import {
  getCategoryColor,
  getProjectColor,
  isUncategorized,
} from "@/lib/colors"

interface CategoryData {
  name: string
  value: number // seconds
}

interface CategoryPieChartProps {
  data: CategoryData[]
  onCategoryClick?: (category: string) => void
  colorType?: "category" | "project"
  customColors?: Record<string, string>
}

function formatDuration(seconds: number): string {
  const hours = seconds / 3600
  if (hours >= 1) {
    return `${hours.toFixed(1)}h`
  }
  const mins = Math.floor(seconds / 60)
  return `${mins}m`
}

export default function CategoryPieChart({
  data,
  onCategoryClick,
  colorType = "category",
  customColors,
}: CategoryPieChartProps) {
  const theme = useChartTheme()
  const getColor = colorType === "project" ? getProjectColor : getCategoryColor

  // 未分類を最後にソート（それ以外は値の降順）
  const sortedData = [...data].sort((a, b) => {
    const aUncategorized = isUncategorized(a.name)
    const bUncategorized = isUncategorized(b.name)
    if (aUncategorized && !bUncategorized) return 1
    if (!aUncategorized && bUncategorized) return -1
    return b.value - a.value
  })

  const totalSeconds = sortedData.reduce((sum, item) => sum + item.value, 0)

  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) => {
        const p = params as { name: string; value: number; percent: number }
        return `<strong>${p.name}</strong><br/>${formatDuration(p.value)} (${p.percent.toFixed(1)}%)`
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
    legend: {
      orient: "horizontal",
      bottom: 0,
      left: "center",
      textStyle: {
        color: theme.subTextColor,
        fontSize: 12,
      },
      itemWidth: 12,
      itemHeight: 12,
    },
    series: [
      {
        name: "Category",
        type: "pie",
        radius: ["40%", "65%"],
        center: ["50%", "42%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: theme.isDark ? "#1e293b" : "#fff", // Match background color for border effect
          borderWidth: 2,
        },
        label: {
          show: false,
        },
        emphasis: {
          label: {
            show: false,
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: "rgba(0, 0, 0, 0.2)",
          },
        },
        labelLine: {
          show: false,
        },
        data: sortedData.map((item) => ({
          name: item.name,
          value: item.value,
          itemStyle: {
            color: customColors?.[item.name]
              ? customColors[item.name]
              : getColor(item.name),
          },
        })),
      },
    ],
    graphic: [
      {
        type: "group",
        left: "center",
        top: "35%",
        children: [
          {
            type: "text",
            style: {
              text: formatDuration(totalSeconds),
              textAlign: "center",
              textVerticalAlign: "bottom",
              fill: theme.textColor,
              fontSize: 24,
              fontWeight: "bold",
            } as Record<string, unknown>,
            top: 10,
          },
          {
            type: "text",
            style: {
              text: "Total",
              textAlign: "center",
              textVerticalAlign: "top",
              fill: theme.subTextColor,
              fontSize: 12,
            } as Record<string, unknown>,
            top: 40,
          },
        ],
      },
    ],
  }

  const handleEvents = {
    click: (params: unknown) => {
      const p = params as { name?: string }
      if (onCategoryClick && p.name) {
        onCategoryClick(p.name)
      }
    },
    legendselectchanged: (params: unknown, instance: unknown) => {
      const p = params as { name: string; selected: Record<string, boolean> }
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
      const p = params as { name: string }
      const inst = instance as {
        dispatchAction: (payload: Record<string, unknown>) => void
      }
      if (p.name) {
        const dataIndex = sortedData.findIndex((d) => d.name === p.name)
        if (dataIndex >= 0) {
          setTimeout(() => {
            inst.dispatchAction({
              type: "showTip",
              seriesIndex: 0,
              dataIndex: dataIndex,
            })
          }, 50)
        }
      }
    },
    // downplayではツールチップを消さない（自然に消える）
  }

  return (
    <EChartsWrapper
      option={option}
      style={{ height: "280px", width: "100%" }}
      onEvents={handleEvents}
    />
  )
}
