import type { EChartsOption } from "echarts"
import { useMemo } from "react"
import type { ProjectCategoryData } from "@/components/echarts/ProjectCategoryHeatmap"
import { useChartTheme } from "@/hooks/useChartTheme"
import { isUncategorized } from "@/lib/colors"

type SeriesDataItem = {
  value: [number, number, number]
  label?: {
    color?: string
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) {
    return `${h}h ${m}m`
  }
  return `${m}m`
}

export function useHeatmap(data: ProjectCategoryData) {
  const theme = useChartTheme()

  const { max, normalData, unclassifiedData } = useMemo(() => {
    let maxVal = 0
    data.matrix.forEach((row) => {
      row.forEach((val) => {
        if (val > maxVal) maxVal = val
      })
    })

    const normal: SeriesDataItem[] = []
    const unclassified: SeriesDataItem[] = []

    for (let i = 0; i < data.projects.length; i++) {
      for (let j = 0; j < data.categories.length; j++) {
        const value = data.matrix[i]?.[j] || 0
        const project = data.projects[i]
        const category = data.categories[j]

        // Decide text color based on background intensity
        const isDarkBackground = maxVal > 0 && value > maxVal * 0.5
        const labelColor = isDarkBackground ? "#ffffff" : theme.textColor

        const entry: SeriesDataItem = {
          value: [j, i, value],
          label: { color: labelColor },
        }

        if (isUncategorized(project) || isUncategorized(category)) {
          unclassified.push(entry)
        } else {
          normal.push(entry)
        }
      }
    }
    return { max: maxVal, normalData: normal, unclassifiedData: unclassified }
  }, [data, theme.textColor])

  const option = useMemo<EChartsOption>(() => {
    const commonTooltipFormatter = (params: unknown) => {
      const p = params as { data: SeriesDataItem }
      const [catIdx, projIdx, value] = p.data.value
      const project = data.projects[projIdx] || "Unknown"
      const category = data.categories[catIdx] || "Unknown"
      return `<strong>${project}</strong> × ${category}<br/>${formatDuration(
        value,
      )}`
    }

    const commonLabelOption = {
      show: true,
      formatter: (params: unknown) => {
        const p = params as { data: SeriesDataItem }
        const value = p.data.value[2]
        if (value < 60) return ""
        return formatDuration(value)
      },
      fontSize: 9,
      color: theme.textColor,
    }

    return {
      tooltip: {
        position: "top",
        formatter: commonTooltipFormatter,
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
        top: "10%",
        left: "15%",
        right: "15%",
        bottom: "15%",
      },
      xAxis: {
        type: "category",
        data: data.categories,
        position: "top",
        axisLine: { show: false },
        axisLabel: {
          color: theme.subTextColor,
          fontSize: 10,
          rotate: 45,
          triggerEvent: true,
        },
        axisTick: { show: false },
        splitArea: {
          show: true,
          areaStyle: {
            color: [
              theme.isDark ? "rgba(255,255,255,0.02)" : "rgba(250,250,250,0.3)",
              theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(200,200,200,0.1)",
            ],
          },
        }, // Subtle Zebra stripe
      } as EChartsOption["xAxis"],
      yAxis: {
        type: "category",
        data: data.projects,
        inverse: true,
        axisLine: { show: false },
        axisLabel: {
          color: theme.subTextColor,
          fontSize: 10,
          triggerEvent: true,
        },
        axisTick: { show: false },
        splitArea: {
          show: true,
          areaStyle: {
            color: [
              theme.isDark ? "rgba(255,255,255,0.02)" : "rgba(250,250,250,0.3)",
              theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(200,200,200,0.1)",
            ],
          },
        },
      } as EChartsOption["yAxis"],
      visualMap: [
        {
          type: "continuous",
          seriesIndex: 0, // For normal data (Blue)
          min: 0,
          max: Math.max(max, 1),
          calculable: true,
          orient: "vertical",
          right: "2%",
          top: "center",
          inRange: {
            // Use different scale for dark mode if needed, or keeping it same as it is blue which works on dark
            // Light: ["#f1f5f9", "#a5b4fc", "#6366f1", "#4338ca"]
            // Dark: Maybe start darker? #1e293b is bg.
            color: theme.isDark
              ? ["#334155", "#6366f1", "#818cf8", "#c7d2fe"] // Dark slate -> Indigo -> Light Indigo
              : ["#f1f5f9", "#a5b4fc", "#6366f1", "#4338ca"],
          },
          formatter: (value: number | string) =>
            formatDuration(typeof value === "number" ? value : 0),
          textStyle: { color: theme.subTextColor, fontSize: 10 },
        },
        {
          type: "continuous",
          seriesIndex: 1, // For unclassified data (Grayscale)
          min: 0,
          max: Math.max(max, 1),
          calculable: false, // Hide handle/text for secondary visualMap to avoid clutter
          show: false, // Completely hide the visualMap controller for unclassified
          inRange: {
            // Darker grayscale for better visibility
            color: theme.isDark
              ? ["#404040", "#525252", "#737373", "#a3a3a3"] // Neutral 700 -> 400 (True Grayscale)
              : ["#e5e5e5", "#d4d4d4", "#a3a3a3", "#737373"], // Neutral 200 -> 500
          },
        },
      ] as EChartsOption["visualMap"],
      series: [
        {
          name: "Normal Time",
          type: "heatmap",
          data: normalData,
          label: commonLabelOption,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
          itemStyle: {
            borderRadius: 4,
            borderColor: theme.isDark ? "#1e293b" : "#fff",
            borderWidth: 2,
          },
        },
        {
          name: "Unclassified Time",
          type: "heatmap",
          data: unclassifiedData,
          label: commonLabelOption,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: "rgba(0, 0, 0, 0.5)",
            },
          },
          itemStyle: {
            borderRadius: 4,
            borderColor: theme.isDark ? "#1e293b" : "#fff",
            borderWidth: 2,
          },
        },
      ] as EChartsOption["series"],
    }
  }, [theme, data.categories, data.projects, max, normalData, unclassifiedData])

  return option
}
