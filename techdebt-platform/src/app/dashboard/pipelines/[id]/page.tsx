"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { io } from "socket.io-client"
import { ArrowLeft, Ban, ChevronDown, ChevronRight, GitBranch, Loader2, Play, RefreshCw, Terminal, Workflow, Zap } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, wsOrigin, type Pipeline, type PipelineRun, type RunStatus } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn, timeAgo } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message)
  return "Error"
}

const RUN_VARIANT: Record<RunStatus, "default" | "secondary" | "outline" | "success" | "warning" | "danger" | "info"> = {
  QUEUED: "secondary",
  RUNNING: "info",
  SUCCESS: "success",
  FAILED: "danger",
  CANCELLED: "outline",
}

function runLabel(s: RunStatus, t: Record<string, string>): string {
  switch (s) {
    case "SUCCESS":
      return t.success
    case "FAILED":
      return t.failed
    case "RUNNING":
      return t.running
    case "CANCELLED":
      return t.cancelled
    default:
      return t.queued
  }
}

function StepDot({ status }: { status: RunStatus }) {
  return (
    <span
      className={cn(
        "h-2.5 w-2.5 shrink-0 rounded-full",
        status === "SUCCESS" && "bg-success",
        status === "FAILED" && "bg-danger",
        status === "RUNNING" && "bg-info animate-pulse",
        status === "QUEUED" && "bg-muted-foreground",
        status === "CANCELLED" && "bg-border"
      )}
    />
  )
}

