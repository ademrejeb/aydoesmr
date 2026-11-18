"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bug,
  CircleAlert,
  CircleCheck,
  Copy,
  Filter,
  FolderOpen,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type DevIssue, type DevStats, type IssueExplanation, type Project } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn, timeAgo } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { SeverityBadge, SEVERITY_ORDER, severityLabel, severityVariant } from "@/components/ui/severity-badge"

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 }

function IssueSnippet({ issue }: { issue: DevIssue }) {
  const snippet = issue.codeSnippet?.trimEnd()
  if (!snippet) return null
  const start = issue.columnStart ?? null
  const end = issue.columnEnd ?? null
  let before = snippet
  let highlight = ""
  let after = ""
  if (start !== null && end !== null && start >= 1 && end > start && end <= snippet.length + 1) {
    before = snippet.slice(0, start - 1)
    highlight = snippet.slice(start - 1, end - 1)
    after = snippet.slice(end - 1)
  } else {
    highlight = snippet
    before = ""
    after = ""
  }
  return (
    <div className="mt-2 flex overflow-x-auto rounded-lg border border-border bg-muted/40">
      {issue.lineNumber !== null && (
        <span className="select-none border-e border-border px-2 py-1 text-end font-mono text-[11px] leading-relaxed text-muted-foreground">
          {issue.lineNumber}
        </span>
      )}
      <pre className="flex-1 overflow-x-auto px-2 py-1 font-mono text-[11px] leading-relaxed text-foreground/90">
        {before}
        {highlight && <mark className="rounded-sm bg-danger/20 text-foreground">{highlight}</mark>}
        {after}
      </pre>
    </div>
  )
}

const searchInputCls =
  "h-10 w-full rounded-md border border-border bg-card ps-9 pe-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
const selectInputCls =
  "h-10 w-full cursor-pointer rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"

