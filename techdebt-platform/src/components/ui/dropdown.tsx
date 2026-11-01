"use client"

import * as React from "react"
import * as ReactDOM from "react-dom"
import { cn } from "@/lib/utils"

const GAP = 6
const EDGE = 8

interface DropdownProps {
  trigger: (open: boolean, toggle: () => void) => React.ReactNode
  children: React.ReactNode | ((close: () => void) => React.ReactNode)
  align?: "start" | "end"
  width?: string
  className?: string
}

/**
 * Click/keyboard dropdown whose panel is rendered into a portal on <body> and
 * pinned with measured fixed positioning. Portaling keeps panels visible when
 * the trigger sits inside overflow-hidden or scroll containers (chat thread,
 * tables, drawers) instead of being clipped like the previous absolute/flex
 * version. Positioning is direction-aware and viewport-clamped.
 */
export function Dropdown({
  trigger,
  children,
  align = "start",
  width = "w-64",
  className,
}: DropdownProps) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState<{ top: number; left: number; maxHeight?: number } | null>(null)

  const update = React.useCallback(() => {
    const el = triggerRef.current
    const menu = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const mw = menu?.offsetWidth ?? 0
    const mh = menu?.offsetHeight ?? 0
    const rtl = typeof document !== "undefined" && document.documentElement.getAttribute("dir") === "rtl"

    const spaceBottom = window.innerHeight - rect.bottom
    const spaceTop = rect.top
    const flex = spaceBottom >= mh + GAP + EDGE
    let top = flex ? rect.bottom + GAP : rect.top - mh - GAP
    let maxHeight: number | undefined
    if (!flex && mh + GAP + EDGE > spaceTop) {
      // Menus taller than the available viewport: cap height and scroll.
      top = GAP + EDGE
      maxHeight = window.innerHeight - (GAP + EDGE) * 2
    }

    let left: number
    const endAligned = align === "end"
    if (rtl ? !endAligned : endAligned) {
      left = rect.right - mw
    } else {
      left = rect.left
    }
    left = Math.max(EDGE, Math.min(window.innerWidth - mw - EDGE, left))
    setPos({ top, left, maxHeight })
  }, [align])

  const toggle = React.useCallback(() => {
    setOpen((v) => !v)
    setPos(null)
  }, [])

  const close = React.useCallback(() => {
    setOpen(false)
    setPos(null)
  }, [])

  React.useLayoutEffect(() => {
    if (open) update()
  }, [open, update])

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current &&
        menuRef.current &&
        !triggerRef.current.contains(target) &&
        !menuRef.current.contains(target)
      ) {
        close()
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close()
    }
    const onViewportChange = () => update()
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onViewportChange, true)
    window.addEventListener("resize", onViewportChange)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onViewportChange, true)
      window.removeEventListener("resize", onViewportChange)
    }
  }, [open, update, close])

  return (
    <div ref={triggerRef} className="relative">
      {trigger(open, toggle)}
      {open &&
        typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            role="menu"
            className={cn(
              "animate-slide-up z-flyout overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl shadow-black/5",
              width,
              className
            )}
            style={
              pos
                ? { position: "fixed", top: pos.top, left: pos.left, maxHeight: pos.maxHeight }
                : { position: "fixed", top: -10000, left: -10000 }
            }
          >
            {typeof children === "function" ? children(close) : children}
          </div>,
          document.body
        )}
    </div>
  )
}

export function DropdownItem({
  active,
  danger,
  icon,
  onClick,
  children,
  className,
  disabled,
}: {
  active?: boolean
  danger?: boolean
  icon?: React.ReactNode
  onClick?: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition-colors cursor-pointer disabled:opacity-50 font-medium",
        active
          ? "bg-primary/10 text-primary"
          : danger
            ? "text-danger hover:bg-danger/10"
            : "text-foreground hover:bg-accent",
        className
      )}
    >
      {icon && <span className={cn("shrink-0", danger ? "text-danger" : "text-muted-foreground", active && "text-primary")}>{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  )
}

export function DropdownHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("border-b border-border px-3.5 py-2.5", className)}>
      {children}
    </div>
  )
}

export function DropdownFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("border-t border-border p-2", className)}>{children}</div>
}