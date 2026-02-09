"use client"

import clsx from "clsx"
import { BarChart2, Bug, Settings } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { useTranslation } from "@/contexts/I18nContext"
import { ThemeToggle } from "./ThemeToggle"

export function Header() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const dateParam = searchParams.get("date")

  const getLink = (path: string) => {
    return dateParam ? `${path}?date=${dateParam}` : path
  }

  const isActive = (path: string) => pathname === path

  return (
    <header className="sticky top-0 z-50 w-full border-b border-base-200 bg-base-100/70 backdrop-blur-md transition-colors duration-300">
      <div className="px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold bg-linear-to-br from-indigo-500 to-violet-600 bg-clip-text text-transparent">
            AW Daily Reporter
          </h1>
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href={getLink("/")}
            className={clsx(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary relative py-2 px-1",
              isActive("/") ? "text-primary" : "text-base-content/60",
            )}
          >
            <BarChart2 size={18} />
            <span className="hidden sm:inline">{t("Dashboard")}</span>
            {isActive("/") && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-linear-to-r from-violet-500 to-fuchsia-500 rounded-full" />
            )}
          </Link>
          <Link
            href={getLink("/settings")}
            className={clsx(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary relative py-2 px-1",
              isActive("/settings") ? "text-primary" : "text-base-content/60",
            )}
          >
            <Settings size={18} />
            <span className="hidden sm:inline">{t("Settings")}</span>
            {isActive("/settings") && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-linear-to-r from-violet-500 to-fuchsia-500 rounded-full" />
            )}
          </Link>

          <Link
            href={getLink("/debugger")}
            className={clsx(
              "flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary relative py-2 px-1",
              isActive("/debugger") ? "text-primary" : "text-base-content/60",
            )}
          >
            <Bug size={18} />
            <span className="hidden sm:inline">{t("Debugger")}</span>
            {isActive("/debugger") && (
              <span className="absolute bottom-0 left-0 w-full h-0.5 bg-linear-to-r from-violet-500 to-fuchsia-500 rounded-full" />
            )}
          </Link>

          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
