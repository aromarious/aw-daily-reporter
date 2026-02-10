"use client"

import dynamic from "next/dynamic"
import { usePlugins } from "@/app/settings/hooks/usePlugins"
import { Card } from "@/components/Card"
import { PLUGIN_IDS } from "@/constants/pluginIds"
import { useTranslation } from "@/contexts/I18nContext"
import type { ChartCard } from "@/hooks/useDashboardCards"
import { BillingSummaryCard } from "./BillingSummaryCard"

const CategoryPieChart = dynamic(() => import("./CategoryPieChart"), {
  ssr: false,
})

interface DashboardChartsProps {
  categoryData: Array<{ name: string; value: number }>
  projectData: Array<{ name: string; value: number }>
  _clientStats: Record<string, number>
  clientColors: Record<string, string>
  report: {
    client_stats?: Record<string, number>
  }
  openCards: Set<ChartCard>
  toggleCard: (card: ChartCard, isOpen: boolean) => void
  applyFilterWithCollapse: (
    filterValue: { category?: string; project?: string; client?: string },
    sourceCard: ChartCard,
  ) => void
}

export function DashboardCharts({
  categoryData,
  projectData,
  _clientStats,
  clientColors,
  report,
  openCards,
  toggleCard,
  applyFilterWithCollapse,
}: DashboardChartsProps) {
  const { t } = useTranslation()
  const { isPluginEnabled } = usePlugins()

  // プラグインの有効状態を確認
  const isProjectExtractorEnabled = isPluginEnabled(
    PLUGIN_IDS.PROCESSOR_PROJECT_EXTRACTOR,
  )
  const isProjectMappingEnabled = isPluginEnabled(
    PLUGIN_IDS.PROCESSOR_PROJECT_MAPPING,
  )

  // プロジェクト関連機能が有効かどうか
  const hasProjectFeature = isProjectExtractorEnabled || isProjectMappingEnabled

  return (
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
      {hasProjectFeature && (
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
      )}
      {isProjectMappingEnabled && (
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
      )}
      <BillingSummaryCard
        report={report}
        isOpen={openCards.has("billing")}
        onToggle={(isOpen) => toggleCard("billing", isOpen)}
      />
    </div>
  )
}
