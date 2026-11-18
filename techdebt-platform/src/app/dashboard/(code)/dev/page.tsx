"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  CircleAlert,
  CircleCheck,
  Code2,
  FolderOpen,
  GitBranch,
  History,
  Loader2,
  Play,
  ScanSearch,
  Settings,
  type LucideIcon,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type AnalysisConfig, type DebtPoint, type DevScan, type RuleCatalogEntry } from "@/lib/api"
import { useI18n, type Dictionary } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn, timeAgo } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalysisResultsView, type RuleMatch } from "@/components/platform/analysis-results"

type Tab = "paste" | "project" | "git"

interface RuleResult {
  rule_id: string
  rule_name: string
  severity: string
  category: string
  message: string
  suggestion: string
  line_number?: number
  language?: string
  file?: string
}

interface LegacyAnalysis {
  success: boolean
  metrics?: { lines_of_code: number; cyclomatic_complexity: number; maintainability_index: number }
  issues_found?: number
  rules?: RuleResult[]
  repo?: { branch?: string; total_commits?: number; tracked_files?: number; status?: string }
}

function extractError(e: unknown, fallback: string): string {
  if (e instanceof Error) return e.message
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message: unknown }).message
    if (typeof m === "string" && m) return m
  }
  return fallback
}

function InfoCard({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", className)}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  )
}

function ResultsSkeleton() {
  return (
    <section className="space-y-4" aria-busy="true" aria-label="Loading results">
      <Skeleton className="h-7 w-44" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    </section>
  )
}

function TrendChart({ values, color }: { values: number[]; color: string }) {
  const W = 200
  const H = 56
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const points = values
    .map((v, i) => `${(i / Math.max(values.length - 1, 1)) * W},${H - ((v - min) / span) * (H - 8) - 4}`)
    .join(" ")
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="h-14 w-full max-w-[200px]" aria-label="trend">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function DebtTrendCard({
  token,
  orgId,
  t,
}: {
  token: string | null
  orgId: string | undefined
  t: Dictionary
}) {
  const [points, setPoints] = useState<DebtPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token || !orgId) {
      setLoading(false)
      return
    }
    api
      .getDebtTrend(token, orgId)
      .then(setPoints)
      .catch(() => setPoints([]))
      .finally(() => setLoading(false))
  }, [token, orgId])

  const scores = points.map((p) => p.debtScore).filter((v): v is number => v !== null)
  const latest = scores.length > 0 ? scores[scores.length - 1] : null
  const openCount = points.reduce((acc, p) => acc + p.openIssues, 0)

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{t.dev.debt_trend}</p>
      {loading ? (
        <Skeleton className="mt-3 h-14 w-full" />
      ) : scores.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{t.dev.no_data}</p>
      ) : (
        <div className="mt-2 flex items-end justify-between gap-3">
          <span className="text-2xl font-extrabold">
            {latest !== null ? Math.round(latest) : "—"}
            <span className="ms-1 text-xs font-medium text-muted-foreground">/100</span>
          </span>
          <div className="flex flex-col items-end gap-1">
            {scores.length >= 2 && <TrendChart values={scores} color={latest !== null && latest > 50 ? "#dc2626" : "#16a34a"} />}
            <span className="text-[11px] text-muted-foreground">
              {openCount} {t.platform.issues} · {points.length} {t.dev.scans.toLowerCase()}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function AnalysisSettingsCard({
  open,
  onClose,
  token,
  orgId,
  t,
}: {
  open: boolean
  onClose: () => void
  token: string | null
  orgId: string | undefined
  t: Dictionary
}) {
  const toast = useToast()
  const [catalog, setCatalog] = useState<RuleCatalogEntry[]>([])
  const [config, setConfig] = useState<AnalysisConfig["config"]>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !token || !orgId) return
    Promise.all([
      api.getRulesCatalog(token, orgId),
      api.getAnalysisConfig(token, orgId),
    ])
      .then(([cat, cfg]) => {
        setCatalog(cat.rules ?? [])
        setConfig(cfg.config ?? {})
      })
      .catch(() => undefined)
  }, [open, token, orgId])

  if (!open) return null

  const THRESHOLDS = ["cyclomatic_complexity", "max_nesting_depth", "maintainability_index", "max_line_length", "max_line_reports"]

  const updateThreshold = (key: string, value: string) => {
    setConfig((c) => ({
      ...c,
      thresholds: { ...(c.thresholds ?? {}), [key]: value === "" ? 0 : Number(value) },
    }))
  }

  const save = async () => {
    if (!token || !orgId) return
    setSaving(true)
    try {
      const clean: AnalysisConfig["config"] = {}
      const thresholds = { ...(config.thresholds ?? {}) }
      for (const k of Object.keys(thresholds)) {
        if (!thresholds[k] || thresholds[k] <= 0) delete thresholds[k]
      }
      clean.thresholds = Object.keys(thresholds).length > 0 ? thresholds : undefined
      const rules = (config.ignore_rules ?? []).map((r) => r.trim()).filter(Boolean)
      clean.ignore_rules = rules.length > 0 ? rules : undefined
      const exclude = (config.exclude_paths ?? []).map((p) => p.trim()).filter(Boolean)
      clean.exclude_paths = exclude.length > 0 ? exclude : undefined
      const include = (config.include_paths ?? []).map((p) => p.trim()).filter(Boolean)
      clean.include_paths = include.length > 0 ? include : undefined
      await api.setAnalysisConfig(token, orgId, clean)
      toast.success(t.dev.saved, t.dev.settings)
      onClose()
    } catch {
      toast.error(t.errors.network_error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Settings className="h-4 w-4" />
          {t.dev.settings}
        </h3>
        <Button size="sm" variant="ghost" onClick={onClose}>
          ×
        </Button>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground">{t.dev.threshold}</label>
          <div className="space-y-2">
            {THRESHOLDS.map((key) => (
              <label key={key} className="flex items-center justify-between gap-3 text-xs">
                <span className="font-mono text-muted-foreground">{key}</span>
                <input
                  type="number"
                  step="any"
                  defaultValue={config.thresholds?.[key]}
                  placeholder="—"
                  onChange={(e) => updateThreshold(key, e.target.value)}
                  className="w-28 rounded-md border border-border bg-background px-2 py-1 text-right font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground" htmlFor="dev-ignore-rules">
            {t.dev.ignore_rules}
          </label>
          <textarea
            id="dev-ignore-rules"
            rows={4}
            defaultValue={(config.ignore_rules ?? []).join(", ")}
            placeholder="sql_injection, camel_case, …"
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                ignore_rules: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              }))
            }
            className="w-full rounded-lg border border-border bg-background p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {catalog.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {catalog.slice(0, 12).map((r) => (
                <Badge key={r.id} variant="secondary" className="font-mono text-[10px]">
                  {r.id}
                </Badge>
              ))}
              {catalog.length > 12 && (
                <span className="text-[10px] text-muted-foreground">+{catalog.length - 12}</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground" htmlFor="dev-exclude-paths">
            {t.dev.exclude_paths}
          </label>
          <textarea
            id="dev-exclude-paths"
            rows={2}
            defaultValue={(config.exclude_paths ?? []).join(", ")}
            placeholder="node_modules/, dist/, *.generated.ts"
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                exclude_paths: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              }))
            }
            className="w-full rounded-lg border border-border bg-background p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground" htmlFor="dev-include-paths">
            {t.dev.include_paths}
          </label>
          <textarea
            id="dev-include-paths"
            rows={2}
            defaultValue={(config.include_paths ?? []).join(", ")}
            placeholder="src/api/, packages/core/"
            onChange={(e) =>
              setConfig((c) => ({
                ...c,
                include_paths: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
              }))
            }
            className="w-full rounded-lg border border-border bg-background p-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            {t.dev.path_hint}
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>
          {t.common.cancel}
        </Button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t.dev.save}…
            </>
          ) : (
            t.dev.save
          )}
        </Button>
      </div>
    </section>
  )
}

