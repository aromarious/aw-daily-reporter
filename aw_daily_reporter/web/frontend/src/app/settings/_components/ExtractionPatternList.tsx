"use client"

import clsx from "clsx"
import { AlertCircle, GripVertical, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "@/contexts/I18nContext"

interface ExtractionPatternListProps {
  patterns: Record<string, string[]>
  onUpdate: (newPatterns: Record<string, string[]>) => void
}

interface Entry {
  id: string
  app: string // 空文字列 = 全アプリ、それ以外は正規表現
  pattern: string // プロジェクト名抽出パターン（表示用・短縮記法）
  error?: string // パターンのバリデーションエラー
}

// 短縮記法 {project} を (?P<project>.+?) に展開
const expandShorthand = (pattern: string): string => {
  return pattern.replace(/\{project\}/g, "(?P<project>.+?)")
}

// (?P<project>.+?) を {project} に短縮（表示用）
const collapseToShorthand = (pattern: string): string => {
  return pattern.replace(/\(\?P<project>\.\+\?\)/g, "{project}")
}

const validatePattern = (pattern: string): string | undefined => {
  // Type guard: ensure pattern is a string
  if (typeof pattern !== "string") return undefined
  if (!pattern) return undefined

  // 短縮記法を展開してからバリデーション
  const expanded = expandShorthand(pattern)

  // Check for required Python named group syntax first
  if (!expanded.includes("?P<project>")) {
    return "Must include named group (?P<project>...) or {project}"
  }

  // Validate regex syntax (ignoring Python-specific ?P)
  // Python's (?P<name>...) corresponds to JS's (?<name>...)
  const jsPattern = expanded.replace(/\(\?P</g, "(?<")
  try {
    new RegExp(jsPattern)
  } catch (_e) {
    return "Invalid Regular Expression"
  }
  return undefined
}

export default function ExtractionPatternList({
  patterns,
  onUpdate,
}: ExtractionPatternListProps) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<Entry[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  useEffect(() => {
    setEntries((prev) => {
      const existingMap = new Map(
        prev.map((e) => [`${e.app}|${e.pattern}`, e.id]),
      )

      // Record<string, string[]> を Entry[] に変換
      const newEntries: Entry[] = []
      for (const [app, patternList] of Object.entries(patterns)) {
        for (const pattern of patternList) {
          const appKey = app === "*" ? "" : app // "*" → 空文字列
          // 表示用に短縮記法に変換
          const displayPattern = collapseToShorthand(pattern)
          const cacheKey = `${appKey}|${displayPattern}`
          const id = existingMap.get(cacheKey) || crypto.randomUUID()

          newEntries.push({
            id,
            app: appKey,
            pattern: displayPattern,
            error: validatePattern(displayPattern),
          })
        }
      }
      return newEntries
    })
  }, [patterns])

  const handleUpdateApp = (id: string, newApp: string) => {
    const next = entries.map((entry) =>
      entry.id === id ? { ...entry, app: newApp } : entry,
    )
    setEntries(next)
  }

  const handleUpdatePattern = (id: string, newPattern: string) => {
    const next = entries.map((entry) =>
      entry.id === id
        ? { ...entry, pattern: newPattern, error: validatePattern(newPattern) }
        : entry,
    )
    setEntries(next)
  }

  const handleBlur = () => {
    notifyChange(entries)
  }

  const handleDelete = (id: string) => {
    const next = entries.filter((e) => e.id !== id)
    setEntries(next)
    notifyChange(next)
  }

  const handleAdd = () => {
    // デフォルトのパターンを設定（短縮記法）
    const defaultPattern = "^{project}\\|"
    setEntries((prev) => [
      ...prev,
      { id: crypto.randomUUID(), app: "", pattern: defaultPattern },
    ])
  }

  const notifyChange = (currentEntries: Entry[]) => {
    // Entry[] を Record<string, string[]> に変換
    const newPatterns: Record<string, string[]> = {}

    for (const entry of currentEntries) {
      const pattern = entry.pattern.trim()
      if (!pattern) continue // 空のパターンはスキップ

      const appKey = entry.app.trim() || "*" // 空文字列 → "*"

      // 保存時に短縮記法を展開
      const expandedPattern = expandShorthand(pattern)

      if (!newPatterns[appKey]) {
        newPatterns[appKey] = []
      }
      newPatterns[appKey].push(expandedPattern)
    }

    onUpdate(newPatterns)
  }

  // DnD
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === dropIndex) return

    const newEntries = [...entries]
    const [moved] = newEntries.splice(draggedIndex, 1)
    newEntries.splice(dropIndex, 0, moved)

    setEntries(newEntries)
    setDraggedIndex(null)
    notifyChange(newEntries)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* ヘッダー */}
      <div className="flex items-center p-1 mb-1 gap-2">
        <div className="w-6 shrink-0" />
        <div className="w-48 px-3 py-2 text-xs font-semibold text-base-content/40 uppercase tracking-wider">
          {t("App Name")}
        </div>
        <div className="flex-1 px-3 py-2 text-xs font-semibold text-base-content/40 uppercase tracking-wider">
          {t("Regex Pattern")}
        </div>
        <div className="w-8 shrink-0" />
      </div>

      {entries.length === 0 && (
        <div className="text-center py-8 text-base-content/40 bg-base-200 border-base-content/10 text-sm">
          {t("No extraction patterns defined.")}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {entries.map((entry, index) => {
          const isDragged = draggedIndex === index

          return (
            <li
              key={entry.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={clsx(
                "flex gap-2 items-start transition-all p-1 rounded-md border border-transparent hover:border-base-content/20 hover:bg-base-200 list-none",
                isDragged &&
                  "opacity-50 border-dashed border-primary/50 bg-primary/10",
              )}
            >
              {/* ドラッグハンドル */}
              <div
                className="w-6 flex justify-center shrink-0 cursor-move text-base-content/40 hover:text-base-content/80 mt-2"
                title="Drag to reorder"
              >
                <GripVertical size={16} />
              </div>

              {/* アプリ名入力 */}
              <div className="w-48 flex flex-col gap-1">
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-base-content/20 rounded-md focus:ring-2 focus:ring-primary focus:border-primary placeholder-base-content/40 bg-base-100"
                  placeholder={t("All Apps")}
                  value={entry.app}
                  onChange={(e) => handleUpdateApp(entry.id, e.target.value)}
                  onBlur={handleBlur}
                />
                <div className="text-[10px] text-base-content/40 px-1">
                  {t("(e.g. vscode, chrome)")}
                </div>
              </div>

              {/* パターン入力 */}
              <div className="flex-1 flex flex-col gap-1">
                <input
                  type="text"
                  className={clsx(
                    "w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-primary focus:border-primary placeholder-base-content/40 bg-base-100 font-mono",
                    entry.error
                      ? "border-error bg-error/10 focus:border-error focus:ring-error"
                      : "border-base-content/20",
                  )}
                  placeholder={t("Regex (e.g. ^{project}\\|)")}
                  value={entry.pattern}
                  onChange={(e) =>
                    handleUpdatePattern(entry.id, e.target.value)
                  }
                  onBlur={handleBlur}
                />
                {entry.error && (
                  <div className="flex items-center gap-1 text-xs text-error px-1">
                    <AlertCircle size={12} />
                    <span>{entry.error}</span>
                  </div>
                )}
              </div>

              {/* 削除ボタン */}
              <button
                type="button"
                onClick={() => handleDelete(entry.id)}
                className="w-8 flex justify-center shrink-0 h-8 mt-1 text-base-content/40 hover:text-error hover:bg-error/10 rounded transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </li>
          )
        })}
      </ul>

      {/* 追加ボタン */}
      <button
        type="button"
        onClick={handleAdd}
        className="mt-2 w-full py-2 border-2 border-dashed border-base-content/20 text-base-content/60 font-medium hover:border-primary hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-center gap-2"
      >
        <Plus size={16} /> {t("Add Pattern")}
      </button>
    </div>
  )
}