export default function PipelineDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()
  const [pipeline, setPipeline] = useState<(Pipeline & { runs: PipelineRun[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pipelineExpanded, setPipelineExpanded] = useState(false)

  const role = currentOrg?.role ?? "VIEWER"
  const canRun = role !== "VIEWER"
  const canManage = role === "MANAGER" || role === "ADMIN" || role === "OWNER"

  const load = useCallback(async () => {
    if (!token || !currentOrg || !id) {
      setLoading(false)
      return
    }
    try {
      setPipeline(await api.getPipeline(token, currentOrg.id, id))
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg, id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!token || !currentOrg) return
    const socket = io(wsOrigin(), {
      auth: { token, organizationId: currentOrg.id },
      transports: ["websocket"],
    })
    socket.on("pipeline:updated", () => load())
    return () => {
      socket.disconnect()
    }
  }, [token, currentOrg, load])

  const handleRun = async () => {
    if (!token || !currentOrg || !pipeline) return
    setRunningId(pipeline.id)
    try {
      await api.triggerPipelineRun(token, currentOrg.id, pipeline.id, {})
      toast.success(t.pipeline.run_triggered)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setRunningId(null)
    }
  }

  const handleCancel = async (runId: string) => {
    if (!token || !currentOrg) return
    setCancellingId(runId)
    try {
      await api.cancelPipelineRun(token, currentOrg.id, runId)
      toast.success(t.pipeline.run_cancelled)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setCancellingId(null)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !pipeline) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <EmptyState icon={Workflow} title={t.pipeline.title} description={error ?? t.errors.not_found} />
        <div className="mt-4 text-center">
          <Link href="/dashboard/pipelines" className="text-sm font-medium text-primary hover:underline">
            {t.pipeline.back}
          </Link>
        </div>
      </div>
    )
  }

  const lastRun = pipeline.runs[0] ?? null

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <Link href="/dashboard/pipelines" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t.pipeline.back}
      </Link>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Workflow className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold">{pipeline.name}</h1>
                <Badge variant={pipeline.status === "active" ? "success" : "outline"}>
                  {pipeline.status === "active" ? t.pipeline.active : t.pipeline.disabled}
                </Badge>
              </div>
              {pipeline.description && <p className="mt-0.5 text-sm text-muted-foreground">{pipeline.description}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canRun && (
              <Button onClick={handleRun} disabled={runningId === pipeline.id || lastRun?.status === "RUNNING"}>
                {runningId === pipeline.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                {t.pipeline.run}
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={load} aria-label={t.repo.refresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-medium text-muted-foreground">{t.pipeline.repo_label}</p>
            <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm font-semibold">
              <GitBranch className="h-3.5 w-3.5 text-primary" />
              {pipeline.repository?.name ?? "—"} · {pipeline.branch}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-medium text-muted-foreground">{t.pipeline.trigger}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold">
              {pipeline.trigger === "push" ? <Zap className="h-3.5 w-3.5 text-primary" /> : <Play className="h-3.5 w-3.5 text-primary" />}
              {pipeline.trigger === "push" ? t.pipeline.trigger_push : t.pipeline.trigger_manual}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-medium text-muted-foreground">{t.pipeline.last_run}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              {lastRun ? (
                <>
                  <Badge variant={RUN_VARIANT[lastRun.status]}>{runLabel(lastRun.status, t.pipeline)}</Badge>
                  <span className="truncate text-sm text-muted-foreground">{timeAgo(lastRun.createdAt, locale)}</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">{t.pipeline.never}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {canManage && (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <button
            onClick={() => setPipelineExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-start cursor-pointer"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Terminal className="h-4 w-4 text-primary" />
              {t.pipeline.steps} ({pipeline.steps.length})
            </span>
            {pipelineExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />}
          </button>
          {pipelineExpanded && (
            <div className="space-y-1.5 border-t border-border/60 px-5 py-4">
              {pipeline.steps.map((s, i) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground" dir="ltr">{s.command}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            {t.pipeline.runs_title}
            <Badge variant="secondary">{pipeline.runs.length}</Badge>
          </h2>
          <Badge variant="secondary">
            {pipeline.runs.length > 0
              ? `${pipeline.runs.reduce((a, r) => a + (r.durationMs ?? 0), 0) / 1000}s`
              : t.pipeline.never}
          </Badge>
        </div>

        {pipeline.runs.length === 0 ? (
          <EmptyState icon={Workflow} title={t.pipeline.runs_title} description={t.pipeline.no_runs} className="border-0 bg-transparent" />
        ) : (
          <div className="max-h-[480px] divide-y divide-border overflow-y-auto">
            {pipeline.runs.map((run) => {
              const isExpanded = expanded === run.id
              const isRunning = run.status === "RUNNING"
              return (
                <div key={run.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setExpanded(isExpanded ? null : run.id)}>
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4 rtl:rotate-180" />}
                    </Button>
                    <Badge variant={RUN_VARIANT[run.status]} dot dotClassName={run.status === "RUNNING" ? "animate-pulse" : undefined}>
                      {runLabel(run.status, t.pipeline)}
                    </Badge>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <span className="font-medium">#{run.branch}</span>
                        {run.commitSha && <span className="ms-2 font-mono text-xs text-muted-foreground">{run.commitSha.slice(0, 7)}</span>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.pipeline.triggered_by} {run.createdBy?.fullName ?? run.createdBy?.email ?? "—"} · {timeAgo(run.createdAt, locale)}
                        {run.durationMs ? ` · ${(run.durationMs / 1000).toFixed(1)}s` : ""}
                      </p>
                    </div>
                    {isRunning && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancel(run.id)}
                        disabled={cancellingId === run.id}
                      >
                        {cancellingId === run.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                        {t.pipeline.cancel}
                      </Button>
                    )}
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 ps-10">
                      {run.steps.map((step, i) => (
                        <div key={step.id ?? i} className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <StepDot status={step.status} />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{step.name}</span>
                            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                              {step.durationMs ? `${(step.durationMs / 1000).toFixed(1)}s` : ""}
                            </span>
                            <Badge variant={RUN_VARIANT[step.status]}>{runLabel(step.status, t.pipeline)}</Badge>
                          </div>
                          {step.command && (
                            <p className="mt-1.5 truncate font-mono text-[11px] text-muted-foreground" dir="ltr">
                              $ {step.command}
                            </p>
                          )}
                          {step.output && (
                            <pre className="mt-2 max-h-28 overflow-auto rounded-md bg-muted px-2.5 py-2 text-[11px] leading-relaxed text-card-foreground" dir="ltr">
                              {step.output}
                            </pre>
                          )}
                        </div>
                      ))}
                      {run.steps.length === 0 && <p className="text-xs text-muted-foreground">{t.pipeline.no_runs}</p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}