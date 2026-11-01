"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  Copy,
  Crown,
  Database,
  KeyRound,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { NAV_SECTIONS, requirementSatisfied } from "@/lib/access"
import { api, type AccessCatalog, type AuditLog, type GitToken, type HolidaySource, type Invite, type OrgMember } from "@/lib/api"
import { useI18n, type Dictionary } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { timeAgo, cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Modal } from "@/components/ui/modal"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/ui/stat-card"
import { Tooltip } from "@/components/ui/tooltip"

type AdminTab = "overview" | "members" | "invites" | "tokens" | "roles" | "audit" | "settings"

const ROLES_ORDER = ["OWNER", "ADMIN", "MANAGER", "MEMBER", "VIEWER"] as const

const SECTION_LABELS: Record<(typeof NAV_SECTIONS)[number]["id"], (t: Dictionary) => string> = {
  workspace: (t) => t.platform.workspace as string,
  engineering: (t) => t.platform.engineering as string,
  service_desk: (t) => t.platform.service_desk_section as string,
  management: (t) => t.platform.management as string,
  admin: (t) => t.platform.admin as string,
}

const TIMEZONES = [
  "Africa/Tunis",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/London",
  "Asia/Dubai",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
]

const CURRENCIES = ["USD", "EUR", "GBP", "TND", "AED", "JPY"]

const LOCALE_OPTIONS: { value: string; label: string }[] = [
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
]

function RoleBadge({ role, t }: { role: string; t: Dictionary }) {
  const label = t.admin.member_roles[role] ?? role
  if (role === "OWNER") {
    return (
      <Badge variant="success" dot className="shrink-0 text-[10px]">
        <Crown className="h-3 w-3" />
        {label}
      </Badge>
    )
  }
  if (role === "ADMIN") return <Badge variant="info" className="shrink-0 text-[10px]">{label}</Badge>
  if (role === "MANAGER") return <Badge variant="warning" className="shrink-0 text-[10px]">{label}</Badge>
  if (role === "MEMBER") return <Badge variant="default" className="shrink-0 text-[10px]">{label}</Badge>
  return <Badge variant="secondary" className="shrink-0 text-[10px]">{label}</Badge>
}

interface LoadedData {
  detail: Awaited<ReturnType<typeof api.getOrganization>>
  members: OrgMember[]
  invites: Invite[]
  tokens: GitToken[]
  catalog: AccessCatalog
  audits: AuditLog[]
  projects: Awaited<ReturnType<typeof api.listProjects>>
}

