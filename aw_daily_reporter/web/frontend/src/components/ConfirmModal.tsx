"use client"

import { useEffect, useRef } from "react"
import { useTranslation } from "@/contexts/I18nContext"

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel?: string
  cancelLabel?: string
  type?: "danger" | "info"
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  cancelLabel,
  type = "danger",
}: ConfirmModalProps) {
  const { t } = useTranslation()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (isOpen && dialog) {
      dialog.showModal()
    } else if (dialog) {
      dialog.close()
    }
  }, [isOpen])

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onClose={onCancel}
      onClick={(e) => {
        // Close when clicking backdrop
        if (e.target === dialogRef.current) {
          onCancel()
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel()
      }}
    >
      <div className="modal-box">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="py-4">{message}</p>
        <div className="modal-action">
          <button type="button" className="btn" onClick={onCancel}>
            {cancelLabel || t("Cancel")}
          </button>
          <button
            type="button"
            className={`btn ${type === "danger" ? "btn-error" : "btn-primary"}`}
            onClick={() => {
              onConfirm()
              // onCancel() calls close(), but parent handles filtering state,
              // so we normally assume parent sets isOpen=false.
              // However, closing visually is handled by isOpen prop effect.
            }}
          >
            {confirmLabel || (type === "danger" ? t("Delete") : t("Confirm"))}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onCancel}>
          close
        </button>
      </form>
    </dialog>
  )
}
