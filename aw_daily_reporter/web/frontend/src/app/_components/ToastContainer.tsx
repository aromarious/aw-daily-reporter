"use client"

import clsx from "clsx"
import { X } from "lucide-react"
import { type ToastType, useToast } from "@/contexts/ToastContext"

const getToastClass = (type: ToastType) => {
  switch (type) {
    case "success":
      return "alert-success"
    case "warning":
      return "alert-warning"
    case "error":
      return "alert-error"
    case "info":
      return "alert-info"
    default:
      return "alert-info"
  }
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="toast toast-end toast-bottom z-50">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            "alert shadow-lg flex justify-between items-center transition-all duration-300 min-w-75",
            getToastClass(toast.type),
          )}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="btn btn-sm btn-ghost btn-circle"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
