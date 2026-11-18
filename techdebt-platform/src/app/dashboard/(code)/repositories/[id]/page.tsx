"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { io } from "socket.io-client"
import type { LucideIcon } from "lucide-react"
import {
  ArrowLeft,
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  FileCode2,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  Globe,
  HardDrive,
  Loader2,
  Lock,
  Plus,
  ScanSearch,
  Search,
  Terminal,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, wsOrigin, type GitRepository, type GitTreeEntry } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn, shortSha, timeAgo } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Modal } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"

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

const LANG_META: Record<string, { label: string; color: string }> = {
  ts: { label: "TypeScript", color: "#3178c6" },
  tsx: { label: "TypeScript (React)", color: "#3178c6" },
  js: { label: "JavaScript", color: "#f7df1e" },
  jsx: { label: "JavaScript (React)", color: "#61dafb" },
  mjs: { label: "JavaScript", color: "#f7df1e" },
  cjs: { label: "JavaScript", color: "#f7df1e" },
  rs: { label: "Rust", color: "#dea584" },
  go: { label: "Go", color: "#00add8" },
  py: { label: "Python", color: "#3572a5" },
  java: { label: "Java", color: "#b07219" },
  kt: { label: "Kotlin", color: "#a97bff" },
  swift: { label: "Swift", color: "#f05138" },
  c: { label: "C", color: "#555555" },
  h: { label: "C/C++ Header", color: "#555555" },
  cpp: { label: "C++", color: "#f34b7d" },
  hpp: { label: "C++", color: "#f34b7d" },
  cs: { label: "C#", color: "#178600" },
  rb: { label: "Ruby", color: "#701516" },
  php: { label: "PHP", color: "#4f5d95" },
  html: { label: "HTML", color: "#e34c26" },
  css: { label: "CSS", color: "#563d7c" },
  scss: { label: "SCSS", color: "#c6538c" },
  less: { label: "LESS", color: "#1d365d" },
  json: { label: "JSON", color: "#5e5e5e" },
  md: { label: "Markdown", color: "#8b949e" },
  yml: { label: "YAML", color: "#cb171e" },
  yaml: { label: "YAML", color: "#cb171e" },
  toml: { label: "TOML", color: "#9f9f9f" },
  sh: { label: "Shell", color: "#89e051" },
  sql: { label: "SQL", color: "#e38c00" },
  xml: { label: "XML", color: "#0060ac" },
  conf: { label: "Config", color: "#8b949e" },
  tf: { label: "Terraform", color: "#844fba" },
  dockerfile: { label: "Dockerfile", color: "#2496ed" },
  txt: { label: "Text", color: "#8b949e" },
}

function langOf(path: string): { label: string; color: string } {
  const base = path.split("/").pop() ?? ""
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : ""
  if (base.toLowerCase() === "dockerfile") return LANG_META.dockerfile
  return LANG_META[ext] ?? { label: base || "File", color: "#8b949e" }
}

function fileIcon(path: string): LucideIcon {
  const base = path.split("/").pop() ?? ""
  const ext = base.includes(".") ? base.split(".").pop()!.toLowerCase() : ""
  if (["md", "txt"].includes(ext)) return FileText
  if (ext === "json") return FileJson
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext)) return Braces
  if (["sh", "sql", "ps1"].includes(ext)) return Terminal
  return FileCode2
}

interface Contributor {
  name: string
  email: string
  count: number
  lastActive: string
}