export default function DevIssuesPage() {
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()
  const [issues, setIssues] = useState<DevIssue[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [triaging, setTriaging] = useState<string | null>(null)
  const [target, setTarget] = useState<Record<string, string>>({})

  const [search, setSearch] = useState("")
  const [sevFilter, setSevFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [ruleFilter, setRuleFilter] = useState("ALL")
  const [scanFilter, setScanFilter] = useState<string | null>(null)
  const [stats, setStats] = useState<DevStats | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [groupByFile, setGroupByFile] = useState(false)
  const [explaining, setExplaining] = useState<string | null>(null)
  const [explanations, setExplanations] = useState<Record<string, IssueExplanation>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token || !currentOrg) {
      setLoading(false)
      return
    }
    try {
      const [i, p, s] = await Promise.all([
        api.listIssues(token, currentOrg.id).catch(() => [] as DevIssue[]),
        api.listProjects(token, currentOrg.id).catch(() => [] as Project[]),
        api.getDevStats(token, currentOrg.id).catch(() => null as DevStats | null),
      ])
      setIssues(i)
      setProjects(p)
      setStats(s)
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t.errors.network_error)
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg])

  useEffect(() => {
    load()
  }, [load])

  // Deep-link support: /dashboard/dev/issues?scan=<scanId>
  useEffect(() => {
    if (typeof window === "undefined") return
    const scan = new URLSearchParams(window.location.search).get("scan")
    if (scan) setScanFilter(scan)
  }, [])

  const triage = async (issue: DevIssue) => {
    if (!token || !currentOrg) return
    const projectId = target[issue.id]
    if (!projectId) return
    setTriaging(issue.id)
    try {
      await api.triageIssue(token, currentOrg.id, issue.id, {
        projectId,
        title: `Fix: ${issue.message.slice(0, 80)}`,
      })
      await load()
      toast.success(t.dev.triaged, issue.message.slice(0, 60))
    } catch {
      toast.error(t.errors.scan_failed)
    } finally {
      setTriaging(null)
    }
  }

  const explain = async (issue: DevIssue) => {
    if (!token || !currentOrg) return
    if (explanations[issue.id]) return
    setExplaining(issue.id)
    try {
      const result = await api.explainIssue(token, currentOrg.id, issue.id)
      setExplanations((m) => ({ ...m, [issue.id]: result }))
    } catch {
      toast.error(t.errors.scan_failed)
    } finally {
      setExplaining(null)
    }
  }

  const copyFix = async (issue: DevIssue) => {
    const text = issue.fix?.description || issue.codeSnippet || issue.suggestion
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(issue.id)
      setTimeout(() => setCopiedId((cur) => (cur === issue.id ? null : cur)), 1500)
    } catch {
      toast.error(t.errors.network_error)
    }
  }

  const toggleFixed = async (issue: DevIssue) => {
    if (!token || !currentOrg) return
    const next = !issue.isFixed
    setToggling(issue.id)
    setIssues((cur) =>
      cur.map((i) => (i.id === issue.id ? { ...i, isFixed: next } : i))
    )
    try {
      await api.setIssueFixed(token, currentOrg.id, issue.id, next)
      setStats(await api.getDevStats(token, currentOrg.id).catch(() => null as DevStats | null))
      toast.success(next ? t.dev.mark_fixed : t.dev.reopen, issue.message.slice(0, 60))
    } catch {
      setIssues((cur) =>
        cur.map((i) => (i.id === issue.id ? { ...i, isFixed: !next } : i))
      )
      toast.error(t.errors.network_error)
    } finally {
      setToggling(null)
    }
  }

  const sorted = useMemo(
    () =>
      [...issues].sort(
        (a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9)
      ),
    [issues]
  )

  const sevCounts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const issue of issues) {
      const key = issue.severity.toUpperCase()
      m[key] = (m[key] ?? 0) + 1
    }
    return m
  }, [issues])

  const ruleOptions = useMemo(() => {
    const m = new Map<string, number>()
    for (const issue of issues) {
      if (issue.ruleId) m.set(issue.ruleId, (m.get(issue.ruleId) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [issues])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sorted.filter((issue) => {
      const okSev = sevFilter === "ALL" || issue.severity.toUpperCase() === sevFilter
      const okStatus = statusFilter === "ALL" || (statusFilter === "FIXED") === issue.isFixed
      const okRule = ruleFilter === "ALL" || (issue.ruleId ?? "") === ruleFilter
      const okScan = !scanFilter || (issue.scanId ?? null) === scanFilter
      const okSearch =
        !q ||
        issue.message.toLowerCase().includes(q) ||
        issue.filePath.toLowerCase().includes(q) ||
        (issue.category ?? "").toLowerCase().includes(q) ||
        (issue.ruleId ?? "").toLowerCase().includes(q)
      return okSev && okStatus && okSearch && okRule && okScan
    })
  }, [sorted, search, sevFilter, statusFilter, ruleFilter, scanFilter])

  const openCount = issues.filter((i) => !i.isFixed).length
  const fixedCount = issues.filter((i) => i.isFixed).length

  const groups = useMemo(() => {
    if (!groupByFile) return null
    const m = new Map<string, DevIssue[]>()
    for (const issue of filtered) {
      const key = issue.filePath || "(inline)"
      const list = m.get(key)
      if (list) list.push(issue)
      else m.set(key, [issue])
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [filtered, groupByFile])

  const groupTopSeverity = (list: DevIssue[]): string =>
    list.reduce(
      (acc, i) => (SEVERITY_RANK[i.severity] ?? 9) < (SEVERITY_RANK[acc] ?? 9) ? i.severity : acc,
      "INFO"
    )

  const renderIssue = (issue: DevIssue, showPath = true) => {
    const alreadyTriaged = issue.tasks.length > 0
    return (
      <div key={issue.id} className="card-hover bg-card">
        <div className="flex flex-col gap-3 p-4 md:flex-row md:items-start md:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={issue.severity} t={t} />
              {issue.isFixed && (
                <Badge variant="success" className="gap-1">
                  <CircleCheck className="h-3 w-3" />
                  {t.dev.fixed}
                </Badge>
              )}
              <span className="ms-auto text-xs text-muted-foreground">
                {timeAgo(issue.createdAt, locale)}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-medium">{issue.message}</p>
            {showPath && (
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {issue.filePath}
                {issue.lineNumber !== null && (
                  <span className="text-muted-foreground/70">:{issue.lineNumber}</span>
                )}
              </p>
            )}
            <IssueSnippet issue={issue} />
            {(issue.category || issue.ruleId) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {issue.category && (
                  <Badge variant="secondary" className="text-[10px]">
                    {issue.category}
                  </Badge>
                )}
                {issue.ruleId && (
                  <span className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                    <Wrench className="h-3 w-3" />
                    {issue.ruleId}
                  </span>
                )}
              </div>
            )}
            {issue.fix?.kind && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="success" className="gap-1 text-[10px]">
                  <Wrench className="h-3 w-3" />
                  {t.dev.fix_suggested}: {issue.fix.kind}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => copyFix(issue)}
                >
                  {copiedId === issue.id ? (
                    <>
                      <CircleCheck className="h-3 w-3" />
                      {t.dev.copied}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      {t.dev.copy}
                    </>
                  )}
                </Button>
              </div>
            )}
            {explanations[issue.id] && (
              <div className="mt-2 rounded-lg border border-border bg-muted/40 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  {t.dev.explanation}
                  {explanations[issue.id].mode === "ai" && (
                    <Badge variant="secondary" className="text-[10px]">
                      AI
                    </Badge>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                  {explanations[issue.id].explanation}
                </p>
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
            <Button
              size="sm"
              variant="ghost"
              disabled={explaining === issue.id}
              onClick={() => explain(issue)}
            >
              {explaining === issue.id ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t.dev.explaining}
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  {t.dev.explain}
                </>
              )}
            </Button>
            {alreadyTriaged ? (
              <Badge variant="success" dot className="whitespace-nowrap">
                {t.dev.triaged}
              </Badge>
            ) : (
              <>
                <select
                  value={target[issue.id] ?? ""}
                  onChange={(e) => setTarget((m) => ({ ...m, [issue.id]: e.target.value }))}
                  aria-label={t.dev.triage}
                  className="h-8 w-full cursor-pointer rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring sm:w-44"
                >
                  <option value="">{t.projects.title}…</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant={issue.severity === "CRITICAL" ? "destructive" : "default"}
                  disabled={triaging === issue.id || !target[issue.id]}
                  onClick={() => triage(issue)}
                >
                  {triaging === issue.id ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t.dev.triage}
                    </>
                  ) : (
                    <>
                      <Wrench className="h-3.5 w-3.5" />
                      {t.dev.triage}
                    </>
                  )}
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant={issue.isFixed ? "outline" : "secondary"}
              disabled={toggling === issue.id}
              onClick={() => toggleFixed(issue)}
              title={issue.isFixed ? t.dev.reopen : t.dev.mark_fixed}
            >
              {toggling === issue.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CircleCheck className="h-3.5 w-3.5" />
              )}
              {issue.isFixed ? t.dev.reopen : t.dev.mark_fixed}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold md:text-3xl">{t.dev.issues_title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{currentOrg?.name}</p>
        </div>
        {!loading && issues.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant={openCount > 0 ? "warning" : "secondary"} dot>
              {openCount} {t.dev.open}
            </Badge>
            <Badge variant="success" dot>
              {fixedCount} {t.dev.fixed}
            </Badge>
          </div>
        )}
      </div>

      {loadError && !loading && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-6 w-24 rounded-full" />
            ))}
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Skeleton className="h-10 w-full rounded-md lg:flex-1" />
            <Skeleton className="h-10 w-full rounded-md lg:w-44" />
            <Skeleton className="h-10 w-full rounded-md lg:w-36" />
          </div>
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="ms-auto h-4 w-28" />
                </div>
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-3 w-3/4" />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Skeleton className="h-8 w-40 rounded-md" />
                  <Skeleton className="h-8 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {stats && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <p className="text-xs text-muted-foreground">{t.dev.debt_trend}</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums">
                  {stats.debtScore === null ? "—" : stats.debtScore.toFixed(0)}
                  <span className="text-sm font-medium text-muted-foreground">/100</span>
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <p className="text-xs text-muted-foreground">{t.dev.open_issues}</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-warning">{stats.open}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <p className="text-xs text-muted-foreground">{t.dev.fixed_issues}</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-success">{stats.fixed}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
                <p className="text-xs text-muted-foreground">{t.dev.top_rules}</p>
                <ul className="mt-1 space-y-0.5 text-xs text-foreground/90">
                  {stats.topRules.slice(0, 3).map((r) => (
                    <li key={r.ruleId} className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono">{r.ruleId}</span>
                      <span className="tabular-nums text-muted-foreground">{r.count}</span>
                    </li>
                  ))}
                  {stats.topRules.length === 0 && (
                    <li className="text-muted-foreground">{t.dev.no_data}</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {SEVERITY_ORDER.map((sev) => {
              const count = sevCounts[sev] ?? 0
              const active = sevFilter === sev
              return (
                <button
                  key={sev}
                  type="button"
                  aria-pressed={active}
                  aria-label={severityLabel(sev, t)}
                  onClick={() => setSevFilter((prev) => (prev === sev ? "ALL" : sev))}
                  className={cn(
                    "cursor-pointer rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "ring-2 ring-ring/60" : "hover:opacity-80"
                  )}
                >
                  <Badge
                    variant={severityVariant(sev)}
                    dot
                    className={cn(count === 0 && "opacity-40")}
                  >
                    {count} {severityLabel(sev, t)}
                  </Badge>
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <button
              type="button"
              aria-pressed={groupByFile}
              onClick={() => setGroupByFile((v) => !v)}
              className={cn(
                "inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring",
                groupByFile && "border-ring/60 bg-muted"
              )}
            >
              <FolderOpen className="h-4 w-4" />
              {t.dev.group_by_file}
              {groupByFile && groups && (
                <span className="text-xs text-muted-foreground">
                  {groups.length} {t.dev.files}
                </span>
              )}
            </button>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.dev.issues_search}
                aria-label={t.dev.issues_search}
                className={searchInputCls}
              />
            </div>
            <div className="relative lg:w-44">
              <Filter className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <select
                value={sevFilter}
                onChange={(e) => setSevFilter(e.target.value)}
                aria-label={t.dev.all_severities}
                className={cn(selectInputCls, "ps-9")}
              >
                <option value="ALL">{t.dev.all_severities}</option>
                {SEVERITY_ORDER.map((sev) => (
                  <option key={sev} value={sev}>{severityLabel(sev, t)}</option>
                ))}
              </select>
            </div>
            <div className="lg:w-36">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label={t.dev.all_status}
                className={selectInputCls}
              >
                <option value="ALL">{t.dev.all_status}</option>
                <option value="OPEN">{t.dev.open}</option>
                <option value="FIXED">{t.dev.fixed}</option>
              </select>
            </div>
            <div className="lg:w-48">
              <select
                value={ruleFilter}
                onChange={(e) => setRuleFilter(e.target.value)}
                aria-label={t.dev.filter_rule}
                className={selectInputCls}
              >
                <option value="ALL">{t.dev.all_rules}</option>
                {ruleOptions.map(([ruleId, count]) => (
                  <option key={ruleId} value={ruleId}>
                    {ruleId} ({count})
                  </option>
                ))}
              </select>
            </div>
            {scanFilter && (
              <Button
                size="sm"
                variant="outline"
                className="h-10 shrink-0"
                onClick={() => {
                  setScanFilter(null)
                  if (typeof window !== "undefined") {
                    window.history.replaceState(null, "", window.location.pathname)
                  }
                }}
              >
                <X className="h-3.5 w-3.5" />
                {t.dev.filter_scan}
              </Button>
            )}
          </div>

          {sorted.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title={t.results.no_issues}
              description={t.repo.no_issues}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Bug}
              title={t.dev.issues_no_match}
              description={t.dev.subtitle}
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSearch("")
                    setSevFilter("ALL")
                    setStatusFilter("ALL")
                    setRuleFilter("ALL")
                    setScanFilter(null)
                    if (typeof window !== "undefined") {
                      window.history.replaceState(null, "", window.location.pathname)
                    }
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  {t.dev.clear_filters}
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {groups ? (
                groups.map(([filePath, list]) => (
                  <section key={filePath} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
                      <SeverityBadge severity={groupTopSeverity(list)} t={t} />
                      <span className="break-all font-mono text-xs font-medium text-foreground">
                        {filePath}
                      </span>
                      <span className="ms-auto text-xs text-muted-foreground">
                        {list.length} {t.dev.issues_count}
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {list.map((issue) => renderIssue(issue, false))}
                    </div>
                  </section>
                ))
              ) : (
                <div className="space-y-3">
                  {filtered.map((issue) => (
                    <div
                      key={issue.id}
                      className="rounded-xl border border-border bg-card shadow-sm"
                    >
                      {renderIssue(issue, true)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}