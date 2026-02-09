"use client"

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react"

// ... imports ...

// Remove Clock, CupSoda from lucide-react import
import dynamic from "next/dynamic"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import useSWR from "swr"
import { BillingSummaryCard } from "@/app/_components/BillingSummaryCard"
import { DashboardStats } from "@/app/_components/DashboardStats"
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
const CategoryPieChart = dynamic(
  () => import("@/app/_components/CategoryPieChart"),
  { ssr: false },
)
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
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center p-4">
        <div className="bg-base-100 p-6 rounded-xl shadow-sm border border-warning/20 max-w-md w-full">
          <div className="flex items-center gap-3 text-warning mb-4">
            <AlertCircle size={24} />
            <h2 className="font-semibold text-lg">{t("No Report Data")}</h2>
          </div>
          <p className="text-base-content/70 mb-4">
            {t(
              "The server returned a response, but it contains no report data.",
            )}
          </p>
          <div className="bg-base-200 p-3 rounded-lg text-xs font-mono text-base-content/60 overflow-auto max-h-48">
            {JSON.stringify(data, null, 2)}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full mt-4 py-2.5 bg-neutral text-neutral-content rounded-lg hover:bg-neutral/90 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <RefreshCw size={16} />
            {t("Reload")}
          </button>
        </div>
      </div>
    )
  }

  const { work_stats } = report
  const totalSeconds =
    (work_stats.working_seconds || 0) + (work_stats.break_seconds || 0)
  const totalDurationStr = formatDuration(totalSeconds)

  return (
    <main className="container mx-auto px-6 py-8">
      <div className="flex flex-col gap-6">
        {/* Header with Date Navigation */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-base-content">
              {t("Activity Dashboard")}
            </h1>
            <div className="flex items-center gap-2 mt-1 text-base-content/60">
              <button
                type="button"
                onClick={handlePrevDay}
                className="p-1 hover:bg-base-200 rounded text-base-content/40 hover:text-base-content/80 transition-colors"
                title={t("Previous Day")}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                className="relative group cursor-pointer flex items-center gap-2"
                onClick={() => dateInputRef.current?.showPicker()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    dateInputRef.current?.showPicker()
                  }
                }}
              >
                <span className="border-b border-transparent group-hover:border-base-300 transition-colors">
                  {new Date(date).toLocaleDateString(undefined, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={date}
                  onChange={handleDateChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  aria-label="Date selector"
                />
              </button>
              <button
                type="button"
                onClick={handleNextDay}
                className="p-1 hover:bg-base-200 rounded text-base-content/40 hover:text-base-content/80 transition-colors"
                title={t("Next Day")}
              >
                <ChevronRight size={18} />
              </button>

              {!isToday && (
                <button
                  type="button"
                  onClick={handleToday}
                  className="ml-2 text-xs px-2 py-0.5 bg-primary/10 text-primary rounded hover:bg-primary/20 font-medium transition-colors"
                >
                  {t("Today")}
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-6">
            {/* Header Stats */}
            <div className="text-right pl-6 border-l border-base-200">
              <div className="text-sm text-base-content/60">
                {t("Total Active Time")}
              </div>
              <div className="text-2xl font-bold text-base-content">
                {totalDurationStr}
              </div>
            </div>
          </div>
        </div>

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card
            title={t("Time by Category")}
            className="overflow-hidden"
            collapsible
            isOpen={openCards.has("categoryPie")}
            onToggle={(isOpen) => toggleCard("categoryPie", isOpen)}
          >
            <CategoryPieChart
              data={categoryData}
              onCategoryClick={(category) =>
                applyFilterWithCollapse({ category }, "categoryPie")
              }
            />
          </Card>
          <Card
            title={t("Time by Project")}
            className="overflow-hidden"
            collapsible
            isOpen={openCards.has("projectPie")}
            onToggle={(isOpen) => toggleCard("projectPie", isOpen)}
          >
            <CategoryPieChart
              data={projectData}
              colorType="project"
              onCategoryClick={(project) =>
                applyFilterWithCollapse({ project }, "projectPie")
              }
            />
          </Card>
          <Card
            title={t("Time by Client")}
            className="overflow-hidden"
            collapsible
            isOpen={openCards.has("clientPie")}
            onToggle={(isOpen) => toggleCard("clientPie", isOpen)}
          >
            <CategoryPieChart
              data={Object.entries(report.client_stats || {})
                .map(([name, value]) => ({ name, value: value as number }))
                .sort((a, b) => b.value - a.value)}
              colorType="project"
              customColors={clientColors}
              onCategoryClick={(client) =>
                applyFilterWithCollapse({ client }, "clientPie")
              }
            />
          </Card>
          {/* Billing Summary Card */}
          <BillingSummaryCard
            report={report}
            isOpen={openCards.has("billing")}
            onToggle={(isOpen) => toggleCard("billing", isOpen)}
          />
        </div>

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
        {filter && (
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm text-base-content/70">
              {t("Filtering:")}
            </span>
            {filter.project && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                {t("Project")}: {filter.project}
              </span>
            )}
            {filter.category && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {t("Category")}: {filter.category}
              </span>
            )}
            {filter.client && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                {t("Client")}: {filter.client}
              </span>
            )}
            <button
              type="button"
              onClick={clearFilter}
              className="p-0.5 rounded hover:bg-base-200 text-base-content/50"
              title={t("Clear filter")}
            >
              <X size={14} />
            </button>
          </div>
        )}

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
