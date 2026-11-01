"use client"

import { useCallback, useEffect, useState } from "react"
import { io } from "socket.io-client"
import { ChevronDown, ChevronRight, GitBranch, GitFork, GitPullRequest, Loader2, Plus, RefreshCw } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type DevIssue, type DevRepository } from "@/lib/api"
import { useI18n, type Dictionary } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Modal } from "@/components/ui/modal"
import { cn } from "@/lib/utils"

function wsOrigin(): string {
  try { return new URL(api.baseUrl).origin } catch { return "http://localhost:3001" }
}

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-danger/15 text-danger border-danger/30",
  HIGH: "bg-warning/15 text-warning border-warning/30",
  MEDIUM: "bg-primary/15 text-primary border-primary/30",
  LOW: "bg-secondary/50 text-secondary-foreground border-border",
  INFO: "bg-secondary/50 text-muted-foreground border-border",
}

const SCAN_STYLE: Record<string, string> = {
  SUCCESS: "bg-success/15 text-success border-success/30",
  RUNNING: "bg-warning/15 text-warning border-warning/30 animate-pulse",
  PENDING: "bg-secondary/50 text-secondary-foreground border-border",
  FAILED: "bg-danger/15 text-danger border-danger/30",
}

function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  if (provider === "gitlab") return <GitFork className={cn("h-5 w-5", className)} />
  if (provider === "bitbucket") return <GitPullRequest className={cn("h-5 w-5", className)} />
  return <GitBranch className={cn("h-5 w-5", className)} />
}

function sizeLabel(bytesKb: number): string {
  if (bytesKb > 1024 * 1024) return `${(bytesKb / 1024 / 1024).toFixed(1)} GB`
  if (bytesKb > 1024) return `${(bytesKb / 1024).toFixed(1)} MB`
  return `${bytesKb} KB`
}

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message)
  return "Error"
}

function timeLabel(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString()
}

export function GitTab({
  projectId,
  canManage,
}: {
  projectId: string
  canManage: boolean
}) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const [repos, setRepos] = useState<DevRepository[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showLink, setShowLink] = useState(false)
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [confirmUnlink, setConfirmUnlink] = useState<DevRepository | null>(null)
  const [unlinking, setUnlinking] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token || !currentOrg) return
    try { setRepos(await api.listRepositories(token, currentOrg.id, projectId)) }
    catch (e) { setError(errMsg(e)) }
    finally { setLoading(false) }
  }, [token, currentOrg, projectId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!token || !currentOrg) return
    const socket = io(wsOrigin(), {
      auth: { token, organizationId: currentOrg.id },
      transports: ["websocket"],
    })
    socket.on("repo:updated", () => load())
    return () => { socket.disconnect() }
  }, [token, currentOrg, load])

  const anyRunning = repos.some((r) => r.scans?.[0]?.status === "RUNNING")
  useEffect(() => {
    if (!anyRunning) return
    const id = window.setInterval(async () => {
      const fresh = await api.listRepositories(token!, currentOrg!.id, projectId).catch(() => null)
      if (fresh) {
        setRepos(fresh)
        if (!fresh.some((r) => r.scans?.[0]?.status === "RUNNING")) window.clearInterval(id)
      }
    }, 2500)
    return () => window.clearInterval(id)
  }, [anyRunning, token, currentOrg, projectId])

  const scan = async (repoId: string) => {
    if (!token || !currentOrg) return
    setScanningId(repoId)
    try { await api.scanRepository(token, currentOrg.id, repoId); await load() }
    catch (e) { setError(errMsg(e)) }
    finally { setScanningId(null) }
  }

  const unlink = async () => {
    if (!token || !currentOrg || !confirmUnlink) return
    setUnlinking(true)
    try { await api.deleteRepository(token, currentOrg.id, confirmUnlink.id); await load() }
    catch (e) { setError(errMsg(e)) }
    finally { setUnlinking(false); setConfirmUnlink(null) }
  }

  const toggleScanOnPush = async (repo: DevRepository) => {
    if (!token || !currentOrg) return
    try { await api.updateRepository(token, currentOrg.id, repo.id, { scanOnPush: !repo.scanOnPush }); await load() }
    catch (e) { setError(errMsg(e)) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">{t.repo.title}</h3>
          <p className="text-xs text-muted-foreground">{t.repo.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t.repo.refresh}
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setShowLink(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t.repo.link_repository}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-danger/50 bg-danger/10 p-4 text-sm font-medium text-danger">{error}</div>
      )}

      {!canManage && <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">{t.repo.read_only}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.platform.loading}
        </div>
      ) : repos.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={t.repo.empty}
          action={
            canManage ? (
              <Button size="sm" onClick={() => setShowLink(true)}>
                <Plus className="h-3.5 w-3.5" />
                {t.repo.link_repository}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div dir="ltr" className="space-y-3">
          {repos.map((repo) => (
            <RepoCard
              key={repo.id}
              repo={repo}
              canManage={canManage}
              expanded={expanded === repo.id}
              scanning={scanningId === repo.id}
              onToggleExpand={() => setExpanded((cur) => (cur === repo.id ? null : repo.id))}
              onScan={() => scan(repo.id)}
              onUnlink={() => setConfirmUnlink(repo)}
              onToggleScanOnPush={() => toggleScanOnPush(repo)}
              t={t}
            />
          ))}
        </div>
      )}

      {showLink && (
        <LinkRepoModal
          projectId={projectId}
          onClose={() => setShowLink(false)}
          onLinked={() => { setShowLink(false); load() }}
        />
      )}

      {confirmUnlink && (
        <Modal
          open
          onClose={() => setConfirmUnlink(null)}
          title={t.repo.unlink}
          description={confirmUnlink.name}
          footer={
            <>
              <Button variant="ghost" disabled={unlinking} onClick={() => setConfirmUnlink(null)}>{t.agile.cancel}</Button>
              <Button variant="destructive" disabled={unlinking} onClick={unlink}>
                {unlinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
                {t.repo.unlink}
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">{t.repo.confirm_unlink}</p>
          {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{error}</p>}
        </Modal>
      )}
    </div>
  )
}

