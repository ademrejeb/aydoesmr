"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Activity,
  BookOpenText,
  Building2,
  ClipboardList,
  CornerDownLeft,
  FolderKanban,
  GitBranch,
  Headset,
  LayoutDashboard,
  MessageSquare,
  Search,
  ShieldAlert,
  Siren,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react"
import { api, type Conversation, type GitRepository, type Project } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { cn } from "@/lib/utils"

interface Item {
  id: string
  label: string
  sub?: string
  icon: LucideIcon
  run: () => void
}

interface Group {
  title: string
  items: Item[]
}

const RECENT_KEY = "techdebt-recent"

export function CommandPalette() {
  const router = useRouter()
  const { token, currentOrg, organizations, setOrganization } = useAuth()
  const { t } = useI18n()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [projects, setProjects] = useState<Project[]>([])
  const [repos, setRepos] = useState<GitRepository[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadedOrg, setLoadedOrg] = useState<string | null>(null)
  const [recent, setRecent] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    const id = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => {
      document.body.style.overflow = ""
      window.clearTimeout(id)
    }
  }, [open])

  useEffect(() => {
    if (!open || !token || !currentOrg || loadedOrg === currentOrg.id) return
    let alive = true
    Promise.all([
      api.listProjects(token, currentOrg.id).catch(() => [] as Project[]),
      api.gitListRepositories(token, currentOrg.id).catch(() => [] as GitRepository[]),
      api.listConversations(token, currentOrg.id).catch(() => [] as Conversation[]),
    ]).then(([p, r, c]) => {
      if (!alive) return
      setProjects(p)
      setRepos(r)
      setConversations(c)
      setLoadedOrg(currentOrg.id)
    })
    try {
      const saved = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]")
      if (Array.isArray(saved)) setRecent(saved.filter((x) => typeof x === "string").slice(0, 5))
    } catch {
      /* ignore */
    }
    return () => {
      alive = false
    }
  }, [open, token, currentOrg, loadedOrg])

  const go = (href: string, key: string) => {
    const next = [key, ...recent.filter((k) => k !== key)].slice(0, 5)
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    setOpen(false)
    setQuery("")
    router.push(href)
  }

  const pages: Item[] = useMemo(
    () => [
      { id: "nav-overview", label: t.platform.overview, icon: LayoutDashboard, run: () => go("/dashboard", "nav-overview") },
      { id: "nav-projects", label: t.platform.projects, icon: FolderKanban, run: () => go("/dashboard/projects", "nav-projects") },
      { id: "nav-repositories", label: t.platform.repositories, icon: GitBranch, run: () => go("/dashboard/repositories", "nav-repositories") },
      { id: "nav-messages", label: t.platform.messages, icon: MessageSquare, run: () => go("/dashboard/messages", "nav-messages") },
      { id: "nav-teams", label: t.platform.teams, icon: Users, run: () => go("/dashboard/teams", "nav-teams") },
      { id: "nav-dev", label: t.platform.dev, icon: Activity, run: () => go("/dashboard/dev", "nav-dev") },
      { id: "nav-dev-rules", label: t.platform.dev_rules, icon: SlidersHorizontal, run: () => go("/dashboard/dev/rules", "nav-dev-rules") },
      { id: "nav-issues", label: t.platform.issues, icon: ShieldAlert, run: () => go("/dashboard/dev/issues", "nav-issues") },
      { id: "nav-service-desk", label: t.platform.service_desk, icon: Headset, run: () => go("/dashboard/service-desk", "nav-service-desk") },
      { id: "nav-service-requests", label: t.platform.service_requests, icon: ClipboardList, run: () => go("/dashboard/service-desk/requests", "nav-service-requests") },
      { id: "nav-service-incidents", label: t.platform.service_incidents, icon: Siren, run: () => go("/dashboard/service-desk/incidents", "nav-service-incidents") },
      { id: "nav-service-knowledge", label: t.platform.service_knowledge, icon: BookOpenText, run: () => go("/dashboard/service-desk/knowledge", "nav-service-knowledge") },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, recent]
  )

  const groups: Group[] = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (s?: string | null) => !q || (s ?? "").toLowerCase().includes(q)
    const result: Group[] = []

    const navItems = pages.filter((p) => match(p.label))
    if (navItems.length) result.push({ title: t.search.navigate, items: navItems })

    if (organizations.length > 1) {
      const orgItems: Item[] = organizations
        .filter((o) => match(o.name))
        .map((o) => ({
          id: `org-${o.id}`,
          label: o.name,
          sub: t.search.switch_org,
          icon: Building2,
          run: () => {
            setOrganization(o)
            setOpen(false)
            setQuery("")
          },
        }))
      if (orgItems.length) result.push({ title: t.platform.organizations, items: orgItems })
    }

    const projectItems: Item[] = projects
      .filter((p) => match(p.name))
      .map((p) => ({
        id: `project-${p.id}`,
        label: p.name,
        sub: p.key ?? undefined,
        icon: FolderKanban,
        run: () => go(`/dashboard/projects/${p.id}`, `project-${p.id}`),
      }))
    if (projectItems.length) result.push({ title: t.platform.projects, items: projectItems })

    const repoItems: Item[] = repos
      .filter((r) => match(r.name))
      .map((r) => ({
        id: `repo-${r.id}`,
        label: r.name,
        sub: r.defaultBranch,
        icon: GitBranch,
        run: () => go(`/dashboard/repositories/${r.id}`, `repo-${r.id}`),
      }))
    if (repoItems.length) result.push({ title: t.platform.repositories, items: repoItems })

    const convItems: Item[] = conversations
      .filter((c) => match(c.name))
      .map((c) => ({
        id: `conv-${c.id}`,
        label: c.name,
        sub: c.type === "GROUP" ? undefined : t.search.conversations,
        icon: MessageSquare,
        run: () => go("/dashboard/messages", `conv-${c.id}`),
      }))
    if (convItems.length) result.push({ title: t.search.conversations, items: convItems })

    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, pages, organizations, projects, repos, conversations, t, recent])

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const activeIndex = Math.min(active, Math.max(flat.length - 1, 0))

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, flat.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      flat[activeIndex]?.run()
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
      setQuery("")
    }
  }

  let cursor = -1
  const showRecent = query.trim().length === 0 && recent.length > 0
  const recentItems: Item[] = recent
    .map((key) => flat.find((i) => i.id === key))
    .filter((i): i is Item => Boolean(i))

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group hidden h-9 w-full max-w-xs items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm text-muted-foreground transition-colors hover:border-input hover:bg-accent sm:flex cursor-pointer"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-start">{t.platform.search_trigger}</span>
        <kbd className="hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground md:inline-flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        aria-label={t.platform.search_trigger}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:hidden cursor-pointer"
      >
        <Search className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-palette flex items-start justify-center p-3 pt-[12vh] sm:p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-overlay-in"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            className="relative z-hero w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl animate-slide-up"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                onKeyDown={onKeyDown}
                placeholder={t.search.placeholder}
                className="h-13 flex-1 bg-transparent py-4 text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                esc
              </kbd>
            </div>

            <div className="max-h-[52vh] overflow-y-auto p-2">
              {showRecent && recentItems.length > 0 && (
                <div className="mb-1">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {t.search.recent}
                  </p>
                  {recentItems.map((item) => (
                    <Row
                      key={`recent-${item.id}`}
                      item={item}
                      active={false}
                      onHover={() => undefined}
                      onRun={item.run}
                      showSection={false}
                    />
                  ))}
                </div>
              )}

              {groups.map((group) => (
                <div key={group.title} className="mb-1">
                  <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </p>
                  {group.items.map((item) => {
                    cursor += 1
                    const isActive = cursor === activeIndex
                    return (
                      <Row
                        key={item.id}
                        item={item}
                        active={isActive}
                        onHover={() => setActive(cursor)}
                        onRun={item.run}
                      />
                    )
                  })}
                </div>
              ))}

              {flat.length === 0 && (
                <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                  {t.search.no_results} “{query}”
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-2.5 text-[11px] text-muted-foreground">
              <span>{t.search.hint}</span>
              <span className="inline-flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" /> {t.platform.search_trigger}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Row({
  item,
  active,
  onHover,
  onRun,
  showSection = true,
}: {
  item: Item
  active: boolean
  onHover: () => void
  onRun: () => void
  showSection?: boolean
}) {
  const Icon = item.icon
  return (
    <button
      onMouseEnter={onHover}
      onClick={onRun}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-start text-sm transition-colors cursor-pointer",
        active ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/60"
      )}
    >
      <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card", active && "border-primary/30 text-primary")}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
      {showSection && item.sub && (
        <span className="shrink-0 truncate text-xs text-muted-foreground">{item.sub}</span>
      )}
    </button>
  )
}