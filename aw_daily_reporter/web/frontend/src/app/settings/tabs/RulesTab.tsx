"use client"

import { Info, Plus } from "lucide-react"
import dynamic from "next/dynamic"
import { useState } from "react"
import { Card } from "@/components/Card"
import { useTranslation } from "@/contexts/I18nContext"
import { usePlugins } from "../hooks/usePlugins"
import type { FullConfig, Rule } from "../types"

// Dynamic Components for Rules Tab
const RuleList = dynamic(() => import("@/app/settings/_components/RuleList"), {
  ssr: false,
})
const RuleModal = dynamic(() => import("@/components/rules/RuleModal"), {
  ssr: false,
})

interface RulesTabProps {
  config: FullConfig | undefined
  localRules: Rule[]
  setLocalRules: (rules: Rule[]) => void
  handleSaveConfig: (
    newConfig: FullConfig | null,
    showNotification?: boolean,
    immediate?: boolean,
  ) => Promise<boolean>
}

export default function RulesTab({
  config,
  localRules,
  setLocalRules,
  handleSaveConfig,
}: RulesTabProps) {
  const { t } = useTranslation()
  const { isSettingRequired } = usePlugins()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [draggedRuleIndex, setDraggedRuleIndex] = useState<number | null>(null)

  // rules が有効なプラグインに必要かどうかをチェック
  const isRulesEnabled = isSettingRequired("rules")

  // Rule DnD Handlers
  const handleRuleDragStart = (event: React.DragEvent, index: number) => {
    setDraggedRuleIndex(index)
    event.dataTransfer.effectAllowed = "move"
  }

  const handleRuleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  const handleRuleDrop = async (event: React.DragEvent, dropIndex: number) => {
    event.preventDefault()

    if (draggedRuleIndex === null || draggedRuleIndex === dropIndex) return

    const newRules = [...localRules]
    const [movedRule] = newRules.splice(draggedRuleIndex, 1)
    newRules.splice(dropIndex, 0, movedRule)

    setLocalRules(newRules)
    setDraggedRuleIndex(null)
    // 即座に保存
    if (config) {
      await handleSaveConfig({ ...config, rules: newRules }, true)
    }
  }

  const handleRuleDragEnd = () => {
    setDraggedRuleIndex(null)
  }

  // Rule Actions
  const handleAddRule = () => {
    setEditingIndex(null)
    setModalOpen(true)
  }
  const handleEditRule = (index: number) => {
    setEditingIndex(index)
    setModalOpen(true)
  }
  const handleDeleteRule = async (index: number) => {
    const newRules = [...localRules]
    newRules.splice(index, 1)
    setLocalRules(newRules)
    // 即座に保存
    if (config) {
      await handleSaveConfig({ ...config, rules: newRules }, true)
    }
  }
  const handleToggleRule = async (index: number) => {
    const newRules = [...localRules]
    newRules[index] = {
      ...newRules[index],
      enabled: !(newRules[index].enabled !== false),
    }
    setLocalRules(newRules)
    // 即座に保存
    if (config) {
      await handleSaveConfig({ ...config, rules: newRules }, true)
    }
  }
  const handleSaveRule = async (rule: Rule) => {
    const newRules = [...localRules]
    if (editingIndex !== null) newRules[editingIndex] = rule
    else newRules.unshift(rule)
    setLocalRules(newRules)
    // 即座に保存
    if (config) {
      await handleSaveConfig({ ...config, rules: newRules }, true)
    }
  }

  // 全ルールをオン/オフ
  const handleToggleAllRules = async (enabled: boolean) => {
    const newRules = localRules.map((rule) => ({
      ...rule,
      enabled,
    }))
    setLocalRules(newRules)
    if (config) {
      await handleSaveConfig({ ...config, rules: newRules }, true)
    }
  }

  // 全ルールが有効かどうか
  const allRulesEnabled =
    localRules.length > 0 && localRules.every((r) => r.enabled !== false)

  return (
    <>
      <Card title={t("Categorization Rules")} className="flex-1 w-full min-h-0">
        <div className="flex-1 overflow-y-auto pr-2 mt-2 custom-scrollbar min-h-125">
          {!isRulesEnabled && (
            <div className="alert mb-4 text-sm py-3 bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400">
              <Info size={16} className="shrink-0" />
              <span>
                {t("Categorization Rules plugin is disabled.")}{" "}
                {t("Enable it in the Plugins tab to use this feature.")}
              </span>
            </div>
          )}
          <p className="text-sm text-base-content/60 mb-4 px-1">
            {t("Manage categorization rules")}
            <br />
            {t("Used by:")}{" "}
            <span className="font-medium">{t("Categorization Rules")}</span>
          </p>
          {/* Action Bar: Add + Toggle All */}
          <div className="flex gap-3 mb-4">
            <button
              type="button"
              onClick={handleAddRule}
              disabled={!isRulesEnabled}
              className="flex-1 py-2 border-2 border-dashed border-base-content/20 rounded-lg text-base-content/60 font-medium hover:border-primary hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus size={18} /> {t("Add New Rule")}
            </button>
            {/* Toggle All Button */}
            {localRules.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  className="toggle toggle-sm border-base-content/20 bg-base-300 text-white checked:border-primary checked:bg-indigo-400 checked:text-white"
                  checked={allRulesEnabled}
                  onChange={() => handleToggleAllRules(!allRulesEnabled)}
                  disabled={!isRulesEnabled}
                />
                <span className="text-sm text-base-content/70 font-medium">
                  {allRulesEnabled ? t("All On") : t("All Off")}
                </span>
              </label>
            )}
          </div>
          <RuleList
            rules={localRules}
            onEdit={handleEditRule}
            onDelete={handleDeleteRule}
            onToggle={handleToggleRule}
            onDragStart={handleRuleDragStart}
            onDragOver={handleRuleDragOver}
            onDrop={handleRuleDrop}
            onDragEnd={handleRuleDragEnd}
            draggedIndex={draggedRuleIndex}
            disabled={!isRulesEnabled}
          />
        </div>
      </Card>

      {/* Rule Modal */}
      {modalOpen && (
        <RuleModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveRule}
          initialRule={
            editingIndex !== null ? localRules[editingIndex] : undefined
          }
        />
      )}
    </>
  )
}
