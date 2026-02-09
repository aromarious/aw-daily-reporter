"use client"

import { Plus, X } from "lucide-react"
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

import { Combobox } from "@/components/ui/Combobox"

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

    if (finalKeywords.length === 0) {
      alert(t("Please add at least one keyword."))
      return
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
              <div>
                <h3 className="text-xs font-bold text-base-content/40 uppercase tracking-wider mb-3">
                  {t("Match Conditions")}
                </h3>
                <div className="flex flex-wrap gap-4 items-end mb-3">
                  <div className="flex-1">
                    <label
                      htmlFor="keyword-input"
                      className="block text-sm font-semibold text-base-content/80 mb-1"
                    >
                      {t("Keyword")}
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="keyword-input"
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t("Regex pattern...")}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 text-sm ${
                          !isCurrentInputValid
                            ? "border-error focus:ring-error focus:border-error"
                            : "border-base-content/10 focus:ring-primary focus:border-primary"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={addKeyword}
                        disabled={!keywordInput.trim() || !isCurrentInputValid}
                        className={`px-3 rounded-lg transition-colors ${
                          !keywordInput.trim() || !isCurrentInputValid
                            ? "bg-base-200 text-base-content/40 cursor-not-allowed"
                            : "bg-base-200 hover:bg-base-300 text-base-content/80"
                        }`}
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    {!isCurrentInputValid && (
                      <p className="text-xs text-error mt-1">
                        {t("Invalid regex pattern")}
                      </p>
                    )}
                  </div>

                  {/* Target */}
                  <div className="w-1/4 min-w-36">
                    <label
                      htmlFor="target-select"
                      className="block text-sm font-semibold text-base-content/80 mb-1"
                    >
                      {t("Target")}
                    </label>
                    <select
                      id="target-select"
                      value={formData.target}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          target: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-base-content/10 bg-base-100 focus:ring-primary focus:border-primary text-sm rounded-lg"
                    >
                      <option value="title">{t("Window Title")}</option>
                      <option value="app">{t("App Name")}</option>
                      <option value="url">{t("URL")}</option>
                      <option value="all">{t("Everywhere")}</option>
                    </select>
                  </div>

                  {/* App Filter */}
                  <div className="w-1/4 min-w-36">
                    <label
                      htmlFor="app-input"
                      className="block text-sm font-semibold text-base-content/80 mb-1"
                    >
                      {t("App Filter")}
                    </label>
                    <input
                      id="app-input"
                      type="text"
                      value={formData.app}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          app: e.target.value,
                        }))
                      }
                      placeholder={t("(Optional)")}
                      className="w-full px-3 py-2 border border-base-content/10 bg-base-100 focus:ring-primary focus:border-primary text-sm rounded-lg"
                    />
                  </div>
                </div>

                {/* Keywords List */}
                <div className="flex flex-wrap gap-2 min-h-8">
                  {keywords.length === 0 && (
                    <span className="text-sm text-base-content/40 italic py-1">
                      {t("No keywords added yet")}
                    </span>
                  )}
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary border-primary/20 rounded-md group"
                    >
                      {kw}
                      <button
                        type="button"
                        onClick={() => removeKeyword(kw)}
                        className="text-primary/60 hover:text-primary rounded hover:bg-primary/20 p-0.5"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>

                {/* 実際に使用される正規表現パターンを表示 */}
                {keywords.length > 0 && (
                  <div className="mt-3 p-3 bg-base-200 border-base-content/10 rounded-lg">
                    <p className="text-xs text-base-content/60 mb-1">
                      {t("Actual regex pattern (case-insensitive):")}
                    </p>
                    <code className="text-sm font-mono text-base-content/80 break-all">
                      /{keywords.join("|")}/i
                    </code>
                  </div>
                )}
              </div>

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
                  className="px-4 py-2 text-sm font-semibold text-primary-content bg-primary hover:bg-primary/90 transition-colors shadow-sm rounded-lg"
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
