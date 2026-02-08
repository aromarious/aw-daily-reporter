"use client"

import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import TimelineTable from "@/components/TimelineTable"

interface TimelineItem {
  timestamp: string
  duration: number
  app: string
  title: string
  category?: string
  project?: string
}

interface Snapshot {
  name: string
  timeline: TimelineItem[]
}

interface ProcessingStagesProps {
  snapshots: Snapshot[]
  isLoading: boolean
}

export default function ProcessingStages({
  snapshots,
  isLoading,
}: ProcessingStagesProps) {
  // Default open the last stage (Result)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  // Auto-open last snapshot on load? Logic might be tricky if snapshots change
  // Ideally user controls it.

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  if (isLoading) {
    return (
      <div className="p-4 text-center text-muted-foreground animate-pulse">
        Generating preview...
      </div>
    )
  }

  if (!snapshots || snapshots.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No preview data available.
      </div>
    )
  }

  return (
    <div className="flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white/40 backdrop-blur-sm">
      {snapshots.map((snap, index) => {
        const isOpen =
          openIndex === index ||
          (openIndex === null && index === snapshots.length - 1) // Default open last

        return (
          <div
            key={`${snap.name}-${index}`}
            className="border-b border-slate-200 last:border-0"
          >
            <button
              type="button"
              onClick={() => toggle(index)}
              className="w-full flex items-center justify-between p-4 bg-white/40 hover:bg-white/60 transition-colors text-left font-medium text-slate-700"
            >
              <span className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
                {snap.name}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                {snap.timeline?.length || 0} items
              </span>
            </button>

            {isOpen && (
              <div className="p-0 bg-white/20 border-t border-slate-200">
                <TimelineTable data={snap.timeline || []} height="400px" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