export default function DevPage() {
  const { t, locale } = useI18n()
  const { token, currentOrg } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>("paste")

  const [code, setCode] = useState("")
  const [language, setLanguage] = useState("rust")
  const [path, setPath] = useState("")
  const [gitUrl, setGitUrl] = useState("")
  const [gitMode, setGitMode] = useState<"local" | "remote">("local")

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scan, setScan] = useState<DevScan | null>(null)
  const [legacy, setLegacy] = useState<LegacyAnalysis | null>(null)
  const [history, setHistory] = useState<DevScan[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)

  const loadHistory = useCallback(async () => {
    if (!token || !currentOrg) {
      setHistoryLoading(false)
      return
    }
    try {
      const scans = await api.listScans(token, currentOrg.id).catch(() => [] as DevScan[])
      setHistory(scans)
    } finally {
      setHistoryLoading(false)
    }
  }, [token, currentOrg])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const runPasteAnalysis = async () => {
    if (!code.trim()) {
      setError(t.errors.empty_code)
      return
    }
    if (!token || !currentOrg) {
      setError(t.auth.err_generic)
      return
    }
    setLoading(true)
    setError(null)
    setScan(null)
    setLegacy(null)
    try {
      const result = await api.devAnalyze({ source: code, language }, token, currentOrg.id)
      setScan(result)
      setHistory((prev) => [result, ...prev.filter((s) => s.id !== result.id)].slice(0, 20))
    } catch (e) {
      const msg = extractError(e, t.errors.network_error)
      setError(msg)
      toast.error(t.errors.scan_failed, msg)
    } finally {
      setLoading(false)
    }
  }

  const runLegacyScan = async (payload: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    setScan(null)
    setLegacy(null)
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t.errors.scan_failed)
      setLegacy(data)
    } catch (e) {
      const msg = extractError(e, t.errors.scan_failed)
      setError(msg)
      toast.error(t.errors.scan_failed, msg)
    } finally {
      setLoading(false)
    }
  }

  const ruleMatches: RuleMatch[] = scan
    ? scan.issues.map((i) => ({
        rule_id: i.ruleId ?? undefined,
        severity: i.severity,
        category: i.category ?? undefined,
        message: i.message,
        suggestion: i.suggestion ?? undefined,
        line_number: i.lineNumber ?? undefined,
        column: i.columnStart ?? undefined,
        end_column: i.columnEnd ?? undefined,
        code_snippet: i.codeSnippet ?? undefined,
        file: i.filePath ?? undefined,
      }))
    : legacy?.rules?.map((r) => ({
        rule_id: r.rule_id,
        rule_name: r.rule_name,
        severity: r.severity,
        category: r.category,
        message: r.message,
        suggestion: r.suggestion,
        line_number: r.line_number,
        file: r.file,
      })) ?? []

  const issuesCount =
    scan?.issues.length ?? legacy?.issues_found ?? legacy?.rules?.length ?? 0

  const lines =
    scan?.linesAnalyzed ?? legacy?.metrics?.lines_of_code ?? 0
  const complexity =
    scan?.metrics?.cyclomatic_complexity ?? legacy?.metrics?.cyclomatic_complexity ?? 0
  const maintainability =
    scan?.metrics?.maintainability_index ?? legacy?.metrics?.maintainability_index ?? 100

  const hasResults = !!scan || !!legacy

  const tabItems: {
    id: Tab
    label: string
    icon: LucideIcon
    title: string
    description: string
  }[] = [
    {
      id: "paste",
      label: t.tabs.paste,
      icon: Code2,
      title: t.paste.title,
      description: "",
    },
    {
      id: "project",
      label: t.tabs.project,
      icon: FolderOpen,
      title: t.project.title,
      description: t.project.description,
    },
    {
      id: "git",
      label: t.tabs.git,
      icon: GitBranch,
      title: t.git.title,
      description: t.git.description,
    },
  ]
  const activeTab = tabItems.find((item) => item.id === tab) ?? tabItems[0]

  return (
    <div className="space-y-6">
      <section className="hero-gradient relative overflow-hidden rounded-2xl p-6 text-white md:p-8">
        <div className="pointer-events-none absolute -end-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-28 end-32 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-hero flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">{t.platform.dev}</p>
            <h2 className="mt-1 text-2xl font-extrabold leading-tight md:text-3xl">
              {t.dev.title}
              <span className="ms-3 align-middle text-xs font-semibold uppercase tracking-widest text-white/60">TechVerse</span>
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/85 md:text-base">{t.dev.subtitle}</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20">
            <ScanSearch className="h-6 w-6" />
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSettings((v) => !v)}
              className="text-white/80 hover:bg-white/10 hover:text-white"
            >
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">{t.dev.settings}</span>
            </Button>
          </div>
        </div>
      </section>

      <AnalysisSettingsCard
        open={showSettings}
        onClose={() => setShowSettings(false)}
        token={token}
        orgId={currentOrg?.id}
        t={t}
      />

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div
          role="tablist"
          aria-label={t.dev.analyze}
          className="mb-5 grid w-full grid-cols-3 gap-1 rounded-xl border border-border bg-muted p-1"
        >
          {tabItems.map((item) => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab === item.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          ))}
        </div>

        <div>
          <h3 className="text-base font-semibold">{activeTab.title}</h3>
          {activeTab.description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{activeTab.description}</p>
          )}

          {tab === "paste" && (
            <div>
              <div className="mb-3 mt-4 flex flex-wrap items-center justify-between gap-3">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="dev-language">
                  {t.paste.language_label}
                </label>
                <div className="w-full sm:w-48">
                  <select
                    id="dev-language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="input h-10 cursor-pointer"
                  >
                    {Object.entries(t.paste.languages).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t.paste.placeholder}
                className="code-textarea w-full rounded-lg border border-border bg-background p-3 focus:outline-none focus:ring-2 focus:ring-ring"
                rows={12}
              />
              <div className="mt-4 flex justify-end">
                <Button onClick={runPasteAnalysis} disabled={loading} size="lg">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.paste.analyzing}
                    </>
                  ) : (
                    <>
                      <ScanSearch className="h-4 w-4" />
                      {t.paste.analyze}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {tab === "project" && (
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="dev-path">
                {t.project.path_label}
              </label>
              <input
                id="dev-path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder={t.project.path_placeholder}
                className="input mb-4"
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => path.trim() && runLegacyScan({ project_path: path.trim() })}
                  disabled={loading || !path.trim()}
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.project.scanning}
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      {t.project.scan}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {tab === "git" && (
            <div className="mt-4">
              <div className="mb-4 flex w-fit gap-1 rounded-lg border border-border bg-muted p-1">
                <button
                  onClick={() => setGitMode("local")}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-1 text-sm font-semibold transition-colors",
                    gitMode === "local" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.git.local_tab}
                </button>
                <button
                  onClick={() => setGitMode("remote")}
                  className={cn(
                    "cursor-pointer rounded-md px-3 py-1 text-sm font-semibold transition-colors",
                    gitMode === "remote" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.git.remote_tab}
                </button>
              </div>
              {gitMode === "local" ? (
                <input
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder={t.git.local_placeholder}
                  className="input mb-4"
                />
              ) : (
                <input
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder={t.git.remote_placeholder}
                  className="input mb-4"
                />
              )}
              <div className="flex justify-end">
                <Button
                  onClick={() => runLegacyScan(gitMode === "local" ? { git_path: path.trim() } : { git_url: gitUrl.trim() })}
                  disabled={loading || !(gitMode === "local" ? path.trim() : gitUrl.trim())}
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.git.analyzing}
                    </>
                  ) : (
                    <>
                      <GitBranch className="h-4 w-4" />
                      {t.git.analyze}
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {loading ? (
            <ResultsSkeleton />
          ) : hasResults ? (
            <>
              {legacy?.repo && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <InfoCard label={t.git_results.branch} value={legacy.repo.branch ?? "—"} />
                  <InfoCard label={t.git_results.total_commits} value={legacy.repo.total_commits ?? 0} />
                  <InfoCard label={t.git_results.tracked_files} value={legacy.repo.tracked_files ?? 0} />
                  <InfoCard
                    label={t.git_results.repo_status}
                    value={
                      legacy.repo.status === "clean" ? (
                        <span className="text-success">{t.git_results.clean}</span>
                      ) : (
                        <span className="text-danger">{t.git_results.dirty}</span>
                      )
                    }
                  />
                </div>
              )}

              <AnalysisResultsView
                metrics={{ cyclomatic_complexity: complexity, maintainability_index: maintainability, lines_of_code: lines }}
                rules={ruleMatches}
                success={legacy ? legacy.success !== false : true}
                issuesCount={issuesCount}
                durationMs={scan?.durationMs ?? undefined}
              />
            </>
          ) : (
            <EmptyState icon={ScanSearch} title={t.dev.scan_now} description={t.dev.subtitle} />
          )}
        </div>

        <aside className="space-y-3">
          <DebtTrendCard token={token} orgId={currentOrg?.id} t={t} />

          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{t.dev.recent_scans}</h3>
          </div>

          {historyLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : history.length === 0 ? (
            <EmptyState icon={ScanSearch} title={t.dev.no_issues} description={t.dev.subtitle} className="px-4 py-8" />
          ) : (
            <div className="space-y-2">
              {history.slice(0, 8).map((s) => {
                const StatusIcon =
                  s.status === "SUCCESS" ? CircleCheck : s.status === "FAILED" ? CircleAlert : Loader2
                return (
                  <Link
                    key={s.id}
                    href={`/dashboard/dev/issues?scan=${encodeURIComponent(s.id)}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm card-hover"
                  >
                    <StatusIcon
                      className={
                        s.status === "SUCCESS"
                          ? "h-4 w-4 shrink-0 text-success"
                          : s.status === "FAILED"
                            ? "h-4 w-4 shrink-0 text-danger"
                            : "h-4 w-4 shrink-0 animate-spin text-warning"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {s.project?.name ?? s.repository?.name ?? t.dev.inline}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(s.linesAnalyzed ?? 0).toLocaleString(locale)} LOC · {s.issues?.length ?? 0} {t.platform.issues}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(s.createdAt, locale)}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}