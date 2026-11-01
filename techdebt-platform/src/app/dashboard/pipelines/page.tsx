"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { io } from "socket.io-client"
import { GitBranch, Loader2, Play, Plus, RefreshCw, Trash2, Workflow, Zap } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, wsOrigin, type GitRepository, type Pipeline, type RunStatus } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn, timeAgo } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"

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

export default function PipelinesPage() {
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [repos, setRepos] = useState<GitRepository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Pipeline | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)

  const role = currentOrg?.role ?? "VIEWER"
  const canCreate = role === "MANAGER" || role === "ADMIN" || role === "OWNER"
  const canRun = role !== "VIEWER"

  const load = useCallback(async () => {
    if (!token || !currentOrg) {
      setLoading(false)
      return
    }
    try {
      setPipelines(await api.listPipelines(token, currentOrg.id))
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!token || !currentOrg) return
    api
      .gitListRepositories(token, currentOrg.id)
      .then(setRepos)
      .catch(() => {
        /* ignore */
      })
  }, [token, currentOrg])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1" && canCreate) {
      setShowCreate(true)
    }
  }, [canCreate])

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

  const handleRun = async (p: Pipeline) => {
    if (!token || !currentOrg) return
    setRunningId(p.id)
    try {
      await api.triggerPipelineRun(token, currentOrg.id, p.id, {})
      toast.success(t.pipeline.run_triggered)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setRunningId(null)
    }
  }

  const handleDelete = async () => {
    if (!token || !currentOrg || !confirmDelete) return
    setDeleting(true)
    try {
      await api.deletePipeline(token, currentOrg.id, confirmDelete.id)
      toast.success(t.pipeline.deleted)
      setConfirmDelete(null)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.pipeline.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.pipeline.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5 me-1.5" />
            {t.repo.refresh}
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 me-1.5" />
              {t.pipeline.create}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : pipelines.length === 0 ? (
        <EmptyState
          icon={Workflow}
          title={t.pipeline.title}
          description={t.pipeline.empty}
          action={
            canCreate ? (
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5 me-1.5" />
                {t.pipeline.create}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pipelines.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Workflow className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <Link href={`/dashboard/pipelines/${p.id}`} className="block truncate text-sm font-semibold hover:text-primary">
                      {p.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{p.description || t.pipeline.runs}</p>
                  </div>
                </div>
                <Badge variant={p.status === "active" ? "success" : "outline"}>
                  {p.status === "active" ? t.pipeline.active : t.pipeline.disabled}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {p.repository && (
                  <Badge variant="secondary" className="gap-1">
                    <GitBranch className="h-3 w-3" />
                    {p.repository.name}
                  </Badge>
                )}
                <Badge variant="secondary">
                  {p.trigger === "push" ? (
                    <Zap className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                  {p.trigger === "push" ? t.pipeline.trigger_push : t.pipeline.trigger_manual}
                </Badge>
                <Badge variant="secondary">{p.steps.length} {t.pipeline.steps_label}</Badge>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs">
                <div className="min-w-0">
                  {p.lastRun ? (
                    <div className="flex items-center gap-1.5">
                      <Badge variant={RUN_VARIANT[p.lastRun.status]}>
                        {p.lastRun.status === "SUCCESS"
                          ? t.pipeline.success
                          : p.lastRun.status === "FAILED"
                            ? t.pipeline.failed
                            : p.lastRun.status === "RUNNING"
                              ? t.pipeline.running
                              : p.lastRun.status === "CANCELLED"
                                ? t.pipeline.cancelled
                                : t.pipeline.queued}
                      </Badge>
                      <span className="truncate text-muted-foreground">{timeAgo(p.lastRun.createdAt, locale)}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">{t.pipeline.never}</span>
                  )}
                </div>
                {canRun && (
                  <Button
                    size="sm"
                    variant={p.lastRun?.status === "RUNNING" ? "outline" : "secondary"}
                    disabled={runningId === p.id || p.lastRun?.status === "RUNNING"}
                    onClick={() => handleRun(p)}
                  >
                    {runningId === p.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>

              {canCreate && (
                <div className="flex items-center justify-end gap-1 border-t border-border/60 pt-2">
                  <Link href={`/dashboard/pipelines/${p.id}`} className="text-xs font-medium text-primary hover:underline">
                    {t.pipeline.runs}
                  </Link>
                  <span className="text-border">/</span>
                  <Tooltip tip={t.pipeline.delete}>
                    <button
                      onClick={() => setConfirmDelete(p)}
                      aria-label={t.pipeline.delete}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {repos.length > 0 && (
        <CreatePipelineModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          repos={repos}
          onCreated={() => {
            toast.success(t.pipeline.created)
            setShowCreate(false)
            load()
          }}
        />
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete ? `${t.pipeline.delete}: ${confirmDelete.name}` : ""}
        closeLabel={t.platform.close}
        footer={<>
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>
            {t.platform.cancel}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t.pipeline.delete}
          </Button>
        </>}
      >
        <p className="text-sm text-muted-foreground">{t.pipeline.delete_confirm}</p>
      </Modal>
    </div>
  )
}

function CreatePipelineModal({
  open,
  onClose,
  repos,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  repos: GitRepository[]
  onCreated: () => void
}) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [repositoryId, setRepositoryId] = useState(repos[0]?.id ?? "")
  const [trigger, setTrigger] = useState<"manual" | "push">("push")
  const [branch, setBranch] = useState("main")
  const [steps, setSteps] = useState([{ name: "Install dependencies", command: "npm ci" }])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open && !repositoryId && repos[0]) setRepositoryId(repos[0].id)
  }, [open, repos, repositoryId])

  const canSubmit = name.trim() && repositoryId && steps.length > 0 && steps.every((s) => s.name.trim() && s.command.trim()) && !busy

  const submit = async () => {
    if (!token || !currentOrg || !canSubmit) return
    setBusy(true)
    try {
      await api.createPipeline(
        {
          repositoryId,
          name: name.trim(),
          description: description.trim() || undefined,
          trigger,
          branch: branch.trim() || "main",
          steps,
        },
        token,
        currentOrg.id
      )
      setName("")
      setDescription("")
      setTrigger("push")
      setBranch("main")
      setSteps([{ name: "Install dependencies", command: "npm ci" }])
      onCreated()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.pipeline.new_pipeline}
      description={t.pipeline.subtitle}
      closeLabel={t.platform.close}
      size="lg"
      footer={<>
        <Button variant="outline" onClick={onClose}>
          {t.platform.cancel}
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t.pipeline.create}
        </Button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.pipeline.name}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.pipeline.name_placeholder} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.pipeline.branch}</label>
            <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder={t.pipeline.branch_placeholder} className="input" />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.pipeline.repository}</label>
          <select value={repositoryId} onChange={(e) => setRepositoryId(e.target.value)} className="input h-10 cursor-pointer">
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.pipeline.trigger}</label>
          <div className="flex items-center gap-2">
            {(
              [
                ["manual", t.pipeline.trigger_manual],
                ["push", t.pipeline.trigger_push],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTrigger(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                  trigger === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                )}
              >
                {value === "push" ? <Zap className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.pipeline.description}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.pipeline.description_placeholder}
            rows={2}
            className="input resize-none"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">{t.pipeline.steps}</label>
            <button
              onClick={() => setSteps((s) => [...s, { name: "", command: "" }])}
              className="text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              {t.pipeline.add_step}
            </button>
          </div>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                <input
                  value={step.name}
                  onChange={(e) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  placeholder={t.pipeline.step_name}
                  className="input min-w-0 flex-1"
                />
                <input
                  value={step.command}
                  onChange={(e) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, command: e.target.value } : x)))}
                  placeholder={t.pipeline.step_command}
                  className="input min-w-0 flex-1"
                  dir="ltr"
                />
                <button
                  onClick={() => setSteps((s) => s.filter((_, j) => j !== i))}
                  aria-label={t.pipeline.remove_step}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}