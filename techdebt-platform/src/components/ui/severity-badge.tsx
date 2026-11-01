"use client"

import { Badge } from "@/components/ui/badge"
import type { Dictionary } from "@/lib/i18n"

export const SEVERITY_VARIANTS: Record<string, "danger" | "warning" | "success" | "info" | "outline"> = {
  critical: "danger",
  high: "danger",
  medium: "warning",
  low: "success",
  info: "info",
}

export const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as const

export function severityLabel(severity: string, t: Dictionary): string {
  const map: Record<string, string> = {
    critical: t.results.severity_critical,
    high: t.results.severity_high,
    medium: t.results.severity_medium,
    low: t.results.severity_low,
    info: t.results.severity_info,
  }
  return map[severity.toLowerCase()] ?? severity.toLowerCase()
}

export function severityVariant(severity: string): "danger" | "warning" | "success" | "info" | "outline" {
  return SEVERITY_VARIANTS[severity.toLowerCase()] ?? "outline"
}

export function SeverityBadge({ severity, t }: { severity: string; t: Dictionary }) {
  return (
    <Badge variant={severityVariant(severity)} dot>
      {severityLabel(severity, t)}
    </Badge>
  )
}
