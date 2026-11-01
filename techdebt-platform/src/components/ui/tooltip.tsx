"use client"

import * as React from "react"
import * as ReactDOM from "react-dom"
import { cn } from "@/lib/utils"

const GAP = 8
const EDGE = 6

interface TooltipProps {
  tip: string
  children: React.ReactNode
  className?: string
  /** Preferred side. Falls back to the opposite side when there is no room. */
  side?: "top" | "bottom" | "left" | "right"
}

/**
 * Tooltip rendered into a portal on <body> and positioned with a fixed,
 * measured placement. Portaling escapes outer overflow-hidden clipping and
 * stacking-context traps that made the old CSS-only tooltip invisible in
 * modals, chat headers, collapsed sidebars and scroll containers.
 */
export function Tooltip({ tip, children, className, side = "top" }: TooltipProps) {
  const triggerRef = React.useRef<HTMLSpanElement>(null)
  const bubbleRef = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)

  const update = React.useCallback(() => {
    const el = triggerRef.current
    const bubble = bubbleRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const bw = bubble?.offsetWidth ?? 0
    const bh = bubble?.offsetHeight ?? 0
    const spaceTop = rect.top
    const spaceBottom = window.innerHeight - rect.bottom
    const spaceStart = rect.left
    const spaceEnd = window.innerWidth - rect.right

    let finalSide = side
    const needVertical = bh + GAP + EDGE
    const needHorizontal = bw + GAP + EDGE
    if ((side === "top" && spaceTop < needVertical) || (side === "bottom" && spaceBottom < needVertical)) {
      finalSide = spaceBottom >= spaceTop ? "bottom" : "top"
    }
    if ((side === "left" && spaceStart < needHorizontal) || (side === "right" && spaceEnd < needHorizontal)) {
      finalSide = spaceStart >= spaceEnd ? "left" : "right"
    }

    let top: number
    let left: number
    if (finalSide === "top") {
      top = rect.top - bh - GAP
      left = rect.left + rect.width / 2 - bw / 2
    } else if (finalSide === "bottom") {
      top = rect.bottom + GAP
      left = rect.left + rect.width / 2 - bw / 2
    } else if (finalSide === "left") {
      top = rect.top + rect.height / 2 - bh / 2
      left = rect.left - bw - GAP
    } else {
      top = rect.top + rect.height / 2 - bh / 2
      left = rect.right + GAP
    }

    const vw = window.innerWidth
    const vh = window.innerHeight
    left = Math.max(EDGE, Math.min(vw - bw - EDGE, left))
    top = Math.max(EDGE, Math.min(vh - bh - EDGE, top))
    setPos({ top, left })
  }, [side])

  const show = React.useCallback(() => setOpen(true), [])
  const hide = React.useCallback(() => {
    setOpen(false)
    setPos(null)
  }, [])

  React.useLayoutEffect(() => {
    if (open) update()
  }, [open, update])

  React.useEffect(() => {
    if (!open) return
    const onViewportChange = () => update()
    window.addEventListener("scroll", onViewportChange, true)
    window.addEventListener("resize", onViewportChange)
    return () => {
      window.removeEventListener("scroll", onViewportChange, true)
      window.removeEventListener("resize", onViewportChange)
    }
  }, [open, update])

  if (!tip) return <>{children}</>

  return (
    <>
      <span
        ref={triggerRef}
        className={cn("inline-flex", className)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === "Escape") hide()
        }}
      >
        {children}
      </span>
      {open &&
        typeof document !== "undefined" &&
        ReactDOM.createPortal(
          <div
            ref={bubbleRef}
            role="tooltip"
            className="ui-tooltip"
            style={pos ? { top: pos.top, left: pos.left } : { top: -10000, left: -10000 }}
          >
            {tip}
          </div>,
          document.body
        )}
    </>
  )
}