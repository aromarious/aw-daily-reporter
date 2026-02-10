"use client"

import { useEffect } from "react"
import useSWR from "swr"
import { fetcher } from "@/lib/api"
import { setCustomCategoryColors } from "@/lib/colors"

export function ConfigInitializer() {
  const { data: config } = useSWR("/api/settings", fetcher)

  useEffect(() => {
    if (config?.system?.category_colors) {
      setCustomCategoryColors(config.system.category_colors)
    }
  }, [config])

  return null
}
