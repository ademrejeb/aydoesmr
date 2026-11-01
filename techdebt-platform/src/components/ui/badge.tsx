"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type Variant = "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "info"

const variantStyles: Record<Variant, string> = {
  default: "border-transparent bg-primary/10 text-primary",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  outline: "border-border bg-transparent text-muted-foreground",
  success: "border-transparent bg-success/10 text-success",
  warning: "border-transparent bg-warning/15 text-warning",
  danger: "border-transparent bg-danger/10 text-danger",
  info: "border-transparent bg-info/10 text-info",
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: Variant
  dot?: boolean
  dotClassName?: string
}

export function Badge({ variant = "default", dot, dotClassName, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium leading-5",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          aria-hidden
          className={cn(
            "h-1.5 w-1.5 rounded-full bg-current",
            dotClassName
          )}
        />
      )}
      {children}
    </span>
  )
}