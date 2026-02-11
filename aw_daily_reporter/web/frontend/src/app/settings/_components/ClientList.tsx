"use client"

import { Plus, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "@/contexts/I18nContext"

interface Client {
  name: string
  rate: number
}

interface ClientListProps {
  clients: Record<string, Client>
  onChange: (newClients: Record<string, Client>) => void
  disabled?: boolean
}

interface Entry {
  id: string // internal unique id for list keys
  key: string // client id (e.g. 'personal')
  name: string // display name (e.g. 'Personal Project')
  rate: string // allow string for input handling
}

export default function ClientList({
  clients,
  onChange,
  disabled = false,
}: ClientListProps) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<Entry[]>([])

  useEffect(() => {
    setEntries((prev) => {
      const nextEntries = [...prev]
      const clientEntries = Object.entries(clients || {})
      const clientMap = new Map(clientEntries)

      // 1. Update existing entries and mark which ones are found
      const foundKeys = new Set<string>()
      for (let i = 0; i < nextEntries.length; i++) {
        const entry = nextEntries[i]
        if (clientMap.has(entry.key)) {
          const client = clientMap.get(entry.key)
          if (client) {
            nextEntries[i] = {
              ...entry,
              name: client.name,
              rate: client.rate.toString(),
            }
            foundKeys.add(entry.key)
          }
        }
      }

      // 2. Remove entries that no longer exist in clients (remote deletion)
      // Filter out entries whose key is NOT in clientMap
      // BUT: We must be careful about "newly added" items that haven't round-tripped yet?
      // However, in this architecture, we call onChange immediately, so they should be in props unless props are stale.
      // Ideally, we trust props.
      const filteredEntires = nextEntries.filter((e) => clientMap.has(e.key))

      // 3. Add new entries from clients that weren't in prev (remote addition)
      for (const [key, client] of clientEntries) {
        if (!foundKeys.has(key)) {
          filteredEntires.push({
            id: crypto.randomUUID(),
            key: key,
            name: client.name,
            rate: client.rate.toString(),
          })
        }
      }

      return filteredEntires
    })
  }, [clients])

  const handleUpdate = (
    id: string,
    field: "key" | "name" | "rate",
    value: string,
  ) => {
    setEntries((prev) => {
      const next = prev.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry,
      )
      notifyChange(next)
      return next
    })
  }

  const handleDelete = (id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id)
      notifyChange(next)
      return next
    })
  }

  const handleAdd = () => {
    setEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        key: crypto.randomUUID(), // Auto-generate internal ID
        name: "",
        rate: "0",
      },
    ])
  }

  const notifyChange = (currentEntries: Entry[]) => {
    const newClients: Record<string, Client> = {}
    for (const e of currentEntries) {
      if (e.key.trim()) {
        newClients[e.key.trim()] = {
          name: e.name || "Untitled Client", // Ensure name exists
          rate: parseFloat(e.rate) || 0,
        }
      }
    }
    onChange(newClients)
  }

  return (
    <div
      className="flex flex-col gap-2"
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      <div className="flex items-center text-xs font-semibold text-base-content/40 uppercase tracking-wider px-3 mb-1 gap-2">
        <span className="flex-1">{t("Client Name")}</span>
        <span className="w-4 text-center"></span>
        <span className="w-24 text-right">{t("Hourly Rate")}</span>
        <span className="w-10" />
      </div>

      {entries.length === 0 && (
        <div className="text-center py-8 text-base-content/40 bg-base-200 border-base-content/10 text-sm">
          {t("No clients defined.")}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`flex gap-2 items-center transition-all p-1 rounded-md border border-transparent hover:border-base-content/20 hover:bg-base-200 list-none ${disabled ? "cursor-not-allowed" : ""}`}
          >
            <input
              type="text"
              className="flex-1 px-3 py-2 text-sm border border-base-content/20 focus:ring-primary focus:border-primary placeholder-base-content/40 bg-base-100"
              placeholder={t("Client Name (e.g. Personal Project)")}
              value={entry.name}
              onChange={(e) => handleUpdate(entry.id, "name", e.target.value)}
              disabled={disabled}
            />
            <div className="text-base-content/20">@</div>
            <div className="relative w-24">
              <span className="absolute left-3 top-2 text-base-content/40 text-sm">
                ¥
              </span>
              <input
                type="number"
                className="w-full pl-6 pr-3 py-2 text-sm border border-base-content/20 rounded-md focus:ring-2 focus:ring-primary focus:border-primary text-right"
                placeholder="0"
                value={entry.rate}
                onChange={(e) => handleUpdate(entry.id, "rate", e.target.value)}
                disabled={disabled}
              />
            </div>
            <button
              type="button"
              onClick={() => handleDelete(entry.id)}
              disabled={disabled}
              className="p-2 text-base-content/40 hover:text-error hover:bg-error/10 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className="mt-2 w-full py-2 border-2 border-dashed border-base-content/20 rounded-lg text-base-content/60 font-medium hover:border-primary hover:text-primary hover:bg-primary/10 transition-all flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={18} /> {t("Add Client")}
      </button>
    </div>
  )
}
