"use client"

import { Grid3X3, Loader2 } from "lucide-react"

// ... imports ...

// Remove Clock, CupSoda from lucide-react import
import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import useSWR from "swr"
import { DashboardCharts } from "@/app/_components/DashboardCharts"
import { DashboardHeader } from "@/app/_components/DashboardHeader"
import { DashboardStats } from "@/app/_components/DashboardStats"
import { FilterBadge } from "@/app/_components/FilterBadge"
import { NoReportData } from "@/app/_components/NoReportData"
import { RendererOutputViewer } from "@/app/_components/RendererOutputViewer"
import { Card } from "@/components/Card"
import TimelineTable from "@/components/TimelineTable"
import { useTranslation } from "@/contexts/I18nContext"
import { useToast } from "@/contexts/ToastContext"
import { useDashboardCards } from "@/hooks/useDashboardCards"
import { useDashboardChartData } from "@/hooks/useDashboardChartData"
import { useDateNavigation } from "@/hooks/useDateNavigation"
import { useFilteredTimeline } from "@/hooks/useFilteredTimeline"
import { useRuleManagement } from "@/hooks/useRuleManagement"
import { useTimeRange } from "@/hooks/useTimeRange"
import { fetcher } from "@/lib/api"
import { loadConstants } from "@/lib/colors"
import { formatDuration } from "@/lib/date"

// Dynamic imports for SSR safety
const HourlyActivityChart = dynamic(
  () => import("@/app/_components/HourlyActivityChart"),
  { ssr: false },
)
const ProjectCategoryHeatmap = dynamic(
  () => import("@/app/_components/ProjectCategoryHeatmap"),
  { ssr: false },
)
const DualLaneTimeline = dynamic(
  () => import("@/app/_components/DualLaneTimeline"),
  { ssr: false },
)
const RuleModal = dynamic(() => import("@/components/rules/RuleModal"), {
  ssr: false,
})

interface SettingsConfig {
  system?: {
    day_start_source?: string
    start_of_day?: string
    aw_start_of_day?: string
  }
}

