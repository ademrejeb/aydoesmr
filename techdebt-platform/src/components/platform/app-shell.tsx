"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Activity,
  Banknote,
  BookOpenText,
  Bot,
  BrainCircuit,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronsUpDown,
  ClipboardList,
  FolderKanban,
  GitBranch,
  Globe,
  Headset,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PartyPopper,
  Plus,
  Server,
  Settings2,
  Siren,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useChat } from "@/lib/chat/chat-provider"
import { atLeast, capabilitiesFor, NAV_SECTIONS, requirementSatisfied } from "@/lib/access"
import { useI18n, LOCALES, LOCALE_LABELS, type Dictionary } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dropdown, DropdownFooter, DropdownHeader, DropdownItem } from "@/components/ui/dropdown"
import { Tooltip } from "@/components/ui/tooltip"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { CommandPalette } from "@/components/platform/command-palette"
import { NotificationsBell } from "@/components/platform/notifications-bell"
import { FloatingDock } from "@/components/chat/floating-dock"

const SIDEBAR_KEY = "techdebt-sidebar"

type PlatformKey = keyof Dictionary["platform"]

interface NavEntry {
  href: string
  key: PlatformKey
  icon: LucideIcon
}

function OrgSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { organizations, currentOrg, setOrganization, token, refreshOrganizations } = useAuth()
  const { t } = useI18n()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")

  const createOrg = async (close: () => void) => {
    if (!name.trim() || !token) return
    setCreating(true)
    try {
      const created = await api.createOrganization({ name: name.trim() }, token)
      await refreshOrganizations?.()
      setOrganization(created)
      setName("")
      close()
    } catch {
      /* ignore */
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dropdown
      width="w-64"
      className="max-w-[calc(100vw-1.5rem)]"
      trigger={(open, toggle) => (
        <Tooltip tip={collapsed ? (currentOrg?.name ?? t.platform.organizations) : ""} className="w-full">
          <button
            onClick={toggle}
            aria-expanded={open}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-accent cursor-pointer",
              collapsed && "justify-center px-0"
            )}
          >
            <span className="hero-gradient flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black text-white">
              {currentOrg?.name?.[0] ?? "?"}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-start">{currentOrg?.name ?? t.platform.no_orgs}</span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </>
            )}
          </button>
        </Tooltip>
      )}
    >
      {(close) => (
        <>
          <DropdownHeader>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t.platform.organizations}
            </p>
          </DropdownHeader>
          <div className="max-h-56 overflow-y-auto py-1">
            {organizations.length === 0 && (
              <p className="px-3.5 py-3 text-xs text-muted-foreground">{t.platform.no_orgs}</p>
            )}
            {organizations.map((org) => (
              <DropdownItem
                key={org.id}
                active={currentOrg?.id === org.id}
                icon={
                  <span className="hero-gradient flex h-5 w-5 items-center justify-center rounded text-[9px] font-black text-white">
                    {org.name[0]}
                  </span>
                }
                onClick={() => {
                  setOrganization(org)
                  close()
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate">{org.name}</span>
                  {currentOrg?.id === org.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </span>
              </DropdownItem>
            ))}
          </div>
          <DropdownFooter>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createOrg(close)}
              placeholder={t.platform.org_name}
              className="input mb-2"
            />
            <Button size="sm" className="w-full" onClick={() => createOrg(close)} disabled={creating}>
              {t.platform.create_org_btn}
            </Button>
          </DropdownFooter>
        </>
      )}
    </Dropdown>
  )
}

