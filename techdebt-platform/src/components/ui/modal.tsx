"use client"

import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  footer?: React.ReactNode
  children: React.ReactNode
  size?: keyof typeof sizes
  closeLabel?: string
}

export function Modal({ open, onClose, title, description, footer, children, size = "md", closeLabel = "Close" }: ModalProps) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-overlay flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-overlay-in" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          "relative z-hero max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-2xl border border-border bg-popover text-popover-foreground shadow-2xl animate-slide-up sm:rounded-2xl",
          sizes[size]
        )}
      >
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h3 className="text-base font-semibold">{title}</h3>
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
            <button
              onClick={onClose}
              aria-label={closeLabel}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}