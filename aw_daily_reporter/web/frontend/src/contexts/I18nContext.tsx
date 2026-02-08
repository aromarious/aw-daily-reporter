"use client"

import { createContext, type ReactNode, useContext, useState } from "react"
import ja from "@/locales/ja.json"

type Locale = "en" | "ja"

interface I18nContextType {
  language: Locale
  setLanguage: (lang: Locale) => void
  t: (key: string) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

const resources: Record<Locale, Record<string, string>> = {
  en: {}, // English uses keys as values (default)
  ja: ja,
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Locale>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("aw-daily-reporter-lang")
      if (saved && (saved === "en" || saved === "ja")) {
        return saved as Locale
      }
    }
    return "ja"
  })

  const changeLanguage = (lang: Locale) => {
    setLanguage(lang)
    localStorage.setItem("aw-daily-reporter-lang", lang)
  }

  const t = (key: string) => {
    if (language === "en") return key
    return resources[language][key] || key
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error("useTranslation must be used within an I18nProvider")
  }
  return context
}