function RepoCard({
  repo,
  canManage,
  expanded,
  scanning,
  onToggleExpand,
  onScan,
  onUnlink,
  onToggleScanOnPush,
  t,
}: {
  repo: DevRepository
  canManage: boolean
  expanded: boolean
  scanning: boolean
  onToggleExpand: () => void
  onScan: () => void
  onUnlink: () => void
  onToggleScanOnPush: () => void
  t: Dictionary
}) {
  const lastScan = repo.scans?.[0]

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
          <ProviderIcon provider={repo.provider} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-bold">{repo.name}</p>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">{repo.provider}</span>
            <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {repo.defaultBranch}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{repo.url ?? repo.fullPath}</p>
        </div>

        <div className="flex items-center gap-2">
          {repo.language && <span className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">{repo.language}</span>}
          {repo.sizeKb > 0 && <span className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">{sizeLabel(repo.sizeKb)}</span>}
          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", SCAN_STYLE[lastScan?.status ?? "PENDING"] ?? "")}>
            {lastScan?.status ?? "PENDING"}
          </span>
        </div>

        <Button size="sm" variant="outline" onClick={onToggleExpand} aria-expanded={expanded} aria-label={t.repo.title}>
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {lastScan && (
        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg bg-background/60 px-3 py-2 text-[11px]">
          {typeof lastScan.metrics.lines_of_code === "number" && (
            <span className="text-muted-foreground">{lastScan.metrics.lines_of_code.toLocaleString()} {t.repo.lines}</span>
          )}
          {typeof lastScan.metrics.files_scanned === "number" && (
            <span className="text-muted-foreground">{lastScan.metrics.files_scanned} {t.repo.files}</span>
          )}
          <span className={cn("font-bold", lastScan._count.issues > 0 ? "text-danger" : "text-success")}>
            {lastScan._count.issues > 0 ? `${lastScan._count.issues} ${t.repo.issues_found}` : t.repo.clean_scan}
          </span>
          {repo.lastCommitSha && <span className="ms-auto font-mono text-[10px] text-muted-foreground">{repo.lastCommitSha.slice(0, 8)}</span>}
        </div>
      )}

      {expanded && (
        <RepoDetail repo={repo} onScan={onScan} scanning={scanning} canManage={canManage} onUnlink={onUnlink} onToggleScanOnPush={onToggleScanOnPush} t={t} />
      )}
    </div>
  )
}

function RepoDetail({
  repo,
  onScan,
  scanning,
  canManage,
  onUnlink,
  onToggleScanOnPush,
  t,
}: {
  repo: DevRepository
  onScan: () => void
  scanning: boolean
  canManage: boolean
  onUnlink: () => void
  onToggleScanOnPush: () => void
  t: Dictionary
}) {
  const { token, currentOrg } = useAuth()
  const [detail, setDetail] = useState<DevRepository & { branches: string[]; commits: { sha: string; author: string; date: string; message: string }[] } | null>(null)
  const [issues, setIssues] = useState<DevIssue[]>([])
  const [copied, setCopied] = useState(false)
  const [triaging, setTriaging] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !currentOrg) return
    api.getRepository(token, currentOrg.id, repo.id).then(setDetail).catch(() => undefined)
    api.listIssues(token, currentOrg.id, repo.project?.id ?? undefined, 100).then((list) => {
      setIssues(list.filter((i) => i.filePath !== "(inline)").slice(0, 30))
    }).catch(() => undefined)
  }, [token, currentOrg, repo])

  const copyWebhook = async () => {
    if (!repo.webhookSecret) return
    const url = `${api.baseUrl}/webhooks/git/${repo.id}?secret=${repo.webhookSecret}`
    await navigator.clipboard.writeText(url).catch(() => undefined)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const triage = async (issueId: string) => {
    if (!token || !currentOrg || !repo.project) return
    setTriaging(issueId)
    try { await api.triageIssue(token, currentOrg.id, issueId, { projectId: repo.project.id }) }
    catch { /* ignore */ } finally { setTriaging(null) }
  }

  return (
    <div className="mt-3 grid gap-4 rounded-lg border border-border bg-background/60 p-4 lg:grid-cols-2">
      <div>
        <h4 className="text-xs font-bold text-muted-foreground">{t.repo.branches} ({detail?.branches.length ?? 0})</h4>
        {detail?.branches.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {detail.branches.map((b) => (
              <span key={b} className={cn("rounded border px-2 py-0.5 font-mono text-[10px]", b === repo.defaultBranch ? "border-primary text-primary" : "border-border text-muted-foreground")}>
                {b === repo.defaultBranch ? "●" : "○"} {b}
              </span>
            ))}
          </div>
        ) : <p className="mt-2 text-xs text-muted-foreground">…</p>}

        <h4 className="mt-4 text-xs font-bold text-muted-foreground">{t.repo.recent_commits}</h4>
        <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pe-1">
          {detail?.commits.map((c) => (
            <div key={c.sha} className="flex items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-primary/60" />
              <div className="min-w-0">
                <p className="truncate text-xs">{c.message}</p>
                <p className="text-[10px] text-muted-foreground">
                  <span className="font-mono">{c.sha.slice(0, 7)}</span> · {c.author} · {timeLabel(c.date)}
                </p>
              </div>
            </div>
          ))}
          {!detail && <p className="text-xs text-muted-foreground">…</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h4 className="text-xs font-bold text-muted-foreground">{t.repo.issues}</h4>
          {issues.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">{t.repo.no_issues}</p>
          ) : (
            <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pe-1">
              {issues.map((i) => (
                <div key={i.id} className="flex items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5">
                  <span className={cn("mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold border", SEVERITY_STYLE[i.severity])}>{i.severity}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs">{i.message}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{i.filePath}{i.lineNumber ? `:${i.lineNumber}` : ""}</p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => triage(i.id)} disabled={triaging === i.id}>
                    {t.repo.triage}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-auto space-y-3">
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={onScan} disabled={scanning}>
              {scanning ? t.repo.scanning : `→ ${t.repo.scan}`}
            </Button>
            {canManage && (
              <>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={repo.scanOnPush} onChange={onToggleScanOnPush} className="accent-primary" />
                  {t.repo.scan_on_push}
                </label>
                <Button size="sm" variant="ghost" className="ms-auto text-danger hover:text-danger" onClick={onUnlink}>{t.repo.unlink}</Button>
              </>
            )}
          </div>
          {repo.webhookSecret && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground">{t.repo.webhook_url}</span>
              <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-primary">
                {api.baseUrl}/webhooks/git/{repo.id}?secret=…
              </code>
              <Button size="sm" variant="outline" onClick={copyWebhook}>{copied ? t.repo.copied : t.repo.copy}</Button>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground">
            {t.repo.last_sync}: {timeLabel(repo.lastSyncAt)} · {t.repo.latest_commit}: <span className="font-mono">{repo.lastCommitSha?.slice(0, 8) ?? t.repo.never}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function LinkRepoModal({
  projectId,
  onClose,
  onLinked,
}: {
  projectId: string
  onClose: () => void
  onLinked: () => void
}) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [fields, setFields] = useState({ name: "", url: "", token: "" })

  const connect = async () => {
    if (!token || !currentOrg || !fields.url.trim()) return
    setBusy(true)
    setErr(null)
    try {
      await api.createRepository(
        {
          url: fields.url.trim(),
          ...(fields.name.trim() ? { name: fields.name.trim() } : {}),
          ...(fields.token.trim() ? { token: fields.token.trim() } : {}),
          projectId,
        },
        token,
        currentOrg.id
      )
      onLinked()
    } catch (e) {
      setErr(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const cls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
  const lbl = "mt-3 mb-1 block text-xs font-medium text-muted-foreground"

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center p-4" dir="ltr">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-hero w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h3 className="text-lg font-bold">{t.repo.link_repository}</h3>
        <label className={lbl}>{t.repo.url_label} *</label>
        <input value={fields.url} onChange={(e) => setFields((f) => ({ ...f, url: e.target.value }))} placeholder={t.repo.url_placeholder} className={cls} autoFocus />
        <label className={lbl}>{t.repo.name_label}</label>
        <input value={fields.name} onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))} className={cls} />
        <label className={lbl}>{t.repo.token_label}</label>
        <input value={fields.token} onChange={(e) => setFields((f) => ({ ...f, token: e.target.value }))} placeholder={t.repo.token_placeholder} className={cls} />
        {err && <p className="mt-2 rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>{t.agile.cancel}</Button>
          <Button onClick={connect} disabled={busy || !fields.url.trim()}>{busy ? t.repo.connecting : t.repo.connect}</Button>
        </div>
      </div>
    </div>
  )
}