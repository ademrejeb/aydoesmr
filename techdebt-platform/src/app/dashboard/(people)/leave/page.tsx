"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock,
  Hourglass,
  Inbox,
  Loader2,
  Send,
  Wallet,
  X,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import {
  api,
  type LeaveBalance,
  type LeaveRequest,
  type LeaveRequestStatus,
  type LeaveType,
} from "@/lib/api"
import { useI18n, type Dictionary } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { timeAgo } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { StatCard } from "@/components/ui/stat-card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Avatar } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"

/** Roles that can review (and therefore see) the approvals queue. */
const REVIEWER_ROLES = ["MANAGER", "ADMIN", "OWNER"]

function leaveStatusLabel(status: LeaveRequestStatus, t: Dictionary): string {
  switch (status) {
    case "APPROVED":
      return t.leave.approved
    case "REJECTED":
      return t.leave.rejected
    case "CANCELLED":
      return t.leave.cancelled
    default:
      return t.leave.pending
  }
}

function leaveStatusVariant(status: LeaveRequestStatus): "success" | "danger" | "warning" | "secondary" {
  switch (status) {
    case "APPROVED":
      return "success"
    case "REJECTED":
      return "danger"
    case "CANCELLED":
      return "secondary"
    default:
      return "warning"
  }
}

function countDays(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number)
  const [ey, em, ed] = end.split("-").map(Number)
  const a = new Date(sy, sm - 1, sd).getTime()
  const b = new Date(ey, em - 1, ed).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 0
  return Math.round((b - a) / 86400000) + 1
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

function formatShortDate(key: string, locale: string): string {
  const { y, m, d } = parseKey(key)
  return new Date(y, m, d).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric" })
}