function NewMenu({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const { t } = useI18n()
  const router = useRouter()
  const { currentOrg } = useAuth()
  const role = currentOrg?.role ?? null
  const caps = useMemo(() => capabilitiesFor(role), [role])

  const go = (path: string, close: () => void) => {
    close()
    onNavigate?.()
    router.push(path)
  }

  return (
    <Dropdown
      width="w-56"
      className="max-w-[calc(100vw-1.5rem)]"
      trigger={(open, toggle) => (
        <Tooltip tip={collapsed ? t.platform.new : ""} className="w-full">
          <button
            onClick={toggle}
            aria-expanded={open}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg bg-primary px-2.5 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 cursor-pointer",
              collapsed && "justify-center px-0"
            )}
          >
            <Plus className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-start">{t.platform.new}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-80" />
              </>
            )}
          </button>
        </Tooltip>
      )}
    >
      {(close) => (
        <div className="py-1">
          {caps.has("project_create") && (
            <DropdownItem icon={<FolderKanban className="h-4 w-4" />} onClick={() => go("/dashboard/projects?new=1", close)}>
              {t.platform.new_project}
            </DropdownItem>
          )}
          {caps.has("project_create") && (
            <DropdownItem icon={<GitBranch className="h-4 w-4" />} onClick={() => go("/dashboard/repositories?new=1", close)}>
              {t.platform.new_repository}
            </DropdownItem>
          )}
          {caps.has("pipeline_manage") && (
            <DropdownItem icon={<Workflow className="h-4 w-4" />} onClick={() => go("/dashboard/pipelines?new=1", close)}>
              {t.platform.new_pipeline}
            </DropdownItem>
          )}
          {caps.has("ai_use") && (
            <DropdownItem icon={<BrainCircuit className="h-4 w-4" />} onClick={() => go("/dashboard/ai?new=1", close)}>
              {t.platform.new_ai}
            </DropdownItem>
          )}
          {atLeast(role, "MEMBER") && (
            <DropdownItem icon={<MessageSquare className="h-4 w-4" />} onClick={() => go("/dashboard/messages?new=1", close)}>
              {t.platform.new_message}
            </DropdownItem>
          )}
          {caps.has("service_read") && (
            <DropdownItem icon={<ClipboardList className="h-4 w-4" />} onClick={() => go("/dashboard/service-desk/requests?new=1", close)}>
              {t.service.new_request}
            </DropdownItem>
          )}
          {caps.has("service_read") && (
            <DropdownItem icon={<Siren className="h-4 w-4" />} onClick={() => go("/dashboard/service-desk/incidents?new=1", close)}>
              {t.service.new_incident}
            </DropdownItem>
          )}
        </div>
      )}
    </Dropdown>
  )
}

function NavItem({ entry, active, collapsed, unread, onNavigate }: {
  entry: NavEntry
  active: boolean
  collapsed: boolean
  unread?: number
  onNavigate?: () => void
}) {
  const { t } = useI18n()
  const Icon = entry.icon
  const label = t.platform[entry.key] as string

  return (
    <Tooltip tip={collapsed ? label : ""} className="w-full">
      <Link
        href={entry.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
          collapsed && "justify-center px-0",
          active
            ? "bg-primary/10 font-semibold text-primary"
            : "font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        {active && <span className="absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-primary" />}
        <Icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="min-w-0 flex-1 truncate text-start">{label}</span>}
        {unread != null && unread > 0 && (
          collapsed ? (
            <span className="absolute end-1.5 top-1.5 h-2 w-2 rounded-full bg-danger" />
          ) : (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-danger/10 px-1.5 text-[10px] font-bold text-danger">
              {unread > 99 ? "99+" : unread}
            </span>
          )
        )}
      </Link>
    </Tooltip>
  )
}

function LocaleSwitcher() {
  const { locale, setLocale } = useI18n()
  return (
    <Dropdown
      align="end"
      width="w-44"
      trigger={(open, toggle) => (
        <button
          onClick={toggle}
          aria-expanded={open}
          aria-label="Language"
          className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <Globe className="h-4 w-4" />
          <span className="uppercase">{locale}</span>
        </button>
      )}
    >
      {() => (
        <div className="py-1">
          {LOCALES.map((l) => (
            <DropdownItem
              key={l}
              active={locale === l}
              onClick={() => setLocale(l)}
              icon={<span className="w-5 text-center text-xs font-bold uppercase">{l}</span>}
            >
              <span className="flex items-center justify-between gap-2">
                {LOCALE_LABELS[l]}
                {locale === l && <Check className="h-3.5 w-3.5 text-primary" />}
              </span>
            </DropdownItem>
          ))}
        </div>
      )}
    </Dropdown>
  )
}

