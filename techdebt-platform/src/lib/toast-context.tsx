"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"
import { CircleCheck, CircleAlert, Info } from "lucide-react"
import { cn } from "@/lib/utils"

export type ToastKind = "success" | "error" | "info"

export interface ToastItem {
  id: number
  kind: ToastKind
  title: string
  description?: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  dismiss: (id: number) => void
  toast: (kind: ToastKind, title: string, description?: string) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current[id]
    if (timer) {
      clearTimeout(timer)
      delete timers.current[id]
    }
  }, [])

  const toast = useCallback(
    (kind: ToastKind, title: string, description?: string) => {
      const id = nextId++
      setToasts((prev) => [...prev.slice(-4), { id, kind, title, description }])
      timers.current[id] = setTimeout(() => dismiss(id), Math.max(3000, Math.min(7000, (description?.length ?? 0) * 40 + 3500)))
    },
    [dismiss]
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      dismiss,
      toast,
      success: (t, d) => toast("success", t, d),
      error: (t, d) => toast("error", t, d),
      info: (t, d) => toast("info", t, d),
    }),
    [toasts, dismiss, toast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastViewport({ toasts, dismiss }: { toasts: ToastItem[]; dismiss: (id: number) => void }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 start-4 z-toast flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastCard key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  )
}

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon =
    item.kind === "success" ? CircleCheck : item.kind === "error" ? CircleAlert : Info
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border border-border bg-popover p-3.5 shadow-xl shadow-black/10 animate-toast-in",
        item.kind === "success" && "border-success/30",
        item.kind === "error" && "border-danger/30",
        item.kind === "info" && "border-info/30"
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-5 w-5 shrink-0",
          item.kind === "success" && "text-success",
          item.kind === "error" && "text-danger",
          item.kind === "info" && "text-info"
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{item.title}</p>
        {item.description && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{item.description}</p>}
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
      >
        <span className="block h-3.5 w-3.5 leading-none">✕</span>
      </button>
    </div>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}