export default function LeavePage() {
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()

  const [types, setTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [pendingQueue, setPendingQueue] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"mine" | "approvals">("mine")

  const [typeId, setTypeId] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [days, setDays] = useState<number | null>(null)
  const [reason, setReason] = useState("")
  const [notes, setNotes] = useState<Record<string, string>>({})

  const orgId = currentOrg?.id
  const authToken = token ?? ""
  const year = new Date().getFullYear()
  const isReviewer = !!currentOrg?.role && REVIEWER_ROLES.includes(currentOrg.role)

  const todayKey = toDateKey(new Date())
  const [calYear, setCalYear] = useState(year)
  const [calMonth, setCalMonth] = useState(new Date().getMonth())
  const [calOffKeys, setCalOffKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!authToken || !orgId) return
    let stale = false
    api
      .listOffDays(authToken, orgId, calYear)
      .then((list) => {
        if (!stale) setCalOffKeys(new Set((Array.isArray(list) ? list : []).map((o) => o.date.slice(0, 10))))
      })
      .catch(() => {
        if (!stale) setCalOffKeys(new Set())
      })
    return () => {
      stale = true
    }
  }, [authToken, orgId, calYear])

  const calCells = useMemo(() => {
    const leading = (new Date(calYear, calMonth, 1).getDay() + 6) % 7
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const list: (string | null)[] = Array.from({ length: leading }, () => null)
    for (let d = 1; d <= daysInMonth; d++) list.push(toDateKey(new Date(calYear, calMonth, d)))
    while (list.length % 7 !== 0) list.push(null)
    return list
  }, [calYear, calMonth])

  const requestsByDay = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>()
    for (const r of requests) {
      if (r.status !== "APPROVED" && r.status !== "PENDING") continue
      const start = parseKey(r.startDate)
      const last = parseKey(r.endDate)
      const cur = new Date(start.y, start.m, start.d)
      const end = new Date(last.y, last.m, last.d)
      let guard = 0
      while (cur.getTime() <= end.getTime() && guard < 400) {
        const key = toDateKey(cur)
        const arr = map.get(key) ?? []
        if (!arr.some((x) => x.id === r.id)) arr.push(r)
        map.set(key, arr)
        cur.setDate(cur.getDate() + 1)
        guard += 1
      }
    }
    return map
  }, [requests])

  const calMonthLabel = useMemo(
    () => new Date(calYear, calMonth, 1).toLocaleDateString(locale, { month: "long", year: "numeric" }),
    [calYear, calMonth, locale]
  )

  const calHasToday = calYear === new Date().getFullYear() && calMonth === new Date().getMonth()

  const nextLeave = useMemo(() => {
    const upcoming = requests
      .filter((r) => (r.status === "APPROVED" || r.status === "PENDING") && r.startDate >= todayKey)
      .sort((a, b) => (a.startDate > b.startDate ? 1 : -1))
    return upcoming[0] ?? null
  }, [requests, todayKey])

  const shiftCalMonth = (delta: number) => {
    const date = new Date(calYear, calMonth + delta, 1)
    setCalYear(date.getFullYear())
    setCalMonth(date.getMonth())
  }

  const load = useCallback(async () => {
    if (!authToken || !orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [typesList, balancesList, requestsList, queueList] = await Promise.all([
        api.listLeaveTypes(authToken, orgId).catch(() => [] as LeaveType[]),
        api.listLeaveBalances(authToken, orgId, year).catch(() => [] as LeaveBalance[]),
        api.listLeaveRequests(authToken, orgId).catch(() => [] as LeaveRequest[]),
        isReviewer
          ? api.listPendingLeaveRequests(authToken, orgId).catch(() => [] as LeaveRequest[])
          : Promise.resolve([] as LeaveRequest[]),
      ])
      setTypes(typesList)
      setBalances(balancesList)
      setRequests(requestsList.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)))
      setPendingQueue(queueList)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.leave.error_load)
    } finally {
      setLoading(false)
    }
  }, [authToken, orgId, year, isReviewer, t.leave.error_load])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!typeId && types.length > 0) setTypeId(types[0].id)
  }, [types, typeId])

  const activeTypes = useMemo(() => types.filter((ty) => ty.isActive), [types])

  const selectedType = useMemo(() => activeTypes.find((ty) => ty.id === typeId) ?? null, [activeTypes, typeId])

  /**
   * One card per active type. The API only creates a balance row once a
   * request touches it, so types without a row get a synthetic balance seeded
   * from daysPerYear — the page stays meaningful on a fresh organization.
   */
  const displayBalances = useMemo(() => {
    const rows = activeTypes.map((ty) => {
      const found = balances.find((b) => b.typeId === ty.id)
      if (found) return found
      return {
        id: `synthetic-${ty.id}`,
        organizationId: "",
        userId: "",
        typeId: ty.id,
        year,
        granted: ty.daysPerYear,
        used: 0,
        pending: 0,
        carriedOver: 0,
        adjusted: 0,
        remaining: ty.daysPerYear,
        updatedAt: "",
        type: { id: ty.id, name: ty.name, code: ty.code, color: ty.color, isPaid: ty.isPaid },
      } satisfies LeaveBalance
    })
    return rows.sort((a, b) => (a.type.code < b.type.code ? -1 : 1))
  }, [activeTypes, balances, year])

  const remaining = (b: LeaveBalance) => b.remaining ?? b.granted + b.carriedOver + b.adjusted - b.used - b.pending

  const stats = useMemo(() => {
    const totalRemaining = displayBalances.reduce((sum, b) => sum + Math.max(0, remaining(b)), 0)
    const usedDays = displayBalances.reduce((sum, b) => sum + b.used, 0)
    const pendingMine = requests.filter((r) => r.status === "PENDING").length
    const approvedMine = requests.filter((r) => r.status === "APPROVED").length
    return { totalRemaining, usedDays, pendingMine, approvedMine }
  }, [displayBalances, requests])

  const computedDays = useMemo(() => {
    if (!startDate || !endDate) return null
    return countDays(startDate, endDate)
  }, [startDate, endDate])

  const effectiveDays = days ?? computedDays ?? 0

  const selectedBalance = useMemo(
    () => displayBalances.find((b) => b.typeId === typeId) ?? null,
    [displayBalances, typeId]
  )
  const remainingAfter = selectedBalance && effectiveDays > 0 ? remaining(selectedBalance) - effectiveDays : null

  const submit = async () => {
    if (!authToken || !orgId) return
    if (!typeId || !startDate || !endDate) {
      toast.error(t.leave.error_submit)
      return
    }
    const nextDays = computedDays ?? days
    if (!nextDays || nextDays <= 0) {
      toast.error(t.leave.error_submit)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.createLeaveRequest(
        { typeId, startDate, endDate, days: nextDays, reason: reason.trim() || null },
        authToken,
        orgId
      )
      toast.success(t.leave.request_success)
      setStartDate("")
      setEndDate("")
      setDays(null)
      setReason("")
      void load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.leave.error_submit
      setError(msg)
      toast.error(t.leave.error_submit, msg)
    } finally {
      setSubmitting(false)
    }
  }

  const cancelRequest = async (requestId: string) => {
    if (!authToken || !orgId) return
    setBusyId(requestId)
    try {
      await api.cancelLeaveRequest(authToken, orgId, requestId)
      toast.success(t.leave.cancelled_success)
      void load()
    } catch (err) {
      toast.error(t.leave.error_load, err instanceof Error ? err.message : undefined)
    } finally {
      setBusyId(null)
    }
  }

  const review = async (requestId: string, action: "approve" | "reject") => {
    if (!authToken || !orgId) return
    setBusyId(requestId)
    const note = notes[requestId]?.trim() || null
    try {
      if (action === "approve") {
        await api.approveLeaveRequest(authToken, orgId, requestId, note)
        toast.success(t.leave.approved_success)
      } else {
        await api.rejectLeaveRequest(authToken, orgId, requestId, note)
        toast.success(t.leave.rejected_success)
      }
      setNotes((prev) => {
        const next = { ...prev }
        delete next[requestId]
        return next
      })
      void load()
    } catch (err) {
      toast.error(t.leave.error_load, err instanceof Error ? err.message : undefined)
    } finally {
      setBusyId(null)
    }
  }

  const tabClass = (active: boolean) =>
    cn(
      "rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors",
      active
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )

  return (
    <div className="space-y-6">
      <section className="hero-gradient relative overflow-hidden rounded-2xl p-6 text-white md:p-8">
        <div className="pointer-events-none absolute -end-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-hero">
          <p className="text-xs font-medium uppercase tracking-wider text-white/70">{t.platform.leave}</p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight md:text-3xl">{t.leave.title}</h2>
          <p className="mt-2 max-w-xl text-sm text-white/85 md:text-base">{t.leave.subtitle}</p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label={t.leave.balance_remaining}
          value={stats.totalRemaining}
          hint={`${t.leave.balances} · ${year}`}
        />
        <StatCard
          icon={<Hourglass className="h-4 w-4" />}
          label={t.leave.pending}
          value={stats.pendingMine}
          hint={t.leave.requests}
        />
        <StatCard
          icon={<CircleCheck className="h-4 w-4" />}
          label={t.leave.approved}
          value={stats.approvedMine}
          hint={t.leave.requests}
        />
        <StatCard
          icon={<CalendarDays className="h-4 w-4" />}
          label={t.leave.used}
          value={stats.usedDays}
          hint={t.leave.days}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-border bg-card p-1 shadow-sm" role="tablist" aria-label={t.leave.title}>
          <button type="button" role="tab" aria-selected={tab === "mine"} onClick={() => setTab("mine")} className={tabClass(tab === "mine")}>
            {t.leave.my_leave}
          </button>
          {isReviewer && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "approvals"}
              onClick={() => setTab("approvals")}
              className={tabClass(tab === "approvals")}
            >
              {t.leave.approvals}
            </button>
          )}
        </div>
        {tab === "approvals" && pendingQueue.length > 0 && (
          <Badge variant="warning" dot>
            {pendingQueue.length}
          </Badge>
        )}
      </div>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      {tab === "mine" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card
              title={calMonthLabel}
              action={
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => shiftCalMonth(-1)} aria-label={t.timesheet.previous}>
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCalYear(new Date().getFullYear())
                      setCalMonth(new Date().getMonth())
                    }}
                    disabled={calHasToday}
                    aria-label={t.timesheet.today}
                  >
                    {t.timesheet.today}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => shiftCalMonth(1)} aria-label={t.timesheet.next}>
                    <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                </div>
              }
            >
              <div className="mb-3 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{t.leave.calendar_hint}</p>
              </div>
              <div className="overflow-x-auto pb-1">
                <div className="grid min-w-[520px] grid-cols-7 gap-1.5" dir="ltr">
                  {t.timesheet.day_labels.map((label) => (
                    <div
                      key={label}
                      className="px-1 pb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {label.slice(0, 3)}
                    </div>
                  ))}
                </div>
                <div className="grid min-w-[520px] grid-cols-7 gap-1.5">
                {calCells.map((key, i) => {
                  if (!key) return <div key={`blank-${i}`} className="rounded-lg border border-transparent" />
                  const { d } = parseKey(key)
                  const dayReqs = requestsByDay.get(key) ?? []
                  const isOff = calOffKeys.has(key)
                  const isToday = key === todayKey
                  return (
                    <div
                      key={key}
                      className={cn(
                        "flex min-h-14 flex-col items-stretch gap-1 rounded-lg border p-1.5 text-start",
                        isOff
                          ? "border-dashed border-danger/30 bg-danger/5"
                          : dayReqs.length > 0
                            ? "border-border bg-card"
                            : "border-border/60 bg-muted/20",
                        isToday && "ring-1 ring-primary/50 border-primary/50"
                      )}
                      title={`${formatShortDate(key, locale)}${isOff ? ` · ${t.timesheet.off_day}` : ""}`}
                    >
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                          isToday
                            ? "bg-primary text-primary-foreground"
                            : isOff
                              ? "text-danger/90"
                              : "text-muted-foreground"
                        )}
                      >
                        {d}
                      </span>
                      <span className="flex flex-wrap items-center gap-1">
                        {dayReqs.length > 0 && (
                          <span className="flex items-center gap-0.5">
                            {dayReqs.slice(0, 3).map((r) => (
                              <span
                                key={r.id}
                                title={r.type.name}
                                className={cn("h-1.5 w-1.5 rounded-full", r.status === "APPROVED" ? "bg-success" : "bg-warning")}
                              />
                            ))}
                            {dayReqs.length > 3 && (
                              <span className="text-[9px] leading-none text-muted-foreground">+{dayReqs.length - 3}</span>
                            )}
                          </span>
                        )}
                        {isOff && (
                          <span className="ms-auto rounded bg-danger/10 px-1 text-[9px] font-bold uppercase leading-4 text-danger">
                            {t.timesheet.off_day}
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] font-medium text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  {t.leave.approved}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                  {t.leave.pending}
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                  {t.timesheet.off_day}
                </span>
              </div>
              <div className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                {nextLeave ? (
                  <span>
                    <span className="font-semibold text-foreground">{t.leave.next_leave}: </span>
                    <span className="text-foreground">{formatShortDate(nextLeave.startDate, locale)}</span>
                    <span className="text-muted-foreground"> · {nextLeave.type.name}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground">{t.leave.no_upcoming}</span>
                )}
              </div>
            </Card>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">
                  {t.leave.balances} · {year}
                </h3>
              </div>
              {loading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-36 w-full rounded-xl" />
                  ))}
                </div>
              ) : displayBalances.length === 0 ? (
                <EmptyState icon={Wallet} title={t.leave.no_balances} description={t.leave.balances} />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {displayBalances.map((b) => {
                    const total = b.granted + b.carriedOver + b.adjusted
                    const usedPct = total > 0 ? Math.min(100, ((b.used + b.pending) / total) * 100) : 0
                    const rem = remaining(b)
                    return (
                      <div key={b.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: b.type.color ?? "#64748b" }}
                          />
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{b.type.name}</p>
                          <Badge variant="outline" className="font-mono text-[10px] uppercase">
                            {b.type.code}
                          </Badge>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between gap-2">
                          <span
                            className={cn(
                              "text-2xl font-bold tracking-tight",
                              rem < 0 ? "text-danger" : rem <= 2 ? "text-warning" : "text-foreground"
                            )}
                          >
                            {rem}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            / {total} {t.leave.days}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              usedPct >= 100 ? "bg-danger" : usedPct >= 80 ? "bg-warning" : "bg-primary"
                            )}
                            style={{ width: `${usedPct}%` }}
                          />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <Badge variant="secondary">
                            {t.leave.used}: {b.used}
                          </Badge>
                          {b.pending > 0 && (
                            <Badge variant="warning" dot>
                              {t.leave.pending}: {b.pending}
                            </Badge>
                          )}
                          {b.carriedOver > 0 && (
                            <Badge variant="outline">
                              {t.leave.carried_over}: {b.carriedOver}
                            </Badge>
                          )}
                          <Badge variant={b.type.isPaid ? "success" : "secondary"} dot>
                            {b.type.isPaid ? t.leave_settings.paid : t.leave_settings.unpaid}
                          </Badge>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{t.leave.requests}</h3>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : requests.length === 0 ? (
                <EmptyState icon={CalendarClock} title={t.leave.empty_requests} description={t.leave.subtitle} />
              ) : (
                <div className="space-y-2">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        {req.status === "APPROVED" ? (
                          <CircleCheck className="h-4 w-4 shrink-0 text-success" />
                        ) : req.status === "REJECTED" ? (
                          <CircleX className="h-4 w-4 shrink-0 text-danger" />
                        ) : req.status === "CANCELLED" ? (
                          <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <Clock className="h-4 w-4 shrink-0 text-warning" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {req.type.name} · {req.days} {t.leave.days}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {req.startDate} – {req.endDate}
                            {req.reason ? ` · ${req.reason}` : ""}
                          </p>
                          {req.reviewNote && (
                            <p className="truncate text-xs italic text-muted-foreground/80">
                              {t.leave.review_note}: {req.reviewNote}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="hidden text-xs text-muted-foreground sm:inline">
                          {timeAgo(req.createdAt, locale)}
                        </span>
                        <Badge variant={leaveStatusVariant(req.status)} dot>
                          {leaveStatusLabel(req.status, t)}
                        </Badge>
                        {req.status === "PENDING" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelRequest(req.id)}
                            disabled={busyId === req.id}
                          >
                            {busyId === req.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                            {t.leave.cancel}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="lg:col-span-1">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-20">
              <div className="mb-4 flex items-center gap-2">
                <CalendarPlus className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{t.leave.new_request}</h3>
              </div>

              <div className="space-y-4">
                <Field label={t.leave.leave_type} required>
                  <Select value={typeId} onChange={(e) => setTypeId(e.target.value)} disabled={activeTypes.length === 0}>
                    {activeTypes.length === 0 && <option value="">{t.leave.select_type}</option>}
                    {activeTypes.map((ty) => (
                      <option key={ty.id} value={ty.id}>
                        {ty.name} ({ty.code})
                      </option>
                    ))}
                  </Select>
                </Field>

                {selectedType && (
                  <p
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium",
                      selectedType.requiresApproval ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                    )}
                  >
                    {selectedType.requiresApproval ? (
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <CircleCheck className="h-3.5 w-3.5 shrink-0" />
                    )}
                    {selectedType.requiresApproval ? t.leave.needs_approval : t.leave.auto_approved}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label={t.leave.start_date} required>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </Field>
                  <Field label={t.leave.end_date} required>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </Field>
                </div>

                <Field
                  label={t.leave.days}
                  hint={computedDays != null ? `${t.leave.computed_days}: ${computedDays}` : t.leave.computed_days}
                >
                  <Input
                    type="number"
                    min={1}
                    step={0.5}
                    value={effectiveDays || ""}
                    onChange={(e) => setDays(parseFloat(e.target.value) || 0)}
                  />
                </Field>

                {remainingAfter !== null && (
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">{t.leave.remaining_after}: </span>
                    <span
                      className={cn(
                        "font-bold",
                        remainingAfter < 0 ? "text-danger" : remainingAfter <= 2 ? "text-warning" : "text-success"
                      )}
                    >
                      {remainingAfter}
                    </span>
                  </div>
                )}

                <Field label={t.leave.reason}>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t.leave.reason_placeholder}
                    rows={3}
                    size="sm"
                  />
                </Field>

                <Button
                  className="w-full"
                  size="sm"
                  onClick={submit}
                  disabled={submitting || loading || activeTypes.length === 0}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? t.leave.submitting : t.leave.submit}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Inbox className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t.leave.approvals}</h3>
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : pendingQueue.length === 0 ? (
            <EmptyState icon={Inbox} title={t.leave.empty_queue} description={t.leave.subtitle} />
          ) : (
            <div className="space-y-2">
              {pendingQueue.map((req) => (
                <div key={req.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        name={req.user?.fullName ?? req.user?.email ?? "?"}
                        src={req.user?.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {req.user?.fullName ?? req.user?.email ?? req.userId}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {req.type.name} · {req.days} {t.leave.days} · {req.startDate} – {req.endDate}
                        </p>
                      </div>
                    </div>
                    <Badge variant="warning" dot>
                      {t.leave.pending}
                    </Badge>
                  </div>
                  {req.reason && <p className="mt-2 text-xs text-muted-foreground">{req.reason}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Input
                      size="sm"
                      wrapperClassName="min-w-[12rem] flex-1"
                      placeholder={t.leave.review_note}
                      value={notes[req.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => review(req.id, "approve")}
                      disabled={busyId === req.id}
                    >
                      {busyId === req.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 text-success" />
                      )}
                      {t.leave.approve}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => review(req.id, "reject")}
                      disabled={busyId === req.id}
                    >
                      <X className="h-4 w-4 text-danger" />
                      {t.leave.reject}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