function UserMenu({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user, logout } = useAuth()
  const { t } = useI18n()
  const name = user?.fullName ?? user?.email ?? "?"

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <Tooltip tip={t.platform.expand}>
          <button
            onClick={onToggle}
            aria-label={t.platform.expand}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        </Tooltip>
        <Tooltip tip={name}>
          <span>
            <Avatar name={name} src={user?.avatarUrl} size="md" />
          </span>
        </Tooltip>
        <Tooltip tip={t.platform.sign_out}>
          <button
            onClick={logout}
            aria-label={t.platform.sign_out}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </Tooltip>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-2">
      <Avatar name={name} src={user?.avatarUrl} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold leading-tight">{user?.fullName ?? t.platform.profile}</p>
        <p className="truncate text-[10px] text-muted-foreground">{user?.email}</p>
      </div>
      <Tooltip tip={t.platform.collapse}>
        <button
          onClick={onToggle}
          aria-label={t.platform.collapse}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </Tooltip>
      <Tooltip tip={t.platform.sign_out}>
        <button
          onClick={logout}
          aria-label={t.platform.sign_out}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </Tooltip>
    </div>
  )
}

function SidebarContent({ collapsed, onToggle, onNavigate }: {
  collapsed: boolean
  onToggle: () => void
  onNavigate?: () => void
}) {
  const { t } = useI18n()
  const { currentOrg } = useAuth()
  const pathname = usePathname()
  const { unread } = useChat()

  // Section visibility mirrors the backend access matrix via NAV_SECTIONS
  // (src/lib/access.ts) — the same source the admin Roles tab renders, so each
  // role only sees sections the API will actually let it use.
  const role = currentOrg?.role ?? null

  const sections = useMemo(() => {
    const meta: Record<string, { href: string; icon: LucideIcon }> = {
      overview: { href: "/dashboard", icon: LayoutDashboard },
      projects: { href: "/dashboard/projects", icon: FolderKanban },
      repositories: { href: "/dashboard/repositories", icon: GitBranch },
      messages: { href: "/dashboard/messages", icon: MessageSquare },
      teams: { href: "/dashboard/teams", icon: Users },
      dev: { href: "/dashboard/dev", icon: Activity },
      dev_rules: { href: "/dashboard/dev/rules", icon: SlidersHorizontal },
      issues: { href: "/dashboard/dev/issues", icon: ShieldAlert },
      pipelines: { href: "/dashboard/pipelines", icon: Workflow },
      servers: { href: "/dashboard/servers", icon: Server },
      ai: { href: "/dashboard/ai", icon: BrainCircuit },
      agent_factory: { href: "/dashboard/agents", icon: Bot },
      service_desk: { href: "/dashboard/service-desk", icon: Headset },
      service_requests: { href: "/dashboard/service-desk/requests", icon: ClipboardList },
      service_incidents: { href: "/dashboard/service-desk/incidents", icon: Siren },
      service_knowledge: { href: "/dashboard/service-desk/knowledge", icon: BookOpenText },
      timesheet: { href: "/dashboard/timesheet", icon: CalendarClock },
      leave: { href: "/dashboard/leave", icon: CalendarCheck },
      leave_settings: { href: "/dashboard/leave/settings", icon: Settings2 },
      holidays: { href: "/dashboard/holidays", icon: PartyPopper },
      payroll: { href: "/dashboard/payroll", icon: Banknote },
      admin: { href: "/dashboard/admin", icon: ShieldCheck },
    }

    const titles: Record<(typeof NAV_SECTIONS)[number]["id"], string> = {
      workspace: t.platform.workspace,
      engineering: t.platform.engineering,
      service_desk: t.platform.service_desk_section,
      management: t.platform.management,
      admin: t.platform.admin,
    }

    return NAV_SECTIONS.map((section) => ({
      title: titles[section.id],
      items: section.items
        .filter((item) => requirementSatisfied(role, item))
        .map((item) => ({
          href: meta[item.key].href,
          key: item.key as PlatformKey,
          icon: meta[item.key].icon,
        })),
    })).filter((section) => section.items.length > 0)
  }, [t, role])

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 items-center gap-2.5", collapsed ? "justify-center px-2" : "px-4")}>
        <Link href="/dashboard" onClick={onNavigate} className="flex min-w-0 items-center gap-2.5">
          <span className="hero-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white">
            T
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold leading-tight">{t.nav.title}</span>
              <span className="block truncate text-[10px] text-muted-foreground">{t.nav.subtitle}</span>
            </span>
          )}
        </Link>
      </div>

      <div className={cn("space-y-2 pb-2", collapsed ? "px-2" : "px-3")}>
        <OrgSwitcher collapsed={collapsed} />
        <NewMenu collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <nav className={cn("flex-1 space-y-5 overflow-y-auto py-2", collapsed ? "px-2" : "px-3")}>
        {sections.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((entry) => {
                const active =
                  pathname === entry.href ||
                  (entry.href !== "/dashboard" && pathname.startsWith(entry.href))
                return (
                  <NavItem
                    key={entry.href}
                    entry={entry}
                    active={active}
                    collapsed={collapsed}
                    unread={entry.key === "messages" ? unread : undefined}
                    onNavigate={onNavigate}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("border-t border-border", collapsed ? "p-2" : "p-3")}>
        <UserMenu collapsed={collapsed} onToggle={onToggle} />
      </div>
    </div>
  )
}

function TopbarTitle() {
  const pathname = usePathname()
  const { t } = useI18n()
  const title = useMemo(() => {
    const map: [string, string][] = [
      ["/dashboard/dev/issues", t.platform.issues],
      ["/dashboard/dev/rules", t.platform.dev_rules],
      ["/dashboard/dev", t.platform.dev],
      ["/dashboard/pipelines", t.platform.pipelines],
      ["/dashboard/servers", t.platform.servers],
      ["/dashboard/ai", t.platform.ai],
      ["/dashboard/agents", t.platform.agent_factory],
      ["/dashboard/projects", t.platform.projects],
      ["/dashboard/repositories", t.platform.repositories],
      ["/dashboard/messages", t.platform.messages],
      ["/dashboard/teams", t.platform.teams],
      ["/dashboard/timesheet", t.platform.timesheet],
      ["/dashboard/leave", t.platform.leave],
      ["/dashboard/holidays", t.platform.holidays],
      ["/dashboard/payroll", t.platform.payroll],
      ["/dashboard/service-desk/requests", t.platform.service_requests],
      ["/dashboard/service-desk/incidents", t.platform.service_incidents],
      ["/dashboard/service-desk/knowledge", t.platform.service_knowledge],
      ["/dashboard/service-desk", t.platform.service_desk],
      ["/dashboard/admin", t.platform.admin],
      ["/dashboard", t.platform.overview],
    ]
    for (const [prefix, label] of map) {
      if (prefix === "/dashboard" ? pathname === prefix : pathname.startsWith(prefix)) return label
    }
    return t.nav.title
  }, [pathname, t])
  return <h1 className="truncate text-sm font-semibold">{title}</h1>
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (window.localStorage.getItem(SIDEBAR_KEY) === "1") setCollapsed(true)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed((v) => {
      window.localStorage.setItem(SIDEBAR_KEY, v ? "0" : "1")
      return !v
    })
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-e border-border bg-card transition-[width] duration-200 lg:flex lg:flex-col",
          collapsed ? "w-[4.75rem]" : "w-64"
        )}
      >
        <SidebarContent collapsed={collapsed} onToggle={toggleCollapsed} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-drawer lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-overlay-in"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="animate-drawer absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col border-e border-border bg-card shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label={t.platform.close}
              className="absolute end-2 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent collapsed={false} onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-sticky border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex items-center gap-2 px-3 py-2.5 md:px-5">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label={t.platform.menu}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:hidden cursor-pointer"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="hidden min-w-0 md:block">
              <TopbarTitle />
            </div>
            <div className="ms-auto flex items-center gap-1.5">
              <CommandPalette />
              <ThemeToggle />
              <LocaleSwitcher />
              <NotificationsBell />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 md:px-6 md:py-6 lg:px-8">{children}</main>
        <FloatingDock />
      </div>
    </div>
  )
}