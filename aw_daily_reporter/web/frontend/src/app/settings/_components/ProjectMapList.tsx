"use client"

import clsx from "clsx"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "@/contexts/I18nContext"

interface ProjectMapListProps {
  projectMap: Record<string, string>
  projectMapOrder?: string[] // プロジェクトマップのキー順序
  clientMap: Record<string, string>
  clients: Record<string, { name: string; rate: number }>
  onUpdate: (
    newMap: Record<string, string>,
    newClientMap: Record<string, string>,
    newMapOrder: string[], // 順序を追加
  ) => void
}
interface Entry {
  id: string
  key: string
  value: string
  client?: string
}

export default function ProjectMapList({
  projectMap,
  projectMapOrder,
  clientMap,
  clients,
  onUpdate,
}: ProjectMapListProps) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<Entry[]>([])
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  useEffect(() => {
    setEntries((prev) => {
      const existingMap = new Map(prev.map((e) => [e.key, e.id]))

      // 順序が指定されている場合は、その順序に従う
      if (projectMapOrder && projectMapOrder.length > 0) {
        const ordered = projectMapOrder
          .filter((k) => k in projectMap) // 存在するキーのみ
          .map((k) => {
            const id = existingMap.get(k) || crypto.randomUUID()
            const client = clientMap[k]
            return { id, key: k, value: projectMap[k], client }
          })

        // 順序リストにないキーを追加
        const remainingKeys = Object.keys(projectMap).filter(
          (k) => !projectMapOrder.includes(k),
        )
        const remaining = remainingKeys.map((k) => {
          const id = existingMap.get(k) || crypto.randomUUID()
          const client = clientMap[k]
          return { id, key: k, value: projectMap[k], client }
        })

        return [...ordered, ...remaining]
      }

      // 順序が指定されていない場合は、オブジェクトの順序をそのまま使用
      return Object.entries(projectMap || {}).map(([k, v]) => {
        const id = existingMap.get(k) || crypto.randomUUID()
        const client = clientMap[k]
        return { id, key: k, value: v, client }
      })
    })
  }, [projectMap, projectMapOrder, clientMap])

  const handleUpdate = (
    id: string,
    newKey: string,
    newValue: string,
    newClient?: string,
    notify = false,
  ) => {
    const next = entries.map((entry) =>
      entry.id === id
        ? { ...entry, key: newKey, value: newValue, client: newClient }
        : entry,
    )
    setEntries(next)
    if (notify) {
      notifyChange(next)
    }
  }

  const handleDelete = (id: string) => {
    const next = entries.filter((e) => e.id !== id)
    setEntries(next)
    notifyChange(next)
  }

  const handleBlur = () => {
    notifyChange(entries)
  }

  const handleAdd = () => {
    setEntries((prev) => [
      ...prev,
      { id: crypto.randomUUID(), key: "", value: "" },
    ])
  }

  const notifyChange = (currentEntries: Entry[]) => {
    const newMap: Record<string, string> = {}
    const newClientMap: Record<string, string> = {}
    const newMapOrder: string[] = []

    for (const e of currentEntries) {
      if (e.key.trim()) {
        const key = e.key.trim()
        newMap[key] = e.value // Store empty string if value is empty
        newMapOrder.push(key) // 順序を保存
        if (e.client) {
          newClientMap[key] = e.client
        }
      }
    }
    // Batch updates
    onUpdate(newMap, newClientMap, newMapOrder)
  }

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

  const clientOptions = Object.entries(clients).map(([id, c]) => ({
    id,
    name: c.name,
  }))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center p-1 mb-1 gap-2">
        <div className="w-6 shrink-0" />
        <div className="flex-1 min-w-0 px-3 py-2 border border-transparent text-xs font-semibold text-base-content/40 uppercase tracking-wider">
          {t("Regex Pattern")}
        </div>
        <div className="w-5 shrink-0" />
        <div className="flex-1 min-w-0 px-3 py-2 border border-transparent text-xs font-semibold text-base-content/40 uppercase tracking-wider">
          {t("Target Project")}
        </div>
        <div className="w-5 shrink-0" />
        <div className="w-48 px-3 py-2 border border-transparent text-xs font-semibold text-base-content/40 uppercase tracking-wider">
          {t("Client")}
        </div>
        <div className="w-8 shrink-0" />
      </div>

      {entries.length === 0 && (
        <div className="text-center py-8 text-base-content/40 bg-base-200 border-base-content/10 text-sm">
          {t("No project mappings defined.")}
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
                "flex gap-2 items-center transition-all p-1 rounded-md border border-transparent hover:border-base-content/20 hover:bg-base-200 list-none",
                isDragged &&
                  "opacity-50 border-dashed border-primary/50 bg-primary/10",
              )}
            >
              <div
                className="w-6 flex items-center justify-center shrink-0 cursor-move text-base-content/40 hover:text-base-content/80"
                title="Drag to reorder"
              >
                <GripVertical size={16} />
              </div>
              <input
                type="text"
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-base-content/20 focus:ring-primary focus:border-primary placeholder-base-content/40 bg-base-100 font-mono"
                placeholder={t("Regex (e.g. ^aw-.*)")}
                value={entry.key}
                onChange={(e) =>
                  handleUpdate(
                    entry.id,
                    e.target.value,
                    entry.value,
                    entry.client,
                    false,
                  )
                }
                onBlur={handleBlur}
              />
              <div className="w-5 text-center shrink-0 text-base-content/20">
                →
              </div>
              <input
                type="text"
                className="flex-1 min-w-0 px-3 py-2 text-sm border border-base-content/20 focus:ring-primary focus:border-primary placeholder-base-content/40 bg-base-100"
                placeholder={t("(Keep original)")}
                value={entry.value}
                onChange={(e) =>
                  handleUpdate(
                    entry.id,
                    entry.key,
                    e.target.value,
                    entry.client,
                    false,
                  )
                }
                onBlur={handleBlur}
              />
              <div className="w-5 text-center shrink-0 text-base-content/20">
                @
              </div>
              <select
                className="w-48 px-3 py-2 text-sm border border-base-content/20 focus:ring-primary focus:border-primary bg-base-100"
                value={entry.client || ""}
                onChange={(e) =>
                  handleUpdate(
                    entry.id,
                    entry.key,
                    entry.value,
                    e.target.value,
                    true,
                  )
                }
              >
                <option value="">{t("(No Client)")}</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleDelete(entry.id)}
                className="w-8 flex items-center justify-center shrink-0 h-8 text-base-content/40 hover:text-error hover:bg-error/10 rounded transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={handleAdd}
        className="mt-2 w-full py-2 border-2 border-dashed border-base-content/20 rounded-lg text-base-content/60 text-sm font-medium hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2"
      >
        <Plus size={16} /> {t("Add Mapping")}
      </button>
    </div>
  )
}
