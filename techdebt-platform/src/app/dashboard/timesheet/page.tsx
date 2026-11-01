"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Download,
  LayoutGrid,
  List,
  Loader2,
  Pencil,
  Save,
  Sigma,
  Upload,
  XCircle,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, downloadBlob, type AgileTask, type Project, type TimesheetEntry, type TimesheetStatus } from "@/lib/api"
import { useI18n, type Dictionary } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Modal } from "@/components/ui/modal"
import { Skeleton } from "@/components/ui/skeleton"

function dateKeyOf(value: string): string {
  return value.slice(0, 10)
}

function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split("-").map(Number)
  return { y, m: m - 1, d }
}

function formatDay(key: string, locale: string): string {
  const { y, m, d } = parseKey(key)
  return new Date(y, m, d).toLocaleDateString(locale, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function statusLabel(status: TimesheetStatus, t: Dictionary): string {
  switch (status) {
    case "APPROVED":
      return t.timesheet.approved
    case "SUBMITTED":
      return t.timesheet.submitted
    case "REJECTED":
      return t.timesheet.rejected
    default:
      return t.timesheet.draft
  }
}

function statusDotClass(status: TimesheetStatus): string {
  switch (status) {
    case "APPROVED":
      return "bg-success"
    case "SUBMITTED":
      return "bg-warning"
    case "REJECTED":
      return "bg-danger"
    default:
      return "bg-muted-foreground/60"
  }
}

const ACTIVITY_MAX = 240

interface EditorForm {
  hours: string
  activity: string
  projectId: string
  taskId: string
}

export default function TimesheetPage() {
  const { token, currentOrg, user } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()

const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [view, setView] = useState<"month" | "list">("month")

  const [entries, setEntries] = useState<TimesheetEntry[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<AgileTask[]>([])
  const [offDayKeys, setOffDayKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editor, setEditor] = useState<EditorForm>({ hours: "", activity: "", projectId: "", taskId: "" })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const orgId = currentOrg?.id
  const authToken = token ?? ""
  const userId = user?.id

  const todayKey = toDateKey(new Date())

  const load = useCallback(async () => {
    if (!authToken || !orgId) {
      setLoading(false)
      return
    }
    const from = toDateKey(new Date(viewYear, viewMonth, 1))
    const to = toDateKey(new Date(viewYear, viewMonth + 1, 0))
    setLoading(true)
    try {
      const [list, projectList, offList] = await Promise.all([
        api.listTimesheetEntries(authToken, orgId, { from, to }).catch(() => [] as TimesheetEntry[]),
        api.listProjects(authToken, orgId).catch(() => [] as Project[]),
        api.listOffDays(authToken, orgId, viewYear).catch(() => []),
      ])
      setEntries(list)
      setProjects(projectList)
      setOffDayKeys(new Set(offList.map((o) => dateKeyOf(o.date))))
    } finally {
      setLoading(false)
    }
  }, [authToken, orgId, viewYear, viewMonth])

  useEffect(() => {
    void load()
  }, [load])

  const entriesByDate = useMemo(() => {
    const map = new Map<string, TimesheetEntry>()
    for (const e of entries) map.set(dateKeyOf(e.workDate), e)
    return map
  }, [entries])

  const monthTotal = useMemo(
    () => entries.reduce((sum, e) => sum + e.hours, 0),
    [entries]
  )

  const listRows = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const rows: { key: string; entry?: TimesheetEntry; isOff: boolean }[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const key = toDateKey(new Date(viewYear, viewMonth, d))
      const entry = entriesByDate.get(key)
      rows.push({ key, entry, isOff: offDayKeys.has(key) })
    }
    return rows.filter((r) => r.entry || r.isOff)
  }, [viewYear, viewMonth, entriesByDate, offDayKeys])

  const monthOffCount = useMemo(
    () => [...offDayKeys].filter((k) => k.startsWith(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`)).length,
    [offDayKeys, viewYear, viewMonth]
  )

  const cells = useMemo(() => {
    const leading = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const list: (string | null)[] = Array.from({ length: leading }, () => null)
    for (let d = 1; d <= daysInMonth; d++) list.push(toDateKey(new Date(viewYear, viewMonth, d)))
    while (list.length % 7 !== 0) list.push(null)
    return list
  }, [viewYear, viewMonth])

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth, locale]
  )

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()

  const shiftMonth = (delta: number) => {
    const date = new Date(viewYear, viewMonth + delta, 1)
    setViewYear(date.getFullYear())
    setViewMonth(date.getMonth())
  }

  const openEditor = (key: string) => {
    const entry = entriesByDate.get(key)
    setSelectedDate(key)
    setEditor({
      hours: entry ? String(entry.hours) : "",
      activity: entry?.activity ?? "",
      projectId: entry?.projectId ?? "",
      taskId: entry?.taskId ?? "",
    })
    if (entry?.projectId && authToken && orgId) {
      void api
        .listTasks(authToken, orgId, entry.projectId)
        .catch(() => [] as AgileTask[])
        .then((list) => setTasks(list))
    } else {
      setTasks([])
    }
  }

  const onProjectChange = (projectId: string) => {
    setEditor((prev) => ({ ...prev, projectId, taskId: "" }))
    setTasks([])
    if (projectId && authToken && orgId) {
      void api
        .listTasks(authToken, orgId, projectId)
        .catch(() => [] as AgileTask[])
        .then((list) => setTasks(list))
    }
  }

  const hoursNum = parseFloat(editor.hours)
  const invalid = hoursNum > 0 && (hoursNum < 0.5 || hoursNum > 24)

  const saveEntry = async () => {
    if (!authToken || !orgId || !userId || !selectedDate) return
    if (invalid) {
      toast.error(t.timesheet.invalid_hours)
      return
    }
    const activity = editor.activity.trim()
    const hasEntry = entriesByDate.has(selectedDate)
    if (hoursNum <= 0 && !activity && !hasEntry) {
      setSelectedDate(null)
      return
    }
    setSaving(true)
    try {
      await api.upsertTimesheetEntry(
        {
          organizationId: orgId,
          userId,
          workDate: selectedDate,
          hours: Number.isFinite(hoursNum) ? hoursNum : 0,
          activity: activity || null,
          projectId: editor.projectId || null,
          taskId: editor.taskId || null,
        },
        authToken,
        orgId
      )
      toast.success(t.timesheet.saved)
      setSelectedDate(null)
      void load()
    } catch (err) {
      toast.error(t.errors.network_error, err instanceof Error ? err.message : undefined)
    } finally {
      setSaving(false)
    }
  }

  const history = useMemo(
    () => [...entries].sort((a, b) => (a.workDate < b.workDate ? 1 : -1)).slice(0, 10),
    [entries]
  )

  const exportCsv = async () => {
    if (!authToken || !orgId) return
    try {
      const from = toDateKey(new Date(viewYear, viewMonth, 1))
      const csv = await api.exportTimesheetsCsv(authToken, orgId, { from, to: toDateKey(new Date(viewYear, viewMonth + 1, 0)) })
      if (!csv) {
        toast.error(t.errors.network_error)
        return
      }
      downloadBlob(csv, `timesheets-${from}.csv`, "text/csv;charset=utf-8")
    } catch (err) {
      toast.error(t.errors.network_error, err instanceof Error ? err.message : undefined)
    }
  }

  const importCsv = async (file: File) => {
    if (!authToken || !orgId) return
    const text = await file.text().catch(() => "")
    if (!text) {
      toast.error(t.timesheet.import_failed)
      return
    }
    setImporting(true)
    try {
      const result = await api.importTimesheetsCsv(text, authToken, orgId)
      let message = t.timesheet.import_done
        .replace("{imported}", String(result.imported))
        .replace("{total}", String(result.totalRows))
      if (result.skipped > 0) message += ` · ${t.payroll.import_errors.replace("{skipped}", String(result.skipped))}`
      if (result.imported > 0) {
        toast.success(message)
        void load()
      } else {
        toast.error(message)
      }
    } catch (err) {
      toast.error(t.timesheet.import_failed, err instanceof Error ? err.message : undefined)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="hero-gradient relative overflow-hidden rounded-2xl p-6 text-white md:p-8">
        <div className="pointer-events-none absolute -end-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-hero">
          <p className="text-xs font-medium uppercase tracking-wider text-white/70">{t.platform.timesheet}</p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight md:text-3xl">{t.timesheet.title}</h2>
          <p className="mt-2 max-w-xl text-sm text-white/85 md:text-base">{t.timesheet.subtitle}</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => void exportCsv()} disabled={loading || importing}>
          <Download className="h-3.5 w-3.5 me-1.5" />
          {t.timesheet.export_csv}
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" /> : <Upload className="h-3.5 w-3.5 me-1.5" />}
          {t.timesheet.import_csv}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) void importCsv(file)
          }}
        />
      </div>

      <Card
        title={monthLabel}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border bg-muted/60 p-0.5" role="tablist" aria-label={t.timesheet.title}>
              <button
                type="button"
                role="tab"
                aria-selected={view === "month"}
                onClick={() => setView("month")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  view === "month" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {t.timesheet.view_month}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={view === "list"}
                onClick={() => setView("list")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                  view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="h-3.5 w-3.5" />
                {t.timesheet.view_list}
              </button>
            </div>
            <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)} aria-label={t.timesheet.previous}>
              <ChevronRight className="h-4 w-4 rtl:rotate-180" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setViewYear(now.getFullYear())
                setViewMonth(now.getMonth())
              }}
              disabled={isCurrentMonth}
              aria-label={t.timesheet.today}
            >
              {t.timesheet.today}
            </Button>
            <Button variant="outline" size="sm" onClick={() => shiftMonth(1)} aria-label={t.timesheet.next}>
              <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            </Button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Sigma className="h-4 w-4 text-muted-foreground" />
            {t.timesheet.total_hours}
            <span className="text-lg font-extrabold text-primary">{monthTotal.toFixed(1)}</span>
            <span className="text-muted-foreground">{t.timesheet.hours}</span>
          </span>
          <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/60" />
              {t.timesheet.draft}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-warning" />
              {t.timesheet.submitted}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              {t.timesheet.approved}
            </span>
          </span>
        </div>

        {loading ? (
          view === "month" ? (
            <div>
              <div className="grid grid-cols-7 gap-1.5" dir="ltr">
                {t.timesheet.day_labels.map((label) => (
                  <div key={label} className="hidden px-2 pb-2 text-center text-xs font-semibold text-muted-foreground sm:block">
                    {label}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-full rounded-xl" />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          )
        ) : view === "list" ? (
          <div className="space-y-2">
            {listRows.length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {t.timesheet.empty}
              </div>
            ) : (
              listRows.map((row) => {
                const parsed = parseKey(row.key)
                const weekdayLabel = new Date(parsed.y, parsed.m, parsed.d).toLocaleDateString(locale, { weekday: "short" })
                return (
                  <div
                    key={row.key}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 shadow-sm",
                      row.entry ? "border-border bg-card" : "border-dashed border-border/70 bg-muted/30"
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-border bg-muted/40">
                        <span className="text-[10px] font-semibold uppercase leading-none text-muted-foreground">{weekdayLabel}</span>
                        <span className={cn("text-base font-bold leading-tight", row.entry ? "text-foreground" : "text-muted-foreground/70")}>
                          {parsed.d}
                        </span>
                      </div>
                      <div className="min-w-0">
                        {row.entry ? (
                          <>
                            <p className="text-sm font-semibold text-foreground">
                              {formatDay(row.key, locale)}
                              <Badge
                                variant={
                                  row.entry.status === "APPROVED"
                                    ? "success"
                                    : row.entry.status === "SUBMITTED"
                                      ? "warning"
                                      : row.entry.status === "REJECTED"
                                        ? "danger"
                                        : "secondary"
                                }
                                className="ms-2"
                                dot
                              >
                                {statusLabel(row.entry.status, t)}
                              </Badge>
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              <span className="font-semibold text-primary">
                                {row.entry.hours.toFixed(1)} {t.timesheet.hours}
                              </span>
                              {row.entry.project?.name && <span>· {row.entry.project.name}</span>}
                              {row.entry.task?.title && <span>· {row.entry.task.title}</span>}
                            </p>
                            {row.entry.activity && <p className="mt-1 text-sm text-foreground/90">{row.entry.activity}</p>}
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-semibold text-muted-foreground">{formatDay(row.key, locale)}</p>
                            <Badge variant="danger" className="mt-1 uppercase" dot>
                              {t.timesheet.off_day}
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    {row.entry && (
                      <Button size="sm" variant="ghost" onClick={() => openEditor(row.key)} aria-label={t.timesheet.add_entry}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto pb-1">
              <div className="grid min-w-[520px] grid-cols-7 gap-1.5" dir="ltr">
                {t.timesheet.day_labels.map((label) => (
                  <div
                    key={label}
                    className="px-2 pb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {label.slice(0, 3)}
                  </div>
                ))}
              </div>
              <div className="grid min-w-[520px] grid-cols-7 gap-1.5">
              {cells.map((key, i) => {
                if (!key) return <div key={`blank-${i}`} className="rounded-xl border border-transparent" />
                const { d } = parseKey(key)
                const entry = entriesByDate.get(key)
                const isToday = key === todayKey
                const isOff = offDayKeys.has(key)
                if (!entry && isOff) {
                  return (
                    <div
                      key={key}
                      className="flex min-h-20 cursor-default flex-col items-stretch gap-1 rounded-xl border border-dashed border-border/70 bg-muted/30 p-1.5 text-start sm:min-h-24"
                      aria-label={`${d} ${formatDay(key, locale)} ${t.timesheet.off_day}`}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          isToday ? "bg-muted-foreground/30 text-muted-foreground" : "text-muted-foreground/70"
                        )}
                      >
                        {d}
                      </span>
                      <span className="mt-auto flex h-6 w-full items-center justify-center gap-1 rounded-md bg-danger/10 px-1.5 text-[10px] font-bold uppercase tracking-wide text-danger">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-danger/70" />
                        {t.timesheet.off_day}
                      </span>
                    </div>
                  )
                }
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => openEditor(key)}
                    className={cn(
                      "flex min-h-20 cursor-pointer flex-col items-stretch gap-1 rounded-xl border bg-card p-1.5 text-start shadow-sm transition-colors sm:min-h-24",
                      "hover:border-primary/40 hover:bg-primary/5",
                      entry ? "border-primary/20 bg-primary/5" : "border-border",
                      isToday && "ring-1 ring-primary/40 border-primary/50"
                    )}
                    aria-label={`${d} ${formatDay(key, locale)}`}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                        isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                      )}
                    >
                      {d}
                    </span>
                    {entry && (
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center justify-between gap-1">
                          <span className="flex items-center gap-1 text-sm font-bold text-foreground">
                            <Sigma className="h-3 w-3 text-muted-foreground" />
                            {entry.hours.toFixed(1)}
                            <span className="text-[10px] font-medium text-muted-foreground">{t.timesheet.hour_short}</span>
                          </span>
                          <span className={cn("h-2 w-2 shrink-0 rounded-full", statusDotClass(entry.status))} />
                        </span>
                        {entry.activity && (
                          <span className="truncate text-[10px] leading-tight text-muted-foreground">{entry.activity}</span>
                        )}
                      </span>
                    )}
                  </button>
                )
              })}
              </div>
            </div>

            {monthTotal === 0 && monthOffCount === 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4 shrink-0" />
                {t.timesheet.empty}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title={t.timesheet.history}>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {t.timesheet.empty_history}
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {entry.status === "APPROVED" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : entry.status === "REJECTED" ? (
                    <XCircle className="h-4 w-4 shrink-0 text-danger" />
                  ) : entry.status === "SUBMITTED" ? (
                    <Clock className="h-4 w-4 shrink-0 text-warning" />
                  ) : (
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {formatDay(dateKeyOf(entry.workDate), locale)} · {entry.hours.toFixed(1)} {t.timesheet.hours}
                    </p>
                    {entry.activity && <p className="truncate text-xs text-muted-foreground">{entry.activity}</p>}
                  </div>
                </div>
                <Badge
                  variant={entry.status === "APPROVED" ? "success" : entry.status === "SUBMITTED" ? "warning" : entry.status === "REJECTED" ? "danger" : "secondary"}
                  className={cn(entry.status === "DRAFT" && "text-muted-foreground")}
                  dot
                >
                  {statusLabel(entry.status, t)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={selectedDate !== null}
        onClose={() => !saving && setSelectedDate(null)}
        title={selectedDate ? formatDay(selectedDate, locale) : ""}
        description={selectedDate ? t.timesheet.add_entry : undefined}
        closeLabel={t.common.close}
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setSelectedDate(null)} disabled={saving}>
              {t.common.cancel}
            </Button>
            <Button size="sm" onClick={() => void saveEntry()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? t.timesheet.saving : t.timesheet.save}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="ts-hours">
              {t.timesheet.day_hours}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="ts-hours"
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={editor.hours}
                onChange={(e) => setEditor((prev) => ({ ...prev, hours: e.target.value }))}
                placeholder="0"
                className={cn("input h-10 w-28 text-center font-medium", invalid && "border-danger focus:ring-danger/30")}
                aria-invalid={invalid}
              />
              <span className="text-sm text-muted-foreground">{t.timesheet.hours}</span>
            </div>
            {invalid && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-danger">
                <CircleAlert className="h-3 w-3 shrink-0" />
                {t.timesheet.invalid_hours}
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t.timesheet.hours_min} · {t.timesheet.hours_max}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="ts-project">
              {t.timesheet.project}
            </label>
            <select
              id="ts-project"
              value={editor.projectId}
              onChange={(e) => onProjectChange(e.target.value)}
              className="input h-10 cursor-pointer"
            >
              <option value="">{t.timesheet.select_project}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="ts-task">
              {t.timesheet.task}
            </label>
            <select
              id="ts-task"
              value={editor.taskId}
              onChange={(e) => setEditor((prev) => ({ ...prev, taskId: e.target.value }))}
              disabled={!editor.projectId}
              className="input h-10 cursor-pointer disabled:opacity-50"
            >
              <option value="">{t.timesheet.select_task}</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="ts-activity">
              {t.timesheet.activity}
            </label>
            <textarea
              id="ts-activity"
              value={editor.activity}
              maxLength={ACTIVITY_MAX}
              rows={3}
              onChange={(e) => setEditor((prev) => ({ ...prev, activity: e.target.value }))}
              placeholder={t.timesheet.activity_placeholder}
              className="input h-auto resize-none py-2"
            />
            <p className="mt-1 text-end text-[10px] text-muted-foreground">
              {editor.activity.length}/{ACTIVITY_MAX}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}