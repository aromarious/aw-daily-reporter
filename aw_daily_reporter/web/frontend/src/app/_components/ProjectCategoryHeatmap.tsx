"use client"

import EChartsWrapper from "@/components/echarts/EChartsWrapper"
import { useHeatmap } from "@/hooks/useHeatmap"

export interface ProjectCategoryData {
  projects: string[]
  categories: string[]
  matrix: number[][] // [project][category] = seconds
}

interface ProjectCategoryHeatmapProps {
  data: ProjectCategoryData
  onCellClick?: (project: string, category: string) => void
  onProjectClick?: (project: string) => void
  onCategoryClick?: (category: string) => void
}

export default function ProjectCategoryHeatmap({
  data,
  onCellClick,
  onProjectClick,
  onCategoryClick,
}: ProjectCategoryHeatmapProps) {
  const option = useHeatmap(data)

  if (!data.projects.length || !data.categories.length) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-400">
        No data for heatmap
      </div>
    )
  }

  const handleEvents = {
    click: (params: unknown) => {
      const p = params as {
        componentType?: string
        data?: { value: [number, number, number] }
        value?: string
      }
      // Axis label click (project or category)
      if (p.componentType === "yAxis" && p.value) {
        onProjectClick?.(p.value)
        return
      }
      if (p.componentType === "xAxis" && p.value) {
        onCategoryClick?.(p.value)
        return
      }
      // Cell click
      if (p.data) {
        const [catIdx, projIdx] = p.data.value
        const project = data.projects[projIdx]
        const category = data.categories[catIdx]
        if (project && category) {
          onCellClick?.(project, category)
        }
      }
    },
  }

  return (
    <EChartsWrapper
      option={option}
      style={{
        height: `${Math.max(200, data.projects.length * 40 + 100)}px`,
        width: "100%",
      }}
      onEvents={handleEvents}
    />
  )
}
