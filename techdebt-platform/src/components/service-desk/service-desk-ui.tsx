"use client"

import type { LucideIcon } from "lucide-react"
import { AlertTriangle, BookOpenText, Briefcase, IdCard, KeyRound, Laptop, Network, Receipt } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { Dictionary } from "@/lib/i18n"
import type { FormField, IncidentStatus, RequestStatus, ServicePriority } from "@/lib/api"

export type BadgeVariant = "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "info"

export const PRIORITIES: ServicePriority[] = ["P1", "P2", "P3", "P4"]

export const REQUEST_STATUS_LIST: RequestStatus[] = [
  "SUBMITTED",
  "PENDING_APPROVAL",
  "APPROVED",
  "IN_PROGRESS",
  "FULFILLED",
  "REJECTED",
  "CANCELLED",
  "CLOSED",
]

export const INCIDENT_STATUS_LIST: IncidentStatus[] = ["NEW", "IN_PROGRESS", "RESOLVED", "CLOSED"]

export const CATEGORIES = ["IT", "ACCESS", "FACILITIES", "HR", "FINANCE", "GENERAL"] as const

const REQUEST_STATUS_VARIANT: Record<RequestStatus, BadgeVariant> = {
  SUBMITTED: "info",
  PENDING_APPROVAL: "warning",
  APPROVED: "info",
  IN_PROGRESS: "default",
  FULFILLED: "success",
  REJECTED: "danger",
  CANCELLED: "outline",
  CLOSED: "outline",
}

const INCIDENT_STATUS_VARIANT: Record<IncidentStatus, BadgeVariant> = {
  NEW: "danger",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "outline",
}

const PRIORITY_VARIANT: Record<ServicePriority, BadgeVariant> = {
  P1: "danger",
  P2: "warning",
  P3: "info",
  P4: "outline",
}

/** Allowed request transitions, mirroring the API guard rules. */
export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  SUBMITTED: ["PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"],
  PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
  APPROVED: ["IN_PROGRESS", "FULFILLED", "CANCELLED"],
  REJECTED: ["CLOSED"],
  IN_PROGRESS: ["FULFILLED", "CANCELLED"],
  FULFILLED: ["CLOSED"],
  CANCELLED: [],
  CLOSED: [],
}

export const INCIDENT_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  NEW: ["IN_PROGRESS", "RESOLVED"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["IN_PROGRESS", "CLOSED"],
  CLOSED: [],
}

export function statusLabel(status: RequestStatus | IncidentStatus, t: Dictionary): string {
  const keys: Record<string, string> = {
    SUBMITTED: t.service.status,
    PENDING_APPROVAL: t.service.pending_approvals,
    APPROVED: t.service.approve,
    IN_PROGRESS: t.service.start_work,
    FULFILLED: t.service.mark_fulfilled,
    REJECTED: t.service.reject,
    CANCELLED: t.service.cancel_ticket,
    CLOSED: t.service.close_ticket,
    NEW: t.service.filter_open,
    RESOLVED: t.service.resolve,
  }
  return keys[status] ?? status
}

export function priorityLabel(priority: ServicePriority, t: Dictionary): string {
  const keys: Record<ServicePriority, string> = {
    P1: t.service.priority_p1,
    P2: t.service.priority_p2,
    P3: t.service.priority_p3,
    P4: t.service.priority_p4,
  }
  return keys[priority] ?? priority
}

export function StatusBadge({ status, t }: { status: RequestStatus | IncidentStatus; t: Dictionary }) {
  const variant = status in REQUEST_STATUS_VARIANT
    ? REQUEST_STATUS_VARIANT[status as RequestStatus]
    : INCIDENT_STATUS_VARIANT[status as IncidentStatus]
  return (
    <Badge variant={variant} dot>
      {statusLabel(status, t)}
    </Badge>
  )
}

export function PriorityBadge({ priority, t }: { priority: ServicePriority; t: Dictionary }) {
  return (
    <Badge variant={PRIORITY_VARIANT[priority]} dot={priority === "P1"}>
      {priority} · {priorityLabel(priority, t)}
    </Badge>
  )
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  IT: Laptop,
  ACCESS: KeyRound,
  FACILITIES: IdCard,
  HR: Briefcase,
  FINANCE: Receipt,
  GENERAL: BookOpenText,
}

export function CategoryIcon({ category, name, className }: { category: string; name?: string | null; className?: string }) {
  const Icon =
    CATEGORY_ICONS[category] ??
    (CATEGORY_ICONS[(name ?? "").split(/\s+/)[0]?.toUpperCase() as string] ??
    (category === "IT" ? Laptop : BookOpenText))
  return <Icon className={className ?? "h-4 w-4"} />
}

/** True when the ticket deadline has passed. */
export function isOverdue(dueAt?: string | null): boolean {
  return Boolean(dueAt && new Date(dueAt).getTime() < Date.now())
}

/** Compact SLA chip with a live countdown, or a "no target" state. */
export function SlaChip({
  dueAt,
  label,
  t,
  breached,
}: {
  dueAt?: string | null
  label: string
  t: Dictionary
  breached?: boolean
}) {
  if (!dueAt) {
    return (
      <Badge variant="outline">{label}: —</Badge>
    )
  }
  const ms = new Date(dueAt).getTime() - Date.now()
  const overdue = breached ?? ms < 0
  const abs = Math.abs(ms)
  const days = Math.floor(abs / 86_400_000)
  const hours = Math.floor((abs % 86_400_000) / 3_600_000)
  const minutes = Math.floor((abs % 3_600_000) / 60_000)
  const text = days > 0 ? `${days}${t.service.hours_unit === "h" ? "d" : "ي"}` : hours > 0 ? `${hours}h` : `${minutes}${t.service.minutes_short}`
  return (
    <Badge variant={overdue ? "danger" : "outline"}>
      {overdue && <AlertTriangle className="me-1 inline h-3 w-3" />}
      {label}: {overdue ? text : text}
    </Badge>
  )
}

/** Renders a catalog form schema as controlled inputs. */
export function DynamicFormFields({
  fields,
  values,
  onChange,
  t,
}: {
  fields: FormField[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  t: Dictionary
}) {
  if (fields.length === 0) return null
  return (
    <div className="space-y-3">
      {fields.map((field) => {
        const id = `svc-field-${field.key}`
        const value = values[field.key]
        return (
          <div key={field.key} className="space-y-1.5">
            <label htmlFor={id} className="block text-xs font-semibold text-muted-foreground">
              {field.label}
              {field.required && <span className="ms-1 text-danger">*</span>}
            </label>
            {field.type === "textarea" ? (
              <textarea
                id={id}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                rows={3}
                className="input"
              />
            ) : field.type === "select" ? (
              <select
                id={id}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="input"
              >
                <option value="">—</option>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : field.type === "checkbox" ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => onChange(field.key, e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className="text-muted-foreground">{field.label}</span>
              </label>
            ) : (
              <input
                id={id}
                type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                value={value === undefined || value === null ? "" : String(value)}
                onChange={(e) => onChange(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)}
                className="input"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function formatDate(value?: string | null): string {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return "—"
  }
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString()
  } catch {
    return "—"
  }
}