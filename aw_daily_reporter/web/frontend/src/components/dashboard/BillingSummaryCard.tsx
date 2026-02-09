"use client"

import { Card } from "@/components/Card"
import { useTranslation } from "@/contexts/I18nContext"
import { isUncategorized } from "@/lib/colors"

interface ClientData {
  name: string
  rate: number
}

interface BillingSummaryCardProps {
  report: {
    client_stats?: Record<string, number>
    clients?: Record<string, ClientData>
  }
  isOpen: boolean
  onToggle: (isOpen: boolean) => void
}

export function BillingSummaryCard({
  report,
  isOpen,
  onToggle,
}: BillingSummaryCardProps) {
  const { t } = useTranslation()

  if (!report.clients || Object.keys(report.clients).length === 0) {
    return null
  }

  const clientStats = report.client_stats || {}
  const clients = report.clients || {}

  const sortedStats = Object.entries(clientStats).sort(
    ([nameA, a], [nameB, b]) => {
      const aUncat = isUncategorized(nameA)
      const bUncat = isUncategorized(nameB)
      if (aUncat !== bUncat) return aUncat ? 1 : -1
      return b - a
    },
  )

  const totalHours =
    Object.values(clientStats).reduce((sum, s) => sum + s, 0) / 3600

  const totalAmount = Object.entries(clientStats).reduce(
    (sum, [name, seconds]) => {
      const clientEntry = Object.values(clients).find((c) => c.name === name)
      const rate = clientEntry ? clientEntry.rate : 0
      return sum + (seconds / 3600) * rate
    },
    0,
  )

  return (
    <Card
      title={t("Billing Summary")}
      className="overflow-hidden"
      collapsible
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <table className="w-full text-sm">
        <thead>
          <tr className="text-base-content/60 text-xs">
            <th className="text-left pb-2 font-medium">{t("Client")}</th>
            <th className="text-right pb-2 font-medium">{t("Time")}</th>
            <th className="text-right pb-2 font-medium">{t("Rate")}</th>
            <th className="text-right pb-2 font-medium">{t("Amount")}</th>
          </tr>
        </thead>
        <tbody>
          {sortedStats.map(([clientName, seconds]) => {
            const clientEntry = Object.values(clients).find(
              (c) => c.name === clientName,
            )
            const rate = clientEntry ? clientEntry.rate : 0
            const hours = seconds / 3600
            const amount = hours * rate

            return (
              <tr key={clientName} className="border-t border-base-200">
                <td className="py-2 text-base-content">{clientName}</td>
                <td className="py-2 text-right text-base-content/80">
                  {hours.toFixed(1)}h
                </td>
                <td className="py-2 text-right text-base-content/60">
                  {rate > 0 ? `¥${rate.toLocaleString()}` : "-"}
                </td>
                <td className="py-2 text-right font-medium text-base-content/90">
                  {rate > 0 ? `¥${Math.round(amount).toLocaleString()}` : "-"}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-base-200">
            <td className="py-2 font-semibold text-base-content">
              {t("Total")}
            </td>
            <td className="py-2 text-right font-medium text-base-content/80">
              {totalHours.toFixed(1)}h
            </td>
            <td className="py-2"></td>
            <td className="py-2 text-right font-bold text-success">
              ¥{Math.round(totalAmount).toLocaleString()}
            </td>
          </tr>
        </tfoot>
      </table>
    </Card>
  )
}
