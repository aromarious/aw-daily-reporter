"use client"

import { Loader2 } from "lucide-react"
import dynamic from "next/dynamic"

const PipelineDebugger = dynamic(
  () => import("@/components/pipeline/PipelineDebugger"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-indigo-500" size={32} />
      </div>
    ),
  },
)

export default function DebuggerPage() {
  return (
    <main className="w-full px-6 py-6">
      <PipelineDebugger />
    </main>
  )
}