export default function AdminPage() {
  const { token, currentOrg, user } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()

  const [tab, setTab] = useState<AdminTab>("overview")
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<LoadedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [auditFilter, setAuditFilter] = useState<string>("ALL")

  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("MEMBER")
  const [inviteTitle, setInviteTitle] = useState("")
  const [inviting, setInviting] = useState(false)

  const [tokenName, setTokenName] = useState("")
  const [creatingToken, setCreatingToken] = useState(false)
  const [newTokenValue, setNewTokenValue] = useState<string | null>(null)

  const [removeTarget, setRemoveTarget] = useState<OrgMember | null>(null)
  const [removing, setRemoving] = useState(false)

  const [savingSettings, setSavingSettings] = useState(false)
  const [settings, setSettings] = useState({
    name: "",
    billingEmail: "",
    timezone: "",
    currency: "",
    locale: "",
    holidayCountry: "",
    holidayRegion: "",
    workWeekStart: 0,
  })
  const [holidaySources, setHolidaySources] = useState<HolidaySource[]>([])

  const canAdmin = currentOrg?.role === "ADMIN" || currentOrg?.role === "OWNER"

  const load = useCallback(async () => {
    if (!token || !currentOrg) return
    setLoading(true)
    setError(null)
    try {
      const [detail, members, invites, tokens, catalog, audits, projects] = await Promise.all([
        api.getOrganization(token, currentOrg.id),
        api.listMembers(token, currentOrg.id),
        api.listInvites(token, currentOrg.id),
        api.gitListTokens(token, currentOrg.id),
        api.getAccessCatalog(token, currentOrg.id),
        api.listAuditLogs(token, currentOrg.id),
        api.listProjects(token, currentOrg.id),
      ])
      setData({ detail, members, invites, tokens, catalog, audits, projects })
      setInviteRole("MEMBER")
      setSettings({
        name: detail.name ?? "",
        billingEmail: (detail as { billingEmail?: string }).billingEmail ?? "",
        timezone: detail.timezone ?? "",
        currency: detail.currency ?? "",
        locale: detail.locale ?? locale,
        holidayCountry: (detail as { holidayCountry?: string }).holidayCountry ?? "",
        holidayRegion: (detail as { holidayRegion?: string }).holidayRegion ?? "",
        workWeekStart: (detail as { workWeekStart?: number }).workWeekStart ?? 0,
      })
    } catch (e) {
      setError((e as Error)?.message ?? "Error")
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg, locale])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!token || !currentOrg) return
    api
      .listHolidaySources(token, currentOrg.id, locale)
      .then((list) => setHolidaySources(Array.isArray(list) ? list : []))
      .catch(() => setHolidaySources([]))
  }, [token, currentOrg, locale])

  const refresh = async () => {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const filteredAudits = useMemo(() => {
    if (!data) return []
    if (auditFilter === "ALL") return data.audits
    return data.audits.filter((a) => a.action === auditFilter)
  }, [data, auditFilter])

  const pendingInvites = useMemo(() => data?.invites.filter((i) => i.status === "PENDING") ?? [], [data])

  const inviteMember = async () => {
    if (!token || !currentOrg || !inviteEmail.trim()) return
    setInviting(true)
    try {
      await api.inviteMember(token, currentOrg.id, { email: inviteEmail.trim(), role: inviteRole, title: inviteTitle.trim() || undefined })
      toast.success(t.admin.invite_sent)
      setInviteEmail("")
      setInviteTitle("")
      await load()
    } catch (e) {
      toast.error((e as Error)?.message ?? "Error")
    } finally {
      setInviting(false)
    }
  }

  const revokeInvite = async (inviteId: string) => {
    if (!token || !currentOrg) return
    try {
      await api.revokeInvite(token, currentOrg.id, inviteId)
      toast.success(t.admin.invite_revoked)
      await load()
    } catch (e) {
      toast.error((e as Error)?.message ?? "Error")
    }
  }

  const updateMemberRole = async (member: OrgMember, role: string) => {
    if (!token || !currentOrg) return
    try {
      await api.updateMemberRole(token, currentOrg.id, member.id, { role })
      toast.success(t.admin.member_updated)
      await load()
    } catch (e) {
      toast.error((e as Error)?.message ?? "Error")
    }
  }

  const createToken = async () => {
    if (!token || !currentOrg || !tokenName.trim()) return
    setCreatingToken(true)
    try {
      const res = await api.gitCreateToken({ name: tokenName.trim() }, token, currentOrg.id)
      setNewTokenValue(res.token)
      setTokenName("")
      await load()
    } catch (e) {
      toast.error((e as Error)?.message ?? "Error")
    } finally {
      setCreatingToken(false)
    }
  }

  const revokeToken = async (tokenId: string) => {
    if (!token || !currentOrg) return
    try {
      await api.gitRevokeToken(token, currentOrg.id, tokenId)
      toast.success(t.admin.token_revoked)
      await load()
    } catch (e) {
      toast.error((e as Error)?.message ?? "Error")
    }
  }

  const doRemoveMember = async () => {
    if (!token || !currentOrg || !removeTarget) return
    setRemoving(true)
    try {
      await api.removeMember(token, currentOrg.id, removeTarget.id)
      toast.success(t.admin.member_removed)
      setRemoveTarget(null)
      await load()
    } catch (e) {
      toast.error((e as Error)?.message ?? "Error")
    } finally {
      setRemoving(false)
    }
  }

  const saveSettings = async () => {
    if (!token || !currentOrg) return
    setSavingSettings(true)
    try {
      await api.updateOrganization(token, currentOrg.id, {
        name: settings.name.trim() || undefined,
        billingEmail: settings.billingEmail.trim() || undefined,
        timezone: settings.timezone || undefined,
        currency: settings.currency || undefined,
        locale: settings.locale || undefined,
        holidayCountry: settings.holidayCountry || undefined,
        holidayRegion: settings.holidayRegion || undefined,
        workWeekStart: settings.workWeekStart,
      })
      toast.success(t.admin.saved)
      await load()
    } catch (e) {
      toast.error((e as Error)?.message ?? "Error")
    } finally {
      setSavingSettings(false)
    }
  }

  if (!currentOrg) return null

  if (!canAdmin) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          icon={ShieldCheck}
          title={t.admin.not_admin}
          description={t.admin.subtitle}
          action={
            <Link href="/dashboard" className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium text-card-foreground transition-colors hover:bg-accent">
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
              {t.admin.back_to_dashboard}
            </Link>
          }
        />
      </div>
    )
  }

  const tabs: { id: AdminTab; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: t.admin.overview, icon: Activity },
    { id: "members", label: t.admin.members, icon: Users },
    { id: "invites", label: t.admin.invites, icon: Mail },
    { id: "tokens", label: t.admin.tokens, icon: KeyRound },
    { id: "roles", label: t.admin.roles, icon: ShieldCheck },
    { id: "audit", label: t.admin.audit, icon: ClipboardCheck },
    { id: "settings", label: t.admin.settings, icon: Save },
  ]

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={t.admin.back_to_dashboard}
          >
            <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{t.admin.tab}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{t.admin.subtitle}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {t.repo.refresh}
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {tabs.map((tabItem) => {
          const Icon = tabItem.icon
          return (
            <button
              key={tabItem.id}
              onClick={() => setTab(tabItem.id)}
              aria-current={tab === tabItem.id ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                tab === tabItem.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tabItem.label}
            </button>
          )
        })}
      </div>

      {loading && (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      )}

      {!loading && error && (
        <EmptyState icon={ShieldCheck} title={error} description={t.admin.not_admin} />
      )}

      {!loading && !error && data && (
        <>
          {tab === "overview" && (
            <OverviewTab data={data} t={t} locale={locale} pendingCount={pendingInvites.length} />
          )}

          {tab === "members" && (
            <MembersTab
              members={data.members}
              t={t}
              currentUserId={user?.id}
              currentRole={currentOrg.role}
              onRoleChange={updateMemberRole}
              onRemove={setRemoveTarget}
            />
          )}

          {tab === "invites" && (
            <InvitesTab
              invites={data.invites}
              t={t}
              email={inviteEmail}
              setEmail={setInviteEmail}
              role={inviteRole}
              setRole={setInviteRole}
              title={inviteTitle}
              setTitle={setInviteTitle}
              inviting={inviting}
              onSend={inviteMember}
              onRevoke={revokeInvite}
            />
          )}

          {tab === "tokens" && (
            <TokensTab
              tokens={data.tokens}
              t={t}
              name={tokenName}
              setName={setTokenName}
              creating={creatingToken}
              onCreate={createToken}
              onRevoke={revokeToken}
              newTokenValue={newTokenValue}
              onCloseToken={setNewTokenValue.bind(null, null)}
            />
          )}

          {tab === "roles" && <RolesTab catalog={data.catalog} t={t} />}

          {tab === "audit" && (
            <AuditTab audits={data.audits} filtered={filteredAudits} t={t} locale={locale} filter={auditFilter} setFilter={setAuditFilter} />
          )}

          {tab === "settings" && (
            <SettingsTab
              t={t}
              values={settings}
              setValues={setSettings}
              saving={savingSettings}
              onSave={saveSettings}
              detail={data.detail}
              sources={holidaySources}
            />
          )}
        </>
      )}

      <Modal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title={t.admin.remove}
        description={removeTarget ? `${removeTarget.user.fullName ?? removeTarget.user.email} · ${removeTarget.user.email}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              {t.platform.cancel}
            </Button>
            <Button variant="destructive" onClick={doRemoveMember} disabled={removing}>
              {removing && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.admin.remove}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{t.admin.member_removed}</p>
      </Modal>
    </div>
  )
}

function StorageInfoCard({ t }: { t: Dictionary }) {
  const { token, currentOrg } = useAuth()
  const [info, setInfo] = useState<{ driver?: string; bucket?: string; endpoint?: string | null; maxUploadBytes?: number } | null>(null)

  useEffect(() => {
    if (!token || !currentOrg) return
    let cancelled = false
    fetch(`${api.baseUrl}/organizations/${currentOrg.id}/files/storage-info`, {
      headers: { Authorization: `Bearer ${token}`, "X-Organization-Id": currentOrg.id },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setInfo(data)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [token, currentOrg])

  if (!info) return null
  const driverLabel = info.driver === "s3" ? t.admin.storage_s3 : t.admin.storage_local
  const maxMb = info.maxUploadBytes ? Math.round(info.maxUploadBytes / 1024 / 1024) : 10

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Database className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-semibold">{t.admin.storage_attachments}</h2>
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">{t.admin.storage_driver}</dt>
          <dd className="font-semibold">{driverLabel}</dd>
        </div>
        {info.driver === "s3" && info.bucket && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{t.admin.storage_bucket}</dt>
            <dd className="truncate font-mono text-xs font-medium">{info.bucket}</dd>
          </div>
        )}
        {info.endpoint && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">{t.admin.storage_endpoint}</dt>
            <dd className="truncate font-mono text-xs font-medium">{info.endpoint}</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">{t.admin.storage_max}</dt>
          <dd className="font-semibold">{maxMb} MB</dd>
        </div>
      </dl>
    </div>
  )
}

function OverviewTab({ data, t, locale, pendingCount }: { data: LoadedData; t: Dictionary; locale: string; pendingCount: number }) {
  const projects = (data.projects ?? []) as Array<{ id: string }>
  const projectsCount = projects.length
  const billing = data.detail.billing
  const plan = billing?.plan?.toUpperCase() ?? data.detail.plan?.toUpperCase() ?? "—"
  const seats = billing?.seats ?? "—"

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label={t.admin.stat_members}
          value={data.members.length}
          hint={data.members[0]?.user.fullName ?? data.members[0]?.user.email}
        />
        <StatCard icon={<Mail className="h-4 w-4" />} label={t.admin.stat_invites} value={pendingCount} />
        <StatCard icon={<Activity className="h-4 w-4" />} label={t.admin.stat_projects} value={projectsCount} />
        <StatCard icon={<ClipboardCheck className="h-4 w-4" />} label={t.admin.stat_audit_events} value={data.audits.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold">{t.admin.access_intro}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.admin.access_list_intro}</p>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border p-5">
            <div className="absolute inset-0 hero-gradient opacity-10" />
            <div className="relative">
              <p className="text-sm font-semibold">{t.admin.members}</p>
              <div className="mt-3 flex flex-col gap-2.5">
                {data.members.slice(0, 6).map((m) => {
                  const displayName = m.user.fullName ?? m.user.email
                  return (
                    <div key={m.id} className="flex items-center gap-3">
                      <Avatar name={displayName} src={m.user.avatarUrl} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                      </div>
                      <RoleBadge role={m.role} t={t} />
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">{t.admin.settings}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t.admin.plan}</dt>
              <dd className="font-semibold">{plan}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t.admin.seats}</dt>
              <dd className="font-semibold">{seats}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t.admin.timezone}</dt>
              <dd className="font-semibold">{data.detail.timezone ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t.admin.currency}</dt>
              <dd className="font-semibold">{data.detail.currency ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">{t.admin.locale}</dt>
              <dd className="font-semibold">{locale}</dd>
            </div>
          </dl>
        </div>

        <StorageInfoCard t={t} />
      </div>
    </div>
  )
}

function MembersTab({
  members,
  t,
  currentUserId,
  currentRole,
  onRoleChange,
  onRemove,
}: {
  members: OrgMember[]
  t: Dictionary
  currentUserId: string | undefined
  currentRole: string | undefined
  onRoleChange: (member: OrgMember, role: string) => void
  onRemove: (member: OrgMember) => void
}) {
  const roleRank = (r: string) => ROLES_ORDER.indexOf(r as (typeof ROLES_ORDER)[number])

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full min-w-[540px] text-sm">
        <thead>
          <tr className="border-b border-border text-start text-xs uppercase tracking-wider text-muted-foreground">
            <th className="px-5 py-3 text-start font-semibold">{t.admin.members}</th>
            <th className="px-5 py-3 text-start font-semibold">{t.admin.roles}</th>
            <th className="px-5 py-3 text-end font-semibold">{t.admin.remove}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((m) => {
            const displayName = m.user.fullName ?? m.user.email
            const isSelf = currentUserId === m.user.id
            const isOwner = m.role === "OWNER"
            const canEdit = !isOwner && !isSelf && (currentRole === "OWNER" || (currentRole === "ADMIN" && roleRank(m.role) < roleRank("ADMIN")))
            return (
              <tr key={m.id} className={cn("transition-colors hover:bg-accent/40")}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={displayName} src={m.user.avatarUrl} size="sm" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="min-w-0 truncate font-medium">{displayName}</p>
                        {isSelf && <Badge variant="outline" className="text-[10px]">{t.platform.profile}</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{m.user.email}</p>
                      {m.title && <p className="truncate text-xs text-muted-foreground">{m.title}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <select
                        value={m.role}
                        onChange={(e) => onRoleChange(m, e.target.value)}
                        className="input h-8 cursor-pointer py-0 text-xs"
                        aria-label={t.admin.roles}
                      >
                        {ROLES_ORDER.filter((r) => r !== "OWNER").map((r) => (
                          <option key={r} value={r}>
                            {t.admin.member_roles[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <RoleBadge role={m.role} t={t} />
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-end">
                  {!isOwner && !isSelf && (
                    <Tooltip tip={t.admin.remove}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                        aria-label={t.admin.remove}
                        onClick={() => onRemove(m)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {members.length === 0 && (
        <EmptyState icon={Users} title={t.admin.members} description={t.admin.subtitle} className="border-0 bg-transparent" />
      )}
    </div>
  )
}

function InvitesTab({
  invites,
  t,
  email,
  setEmail,
  role,
  setRole,
  title,
  setTitle,
  inviting,
  onSend,
  onRevoke,
}: {
  invites: Invite[]
  t: Dictionary
  email: string
  setEmail: (v: string) => void
  role: string
  setRole: (v: string) => void
  title: string
  setTitle: (v: string) => void
  inviting: boolean
  onSend: () => void
  onRevoke: (inviteId: string) => void
}) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">{t.admin.send_invite}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.admin.email}</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="person@company.com"
                className="input ps-9"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.admin.roles}</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="input h-10 cursor-pointer">
              {ROLES_ORDER.filter((r) => r !== "OWNER").map((r) => (
                <option key={r} value={r}>
                  {t.admin.member_roles[r]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.admin.title}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.admin.title} className="input" />
          </div>
        </div>
        <Button className="mt-4" onClick={onSend} disabled={inviting || !email.trim()}>
          {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
          <Mail className="h-4 w-4" />
          {t.admin.send_invite}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-border text-start text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 text-start font-semibold">{t.admin.members}</th>
              <th className="px-5 py-3 text-start font-semibold">{t.admin.roles}</th>
              <th className="px-5 py-3 text-start font-semibold">{t.admin.status}</th>
              <th className="px-5 py-3 text-end font-semibold">{t.admin.remove}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {invites.map((inv) => {
              const status = inv.status === "PENDING" ? "pending" : inv.status === "ACCEPTED" ? "accepted" : "revoked"
              return (
                <tr key={inv.id} className="hover:bg-accent/40">
                  <td className="px-5 py-3">
                    <p className="font-medium">{inv.email}</p>
                    {inv.title && <p className="text-xs text-muted-foreground">{inv.title}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <RoleBadge role={inv.role} t={t} />
                  </td>
                  <td className="px-5 py-3">
                    <Badge
                      variant={status === "pending" ? "warning" : status === "accepted" ? "success" : "secondary"}
                      className="text-[10px]"
                    >
                      {status === "pending" ? t.admin.pending : status === "accepted" ? t.admin.accepted : t.admin.revoked}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-end">
                    {inv.status === "PENDING" && (
                      <Tooltip tip={t.admin.revoked}>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                          aria-label={t.admin.revoked}
                          onClick={() => onRevoke(inv.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </Tooltip>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {invites.length === 0 && (
          <EmptyState icon={Mail} title={t.admin.invites} description={t.admin.subtitle} className="border-0 bg-transparent" />
        )}
      </div>
    </div>
  )
}

function TokensTab({
  tokens,
  t,
  name,
  setName,
  creating,
  onCreate,
  onRevoke,
  newTokenValue,
  onCloseToken,
}: {
  tokens: GitToken[]
  t: Dictionary
  name: string
  setName: (v: string) => void
  creating: boolean
  onCreate: () => void
  onRevoke: (tokenId: string) => void
  newTokenValue: string | null
  onCloseToken: () => void
}) {
  const toast = useToast()
  const active = tokens.filter((tok) => !tok.revokedAt)
  const revoked = tokens.filter((tok) => !!tok.revokedAt)

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">{t.admin.create_token}</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.admin.token_name}
            className="input sm:max-w-sm"
            onKeyDown={(e) => e.key === "Enter" && onCreate()}
          />
          <Button onClick={onCreate} disabled={creating || !name.trim()}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t.admin.create_token}
          </Button>
        </div>

        {newTokenValue && (
          <div className="mt-4 rounded-xl border border-success/30 bg-success/5 p-4">
            <p className="text-xs font-semibold text-success">{t.admin.created_token}</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="input min-w-0 flex-1 font-mono text-xs">{newTokenValue}</code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(newTokenValue)
                  toast.success(t.admin.copied)
                }}
              >
                <Copy className="h-4 w-4" />
                {t.admin.copy}
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="mt-2 text-muted-foreground" onClick={onCloseToken}>
              {t.platform.close}
            </Button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-5 py-3 text-start font-semibold">{t.admin.token_name}</th>
                <th className="px-5 py-3 text-start font-semibold">{t.admin.last_used}</th>
                <th className="px-5 py-3 text-end font-semibold">{t.admin.remove}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {active.map((tok) => (
                <tr key={tok.id} className="hover:bg-accent/40">
                  <td className="px-5 py-3">
                    <p className="flex items-center gap-2 font-medium">
                      <KeyRound className="h-4 w-4 text-muted-foreground" />
                      {tok.name}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">{tok.prefix}••••••••</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground">
                    {tok.lastUsedAt ? timeAgo(tok.lastUsedAt) : t.admin.never}
                  </td>
                  <td className="px-5 py-3 text-end">
                    <Tooltip tip={t.admin.revoked}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                        aria-label={t.admin.revoked}
                        onClick={() => onRevoke(tok.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {active.length === 0 && (
          <EmptyState icon={KeyRound} title={t.admin.no_tokens} description={t.admin.subtitle} className="border-0 bg-transparent" />
        )}
        {revoked.length > 0 && (
          <div className="border-t border-border px-5 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t.admin.revoked}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {revoked.map((tok) => (
                <Badge key={tok.id} variant="secondary" className="text-[10px]">
                  {tok.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function RolesTab({ catalog, t }: { catalog: AccessCatalog; t: Dictionary }) {
  const caps = catalog.capabilities
  const roles = catalog.roles

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">{t.admin.access_intro}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.admin.access_list_intro}</p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-start text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 text-start font-semibold">{t.admin.roles}</th>
              {caps.map((cap) => (
                <th key={cap.key} className="px-3 py-3 text-center font-semibold" title={cap.description}>
                  {cap.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {roles.map((role) => (
              <tr key={role.role} className="hover:bg-accent/40">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <RoleBadge role={role.role} t={t} />
                  </div>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">{role.summary}</p>
                </td>
                {caps.map((cap) => (
                  <td key={cap.key} className="px-3 py-3 text-center">
                    {role.capabilities.includes(cap.key) ? (
                      <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-success/10 text-success">
                        <ClipboardCheck className="h-3.5 w-3.5" />
                      </span>
                    ) : (
                      <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground/40">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">{t.admin.nav_sections}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t.admin.nav_sections_hint}</p>
        </div>
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-start text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 text-start font-semibold" />
              {ROLES_ORDER.map((r) => (
                <th key={r} className="px-3 py-3 text-center font-semibold">
                  <RoleBadge role={r} t={t} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {NAV_SECTIONS.map((section) => (
              <Fragment key={section.id}>
                <tr className="bg-accent/30">
                  <td
                    colSpan={ROLES_ORDER.length + 1}
                    className="px-5 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    {SECTION_LABELS[section.id](t)}
                  </td>
                </tr>
                {section.items.map((item) => (
                  <tr key={item.key} className="hover:bg-accent/40">
                    <td className="px-5 py-2.5">
                      {t.platform[item.key as keyof Dictionary["platform"]] as string}
                    </td>
                    {ROLES_ORDER.map((r) => (
                      <td key={r} className="px-3 py-2.5 text-center">
                        {requirementSatisfied(r, item) ? (
                          <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-success/10 text-success">
                            <ClipboardCheck className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground/40">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AuditTab({
  audits,
  filtered,
  t,
  locale,
  filter,
  setFilter,
}: {
  audits: AuditLog[]
  filtered: AuditLog[]
  t: Dictionary
  locale: string
  filter: string
  setFilter: (v: string) => void
}) {
  const actions = useMemo(() => Array.from(new Set(audits.map((a) => a.action))).sort(), [audits])

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-sm text-muted-foreground">{t.admin.audit_intro}</p>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="input h-10 min-w-44 cursor-pointer">
          <option value="ALL">{t.admin.all_actions}</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border text-start text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 text-start font-semibold">{t.admin.audit}</th>
              <th className="px-5 py-3 text-start font-semibold">{t.admin.members}</th>
              <th className="px-5 py-3 text-end font-semibold">{t.admin.when}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((entry) => (
              <tr key={entry.id} className="hover:bg-accent/40">
                <td className="px-5 py-3">
                  <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{entry.action}</code>
                  {entry.entityType && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {entry.entityType}
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && ` · ${Object.entries(entry.metadata).slice(0, 2).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(", ")}`}
                    </p>
                  )}
                </td>
                <td className="px-5 py-3">
                  {entry.user ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={entry.user.fullName ?? entry.user.email} size="xs" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{entry.user.fullName ?? entry.user.email}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{entry.user.email}</p>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-5 py-3 text-end text-xs text-muted-foreground">{timeAgo(entry.createdAt, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <EmptyState icon={ClipboardCheck} title={t.admin.no_audit} description={t.admin.subtitle} className="border-0 bg-transparent" />
        )}
      </div>
    </div>
  )
}

function SettingsTab({
  t,
  values,
  setValues,
  saving,
  onSave,
  detail,
  sources,
}: {
  t: Dictionary
  values: { name: string; billingEmail: string; timezone: string; currency: string; locale: string; holidayCountry: string; holidayRegion: string; workWeekStart: number }
  setValues: (v: { name: string; billingEmail: string; timezone: string; currency: string; locale: string; holidayCountry: string; holidayRegion: string; workWeekStart: number }) => void
  saving: boolean
  onSave: () => void
  detail: LoadedData["detail"]
  sources: HolidaySource[]
}) {
  const weekdayNames = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => new Date(2026, 0, 5 + i).toLocaleDateString("en-US", { weekday: "long" }))
  }, [])
  const selectedSource = sources.find((s) => s.code === values.holidayCountry)
  const hasRegions = (selectedSource?.regions.length ?? 0) > 0

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Save className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">{t.admin.settings}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t.admin.settings_intro}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.admin.org_name}</label>
            <input value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.admin.org_slug}</label>
            <input
              value={(detail as unknown as { slug?: string }).slug ?? ""}
              disabled
              className="input cursor-not-allowed opacity-60"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.admin.billing_email}</label>
            <input
              type="email"
              value={values.billingEmail}
              onChange={(e) => setValues({ ...values, billingEmail: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.admin.timezone}</label>
            <select
              value={values.timezone}
              onChange={(e) => setValues({ ...values, timezone: e.target.value })}
              className="input h-10 cursor-pointer"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.admin.currency}</label>
            <select
              value={values.currency}
              onChange={(e) => setValues({ ...values, currency: e.target.value })}
              className="input h-10 cursor-pointer"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.admin.locale}</label>
            <select
              value={values.locale}
              onChange={(e) => setValues({ ...values, locale: e.target.value })}
              className="input h-10 cursor-pointer"
            >
              {LOCALE_OPTIONS.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarDays className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">{t.leave_settings.calendar_source}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.leave_settings.calendar_hint}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.admin.holiday_country}</label>
              <select
                value={values.holidayCountry}
                onChange={(e) => setValues({ ...values, holidayCountry: e.target.value, holidayRegion: "" })}
                className="input h-10 cursor-pointer"
              >
                <option value="">—</option>
                {sources.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.admin.holiday_region}</label>
              <select
                value={values.holidayRegion}
                onChange={(e) => setValues({ ...values, holidayRegion: e.target.value })}
                className="input h-10 cursor-pointer"
                disabled={!hasRegions}
              >
                <option value="">{t.holidays.region_placeholder}</option>
                {selectedSource?.regions.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.admin.work_week_start}</label>
              <select
                value={values.workWeekStart}
                onChange={(e) => setValues({ ...values, workWeekStart: Number(e.target.value) })}
                className="input h-10 cursor-pointer"
              >
                {weekdayNames.map((n, i) => (
                  <option key={i} value={i}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <Button className="mt-5" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t.admin.saved}
        </Button>
      </div>
    </div>
  )
}