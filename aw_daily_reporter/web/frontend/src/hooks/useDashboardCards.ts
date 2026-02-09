import { useEffect, useState } from "react"

export type ChartCard =
  | "categoryPie"
  | "projectPie"
  | "clientPie"
  | "billing"
  | "hourly"
  | "heatmap"

const ALL_CARDS: ChartCard[] = [
  "categoryPie",
  "projectPie",
  "clientPie",
  "billing",
  "hourly",
  "heatmap",
]

export function useDashboardCards(ruleModalOpen: boolean) {
  // Filter state for chart clicks
  const [filter, setFilter] = useState<{
    project?: string
    category?: string
    client?: string
    source?: ChartCard
  } | null>(null)

  // Card open/close state
  const [openCards, setOpenCards] = useState<Set<ChartCard>>(new Set(ALL_CARDS))

  // Apply filter and collapse other cards
  const applyFilterWithCollapse = (
    filterValue: { project?: string; category?: string; client?: string },
    sourceCard: ChartCard,
  ) => {
    setFilter({ ...filterValue, source: sourceCard })
    setOpenCards(new Set([sourceCard]))
  }

  // Clear filter and open all cards
  const clearFilter = () => {
    setFilter(null)
    setOpenCards(new Set(ALL_CARDS))
  }

  // Toggle card manually
  const toggleCard = (card: ChartCard, isOpen: boolean) => {
    setOpenCards((prev) => {
      const next = new Set(prev)
      if (isOpen) {
        next.add(card)
      } else {
        next.delete(card)
      }
      return next
    })
  }

  // Esc key to clear filter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if modal is open
      if (ruleModalOpen) return

      if (e.key === "Escape" && filter) {
        setFilter(null)
        setOpenCards(new Set(ALL_CARDS))
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [filter, ruleModalOpen])

  return {
    filter,
    openCards,
    applyFilterWithCollapse,
    clearFilter,
    toggleCard,
  }
}
