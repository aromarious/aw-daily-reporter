import { useMemo } from "react"
import { getProjectColor, isUncategorized } from "@/lib/colors"

interface TimelineItem {
  timestamp: string
  duration: number
  category?: string
  project?: string
  metadata?: {
    client?: string
  }
}

interface ReportData {
  timeline?: TimelineItem[]
  report?: {
    clients?: Record<string, { name: string }>
  }
}

export function useDashboardChartData(data: ReportData | undefined) {
  return useMemo(() => {
    if (!data?.timeline) {
      return {
        categoryData: [],
        projectData: [],
        hourlyData: [],
        categories: [],
        heatmapData: { projects: [], categories: [], matrix: [] },
        clientColors: {},
      }
    }

    const timeline = data.timeline as TimelineItem[]

    // Category aggregation
    const categoryMap = new Map<string, number>()
    timeline.forEach((item) => {
      const cat = item.category || "Other"
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + item.duration)
    })
    const categoryData = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Hourly aggregation
    const hourlyMap = new Map<number, Record<string, number>>()
    timeline.forEach((item) => {
      const hour = new Date(item.timestamp).getHours()
      const cat = item.category || "Other"
      if (!hourlyMap.has(hour)) {
        hourlyMap.set(hour, {})
      }
      const hourData = hourlyMap.get(hour)
      if (hourData) {
        hourData[cat] = (hourData[cat] || 0) + item.duration
      }
    })
    const hourlyData = Array.from(hourlyMap.entries())
      .map(([hour, categories]) => ({ hour, categories }))
      .sort((a, b) => a.hour - b.hour)

    // Project aggregation
    const projectMap = new Map<string, number>()
    timeline.forEach((item) => {
      let proj = item.project || "Uncategorized"
      if (isUncategorized(proj)) proj = "Uncategorized"
      projectMap.set(proj, (projectMap.get(proj) || 0) + item.duration)
    })
    const projectData = Array.from(projectMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    // Unique categories
    const categories = Array.from(
      new Set(timeline.map((i) => i.category || "Other")),
    )

    // Project x Category and Client x Project Aggregation
    const { projectCategoryMap, clientProjectMap } =
      processTimelineData(timeline)

    // Calculate Client colors (based on dominant project)
    const clientColors = calculateClientColors(
      clientProjectMap,
      data.report?.clients || {},
    )

    const projectsList = sortWithUncategorizedLast(
      Array.from(projectCategoryMap.keys()),
      projectMap,
    )
    const categoriesList = sortWithUncategorizedLast(
      Array.from(
        new Set(
          Array.from(projectCategoryMap.values()).flatMap((m) =>
            Array.from(m.keys()),
          ),
        ),
      ),
      categoryMap,
    )
    const matrix = projectsList.map((proj) => {
      const catMap = projectCategoryMap.get(proj)
      return categoriesList.map((cat) => catMap?.get(cat) ?? 0)
    })

    const heatmapData = {
      projects: projectsList,
      categories: categoriesList,
      matrix,
    }

    return {
      categoryData,
      projectData,
      hourlyData,
      categories,
      heatmapData,
      clientColors,
    }
  }, [data])
}

function processTimelineData(timeline: TimelineItem[]) {
  const projectCategoryMap = new Map<string, Map<string, number>>()
  const clientProjectMap = new Map<string, Map<string, number>>()

  timeline.forEach((item) => {
    let project = item.project || "Uncategorized"
    if (isUncategorized(project)) project = "Uncategorized"
    const category = item.category || "Other"

    // Project x Category
    if (!projectCategoryMap.has(project)) {
      projectCategoryMap.set(project, new Map())
    }
    const catMap = projectCategoryMap.get(project)
    if (catMap) {
      catMap.set(category, (catMap.get(category) || 0) + item.duration)
    }

    // Client x Project
    const client = item.metadata?.client
    if (client) {
      if (!clientProjectMap.has(client)) {
        clientProjectMap.set(client, new Map())
      }
      const cpMap = clientProjectMap.get(client)
      if (cpMap) {
        cpMap.set(project, (cpMap.get(project) || 0) + item.duration)
      }
    }
  })

  return { projectCategoryMap, clientProjectMap }
}

function calculateClientColors(
  clientProjectMap: Map<string, Map<string, number>>,
  clientsConfig: Record<string, { name: string }>,
) {
  const clientColors: Record<string, string> = {}
  clientProjectMap.forEach((projMap, clientId) => {
    let maxDuration = -1
    let dominantProject = ""
    projMap.forEach((duration, project) => {
      if (duration > maxDuration) {
        maxDuration = duration
        dominantProject = project
      }
    })
    if (dominantProject) {
      // Resolve Client ID to Name
      const clientName = clientsConfig[clientId]?.name || clientId
      clientColors[clientName] = getProjectColor(dominantProject)
    }
  })
  return clientColors
}
