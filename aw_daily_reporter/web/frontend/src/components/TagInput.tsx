"use client"

import { Plus, X } from "lucide-react"
import { useState } from "react"

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  className?: string
}

export default function TagInput({
  tags = [],
  onChange,
  placeholder = "Add a tag...",
  className,
}: TagInputProps) {
  const [input, setInput] = useState("")

  const handleAdd = () => {
    const trimmed = input.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
      setInput("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAdd()
    }
  }

  const handleRemove = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove))
  }

  return (
    <div className={className}>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 border border-base-content/20 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="bg-base-200 hover:bg-base-300 text-base-content/80 px-3 rounded-lg transition-colors border border-base-content/10"
        >
          <Plus size={18} />
        </button>
      </div>
      <div className="flex flex-wrap gap-2 min-h-8">
        {tags.length === 0 && (
          <span className="text-sm text-base-content/40 italic py-1">
            No items defined
          </span>
        )}
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1.5 bg-primary/10 text-primary text-sm rounded-md border border-primary/20 group"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemove(tag)}
              className="text-primary/60 hover:text-primary ml-1"
            >
              <X size={14} />
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