function contributorsFrom(commits: GitRepository["commits"]): Contributor[] {
  const map = new Map<string, Contributor>()
  for (const c of commits) {
    const key = c.email || c.author
    const cur = map.get(key)
    if (cur) {
      cur.count += 1
      if (new Date(c.date).getTime() > new Date(cur.lastActive).getTime()) cur.lastActive = c.date
    } else {
      map.set(key, { name: c.author, email: c.email, count: 1, lastActive: c.date })
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

interface TreeNode {
  name: string
  path: string
  type: "tree" | "blob"
  children: TreeNode[]
}

function buildTree(files: GitTreeEntry[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>()
  const make = (path: string, name: string, type: "tree" | "blob") => {
    let n = nodes.get(path)
    if (!n) {
      n = { name, path, type, children: [] }
      nodes.set(path, n)
    }
    return n
  }
  for (const f of files) {
    let path = ""
    const parts = f.path.split("/")
for (let i = 0; i < parts.length; i++) {
      path = path ? `${path}/${parts[i]}` : parts[i]
      make(path, parts[i], i === parts.length - 1 ? (f.type === "tree" ? "tree" : "blob") : "tree")
    }
  }
  const children = new Map<string, TreeNode[]>()
  for (const [path, node] of nodes) {
    const slash = path.lastIndexOf("/")
    const parent = slash === -1 ? "" : path.slice(0, slash)
    const list = children.get(parent) ?? []
    list.push(node)
    children.set(parent, list)
  }
  const sortNodes = (arr: TreeNode[]) =>
    arr.sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "tree" ? -1 : 1
    )
  const attach = (parentPath: string): TreeNode[] => {
    const arr = sortNodes([...(children.get(parentPath) ?? [])])
    for (const n of arr) n.children = attach(n.path)
    return arr
  }
  return attach("")
}

function SectionCard({
  icon: Icon,
  title,
  count,
  right,
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  count?: string
  right?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h3 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{title}</span>
          {count !== undefined && (
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-secondary-foreground">
              {count}
            </span>
          )}
        </h3>
        {right}
      </header>
      {children}
    </section>
  )
}

export default function RepositoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()

  const [repo, setRepo] = useState<GitRepository | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scan, setScan] = useState<{ status: string; issuesCount: number; files: number; lines: number } | null>(null)
  const [showAddFile, setShowAddFile] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [cloneTab, setCloneTab] = useState<"clone" | "push">("clone")

  const role = currentOrg?.role ?? "VIEWER"
  const canWrite = role !== "VIEWER"
  const canManage = ["MANAGER", "ADMIN", "OWNER"].includes(role)

const load = useCallback(async () => {
    if (!token || !currentOrg || !id) {
      setLoading(false)
      return
    }
    try {
      const data = await api.gitGetRepository(token, currentOrg.id, id)
      setRepo(data)
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
    socket.on("gitrepo:updated", (p: { id: string }) => {
      if (p.id === id) load()
    })
    return () => {
      socket.disconnect()
    }
  }, [token, currentOrg, id, load])

  const runScan = async () => {
    if (!token || !currentOrg || !id) return
    setScanning(true)
    setError(null)
    try {
      const res = await api.gitScanRepository(token, currentOrg.id, id)
      setScan({
        status: res.status,
        issuesCount: res.issues?.length ?? 0,
        files: res.metrics?.files_scanned ?? res.filesScanned,
        lines: res.metrics?.lines_of_code ?? res.linesAnalyzed,
      })
      toast.success(`${t.githost.scan} • ${res.status}`, `${res.issues?.length ?? 0} ${t.platform.issues}`)
      await load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setScanning(false)
    }
  }

  const removeRepo = async () => {
    if (!token || !currentOrg || !id) return
    setDeleting(true)
    try {
      await api.gitDeleteRepository(token, currentOrg.id, id)
      router.push("/dashboard/repositories")
    } catch (e) {
      toast.error(errMsg(e))
      setDeleting(false)
    }
  }

  const copy = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text).catch(() => undefined)
    setCopied(key)
    toast.success(t.githost.copied)
    window.setTimeout(() => setCopied(null), 1500)
  }

  const base = repo ? `${api.baseUrl}/git/${currentOrg?.slug ?? currentOrg?.id}/${repo.name}` : ""
  const cloneCmd = `git clone ${base}`
  const pushCmd = `git init\ngit add .\ngit commit -m "init"\ngit remote add origin ${base}\ngit push -u origin ${repo?.defaultBranch ?? "main"}`

  const tree = useMemo(() => (repo ? buildTree(repo.files) : []), [repo])
  const languages = useMemo(() => {
    if (!repo) return [] as { label: string; color: string; count: number; pct: number }[]
    const counts = new Map<string, { label: string; color: string; count: number }>()
    for (const f of repo.files) {
      if (f.type !== "blob") continue
      const meta = langOf(f.path)
      const cur = counts.get(meta.label) ?? { label: meta.label, color: meta.color, count: 0 }
      cur.count += 1
      counts.set(meta.label, cur)
    }
    const total = repo.files.filter((f) => f.type === "blob").length || 1
    return [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .map((c) => ({ ...c, pct: Math.round((c.count / total) * 1000) / 10 }))
  }, [repo])
  const contributors = useMemo(() => (repo ? contributorsFrom(repo.commits) : []), [repo])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-44 w-full rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-96 w-full rounded-2xl lg:col-span-2" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!repo) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title={t.githost.title}
        description={error ?? t.errors.not_found}
        action={
          <Link href="/dashboard/repositories">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
              {t.githost.title}
            </Button>
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/repositories"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t.githost.title}
      </Link>

      {error && (
        <div className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-2.5 text-sm text-danger">{error}</div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GitBranch className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-2xl font-extrabold tracking-tight">{repo.name}</h2>
                <Badge variant={repo.visibility === "public" ? "success" : "secondary"}>
                  {repo.visibility === "public" ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {repo.visibility === "public" ? t.githost.public : t.githost.private}
                </Badge>
              </div>
              {repo.description && <p className="mt-1 text-sm text-muted-foreground">{repo.description}</p>}
              {repo.project && (
                <Link
                  href={`/dashboard/projects/${repo.project.id}`}
                  className="mt-2 inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                >
                  {repo.project.name}
                </Link>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {canWrite && (
              <>
                <Button variant="outline" onClick={() => setShowAddFile(true)}>
                  <Plus className="h-4 w-4" />
                  {t.githost.add_file}
                </Button>
                <Button onClick={runScan} disabled={scanning}>
                  {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                  {scanning ? t.githost.scanning : t.githost.scan}
                </Button>
              </>
            )}
            {canManage && (
              <Tooltip tip={t.githost.delete_confirm}>
                <Button
                  variant="ghost"
                  className="text-muted-foreground hover:bg-danger/10 hover:text-danger"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={t.githost.delete}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-2">
            <div className="flex gap-1">
              {(["clone", "push"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setCloneTab(tab)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
                    cloneTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab === "clone" ? t.githost.clone_url : t.githost.push_command}
                </button>
              ))}
            </div>
            <button
              onClick={() => copy(cloneTab, cloneTab === "clone" ? cloneCmd : pushCmd)}
              aria-label={t.githost.copy}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied === cloneTab ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === cloneTab ? t.githost.copied : t.githost.copy}
            </button>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap bg-card p-3 font-mono text-xs leading-relaxed">
            {cloneTab === "clone" ? cloneCmd : pushCmd}
          </pre>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <StatCell icon={GitBranch} label={t.githost.branches} value={repo.branches.length} />
          <StatCell icon={GitCommitHorizontal} label={t.githost.commits_title} value={repo.commits.length} />
          <StatCell icon={FileCode2} label={t.githost.files} value={repo.fileCount} />
          <StatCell icon={HardDrive} label={t.githost.size} value={sizeLabel(repo.sizeKb)} />
          <StatCell icon={Users} label={t.githost.contributors} value={contributors.length} />
          <StatCell
            icon={Clock}
            label={t.githost.last_push}
            value={repo.lastPushAt ? timeAgo(repo.lastPushAt, locale) : t.githost.never}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <FilesSection files={repo.files} tree={tree} t={t} />
          {repo.readme ? (
            <SectionCard icon={BookOpen} title={t.githost.readme} count={repo.readme.path}>
              <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-foreground">
                {repo.readme.content}
              </pre>
            </SectionCard>
          ) : null}
          <CommitsSection commits={repo.commits} t={t} locale={locale} />
        </div>

        <div className="min-w-0 space-y-6">
          <LanguagesSection languages={languages} t={t} />
          <ContributorsSection contributors={contributors} t={t} locale={locale} />
          <BranchesSection repo={repo} t={t} copied={copied} onCopy={copy} />
          <ScansSection scan={scan} scanning={scanning} canWrite={canWrite} onRun={runScan} t={t} />
        </div>
      </div>

      <AddFileModal
        open={showAddFile}
        repo={repo}
        onClose={() => setShowAddFile(false)}
        onDone={() => {
          setShowAddFile(false)
          load()
        }}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`${t.githost.delete} ${repo.name}?`}
        closeLabel={t.platform.close}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {t.platform.cancel}
            </Button>
            <Button variant="destructive" onClick={removeRepo} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.githost.delete}
            </Button>
          </>
        }
      >
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t.githost.delete_confirm}</span>
        </div>
      </Modal>
    </div>
  )
}

function StatCell({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[10px] font-medium text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-bold">{value}</p>
      </div>
    </div>
  )
}

function FilesSection({ files, tree, t }: { files: GitTreeEntry[]; tree: TreeNode[]; t: ReturnType<typeof useI18n>["t"] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return files.filter((f) => f.type === "blob" && f.path.toLowerCase().includes(q))
  }, [files, query])

  const renderNode = (node: TreeNode, depth: number): React.ReactNode => {
    const isOpen = expanded.has(node.path)
    const indent = { paddingInlineStart: `${depth * 18}px` }
    if (node.type === "tree") {
      return (
        <div key={node.path}>
          <button
            onClick={() => toggle(node.path)}
            className="flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1 pe-2 text-start transition-colors hover:bg-muted/50"
            style={indent}
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground rtl:rotate-180" />
            )}
            {isOpen ? (
              <FolderOpen className="h-4 w-4 shrink-0 text-primary" />
            ) : (
              <Folder className="h-4 w-4 shrink-0 text-primary" />
            )}
            <span className="truncate text-xs font-semibold">{node.name}</span>
            {node.children.length > 0 && (
              <span className="ms-auto text-[10px] font-semibold text-muted-foreground">{node.children.length}</span>
            )}
          </button>
          {isOpen && <div>{node.children.map((c) => renderNode(c, depth + 1))}</div>}
        </div>
      )
    }
    const Icon = fileIcon(node.path)
    return (
      <div
        key={node.path}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-start transition-colors hover:bg-muted/50"
        style={indent}
      >
        <span className="w-3.5 shrink-0" />
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-mono text-xs">{node.name}</span>
      </div>
    )
  }

  return (
    <SectionCard
      icon={Code2}
      title={t.githost.files_title}
      count={String(files.length)}
      right={
        <div className="relative w-44 sm:w-56">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.placeholder}
            aria-label={t.search.placeholder}
            className="h-8 w-full rounded-md border border-border bg-background ps-8 pe-2 text-xs focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      }
    >
      <div className="max-h-80 overflow-y-auto p-2">
        {files.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{t.githost.no_files}</p>
        ) : matches ? (
          matches.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{t.search.no_results}</p>
          ) : (
            <div className="divide-y divide-border">
              {matches.map((f) => {
                const Icon = fileIcon(f.path)
                return (
                  <div key={f.path} className="flex items-center gap-2 px-2 py-1.5">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate font-mono text-xs">{f.path}</span>
                    <span className="ml-auto shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-secondary-foreground">
                      {langOf(f.path).label}
                    </span>
                  </div>
                )
              })}
            </div>
          )
        ) : tree.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{t.githost.no_files}</p>
        ) : (
          tree.map((node) => renderNode(node, 0))
        )}
      </div>
    </SectionCard>
  )
}

