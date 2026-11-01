"use client"

import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  FileCode2,
  HeartPulse,
  ScanSearch,
  ShieldAlert,
  Wrench,
} from "lucide-react"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import { SEVERITY_ORDER, SeverityBadge, severityLabel } from "@/components/ui/severity-badge"

export interface RuleMatch {
  rule_id?: string
  rule_name?: string
  severity: string
  category?: string
  message: string
  suggestion?: string
  line_number?: number
  column?: number
  end_column?: number
  code_snippet?: string
  codeSnippet?: string
  file?: string
}

export interface AnalysisMetrics {
  cyclomatic_complexity: number
  maintainability_index: number
  lines_of_code: number
}

interface AnalysisResultsViewProps {
  metrics?: AnalysisMetrics
  rules?: RuleMatch[]
  durationMs?: number
  success?: boolean
  issuesCount?: number
}

const BAR_COLORS: Record<string, string> = {
  CRITICAL: "bg-danger",
  HIGH: "bg-warning",
  MEDIUM: "bg-info",
  LOW: "bg-success",
  INFO: "bg-muted-foreground",
}

export function AnalysisResultsView({
  metrics,
  rules = [],
  durationMs,
  success = true,
  issuesCount,
}: AnalysisResultsViewProps) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const total = issuesCount ?? rules.length

  const severityCounts = useMemo(
    () =>
      SEVERITY_ORDER.map((sev) => ({
        sev,
        count: rules.filter((r) => r.severity.toUpperCase() === sev).length,
      })),
    [rules]
  )
  const visible = severityCounts.filter((c) => c.count > 0)
  const visibleTotal = visible.reduce((sum, c) => sum + c.count, 0)

  const copy = async (suggestion: string, key: string) => {
    try {
      await navigator.clipboard.writeText(suggestion)
      setCopiedKey(key)
      toast.success(t.results.suggestion_copied)
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1600)
    } catch {
      toast.error(t.errors.network_error)
    }
  }

  if (!success && rules.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
        <CircleAlert className="h-4 w-4 shrink-0" />
        {t.ai.analysis_failed}
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">{t.results.title}</h3>
        <div className="flex items-center gap-2">
          {durationMs != null && (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {durationMs}ms
            </span>
          )}
          <Badge variant={total > 0 ? "danger" : "success"} dot>
            {total} {t.platform.issues}
          </Badge>
        </div>
      </div>

      {metrics && (
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard
            icon={<FileCode2 className="h-4 w-4" />}
            label={t.results.lines_of_code}
            value={metrics.lines_of_code.toLocaleString(locale)}
            hint={t.dev.code_health}
          />
          <StatCard
            icon={<ScanSearch className="h-4 w-4" />}
            label={t.results.cyclomatic_complexity}
            value={metrics.cyclomatic_complexity.toFixed(1)}
            hint={t.dev.complexity}
          />
          <StatCard
            icon={<HeartPulse className="h-4 w-4" />}
            label={t.results.maintainainability_index}
            value={
              <span
                className={cn(
                  metrics.maintainability_index >= 85
                    ? "text-success"
                    : metrics.maintainability_index >= 60
                      ? "text-warning"
                      : "text-danger"
                )}
              >
                {metrics.maintainability_index.toFixed(1)}
              </span>
            }
            hint={t.dev.maintainability}
          />
          <StatCard
            icon={total > 0 ? <AlertTriangle className="h-4 w-4" /> : <CircleCheck className="h-4 w-4" />}
            label={t.results.issues_found}
            value={<span className={total > 0 ? "text-danger" : "text-success"}>{total}</span>}
            hint={total > 0 ? t.platform.issues : t.dev.no_issues}
          />
        </div>
      )}

      {visibleTotal > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">{t.results.rules_triggered}</h4>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </div>
          <div
            className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${t.results.rules_triggered}: ${visible.map((c) => `${severityLabel(c.sev, t)} ${c.count}`).join(", ")}`}
          >
            {visible.map((c) => (
              <span
                key={c.sev}
                className={cn("h-full transition-all", BAR_COLORS[c.sev])}
                style={{ width: `${(c.count / visibleTotal) * 100}%` }}
              />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {visible.map((c) => (
              <span key={c.sev} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", BAR_COLORS[c.sev])} />
                <span className="font-semibold text-foreground">{severityLabel(c.sev, t)}</span>
                <span>{c.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold">{t.dev.issues_title}</h4>
          <Badge variant={total > 0 ? "danger" : "success"} dot>
            {total}
          </Badge>
        </div>

        {rules.length > 0 ? (
          <div className="space-y-3">
            {rules.map((rule, i) => {
              const key = `${rule.rule_id ?? rule.message}-${i}`
              return (
                <div key={key} className="rounded-xl border border-border bg-card p-4 shadow-sm card-hover">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <SeverityBadge severity={rule.severity} t={t} />
                      {rule.file && (
                        <span className="max-w-full truncate font-mono text-xs text-muted-foreground">
                          {rule.file}
                        </span>
                      )}
                    </div>
                    {rule.line_number != null && (
                      <span className="inline-flex shrink-0 items-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                        {t.results.line} {rule.line_number}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm">{rule.message}</p>
                  {(() => {
                    const snippet = (rule.code_snippet ?? rule.codeSnippet ?? "").trimEnd()
                    if (!snippet) return null
                    const start = rule.column ?? null
                    const end = rule.end_column ?? null
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
                        {rule.line_number != null && (
                          <span className="select-none border-e border-border px-2 py-1 text-end font-mono text-[11px] leading-relaxed text-muted-foreground">
                            {rule.line_number}
                          </span>
                        )}
                        <pre className="flex-1 overflow-x-auto px-2 py-1 font-mono text-[11px] leading-relaxed text-foreground/90">
                          {before}
                          {highlight && <mark className="rounded-sm bg-danger/20 text-foreground">{highlight}</mark>}
                          {after}
                        </pre>
                      </div>
                    )
                  })()}
                  {(rule.rule_id || rule.category || rule.rule_name) && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5">
                      {rule.rule_id && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          <Wrench className="h-3 w-3" />
                          {rule.rule_id}
                        </Badge>
                      )}
                      {rule.rule_name && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {rule.rule_name}
                        </Badge>
                      )}
                      {rule.category && (
                        <Badge variant="secondary" className="text-[10px]">
                          {rule.category}
                        </Badge>
                      )}
                    </div>
                  )}
                  {!!rule.suggestion && (
                    <div className="mt-3 flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-muted-foreground">{t.results.suggestion}</p>
                        <p className="mt-1 whitespace-pre-wrap font-mono text-xs leading-relaxed">{rule.suggestion}</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => copy(rule.suggestion as string, key)}
                        className="shrink-0"
                      >
                        {copiedKey === key ? (
                          <Check className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {t.results.copy_suggestion}
                      </Button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <EmptyState
            icon={CircleCheck}
            title={t.results.no_issues}
            description={t.dev.no_issues}
            className="px-4 py-10"
          />
        )}
      </div>
    </section>
  )
}