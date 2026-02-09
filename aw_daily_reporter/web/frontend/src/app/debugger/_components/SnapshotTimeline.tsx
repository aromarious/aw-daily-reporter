"use client"

import dynamic from "next/dynamic"
import { useTheme } from "next-themes"
import type { EChartsWrapperProps } from "@/components/echarts/EChartsWrapper"
import { useSnapshotTimeline } from "@/hooks/useSnapshotTimeline"

const EChartsWrapper = dynamic<EChartsWrapperProps>(
  () => import("@/components/echarts/EChartsWrapper"),
  {
    ssr: false,
  },
)

import type { TimelineItem } from "@/types"
export type { TimelineItem }

export interface Snapshot {
  name: string
  timeline: TimelineItem[]
}

interface SnapshotTimelineProps {
  snapshot: Snapshot
  height?: number
  domainStart?: number
  domainEnd?: number
}

export default function SnapshotTimeline({
  snapshot,
  height = 150,
  domainStart,
  domainEnd,
}: SnapshotTimelineProps) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const { option, actualHeight } = useSnapshotTimeline({
    snapshot,
    height,
    domainStart,
    domainEnd,
  })

  // データがない場合の表示はフック内のoptionが空かどうかで判断できますが、
  // フックが空のオブジェクトを返す仕様になっているため、ここで判定するのは難しいかもしれません。
  // フック内でデータチェックを行っていますが、optionが空文字などではなく空オブジェクト {} になります。
  // EChartsは空オブジェクトでもエラーにはなりませんが、"No Data"を表示したいです。
  // useSnapshotTimelineからisEmptyなどを返すと良さそうですが、
  // 現状の実装では chartData.length === 0 の場合 option = {} を返しています。
  // Object.keys(option).length === 0 で判定できます。

  if (Object.keys(option).length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-sm">
        No Data
      </div>
    )
  }

  return (
    <div style={{ height: actualHeight, width: "100%" }}>
      <EChartsWrapper
        key={isDark ? "dark" : "light"}
        option={option}
        style={{ height: "100%", width: "100%" }}
        theme={isDark ? "dark" : "light"}
      />
    </div>
  )
}
