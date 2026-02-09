"use client"

import { Plus, X } from "lucide-react"
import { useTranslation } from "@/contexts/I18nContext"

interface RuleMatchConditionsProps {
  keywords: string[]
  keywordInput: string
  setKeywordInput: (value: string) => void
  addKeyword: () => void
  removeKeyword: (keyword: string) => void
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
  isCurrentInputValid: boolean
  target: string
  app: string
  onTargetChange: (value: string) => void
  onAppChange: (value: string) => void
}

export function RuleMatchConditions({
  keywords,
  keywordInput,
  setKeywordInput,
  addKeyword,
  removeKeyword,
  handleKeyDown,
  isCurrentInputValid,
  target,
  app,
  onTargetChange,
  onAppChange,
}: RuleMatchConditionsProps) {
  const { t } = useTranslation()

  return (
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
            value={target}
            onChange={(e) => onTargetChange(e.target.value)}
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
            value={app}
            onChange={(e) => onAppChange(e.target.value)}
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
  )
}
