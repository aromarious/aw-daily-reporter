"use client"

import { Check, ChevronDown, Plus } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "@/contexts/I18nContext"

export interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  className?: string
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  className,
}: ComboboxProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [inputFocus, setInputFocus] = useState(false)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(value.toLowerCase()),
  )

  const showCreateOption =
    value.trim() !== "" &&
    !options.some((opt) => opt.toLowerCase() === value.toLowerCase())

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            setInputFocus(true)
            setIsOpen(true)
          }}
          onBlur={() => setInputFocus(false)}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border bg-base-100 text-sm rounded-lg pr-10 outline-none transition-all ${
            inputFocus || isOpen
              ? "border-primary ring-2 ring-primary/20"
              : "border-base-content/10"
          }`}
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content/80 p-1"
          tabIndex={-1}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 bg-base-100 border border-base-content/10 rounded-lg shadow-lg max-h-60 overflow-y-auto py-1">
          {filteredOptions.map((option) => (
            <li
              key={option}
              onMouseDown={(e) => {
                e.preventDefault() // Prevent blur
                onChange(option)
                setIsOpen(false)
              }}
              className={`px-3 py-2 text-sm cursor-pointer hover:bg-base-200 flex items-center justify-between ${
                value === option ? "bg-primary/5 text-primary font-medium" : ""
              }`}
            >
              <span>{option}</span>
              {value === option && <Check size={14} />}
            </li>
          ))}
          {showCreateOption && (
            <li
              onMouseDown={(e) => {
                e.preventDefault()
                onChange(value) // confirm value
                setIsOpen(false)
              }}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-base-200 text-primary flex items-center gap-2 border-t border-base-content/5 mt-1"
            >
              <Plus size={14} />
              <span>
                {t("Create")} "{value}"
              </span>
            </li>
          )}
          {filteredOptions.length === 0 && !showCreateOption && (
            <li className="px-3 py-2 text-sm text-base-content/40 italic">
              {t("No options found")}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
