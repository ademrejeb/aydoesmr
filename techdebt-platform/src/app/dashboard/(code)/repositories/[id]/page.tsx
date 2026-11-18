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
  GitPullRequest,
  Globe,
  HardDrive,
  Loader2,
  Lock,
  Plus,
  ScanSearch,
  Search,
  Sparkles,
  Terminal,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import {
  api,
  wsOrigin,
  type FactoryPullRequest,
  type GitBlob,
  type GitCommit,
  type GitCommitDetail,
  type GitDiff,
  type GitRepository,
  type GitTreeEntry,
} from "@/lib/api"
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
import { MarkdownView } from "@/components/repositories/markdown-view"
import { DiffView } from "@/components/repositories/diff-view"

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
  const [tab, setTab] = useState<"code" | "commits" | "branches" | "pulls">("code")
  const [branch, setBranch] = useState("")
  const [branchFiles, setBranchFiles] = useState<GitTreeEntry[] | null>(null)
  const [treeLoading, setTreeLoading] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [blob, setBlob] = useState<GitBlob | null>(null)
  const [blobLoading, setBlobLoading] = useState(false)
  const [blobError, setBlobError] = useState<string | null>(null)
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [commitsLoading, setCommitsLoading] = useState(false)
  const [commitDetail, setCommitDetail] = useState<GitCommitDetail | null>(null)
  const [commitLoading, setCommitLoading] = useState(false)
  const [pulls, setPulls] = useState<FactoryPullRequest[]>([])
  const [pullsLoading, setPullsLoading] = useState(false)
  const [pullDetail, setPullDetail] = useState<FactoryPullRequest | null>(null)
  const [pullDiff, setPullDiff] = useState<GitDiff | null>(null)
  const [pullDiffLoading, setPullDiffLoading] = useState(false)
  const [pullDiffError, setPullDiffError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!repo) return
    if (!branch) setBranch(repo.defaultBranch)
  }, [repo, branch])

  useEffect(() => {
    if (!repo || !token || !currentOrg || !branch) return
    let cancelled = false
    setTreeLoading(true)
    api
      .gitRepositoryTree(token, currentOrg.id, repo.id, branch)
      .then((res) => {
        if (cancelled) return
        setBranchFiles(res.entries)
        const readme = res.entries.find(
          (entry) => entry.type === "blob" && /(^|\/)readme\.md$/i.test(entry.path)
        )
        setSelectedPath(readme?.path ?? null)
      })
      .catch((e) => {
        if (!cancelled) setBlobError(errMsg(e))
      })
      .finally(() => {
        if (!cancelled) setTreeLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [repo?.id, token, currentOrg, branch])

  useEffect(() => {
    if (!repo || !token || !currentOrg || !selectedPath || !branch) {
      setBlob(null)
      return
    }
    let cancelled = false
    setBlobLoading(true)
    setBlobError(null)
    api
      .gitRepositoryFile(token, currentOrg.id, repo.id, selectedPath, branch)
      .then((res) => {
        if (!cancelled) setBlob(res)
      })
      .catch((e) => {
        if (!cancelled) {
          setBlob(null)
          setBlobError(errMsg(e))
        }
      })
      .finally(() => {
        if (!cancelled) setBlobLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [repo?.id, token, currentOrg, selectedPath, branch])

  useEffect(() => {
    if (tab !== "commits" || !repo || !token || !currentOrg || !branch) return
    let cancelled = false
    setCommitsLoading(true)
    api
      .gitRepositoryCommits(token, currentOrg.id, repo.id, branch, 80)
      .then((res) => {
        if (!cancelled) setCommits(res.commits)
      })
      .catch((e) => {
        if (!cancelled) setBlobError(errMsg(e))
      })
      .finally(() => {
        if (!cancelled) setCommitsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, repo?.id, token, currentOrg, branch])

  useEffect(() => {
    if (tab !== "pulls" || !repo || !token || !currentOrg) return
    let cancelled = false
    setPullsLoading(true)
    api
      .factoryPullRequests(token, currentOrg.id)
      .then((rows) => {
        if (!cancelled) setPulls(rows.filter((pull) => pull.repositoryId === repo.id))
      })
      .catch((e) => {
        if (!cancelled) setBlobError(errMsg(e))
      })
      .finally(() => {
        if (!cancelled) setPullsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, repo?.id, token, currentOrg])

  const openPull = async (pull: FactoryPullRequest) => {
    if (!token || !currentOrg || !repo) return
    setPullDetail(pull)
    setPullDiff(null)
    setPullDiffError(null)
    setPullDiffLoading(true)
    try {
      setPullDiff(await api.gitPullRequestDiff(token, currentOrg.id, repo.id, pull.id))
    } catch (e) {
      setPullDiffError(errMsg(e))
    } finally {
      setPullDiffLoading(false)
    }
  }

  const openCommit = async (sha: string) => {
    if (!token || !currentOrg || !repo) return
    setCommitLoading(true)
    setCommitDetail(null)
    try {
      setCommitDetail(await api.gitRepositoryCommit(token, currentOrg.id, repo.id, sha))
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setCommitLoading(false)
    }
  }

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

  const tree = useMemo(() => (repo ? buildTree(branchFiles ?? repo.files) : []), [repo, branchFiles])
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label={repo.name}>
          {([
            ["code", Code2, t.githost.files_title],
            ["commits", GitCommitHorizontal, t.githost.commits_title],
            ["branches", GitBranch, t.githost.branches],
            ["pulls", GitPullRequest, t.githost.pull_requests],
          ] as const).map(([key, Icon, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setTab(key)
                setCommitDetail(null)
                setPullDetail(null)
              }}
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                tab === key
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {key === "commits" && commits.length > 0 ? (
                <span className="rounded-full bg-secondary px-1.5 text-[10px] font-bold text-secondary-foreground">
                  {commits.length}
                </span>
              ) : null}
              {key === "pulls" && pulls.length > 0 ? (
                <span className="rounded-full bg-secondary px-1.5 text-[10px] font-bold text-secondary-foreground">
                  {pulls.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-muted-foreground">
          <GitBranch className="h-3.5 w-3.5" />
          <select
            value={branch}
            onChange={(e) => {
              setBranch(e.target.value)
              setCommitDetail(null)
            }}
            className="h-8 w-40 rounded-md border border-border bg-background px-2 font-mono text-xs text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={t.githost.default_branch}
          >
            {repo.branches.length === 0 ? <option value={repo.defaultBranch}>{repo.defaultBranch}</option> : null}
            {repo.branches.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tab === "code" && (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <FilesSection
            files={branchFiles ?? repo.files}
            tree={tree}
            t={t}
            loading={treeLoading}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
          />
          <FileViewer
            blob={blob}
            path={selectedPath}
            loading={blobLoading}
            error={blobError}
            branch={branch}
            t={t}
            onCopy={copy}
            copied={copied}
          />
        </div>
      )}

      {tab === "commits" && (
        <CommitsBrowser
          commits={commits}
          loading={commitsLoading}
          branch={branch}
          detail={commitDetail}
          detailLoading={commitLoading}
          onOpen={openCommit}
          onBack={() => setCommitDetail(null)}
          t={t}
          locale={locale}
        />
      )}

      {tab === "branches" && (
        <BranchesBrowser
          repo={repo}
          branch={branch}
          onBrowse={(name) => {
            setBranch(name)
            setTab("code")
          }}
          onCopy={copy}
          copied={copied}
          t={t}
        />
      )}

      {tab === "pulls" && (
        <PullRequestsBrowser
          pulls={pulls}
          loading={pullsLoading}
          t={t}
          locale={locale}
          detail={pullDetail}
          diff={pullDiff}
          diffLoading={pullDiffLoading}
          diffError={pullDiffError}
          onOpen={openPull}
          onBack={() => {
            setPullDetail(null)
            setPullDiff(null)
          }}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <LanguagesSection languages={languages} t={t} />
        <ContributorsSection contributors={contributors} t={t} locale={locale} />
        <ScansSection scan={scan} scanning={scanning} canWrite={canWrite} onRun={runScan} t={t} />
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

function FilesSection({
  files,
  tree,
  t,
  loading,
  selectedPath,
  onSelect,
}: {
  files: GitTreeEntry[]
  tree: TreeNode[]
  t: ReturnType<typeof useI18n>["t"]
  loading?: boolean
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
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
      <button
        key={node.path}
        type="button"
        onClick={() => onSelect(node.path)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-start transition-colors hover:bg-muted/50",
          selectedPath === node.path && "bg-primary/10 text-primary"
        )}
        style={indent}
      >
        <span className="w-3.5 shrink-0" />
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate font-mono text-xs">{node.name}</span>
      </button>
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
      <div className="max-h-[34rem] overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.platform.loading}
          </div>
        ) : files.length === 0 ? (
          <p className="px-3 py-4 text-sm text-muted-foreground">{t.githost.no_files}</p>
        ) : matches ? (
          matches.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">{t.search.no_results}</p>
          ) : (
            <div className="divide-y divide-border">
              {matches.map((f) => {
                const Icon = fileIcon(f.path)
                return (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => onSelect(f.path)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 px-2 py-1.5 text-start hover:bg-muted/50",
                      selectedPath === f.path && "bg-primary/10 text-primary"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate font-mono text-xs">{f.path}</span>
                    <span className="ml-auto shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-secondary-foreground">
                      {langOf(f.path).label}
                    </span>
                  </button>
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

function FileViewer({
  blob,
  path,
  loading,
  error,
  branch,
  t,
  onCopy,
  copied,
}: {
  blob: GitBlob | null
  path: string | null
  loading: boolean
  error: string | null
  branch: string
  t: ReturnType<typeof useI18n>["t"]
  onCopy: (key: string, text: string) => void
  copied: string | null
}) {
  const isMarkdown = !!path && /\.(md|markdown)$/i.test(path)
  const content = blob?.content ?? ""
  return (
    <SectionCard
      icon={FileCode2}
      title={path ?? t.githost.files_title}
      count={blob ? `${(blob.size / 1024).toFixed(1)} KB` : undefined}
      right={
        <div className="flex items-center gap-1.5">
          <Badge variant="outline" className="font-mono">
            <GitBranch className="h-3 w-3" />
            {branch}
          </Badge>
          {path && content ? (
            <Button size="sm" variant="outline" onClick={() => onCopy("file", content)}>
              {copied === "file" ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === "file" ? t.githost.copied : t.githost.copy}
            </Button>
          ) : null}
        </div>
      }
    >
      {!path ? (
        <div className="p-6 text-sm text-muted-foreground">{t.githost.select_file}</div>
      ) : loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.platform.loading}
        </div>
      ) : error ? (
        <div className="m-4 rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}</div>
      ) : !blob ? (
        <div className="p-6 text-sm text-muted-foreground">{t.githost.no_files}</div>
      ) : blob.binary ? (
        <div className="p-6 text-sm text-muted-foreground">{t.githost.binary_file}</div>
      ) : isMarkdown ? (
        <div className="max-h-[42rem] overflow-auto p-6">
          <MarkdownView content={content} />
        </div>
      ) : (
        <div className="max-h-[42rem] overflow-auto">
          <CodeView content={content} path={path} truncated={blob.truncated} t={t} />
        </div>
      )}
    </SectionCard>
  )
}

function CodeView({
  content,
  path,
  truncated,
  t,
}: {
  content: string
  path: string
  truncated: boolean
  t: ReturnType<typeof useI18n>["t"]
}) {
  const lines = content.split("\n")
  return (
    <div dir="ltr">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="font-mono">{path}</span>
        <span>
          {lines.length} lines
          {truncated ? ` · ${t.githost.truncated}` : ""}
        </span>
      </div>
      <table className="w-full border-collapse font-mono text-xs">
        <tbody>
          {lines.map((line, index) => (
            <tr key={index} className="align-top hover:bg-muted/30">
              <td className="w-12 select-none border-e border-border/60 px-3 py-0.5 text-end text-[10px] text-muted-foreground">
                {index + 1}
              </td>
              <td className="whitespace-pre-wrap break-words px-4 py-0.5 leading-5">{line || " "}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CommitsBrowser({
  commits,
  loading,
  branch,
  detail,
  detailLoading,
  onOpen,
  onBack,
  t,
  locale,
}: {
  commits: GitCommit[]
  loading: boolean
  branch: string
  detail: GitCommitDetail | null
  detailLoading: boolean
  onOpen: (sha: string) => void
  onBack: () => void
  t: ReturnType<typeof useI18n>["t"]
  locale: string
}) {
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commits
    return commits.filter(
      (commit) =>
        commit.message.toLowerCase().includes(q) ||
        commit.author.toLowerCase().includes(q) ||
        commit.email.toLowerCase().includes(q) ||
        commit.sha.toLowerCase().includes(q)
    )
  }, [commits, query])

  if (detail || detailLoading) {
    return (
      <SectionCard
        icon={GitCommitHorizontal}
        title={detail ? shortSha(detail.sha) : t.platform.loading}
        right={
          <Button size="sm" variant="outline" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {t.githost.commits_title}
          </Button>
        }
      >
        {detailLoading || !detail ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t.platform.loading}
          </div>
        ) : (
          <div className="space-y-5 p-5">
            <div>
              <h3 className="text-lg font-bold">{detail.message}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Avatar name={detail.author} size="sm" />
                <span className="font-semibold text-foreground">{detail.author}</span>
                {detail.email ? `<${detail.email}>` : null}
                <span>·</span>
                <span>{timeAgo(detail.date, locale)}</span>
                <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">{detail.sha}</code>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="rounded-full bg-secondary px-2.5 py-1">{detail.entries.length} {t.githost.files}</span>
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-success">+{detail.additions}</span>
              <span className="rounded-full bg-danger/10 px-2.5 py-1 text-danger">−{detail.deletions}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              {detail.entries.map((entry) => (
                <div key={entry.path} className="flex items-center gap-3 border-b border-border px-3 py-2 text-xs last:border-0">
                  <span className="w-5 shrink-0 rounded bg-secondary py-0.5 text-center font-mono text-[10px] text-secondary-foreground">
                    {entry.status}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono">{entry.path}</span>
                  <span className="shrink-0 text-success">+{entry.additions}</span>
                  <span className="shrink-0 text-danger">−{entry.deletions}</span>
                </div>
              ))}
            </div>
            <DiffView patch={detail.patch} emptyLabel={t.githost.no_diff} maxHeight="30rem" />
          </div>
        )}
      </SectionCard>
    )
  }

  return (
    <SectionCard
      icon={GitCommitHorizontal}
      title={t.githost.commits_title}
      count={String(commits.length)}
      right={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            <GitBranch className="h-3 w-3" />
            {branch}
          </Badge>
          <div className="relative w-40 sm:w-56">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search.placeholder}
              aria-label={t.search.placeholder}
              className="h-8 w-full rounded-md border border-border bg-background ps-8 pe-2 text-xs focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.platform.loading}
        </div>
      ) : commits.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">{t.githost.no_commits}</p>
      ) : (
        <div className="divide-y divide-border">
          {filtered.map((commit) => (
            <button
              key={commit.sha}
              type="button"
              onClick={() => onOpen(commit.sha)}
              className="flex w-full cursor-pointer items-start gap-3 px-5 py-3 text-start transition-colors hover:bg-muted/40"
            >
              <Avatar name={commit.author} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{commit.message}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  <code className="rounded bg-secondary px-1 py-px font-mono text-[10px]">{shortSha(commit.sha)}</code>
                  <span className="truncate">
                    {commit.author}
                    {commit.email ? ` <${commit.email}>` : ""}
                  </span>
                  <span className="whitespace-nowrap">{timeAgo(commit.date, locale)}</span>
                </span>
              </span>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
            </button>
          ))}
          {filtered.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t.search.no_results}</p>
          ) : null}
        </div>
      )}
    </SectionCard>
  )
}

function BranchesBrowser({
  repo,
  branch,
  onBrowse,
  onCopy,
  copied,
  t,
}: {
  repo: GitRepository
  branch: string
  onBrowse: (name: string) => void
  onCopy: (key: string, text: string) => void
  copied: string | null
  t: ReturnType<typeof useI18n>["t"]
}) {
  return (
    <SectionCard icon={GitBranch} title={t.githost.branches} count={String(repo.branches.length)}>
      {repo.branches.length === 0 ? (
        <p className="px-5 py-8 text-sm text-muted-foreground">{t.githost.no_commits}</p>
      ) : (
        <div className="divide-y divide-border">
          {repo.branches.map((name) => (
            <div key={name} className={cn("flex flex-wrap items-center gap-3 px-5 py-3", name === branch && "bg-primary/5")}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GitBranch className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-semibold">{name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {name === repo.defaultBranch ? t.githost.default_branch : t.githost.branch}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => onCopy(`branch-${name}`, name)}>
                  {copied === `branch-${name}` ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {t.githost.copy}
                </Button>
                <Button size="sm" onClick={() => onBrowse(name)}>
                  <Code2 className="h-3.5 w-3.5" />
                  {t.githost.browse}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  )
}

function PullRequestsBrowser({
  pulls,
  loading,
  t,
  locale,
  detail,
  diff,
  diffLoading,
  diffError,
  onOpen,
  onBack,
}: {
  pulls: FactoryPullRequest[]
  loading: boolean
  t: ReturnType<typeof useI18n>["t"]
  locale: string
  detail: FactoryPullRequest | null
  diff: GitDiff | null
  diffLoading: boolean
  diffError: string | null
  onOpen: (pull: FactoryPullRequest) => void
  onBack: () => void
}) {
  if (detail) {
    return (
      <SectionCard
        icon={GitPullRequest}
        title={`#${detail.number} ${detail.title}`}
        right={
          <div className="flex items-center gap-2">
            <Badge variant={detail.status === "MERGED" ? "success" : detail.status === "CLOSED" ? "danger" : "outline"}>
              {detail.status}
            </Badge>
            <Link href={`/dashboard/factory?run=${detail.runId}`}>
              <Button size="sm" variant="outline">
                <Sparkles className="h-3.5 w-3.5" />
                {t.githost.open_in_factory}
              </Button>
            </Link>
            <Button size="sm" variant="ghost" onClick={onBack}>
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              {t.githost.back_to_pull_requests}
            </Button>
          </div>
        }
      >
        <div className="space-y-5 p-5">
          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">{detail.sourceBranch}</code>
            <span>→</span>
            <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">{detail.targetBranch}</code>
            <span>·</span>
            <span>{timeAgo(detail.createdAt, locale)}</span>
            {detail.risk ? <Badge variant="secondary">{detail.risk}</Badge> : null}
          </p>

          {detail.checks.length > 0 ? (
            <div>
              <h4 className="mb-2 text-xs font-bold">{t.githost.checks}</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {detail.checks.map((check) => (
                  <div key={check.name} className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                    {check.status === "PASSED" ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                    ) : check.status === "FAILED" ? (
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                    ) : (
                      <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-mono text-[11px] font-semibold">{check.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{check.detail ?? check.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {diffLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t.platform.loading}
            </div>
          ) : diffError ? (
            <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{diffError}</div>
          ) : diff ? (
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h4 className="text-xs font-bold">{t.githost.files_title}</h4>
                <Badge variant="secondary">{diff.entries.length}</Badge>
                <span className="text-[11px] font-bold text-success">+{diff.additions}</span>
                <span className="text-[11px] font-bold text-danger">−{diff.deletions}</span>
              </div>
              <DiffView patch={diff.patch} emptyLabel={t.githost.no_diff} maxHeight="42rem" />
            </div>
          ) : (
            <DiffView patch="" emptyLabel={t.githost.no_diff} />
          )}
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard icon={GitPullRequest} title={t.githost.pull_requests} count={String(pulls.length)}>
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.platform.loading}
        </div>
      ) : pulls.length === 0 ? (
        <EmptyState icon={GitPullRequest} title={t.githost.no_pull_requests} description={t.githost.no_pull_requests_hint} />
      ) : (
        <div className="divide-y divide-border">
          {pulls.map((pull) => {
            const failed = pull.checks.filter((check) => check.status === "FAILED").length
            return (
              <button
                key={pull.id}
                type="button"
                onClick={() => onOpen(pull)}
                className="flex w-full flex-wrap items-start gap-3 px-5 py-4 text-start transition-colors hover:bg-muted/40"
              >
                <span className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  pull.status === "MERGED" ? "bg-success/10 text-success" : pull.status === "CLOSED" ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"
                )}>
                  <GitPullRequest className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold">#{pull.number}</span>
                    <span className="truncate text-sm font-semibold">{pull.title}</span>
                    <Badge variant={pull.status === "MERGED" ? "success" : pull.status === "CLOSED" ? "danger" : "outline"}>
                      {pull.status}
                    </Badge>
                    {pull.risk ? <Badge variant="secondary">{pull.risk}</Badge> : null}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">{pull.sourceBranch}</code>
                    <span>→</span>
                    <code className="rounded bg-secondary px-1.5 py-0.5 font-mono">{pull.targetBranch}</code>
                    <span>·</span>
                    <span>{pull.changedFiles.length} {t.githost.files}</span>
                    <span>·</span>
                    <span>{timeAgo(pull.createdAt, locale)}</span>
                    {failed > 0 ? <span className="font-bold text-danger">· {failed} checks failed</span> : null}
                  </span>
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
              </button>
            )
          })}
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
