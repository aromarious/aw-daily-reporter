"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"
import type { RefObject } from "react"
import { useTranslation } from "@/contexts/I18nContext"

interface DashboardHeaderProps {
  date: string
  dateInputRef: RefObject<HTMLInputElement | null>
  handlePrevDay: () => void
  handleNextDay: () => void
  handleDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleToday: () => void
  isToday: boolean
  totalDurationStr: string
}

export function DashboardHeader({
  date,
  dateInputRef,
  handlePrevDay,
  handleNextDay,
  handleDateChange,
  handleToday,
  isToday,
  totalDurationStr,
}: DashboardHeaderProps) {
  const { t } = useTranslation()

  return (
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
  )
}
