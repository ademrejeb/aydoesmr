"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { io } from "socket.io-client"
import {
  ArrowUpDown,
  Check,
  Copy,
  FileText,
  GitBranch,
  Globe,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, wsOrigin, type GitRepository, type GitToken, type Project } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn, timeAgo } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Modal } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import { Dropdown, DropdownItem } from "@/components/ui/dropdown"

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message)
  return "Error"
}

function sizeLabel(bytesKb: number): string {
  if (bytesKb > 1024 * 1024) return `${(bytesKb / 1024 / 1024).toFixed(1)} GB`
  if (bytesKb > 1024) return `${(bytesKb / 1024).toFixed(1)} MB`
  return `${bytesKb} KB`
}

function StatMini({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-bold leading-tight">{value}</p>
      </div>
    </div>
  )
}

export default function RepositoriesPage() {
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()
  const [repos, setRepos] = useState<GitRepository[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showTokens, setShowTokens] = useState(false)
  const [query, setQuery] = useState("")
  const [visFilter, setVisFilter] = useState<"all" | "private" | "public">("all")
  const [sort, setSort] = useState<"recent" | "name">("recent")

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [visibility, setVisibility] = useState<"private" | "public">("private")
  const [projectId, setProjectId] = useState("")
  const [initReadme, setInitReadme] = useState(true)
  const [busy, setBusy] = useState(false)

  const role = currentOrg?.role ?? "VIEWER"
  const canCreate = role !== "VIEWER"

  const load = useCallback(async () => {
    if (!token || !currentOrg) {
      setLoading(false)
      return
    }
    try {
      setRepos(await api.gitListRepositories(token, currentOrg.id))
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
      .listProjects(token, currentOrg.id)
      .then(setProjects)
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
    socket.on("gitrepo:updated", () => load())
    return () => {
      socket.disconnect()
    }
  }, [token, currentOrg, load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = repos.filter(
      (r) =>
        (visFilter === "all" || r.visibility === visFilter) &&
        (!q || r.name.toLowerCase().includes(q) || (r.description ?? "").toLowerCase().includes(q))
    )
    return [...list].sort((a, b) =>
      sort === "name"
        ? a.name.localeCompare(b.name)
        : new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime()
    )
  }, [repos, query, visFilter, sort])

  const summary = useMemo(() => {
    return {
      totalSize: repos.reduce((s, r) => s + (r.sizeKb ?? 0), 0),
      totalFiles: repos.reduce((s, r) => s + (r.fileCount ?? 0), 0),
      publicCount: repos.filter((r) => r.visibility === "public").length,
    }
  }, [repos])

  const create = async () => {
    if (!token || !currentOrg || !name.trim()) return
    setBusy(true)
    try {
      await api.gitCreateRepository(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          visibility,
          projectId: projectId || undefined,
          initReadme,
        },
        token,
        currentOrg.id
      )
      setName("")
      setDescription("")
      setProjectId("")
      setVisibility("private")
      setInitReadme(true)
      setShowCreate(false)
      toast.success(t.githost.create, name.trim())
      await load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">{t.githost.title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.githost.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowTokens(true)}>
            <KeyRound className="h-4 w-4" />
            <span className="hidden sm:inline">{t.githost.tokens_title}</span>
          </Button>
          {canCreate && (
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t.githost.create}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          <span>{error}</span>
          <Button size="sm" variant="ghost" onClick={load}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t.repo.refresh}
          </Button>
        </div>
      )}

      {!loading && repos.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatMini icon={GitBranch} label={t.githost.title} value={String(repos.length)} />
          <StatMini icon={FileText} label={t.githost.files} value={summary.totalFiles.toLocaleString(locale)} />
          <StatMini icon={HardDrive} label={t.githost.size} value={sizeLabel(summary.totalSize)} />
          <StatMini icon={Globe} label={t.githost.public} value={String(summary.publicCount)} />
        </div>
      )}

      {!loading && repos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-48 flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search.placeholder}
              className="input ps-9"
              aria-label={t.search.placeholder}
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            {(["all", "private", "public"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setVisFilter(v)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                  visFilter === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "all" ? t.projects.view : v === "private" ? t.githost.private : t.githost.public}
              </button>
            ))}
          </div>
          <Dropdown
            align="end"
            width="w-44"
            trigger={(open, toggle) => (
              <Button variant="outline" onClick={toggle} aria-expanded={open}>
                <ArrowUpDown className="h-4 w-4" />
                <span className="hidden sm:inline">{sort === "recent" ? t.githost.last_push : t.githost.name}</span>
              </Button>
            )}
          >
            {(close) => (
              <div className="py-1">
                <DropdownItem active={sort === "recent"} onClick={() => { setSort("recent"); close() }}>
                  {t.githost.last_push}
                </DropdownItem>
                <DropdownItem active={sort === "name"} onClick={() => { setSort("name"); close() }}>
                  {t.githost.name}
                </DropdownItem>
              </div>
            )}
          </Dropdown>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
          ))}
        </div>
      ) : repos.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title={t.githost.empty}
          action={
            canCreate ? (
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" />
                {t.githost.create}
              </Button>
            ) : undefined
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title={t.search.no_results} description={`“${query}”`} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((repo) => {
            const authors = Array.from(new Set((repo.commits ?? []).map((c) => c.email || c.author))).filter(Boolean).slice(0, 5)
            return (
            <Link
              key={repo.id}
              href={`/dashboard/repositories/${repo.id}`}
              className="group flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm card-hover"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <GitBranch className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold leading-tight group-hover:text-primary">{repo.name}</h3>
                    {repo.project && <p className="truncate text-[11px] text-muted-foreground">{repo.project.name}</p>}
                  </div>
                </div>
                <Badge variant={repo.visibility === "public" ? "success" : "secondary"}>
                  {repo.visibility === "public" ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {repo.visibility === "public" ? t.githost.public : t.githost.private}
                </Badge>
              </div>

              <p className="mt-3 line-clamp-2 min-h-8 text-xs text-muted-foreground">
                {repo.description || t.githost.subtitle}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5" />
                  {repo.defaultBranch}
                </span>
                <span className="inline-flex items-center gap-1">
                  <HardDrive className="h-3.5 w-3.5" />
                  {sizeLabel(repo.sizeKb)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {repo.fileCount} {t.githost.files}
                </span>
              </div>

              <div className="mt-4 flex items-center gap-2.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
                {authors.length > 0 && (
                  <div className="flex shrink-0 -space-x-2 rtl:space-x-reverse" title={authors.join(", ")}>
                    {authors.map((a, i) => (
                      <Avatar key={`${a}-${i}`} name={a} size="xs" className="ring-2 ring-card" />
                    ))}
                  </div>
                )}
                {repo.commits?.[0] ? (
                  <>
                    <span className="min-w-0 flex-1 truncate">{repo.commits[0].message}</span>
                    <span className="mx-1 shrink-0">·</span>
                    <span className="shrink-0 whitespace-nowrap">{timeAgo(repo.commits[0].date, locale)}</span>
                  </>
                ) : (
                  <span className="truncate">
                    {t.githost.last_push}: {repo.lastPushAt ? timeAgo(repo.lastPushAt, locale) : t.githost.never}
                  </span>
                )}
              </div>
            </Link>
            )
          })}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t.githost.new_repository}
        description={t.githost.subtitle}
        closeLabel={t.platform.close}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              {t.platform.cancel}
            </Button>
            <Button onClick={create} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? t.githost.create_busy : t.githost.create}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="repo-name" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t.githost.name}
            </label>
            <input
              id="repo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.githost.name_placeholder}
              className="input"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="repo-desc" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t.githost.description}
            </label>
            <textarea
              id="repo-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="input"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{t.githost.visibility_label}</span>
            <div className="flex gap-2">
              {(["private", "public"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors cursor-pointer",
                    visibility === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v === "private" ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                  {v === "private" ? t.githost.private : t.githost.public}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="repo-project" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t.githost.link_project}
            </label>
            <select id="repo-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input">
              <option value="">{t.githost.no_project}</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={initReadme}
              onChange={(e) => setInitReadme(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-[var(--primary)]"
            />
            {t.githost.init_readme}
          </label>
        </div>
      </Modal>

      {showTokens && <TokensModal token={token} orgId={currentOrg?.id} onClose={() => setShowTokens(false)} />}
    </div>
  )
}

function TokensModal({ token, orgId, onClose }: { token: string | null; orgId: string | undefined; onClose: () => void }) {
  const { t, locale } = useI18n()
  const toast = useToast()
  const [tokens, setTokens] = useState<GitToken[]>([])
  const [tokenName, setTokenName] = useState("")
  const [created, setCreated] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token || !orgId) return
    try {
      setTokens(await api.gitListTokens(token, orgId))
    } catch (e) {
      setError(errMsg(e))
    }
  }, [token, orgId])

  useEffect(() => {
    load()
  }, [load])

  const create = async () => {
    if (!token || !orgId) return
    setBusy(true)
    try {
      const res = await api.gitCreateToken({ name: tokenName.trim() || "default" }, token, orgId)
      setCreated(res.token)
      setTokenName("")
      await load()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (tokenId: string) => {
    if (!token || !orgId) return
    try {
      await api.gitRevokeToken(token, orgId, tokenId)
      toast.success(t.githost.revoke)
      await load()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text).catch(() => undefined)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.githost.tokens_title}
      description={t.githost.push_command}
      closeLabel={t.platform.close}
      size="lg"
      footer={
        <Button variant="ghost" onClick={onClose}>
          {t.platform.close}
        </Button>
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>
      )}

      <div className="flex gap-2">
        <input
          value={tokenName}
          onChange={(e) => setTokenName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && create()}
          placeholder={t.githost.token_name}
          className="input flex-1"
          aria-label={t.githost.token_name}
        />
        <Button onClick={create} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.githost.create_token}
        </Button>
      </div>

      {created && (
        <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-success">
            <Check className="h-4 w-4" />
            {t.githost.created_token}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-background px-2 py-1.5 text-xs">
              {created}
            </code>
            <Tooltip tip={copied ? t.githost.copied : t.githost.copy}>
              <Button size="icon" variant="outline" onClick={() => copy(created)} aria-label={t.githost.copy}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </Tooltip>
          </div>
        </div>
      )}

      <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
        {tokens.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t.githost.no_tokens}</p>
        ) : (
          tokens.map((tk) => (
            <div
              key={tk.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <KeyRound className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{tk.name}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    <code className="font-mono">{tk.prefix}…</code>
                    {" · "}
                    {tk.revokedAt
                      ? t.githost.revoke
                      : tk.lastUsedAt
                        ? `${t.githost.last_push}: ${timeAgo(tk.lastUsedAt, locale)}`
                        : t.githost.never}
                  </p>
                </div>
              </div>
              {!tk.revokedAt && (
                <Tooltip tip={t.githost.revoke}>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground hover:bg-danger/10 hover:text-danger"
                    onClick={() => revoke(tk.id)}
                    aria-label={t.githost.revoke}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </Tooltip>
              )}
            </div>
          ))
        )}
      </div>
    </Modal>
  )
}