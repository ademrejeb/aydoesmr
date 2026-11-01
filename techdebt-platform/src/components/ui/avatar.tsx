"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

const GRADIENTS = [
  "from-blue-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-indigo-500 to-blue-600",
  "from-fuchsia-500 to-purple-600",
  "from-cyan-500 to-blue-600",
  "from-lime-500 to-emerald-600",
]

function hashName(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h)
}

function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar({
  name,
  src,
  size = "md",
  className,
  title,
}: {
  name: string
  src?: string | null
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
  title?: string
}) {
  const sizeClass = {
    xs: "h-6 w-6 text-[9px]",
    sm: "h-7 w-7 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  }[size]
  const gradient = GRADIENTS[hashName(name || "?") % GRADIENTS.length]

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        title={title ?? name}
        className={cn("rounded-full object-cover ring-1 ring-border", sizeClass, className)}
      />
    )
  }
  return (
    <span
      aria-hidden
      title={title ?? name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br font-bold text-white ring-1 ring-border/60",
        gradient,
        sizeClass,
        className
      )}
    >
      {toInitials(name)}
    </span>
  )
}