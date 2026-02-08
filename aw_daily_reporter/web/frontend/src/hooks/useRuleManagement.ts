import { useState } from "react"
import { mutate } from "swr"
import { useTranslation } from "@/contexts/I18nContext"
import { useToast } from "@/contexts/ToastContext"
import { api } from "@/lib/api"

import type { TimelineItem } from "@/types"

export function useRuleManagement(date: string) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [ruleModalOpen, setRuleModalOpen] = useState(false)
  const [initialRule, setInitialRule] = useState<{
    keyword: string | string[]
    category: string
    project: string
    target?: string
    app?: string
  } | null>(null)
  const [suggestedKeyword, setSuggestedKeyword] = useState("")

  const handleCreateRule = (item: TimelineItem) => {
    // Escape special regex characters in title
    const keyword = item.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    setInitialRule({
      keyword: [], // Empty keyword list so it doesn't show as a chip
      category: item.category || "",
      project: item.project || "",
      target: "title",
      app: item.app,
    })
    setSuggestedKeyword(keyword) // Pass as suggested input
    setRuleModalOpen(true)
  }

  const handleSaveRule = async (rule: {
    keyword: string | string[]
    category: string
    project: string
    target?: string
    app?: string
  }) => {
    try {
      // Get current config first to append
      const config = await api.get("/api/settings").then((res) => res.data)
      const newRules = [rule, ...(config.rules || [])]

      await api.post("/api/settings", { ...config, rules: newRules })

      setRuleModalOpen(false)
      // Refresh data
      mutate(`/api/report?date=${date}`)
      showToast(t("Rule created successfully!"), "success")
    } catch (e) {
      console.error("Failed to save rule", e)
      showToast(t("Failed to save rule."), "error")
    }
  }

  return {
    ruleModalOpen,
    setRuleModalOpen,
    initialRule,
    suggestedKeyword,
    handleCreateRule,
    handleSaveRule,
  }
}