function DashboardContent() {
  const _router = useRouter()
  const _pathname = usePathname()
  const _searchParams = useSearchParams()
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [isDetailedLogOpen, setIsDetailedLogOpen] = useState(true)

  // Fetch settings for day start configuration
  const { data: settings } = useSWR<SettingsConfig>("/api/settings", fetcher)

  // Date Navigation
  const {
    date,
    dateInputRef,
    handlePrevDay,
    handleNextDay,
    handleDateChange,
    handleToday,
    isToday,
  } = useDateNavigation(settings)

  // Rule actions
  const {
    ruleModalOpen,
    setRuleModalOpen,
    initialRule,
    suggestedKeyword,
    handleCreateRule,
    handleSaveRule,
  } = useRuleManagement(date)

  const { data, error, isLoading } = useSWR(`/api/report?date=${date}`, fetcher)

  useEffect(() => {
    if (error) {
      showToast(t("Failed to load report: ") + error.message, "error")
    }
  }, [error, showToast, t])

  // APIから定数を読み込む（初回のみ）
  useEffect(() => {
    loadConstants()
  }, [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const timeRange = useTimeRange(data)

  const {
    filter,
    openCards,
    applyFilterWithCollapse,
    clearFilter,
    toggleCard,
  } = useDashboardCards(ruleModalOpen)

  // Generate chart data
  const {
    categoryData,
    projectData,
    hourlyData,
    categories,
    heatmapData,
    clientColors,
  } = useDashboardChartData(data)

  const { report, timeline } = data || {}
  const filteredTimeline = useFilteredTimeline(timeline, filter, report)

  if (error)
    return (
      <div className="p-8 text-red-500">
        Failed to load report: {error.message}
      </div>
    )
  if (isLoading)
    return (
      <div className="p-8 flex items-center gap-2">
        <Loader2 className="animate-spin" suppressHydrationWarning /> Loading
        report...
      </div>
    )

  if (!data) return null

  if (!report) {
    return <NoReportData data={data} />
  }

  const { work_stats } = report
  const totalSeconds =
    (work_stats.working_seconds || 0) + (work_stats.break_seconds || 0)
  const totalDurationStr = formatDuration(totalSeconds)

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="flex flex-col gap-6">
        {/* Header with Date Navigation */}
        <DashboardHeader
          date={date}
          dateInputRef={dateInputRef}
          handlePrevDay={handlePrevDay}
          handleNextDay={handleNextDay}
          handleDateChange={handleDateChange}
          handleToday={handleToday}
          isToday={isToday}
          totalDurationStr={totalDurationStr}
        />

        {/* Stats Cards */}
        <DashboardStats report={report} />

        {/* Activity Timeline */}
        <Card title={t("Activity Timeline")} className="overflow-hidden">
          <DualLaneTimeline
            data={timeline}
            height={120}
            startTime={timeRange?.start}
            endTime={timeRange?.end}
          />
        </Card>

        {/* Charts Row */}
        <DashboardCharts
          categoryData={categoryData}
          projectData={projectData}
          _clientStats={report.client_stats || {}}
          clientColors={clientColors}
          report={report}
          openCards={openCards}
          toggleCard={toggleCard}
          applyFilterWithCollapse={applyFilterWithCollapse}
        />

        {/* Hourly Activity (full width) */}
        <Card
          title={t("Hourly Activity")}
          className="overflow-hidden"
          collapsible
          isOpen={openCards.has("hourly")}
          onToggle={(isOpen) => toggleCard("hourly", isOpen)}
        >
          <HourlyActivityChart
            data={hourlyData}
            categories={categories}
            onCategoryClick={(category) =>
              applyFilterWithCollapse({ category }, "hourly")
            }
          />
        </Card>

        {/* Project x Category Heatmap */}
        <Card
          title={t("Project × Category Matrix")}
          className="overflow-hidden"
          icon={<Grid3X3 size={18} className="text-primary" />}
          collapsible
          isOpen={openCards.has("heatmap")}
          onToggle={(isOpen) => toggleCard("heatmap", isOpen)}
        >
          <ProjectCategoryHeatmap
            data={heatmapData}
            onCellClick={(project, category) =>
              applyFilterWithCollapse({ project, category }, "heatmap")
            }
            onProjectClick={(project) =>
              applyFilterWithCollapse({ project }, "heatmap")
            }
            onCategoryClick={(category) =>
              applyFilterWithCollapse({ category }, "heatmap")
            }
          />
        </Card>

        {/* Filter Badge */}
        <FilterBadge filter={filter} clearFilter={clearFilter} />

        {/* Main Timeline */}
        <Card
          title={
            <div className="flex items-center gap-2">
              <span>{t("Detailed Activity Log")}</span>
              <span className="text-sm font-normal text-base-content/60">
                ({date})
              </span>
            </div>
          }
          className="flex-1 overflow-hidden flex flex-col"
          collapsible
          isOpen={isDetailedLogOpen}
          onToggle={(isOpen) => setIsDetailedLogOpen(isOpen)}
        >
          <TimelineTable
            data={filteredTimeline}
            clients={report.clients}
            onCreateRule={handleCreateRule}
          />
        </Card>

        {/* Renderer Output */}
        {data.renderer_outputs &&
          Object.keys(data.renderer_outputs).length > 0 && (
            <Card title={t("Report Output (Renderer)")} collapsible>
              <RendererOutputViewer
                outputs={data.renderer_outputs}
                rendererNames={data.renderer_names}
              />
            </Card>
          )}
      </div>

      <RuleModal
        isOpen={ruleModalOpen}
        onClose={() => setRuleModalOpen(false)}
        onSave={handleSaveRule}
        initialRule={initialRule}
        initialKeywordInput={suggestedKeyword}
      />
    </main>
  )
}

// Suspense でラップした export（Next.js 16 の要件）
export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center gap-2">
          <Loader2 className="animate-spin" /> Loading...
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
