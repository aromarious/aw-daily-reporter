"use client"

import { X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "@/contexts/I18nContext"

interface Rule {
  keyword: string | string[]
  category: string
  project: string
  target?: string
  app?: string
}

interface RuleModalProps {
  isOpen: boolean
  initialRule?: Rule | null
  onClose: () => void
  onSave: (rule: Rule) => void | Promise<void>
  onDelete?: () => void
  initialKeywordInput?: string
  categoryList?: string[]
}

// 正規表現が有効かどうかを検査
function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern)
    return true
  } catch {
    return false
  }
}

import { Combobox } from "./Combobox"
import { RuleMatchConditions } from "./RuleMatchConditions"

export default function RuleModal({
  isOpen,
  initialRule,
  onClose,
  onSave,
  onDelete,
  initialKeywordInput = "",
  categoryList = [],
}: RuleModalProps) {
  const { t } = useTranslation()
  // Compute initial values once from props
  const getInitialKeywords = useCallback(() => {
    if (!initialRule?.keyword) return []
    // 配列の場合はそのまま、文字列の場合は1要素の配列として扱う
    if (Array.isArray(initialRule.keyword)) return initialRule.keyword
    return [initialRule.keyword]
  }, [initialRule])

  const getInitialFormData = useCallback(
    () => ({
      category: initialRule?.category || "",
      project: initialRule?.project || "",
      target: initialRule?.target || "title",
      app: initialRule?.app || "",
    }),
    [initialRule],
  )

  // State initialized from props using initializers (only runs on mount)
  const [keywords, setKeywords] = useState<string[]>(getInitialKeywords)
  const [formData, setFormData] =
    useState<Omit<Rule, "keyword">>(getInitialFormData)
  const [keywordInput, setKeywordInput] = useState("")

  // Reset state when modal opens or initialRule changes
  useEffect(() => {
    if (isOpen) {
      setKeywords(getInitialKeywords())
      setFormData(getInitialFormData())
      setKeywordInput(initialKeywordInput)
    }
  }, [isOpen, initialKeywordInput, getInitialKeywords, getInitialFormData])

  // 入力中のキーワードが有効な正規表現かチェック
  const isCurrentInputValid = useMemo(() => {
    if (!keywordInput.trim()) return true // 空の場合はエラー表示しない
    return isValidRegex(keywordInput.trim())
  }, [keywordInput])

  const addKeyword = () => {
    const trimmed = keywordInput.trim()
    if (trimmed && isValidRegex(trimmed)) {
      setKeywords((prev) => [...prev, trimmed])
      setKeywordInput("")
    }
  }

  const removeKeyword = (keyword: string) => {
    setKeywords((prev) => {
      const idx = prev.indexOf(keyword)
      if (idx === -1) return prev
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const finalKeywords = [...keywords]
    if (keywordInput.trim()) {
      finalKeywords.push(keywordInput.trim())
    }

    // 配列のまま送信（バックエンドは配列対応済み）
    onSave({ ...formData, keyword: finalKeywords })
    onClose()
  }

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }

    if (isOpen) {
      window.addEventListener("keydown", handleGlobalKeyDown)
    }
    return () => window.removeEventListener("keydown", handleGlobalKeyDown)
  }, [isOpen, onClose])

  // Keyword input Enter key handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME入力中（日本語変換中など）は無視
    if (e.nativeEvent.isComposing) return
    if (e.key === "Enter") {
      e.preventDefault()
      addKeyword()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        {/* Backdrop */}
        <button
          type="button"
          className="fixed inset-0 bg-black/40 transition-opacity w-full h-full border-none cursor-default"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose()
          }}
          tabIndex={-1}
          aria-label="Close modal"
        />

        {/* Modal Panel */}
        <div className="relative transform overflow-visible rounded-lg bg-base-100 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl border border-base-content/10">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-base-content">
                {initialRule ? t("Edit Rule") : t("Add New Rule")}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1 text-base-content/40 hover:text-base-content/60 hover:bg-base-200 transition-colors rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <RuleMatchConditions
                keywords={keywords}
                keywordInput={keywordInput}
                setKeywordInput={setKeywordInput}
                addKeyword={addKeyword}
                removeKeyword={removeKeyword}
                handleKeyDown={handleKeyDown}
                isCurrentInputValid={isCurrentInputValid}
                target={formData.target || "title"}
                app={formData.app || ""}
                onTargetChange={(value) =>
                  setFormData((prev) => ({ ...prev, target: value }))
                }
                onAppChange={(value) =>
                  setFormData((prev) => ({ ...prev, app: value }))
                }
              />

              <div className="pt-4 border-t border-base-content/5">
                <h3 className="text-xs font-bold text-base-content/40 uppercase tracking-wider mb-3">
                  {t("Assign To")}
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Category */}
                  <div>
                    <label
                      htmlFor="category-input"
                      className="block text-sm font-semibold text-base-content/80 mb-1"
                    >
                      {t("Category")}
                    </label>
                    <Combobox
                      value={formData.category}
                      onChange={(val) =>
                        setFormData((prev) => ({ ...prev, category: val }))
                      }
                      options={categoryList}
                      placeholder={t("Select or create category")}
                    />
                  </div>

                  {/* Project */}
                  <div>
                    <label
                      htmlFor="project-input"
                      className="block text-sm font-semibold text-base-content/80 mb-1"
                    >
                      {t("Project")}
                    </label>
                    <input
                      id="project-input"
                      type="text"
                      value={formData.project}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          project: e.target.value,
                        }))
                      }
                      placeholder={t("e.g., Project A")}
                      className="w-full px-3 py-2 border border-base-content/10 bg-base-100 focus:ring-primary focus:border-primary text-sm rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-base-content/5">
                {initialRule && onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="mr-auto px-4 py-2 text-sm font-medium text-error bg-error/10 hover:bg-error/20 transition-colors rounded-lg"
                  >
                    {t("Delete Rule")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-base-content/80 bg-base-200 hover:bg-base-300 transition-colors rounded-lg"
                >
                  {t("Cancel")}
                </button>
                <button
                  type="submit"
                  disabled={keywords.length === 0 && !keywordInput.trim()}
                  title={
                    keywords.length === 0 && !keywordInput.trim()
                      ? t("Please add at least one keyword")
                      : ""
                  }
                  className="px-4 py-2 text-sm font-semibold text-primary-content bg-primary hover:bg-primary/90 transition-colors shadow-sm rounded-lg disabled:bg-base-300 disabled:text-base-content/40 disabled:cursor-not-allowed"
                >
                  {t("Save Rule")}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
