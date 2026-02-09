import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

interface SettingsConfig {
  system?: {
    day_start_source?: string
    start_of_day?: string
    aw_start_of_day?: string
  }
}

const getAdjustedDate = (config: SettingsConfig | undefined) => {
  const d = new Date()
  if (!config) return d

  const system = config.system || {}
  const source = system.day_start_source || "manual"
  let offset = system.start_of_day || "00:00"

  if (source === "aw" && system.aw_start_of_day) {
    offset = system.aw_start_of_day
  }

  // offset format is "HH:MM"
  // If current time < offset, it's considered the previous day
  const [offsetHour, offsetMinute] = offset.split(":").map(Number)
  const currentHour = d.getHours()
  const currentMinute = d.getMinutes()

  if (
    currentHour < offsetHour ||
    (currentHour === offsetHour && currentMinute < offsetMinute)
  ) {
    d.setDate(d.getDate() - 1)
  }
  return d
}

export function useDateNavigation(settings: SettingsConfig | undefined) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const dateInputRef = useRef<HTMLInputElement>(null)

  const [date, setDate] = useState(() => {
    const dateParam = searchParams.get("date")
    if (dateParam) return dateParam

    // Initial load might not have settings yet, defaulting to calendar day
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  })

  // Update date on initial load when settings become available
  useEffect(() => {
    if (settings && !searchParams.get("date")) {
      const adjusted = getAdjustedDate(settings)
      const year = adjusted.getFullYear()
      const month = String(adjusted.getMonth() + 1).padStart(2, "0")
      const day = String(adjusted.getDate()).padStart(2, "0")
      const formatted = `${year}-${month}-${day}`

      setDate((prev) => (prev !== formatted ? formatted : prev))
    }
  }, [settings, searchParams])

  const updateDate = (newDate: string) => {
    setDate(newDate)
    const params = new URLSearchParams(searchParams.toString())
    params.set("date", newDate)
    router.replace(`${pathname}?${params.toString()}`)
  }

  const handlePrevDay = () => {
    const d = new Date(date)
    d.setDate(d.getDate() - 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    updateDate(`${year}-${month}-${day}`)
  }

  const handleNextDay = () => {
    const d = new Date(date)
    d.setDate(d.getDate() + 1)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    updateDate(`${year}-${month}-${day}`)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateDate(e.target.value)
  }

  const handleToday = () => {
    const d = getAdjustedDate(settings)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    updateDate(`${year}-${month}-${day}`)
  }

  const isToday = () => {
    const d = getAdjustedDate(settings)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return date === `${year}-${month}-${day}`
  }

  return {
    date,
    dateInputRef,
    handlePrevDay,
    handleNextDay,
    handleDateChange,
    handleToday,
    isToday: isToday(),
  }
}