function LanguagesSection({
  languages,
  t,
}: {
  languages: { label: string; color: string; count: number; pct: number }[]
  t: ReturnType<typeof useI18n>["t"]
}) {
  const top = languages.slice(0, 8)
  return (
    <SectionCard icon={Code2} title={t.githost.languages} count={languages.length > 0 ? String(languages.length) : undefined}>
      {languages.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">—</p>
      ) : (
        <div className="space-y-3 p-5">
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary/50">
            {languages.slice(0, 8).map((l) => (
              <span key={l.label} className="h-full" style={{ width: `${l.pct}%`, backgroundColor: l.color }} />
            ))}
          </div>
          <div className="space-y-2">
            {top.map((l) => (
              <div key={l.label} className="flex items-center gap-2">
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{l.label}</span>
                <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">{l.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

function ContributorsSection({
  contributors,
  t,
  locale,
}: {
  contributors: Contributor[]
  t: ReturnType<typeof useI18n>["t"]
  locale: string
}) {
  return (
    <SectionCard icon={Users} title={t.githost.contributors} count={contributors.length > 0 ? String(contributors.length) : undefined}>
      {contributors.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">{t.githost.no_commits}</p>
      ) : (
        <div className="divide-y divide-border">
          {contributors.slice(0, 10).map((c) => (
            <div key={`${c.name}-${c.email}`} className="flex items-center gap-3 px-5 py-2.5">
              <Avatar name={c.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{c.name}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {c.email}
                  {" · "}
                  {timeAgo(c.lastActive, locale)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-secondary-foreground">
                {c.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

function BranchesSection({
  repo,
  t,
  copied,
  onCopy,
}: {
  repo: GitRepository
  t: ReturnType<typeof useI18n>["t"]
  copied: string | null
  onCopy: (key: string, text: string) => void
}) {
  return (
    <SectionCard icon={GitBranch} title={t.githost.branches} count={String(repo.branches.length)}>
      <div className="flex flex-wrap gap-2 p-4">
        {repo.branches.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          repo.branches.map((b) => (
            <button
              key={b}
              onClick={() => onCopy(`branch-${b}`, b)}
              className={cn(
                "group inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors",
                b === repo.defaultBranch
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
              title={t.githost.copy}
            >
              {copied === `branch-${b}` ? (
                <Check className="h-3 w-3 text-success" />
              ) : (
                <GitBranch className="h-3 w-3" />
              )}
              {b}
              {b === repo.defaultBranch && (
                <span className="rounded-full bg-background/60 px-1.5 text-[9px] uppercase text-muted-foreground">
                  {t.githost.default_branch.replace(/\s*:.*$/, "")}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </SectionCard>
  )
}

function ScansSection({
  scan,
  scanning,
  canWrite,
  onRun,
  t,
}: {
  scan: { status: string; issuesCount: number; files: number; lines: number } | null
  scanning: boolean
  canWrite: boolean
  onRun: () => void
  t: ReturnType<typeof useI18n>["t"]
}) {
  return (
    <SectionCard
      icon={ScanSearch}
      title={t.githost.scan}
      right={
        canWrite ? (
          <Button size="sm" onClick={onRun} disabled={scanning}>
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
            {scanning ? t.githost.scanning : t.githost.scan}
          </Button>
        ) : undefined
      }
    >
      {scan ? (
        <div className="space-y-3 p-5">
          <Badge
            variant={scan.status === "SUCCESS" ? "success" : scan.status === "FAILED" ? "danger" : "warning"}
          >
            {scan.status === "RUNNING" || scan.status === "PENDING" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : scan.status === "SUCCESS" ? (
              <Check className="h-3 w-3" />
            ) : (
              <TriangleAlert className="h-3 w-3" />
            )}
            {scan.status}
          </Badge>
<div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
            <ScanMetric label={t.githost.files} value={String(scan.files)} />
            <ScanMetric label="LOC" value={scan.lines.toLocaleString()} />
            <ScanMetric
              label={t.platform.issues}
              value={String(scan.issuesCount)}
              valueClassName={scan.issuesCount > 0 ? "text-danger" : "text-success"}
            />
          </div>
        </div>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground">—</p>
      )}
    </SectionCard>
  )
}

function ScanMetric({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-2.5 py-2 text-center">
      <p className={cn("text-base font-bold", valueClassName)}>{value}</p>
      <p className="truncate text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

function CommitsSection({
  commits,
  t,
  locale,
}: {
  commits: GitRepository["commits"]
  t: ReturnType<typeof useI18n>["t"]
  locale: string
}) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commits
    return commits.filter(
      (c) =>
        c.message.toLowerCase().includes(q) ||
        c.author.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.sha.toLowerCase().includes(q)
    )
  }, [commits, query])

  return (
    <SectionCard
      icon={GitCommitHorizontal}
      title={t.githost.commits_title}
      count={String(commits.length)}
      right={
        <div className="relative w-44 sm:w-56">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search.placeholder}
            aria-label={t.search.placeholder}
            className="h-8 w-full rounded-md border border-border bg-background ps-8 pe-2 text-xs focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      }
    >
      {commits.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">{t.githost.no_commits}</p>
      ) : (
        <div className="relative">
          <span aria-hidden className="absolute bottom-6 start-[2.35rem] top-6 w-px bg-border" />
          <div className="max-h-[26rem] overflow-y-auto py-1">
            {filtered.map((c) => (
              <div key={c.sha} className="relative flex items-start gap-3 px-5 py-2">
                <span className="relative z-hero mt-0.5 shrink-0">
                  <Avatar name={c.author} size="sm" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.message}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                    <code className="rounded bg-secondary px-1 py-px font-mono text-[10px]">{shortSha(c.sha)}</code>
<span className="min-w-0 truncate">
                      {c.author}
                      {c.email ? ` <${c.email}>` : ""}
                    </span>
                    <span className="whitespace-nowrap">{timeAgo(c.date, locale)}</span>
                  </p>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">{t.search.no_results}</p>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

function AddFileModal({
  open,
  repo,
  onClose,
  onDone,
}: {
  open: boolean
  repo: GitRepository
  onClose: () => void
  onDone: () => void
}) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [path, setPath] = useState("")
  const [content, setContent] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  const commit = async () => {
    if (!token || !currentOrg || !path.trim()) return
    setBusy(true)
    try {
      await api.gitCommitFile(token, currentOrg.id, repo.id, {
        path: path.trim(),
        content,
        message: message.trim() || undefined,
      })
      setPath("")
      setContent("")
      setMessage("")
      toast.success(t.githost.commit)
      onDone()
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
      title={t.githost.new_file}
      description={repo.name}
      closeLabel={t.platform.close}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.platform.cancel}
          </Button>
          <Button onClick={commit} disabled={busy || !path.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? t.githost.committing : t.githost.commit}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label htmlFor="file-path" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t.githost.file_path}
          </label>
          <input
            id="file-path"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="src/main.rs"
            className="input font-mono"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="file-content" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t.githost.file_content}
          </label>
          <textarea id="file-content" value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="input code-textarea" />
        </div>
        <div>
          <label htmlFor="file-message" className="mb-1.5 block text-xs font-medium text-muted-foreground">
            {t.githost.commit_message}
          </label>
          <input
            id="file-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={path ? `Add ${path}` : "…"}
            className="input"
          />
        </div>
      </div>
    </Modal>
  )
}
