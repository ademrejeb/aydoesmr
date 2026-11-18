"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Calendar,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  FolderKanban,
  GitBranch,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type Project } from "@/lib/api"
import { useI18n, type Dictionary } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { Dropdown, DropdownItem } from "@/components/ui/dropdown"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"

const PROJECT_TYPES = ["GENERAL", "ENGINEERING", "MARKETING", "SALES", "HR", "OTHER"] as const
const PROJECT_COLORS = ["#2563eb", "#7c3aed", "#ec4899", "#f59e0b", "#22c55e", "#0ea5e9", "#ef4444"]

function statusVariant(status: string): "success" | "secondary" | "outline" {
  const s = status?.toUpperCase()
  if (s === "ACTIVE") return "success"
  if (s === "ARCHIVED") return "secondary"
  return "outline"
}

function ProjectCard({ project, t, locale }: { project: Project; t: Dictionary; locale: string }) {
  const router = useRouter()
  const initial = (project.key ?? project.name).slice(0, 2).toUpperCase()
  const isPublic = project.visibility?.toLowerCase() === "public"

  return (
    <div className="card-hover group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: project.color }} />
      <Link
        href={`/dashboard/projects/${project.id}`}
        className="flex flex-1 flex-col p-5 pt-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start gap-3 pe-10">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white shadow-sm"
            style={{ backgroundColor: project.color }}
          >
            {initial}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-bold transition-colors group-hover:text-primary">{project.name}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">
                {project.key ?? initial}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {t.projects.types[project.type as keyof typeof t.projects.types] ?? project.type}
              </Badge>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
          <div className="flex flex-col gap-1 rounded-lg bg-muted/60 px-2 py-1.5">
            <span className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              {t.projects.tasks}
            </span>
            <span className="text-sm font-bold">{project._count.tasks}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted/60 px-2 py-1.5">
            <span className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
              <GitBranch className="h-3 w-3 shrink-0" />
              {t.platform.repositories}
            </span>
            <span className="text-sm font-bold">{project._count.repositories + (project._count.gitRepositories ?? 0)}</span>
          </div>
          <div className="flex flex-col gap-1 rounded-lg bg-muted/60 px-2 py-1.5">
            <span className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
              <LayoutGrid className="h-3 w-3 shrink-0" />
              {t.projects.boards}
            </span>
            <span className="text-sm font-bold">{project._count.workflows}</span>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          {project.dueDate && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(project.dueDate).toLocaleDateString(locale)}
            </span>
          )}
          <span className="ms-auto flex items-center gap-1.5">
            <Badge variant={isPublic ? "success" : "secondary"} dot className="text-[10px]">
              {isPublic ? t.githost.public : t.githost.private}
            </Badge>
            <Badge variant={statusVariant(project.status)} dot className="text-[10px]">
              {project.status}
            </Badge>
          </span>
        </div>
      </Link>

      <div className="absolute end-3 top-3">
        <Dropdown
          align="end"
          width="w-48"
          trigger={(open, toggle) => (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={t.platform.menu}
              aria-expanded={open}
              onClick={toggle}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          )}
        >
          <DropdownItem
            icon={<ExternalLink className="h-4 w-4" />}
            onClick={() => router.push(`/dashboard/projects/${project.id}`)}
          >
            {t.projects.view}
          </DropdownItem>
        </Dropdown>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("ALL")
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState("")
  const [key, setKey] = useState("")
  const [type, setType] = useState<string>("GENERAL")
  const [color, setColor] = useState<string>(PROJECT_COLORS[0])
  const [repoUrl, setRepoUrl] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!token || !currentOrg) {
      setLoading(false)
      return
    }
    try {
      setProjects(await api.listProjects(token, currentOrg.id))
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

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1") {
      setShowCreate(true)
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((project) => {
      const matchesQ =
        !q ||
        project.name.toLowerCase().includes(q) ||
        (project.key ?? "").toLowerCase().includes(q)
      const matchesType = typeFilter === "ALL" || project.type === typeFilter
      return matchesQ && matchesType
    })
  }, [projects, search, typeFilter])

  const createProject = async () => {
    if (!token || !currentOrg || !name.trim()) return
    setBusy(true)
    try {
      const created = await api.createProject(
        { name: name.trim(), key: key.trim() || undefined, type, color },
        token,
        currentOrg.id
      )
      if (repoUrl.trim()) {
        try {
          await api.createRepository({ url: repoUrl.trim(), projectId: created.id }, token, currentOrg.id)
        } catch {
          /* linked later from the Git tab */
        }
      }
      setName("")
      setKey("")
      setRepoUrl("")
      setShowCreate(false)
      await load()
      toast.success(t.projects.create, created.name)
    } catch {
      toast.error(t.errors.network_error)
    } finally {
      setBusy(false)
    }
  }

  const searchInputCls =
    "h-10 w-full rounded-md border border-border bg-card ps-9 pe-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
  const selectInputCls =
    "h-10 w-full cursor-pointer rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold md:text-3xl">{t.projects.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{currentOrg?.name}</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          {t.projects.create}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.agile.search}
            aria-label={t.agile.search}
            className={searchInputCls}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label={t.projects.type}
          className={cn(selectInputCls, "sm:w-44")}
        >
          <option value="ALL">{t.projects.all}</option>
          {PROJECT_TYPES.map((pt) => (
            <option key={pt} value={pt}>
              {t.projects.types[pt]}
            </option>
          ))}
        </select>
      </div>

      {loadError && !loading && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </div>
              <Skeleton className="mt-4 h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title={projects.length === 0 ? t.projects.empty : t.search.no_results}
          description={projects.length === 0 ? currentOrg?.name : t.projects.no_match}
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t.projects.create}
            </Button>
          }
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {filtered.length} {t.platform.projects}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} t={t} locale={locale} />
            ))}
          </div>
        </>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t.projects.new_project}
        description={currentOrg?.name}
        size="md"
        closeLabel={t.platform.close}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              {t.platform.cancel}
            </Button>
            <Button onClick={createProject} disabled={busy || !name.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t.projects.create}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.projects.name}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" autoFocus />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.projects.key}</label>
            <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="PRJ" className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.projects.type}</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="input cursor-pointer"
            >
              {PROJECT_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {t.projects.types[pt]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.projects.color}</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  title={c}
                  className={cn(
                    "h-8 w-8 rounded-full transition-transform cursor-pointer",
                    color === c ? "ring-2 ring-ring ring-offset-2 scale-110" : "hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.repo.url_label}</label>
            <input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder={t.repo.url_placeholder}
              className="input"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}