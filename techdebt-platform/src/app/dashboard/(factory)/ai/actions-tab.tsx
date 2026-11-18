"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ArrowRight,
  Braces,
  CheckCircle2,
  Copy,
  FileCode2,
  FileDiff,
  FilePenLine,
  GitBranch,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import {
  api,
  type AiActionDef,
  type AiActionRun,
  type AiProvider,
} from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn, timeAgo } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Modal } from "@/components/ui/modal"
import { Skeleton } from "@/components/ui/skeleton"

function uiErr(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "object" && e !== null && "message" in e)
    return String((e as { message: unknown }).message)
  return "Error"
}

const KIND_ORDER: Record<string, number> = {
  optimize_dockerfile: 0,
  optimize_pipeline: 1,
  fix_scan_issues: 2,
  explain_code: 3,
}

const KIND_ICON: Record<string, typeof Wand2> = {
  optimize_dockerfile: FileCode2,
  optimize_pipeline: GitBranch,
  fix_scan_issues: FileDiff,
  explain_code: FilePenLine,
}

type RunUi = {
  def: AiActionDef
  providerId: string
  model: string
  input: Record<string, string>
  busy: boolean
}

type Props = {
  providers?: AiProvider[]
  onRunCount?: (n: number) => void
}

export function AiActionsTab({ providers = [], onRunCount }: Props) {
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const aa = t.ai_actions
  const toast = useToast()

  const [catalog, setCatalog] = useState<AiActionDef[]>([])
  const [runs, setRuns] = useState<AiActionRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runUi, setRunUi] = useState<RunUi | null>(null)
  const [preview, setPreview] = useState<AiActionRun | null>(null)
  const [applying, setApplying] = useState<string | null>(null)

  const activeProvider = providers.find((p) => p.status === "active")

  const load = useCallback(async () => {
    if (!token || !currentOrg) return
    setError(null)
    try {
      const [defs, runList, cat] = await Promise.all([
        api.listAiActionCatalog(token, currentOrg.id),
        api.listAiActionRuns(token, currentOrg.id),
        api.listAiActionCatalog(token, currentOrg.id),
      ])
      setCatalog(cat)
      setRuns(runList)
      setLoading(false)
    } catch (e) {
      setError(uiErr(e))
      setLoading(false)
    }
  }, [token, currentOrg])

  useEffect(() => {
    void load()
  }, [load])

  const sorted = useMemo(
    () =>
      [...catalog].sort(
        (a, b) => (KIND_ORDER[a.key] ?? 99) - (KIND_ORDER[b.key] ?? 99)
      ),
    [catalog]
  )

  const defName = (d: AiActionDef) => aa.action_name[d.key] ?? d.key
  const defDesc = (d: AiActionDef) => aa.action_desc[d.key] ?? d.key

  const openRun = (d: AiActionDef) => {
    if (!activeProvider) {
      toast.error(aa.no_provider)
      return
    }
    setPreview(null)
    setRunUi({
      def: d,
      providerId: activeProvider.id,
      model: activeProvider.defaultModel ?? "",
      input: {},
      busy: false,
    })
  }

  const startRun = async () => {
    if (!runUi || runUi.busy || !token || !currentOrg) return
    setRunUi({ ...runUi, busy: true })
    try {
      const run = await api.runAiAction(
        { action: runUi.def.key, input: runUi.input },
        token,
        currentOrg.id
      )
      setPreview(run)
      setRunUi(null)
      void load()
    } catch (e) {
      toast.error(uiErr(e))
      setRunUi((r) => (r ? { ...r, busy: false } : r))
    }
  }

  const applyRun = async (r: AiActionRun) => {
    if (!token || !currentOrg || r.applied || applying === r.id) return
    setApplying(r.id)
    try {
      await api.applyAiActionRun(token, currentOrg.id, r.id)
      toast.success(aa.applied)
      setApplying(null)
      void load()
    } catch (e) {
      toast.error(uiErr(e))
      setApplying(null)
    }
  }

  const champ = (v: unknown) =>
    typeof v === "string"
      ? v
      : v !== null && typeof v === "object"
      ? JSON.stringify(v)
      : String(v ?? "")

  const renderField = (d: AiActionDef) => {
    const k = d.key
    if (k === "explain_code")
      return (
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {aa.language_label}
          </label>
          <select
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            value={runUi?.input?.language ?? ""}
            onChange={(e) =>
              setRunUi((s) =>
                s
                  ? { ...s, input: { ...s.input, language: e.target.value } }
                  : s
              )
            }
          >
            {["python", "javascript", "typescript", "go", "rust", "java", "c", "cpp"].map(
              (l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              )
            )}
          </select>
        </div>
      )
    return (
      <div className="grid gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {k === "fix_scan_issues" ? aa.issue_count : aa.steps_label}
        </label>
        <textarea
          className="min-h-24 w-full rounded-lg border border-border bg-background p-2.5 text-sm"
          placeholder={
            k === "fix_scan_issues"
              ? aa.issue_count
              : aa.steps_placeholder
          }
          value={runUi?.input?.steps ?? ""}
          onChange={(e) =>
            setRunUi((s) =>
              s ? { ...s, input: { ...s.input, steps: e.target.value } } : s
            )
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{aa.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{aa.subtitle}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className="me-1.5 h-3.5 w-3.5" />
          {aa.refresh}
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {!loading && !activeProvider && (
        <EmptyState
          icon={Braces}
          title={aa.title}
          description={aa.no_provider}
        />
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {sorted.map((d) => {
              const Icon = KIND_ICON[d.key] ?? Wand2
              return (
                <div
                  key={d.key}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{defName(d)}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {defDesc(d)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                    <span className="text-xs text-muted-foreground">
                      {aa.available}
                    </span>
                    <Button size="sm" onClick={() => openRun(d)}>
                      <Play className="me-1.5 h-3.5 w-3.5" />
                      {aa.run}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {runs.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {aa.runs}
              </h3>
              <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                {runs.map((r) => {
                  const Applying = applying === r.id
                  return (
                    <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{aa.action_name[r.action] ?? r.action}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.status} {"·"} {timeAgo(r.createdAt, locale)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.status === "failed" ? (
                          <Badge variant="danger">{aa.status_failed}</Badge>
                        ) : r.applied ? (
                          <Badge variant="success">{aa.applied}</Badge>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" onClick={() => setPreview(r)}>
                              {aa.preview}
                            </Button>
                            <Button size="sm" disabled={Applying} onClick={() => applyRun(r)}>
                              {Applying ? (
                                <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="me-1.5 h-3.5 w-3.5" />
                              )}
                              {aa.apply}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </>
      )}

      {runUi && (
        <Modal
          open
          onClose={() => setRunUi(null)}
          title={defName(runUi.def)}
          description={defDesc(runUi.def)}
        >
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{aa.provider}</label>
              <select
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                value={runUi.providerId}
                onChange={(e) =>
                  setRunUi({ ...runUi, providerId: e.target.value })
                }
              >
                {providers
                  .filter((p) => p.status === "active" || p.id === runUi.providerId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">{aa.model}</label>
              <select
                className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                value={runUi.model}
                onChange={(e) => setRunUi({ ...runUi, model: e.target.value })}
              >
                {(activeProvider?.models ?? []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            { (runUi.def.key === "optimize_pipeline" || runUi.def.key === "fix_scan_issues" || runUi.def.key === "explain_code") &&
              renderField(runUi.def) }
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRunUi(null)}>
                {aa.cancel}
              </Button>
              <Button disabled={runUi.busy} onClick={() => void startRun()}>
                {runUi.busy ? (
                  <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="me-1.5 h-3.5 w-3.5" />
                )}
                {runUi.busy ? aa.running : aa.run_now}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {preview && (
        <Modal
          open
          onClose={() => setPreview(null)}
          title={aa.preview}
          description={aa.run_by + " " + (preview.action ?? "")}
        >
          <div className="space-y-4">
            <pre className="max-h-72 overflow-auto rounded-lg border border-border bg-muted/50 p-3 text-xs">
              {champ(preview.output ?? preview)}
            </pre>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPreview(null)}>
                {aa.back}
              </Button>
              <Button onClick={() => { void applyRun(preview); setPreview(null) }}>
                {aa.apply}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
