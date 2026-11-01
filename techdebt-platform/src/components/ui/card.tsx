"use client"

import * as React from "react"
import { Card as DesignSystemCard } from "@adem.rejeb/ui"
import { cn } from "@/lib/utils"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  action?: React.ReactNode
}

/**
 * App card, backed by `@adem.rejeb/ui`.
 *
 * The design-system card owns the surface, border, radius and elevation; the
 * existing title/action header is kept so call sites stay unchanged.
 */
export function Card({ title, action, className, children, ...props }: CardProps) {
  return (
    <DesignSystemCard
      bordered
      elevation={1}
      className={cn("card-hover gap-0 p-0", className)}
      {...props}
    >
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3">
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h3>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </DesignSystemCard>
  )
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />
}
