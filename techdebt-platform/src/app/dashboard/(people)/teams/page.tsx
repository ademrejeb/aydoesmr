"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, CircleAlert, Crown, Loader2, MoreHorizontal, Plus, Search, Sparkles, Trash2, UserPlus, Users } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type OrgMember, type Team } from "@/lib/api"
import { useI18n, type Dictionary } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn } from "@/lib/utils"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dropdown, DropdownItem } from "@/components/ui/dropdown"
import { EmptyState } from "@/components/ui/empty-state"
import { Modal } from "@/components/ui/modal"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import { SprintPlannerModal } from "./sprint-planner-modal"

const TEAM_COLORS = ["#4F46E5", "#EC4899", "#F59E0B", "#10B981", "#6366F1", "#8B5CF6"]

function RoleBadge({ role, t }: { role: string; t: Dictionary }) {
  const r = role?.toLowerCase?.() ?? ""
  if (r === "owner") {
    return (
      <Badge variant="success" dot className="shrink-0 text-[10px]">
        <Crown className="h-3 w-3" />
        {t.teams.owner}
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="shrink-0 text-[10px]">
      {r === "member" ? t.teams.member : role}
    </Badge>
  )
}

function TeamMemberRow({
  member,
  title,
  t,
  onRemove,
}: {
  member: Team["members"][number]
  title?: string
  t: Dictionary
  onRemove: (userId: string) => void
}) {
  const displayName = member.user.fullName ?? member.user.email
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/70">
      <Avatar name={displayName} src={member.user.avatarUrl} size="sm" title={displayName} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 truncate text-sm font-medium text-foreground">{displayName}</p>
          <RoleBadge role={member.role} t={t} />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {title && <span className="font-medium">{title}</span>}
          {title && <span className="mx-1.5 text-border">·</span>}
          <span className="truncate">{member.user.email}</span>
        </p>
      </div>
      <Tooltip tip={t.teams.remove}>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-danger/10 hover:text-danger"
          aria-label={t.teams.remove}
          onClick={() => onRemove(member.user.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
  )
}

function TeamCard({
  team,
  titles,
  t,
  onAddMember,
  onRemoveMember,
}: {
  team: Team
  titles: Record<string, string | undefined>
  t: Dictionary
  onAddMember: (team: Team) => void
  onRemoveMember: (teamId: string, userId: string) => void
}) {
  const initials = team.name.slice(0, 2).toUpperCase()
  const tileColor = team.color ?? TEAM_COLORS[0]
  const visible = team.members.slice(0, 5)
  const extra = Math.max(team.members.length - visible.length, 0)

  return (
    <div className="card-hover flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="p-5 pb-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm"
            style={{ backgroundColor: tileColor }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h3 className="truncate font-bold">{team.name}</h3>
            {team.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{team.description}</p>
            ) : null}
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              {team.members.length} {t.teams.members}
            </p>
          </div>
          <Dropdown
            align="end"
            width="w-52"
            trigger={(open, toggle) => (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0"
                aria-label={t.platform.menu}
                aria-expanded={open}
                onClick={toggle}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            )}
          >
            <DropdownItem icon={<UserPlus className="h-4 w-4" />} onClick={() => onAddMember(team)}>
              {t.teams.add_member}
            </DropdownItem>
          </Dropdown>
        </div>

        {team.members.length > 0 && (
          <div className="mt-4 flex items-center">
            <div className="flex">
              {visible.map((m, i) => (
                <Avatar
                  key={m.user.id}
                  name={m.user.fullName ?? m.user.email}
                  src={m.user.avatarUrl}
                  size="sm"
                  title={m.user.fullName ?? m.user.email}
                  className={cn(i > 0 && "-ms-2", "ring-2 ring-card")}
                />
              ))}
            </div>
            {extra > 0 && <span className="ms-1.5 text-xs font-medium text-muted-foreground">+{extra}</span>}
          </div>
        )}
      </div>

      <div className="flex-1 border-t border-border p-3">
        {team.members.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t.teams.no_members}
            className="py-6"
            action={
              <Button variant="outline" size="sm" onClick={() => onAddMember(team)}>
                <UserPlus className="h-4 w-4" />
                {t.teams.add_member}
              </Button>
            }
          />
        ) : (
          <div className="max-h-60 space-y-0.5 overflow-y-auto pe-1">
            {team.members.map((m) => (
              <TeamMemberRow
                key={m.user.id}
                member={m}
                title={titles[m.user.id]}
                t={t}
                onRemove={(userId) => onRemoveMember(team.id, userId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TeamsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <div className="mt-4 flex">
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="-ms-2 h-7 w-7 rounded-full" />
            <Skeleton className="-ms-2 h-7 w-7 rounded-full" />
          </div>
          <div className="mt-4 space-y-2 border-t border-border pt-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TeamsPage() {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showPlanner, setShowPlanner] = useState(false)
  const [addTarget, setAddTarget] = useState<Team | null>(null)
  const [adding, setAdding] = useState<{ teamId: string; userId: string } | null>(null)
  const [memberSearch, setMemberSearch] = useState("")

  const [createName, setCreateName] = useState("")
  const [createDesc, setCreateDesc] = useState("")
  const [createColor, setCreateColor] = useState(TEAM_COLORS[0])
  const [creating, setCreating] = useState(false)

  const load = useCallback(async (): Promise<Team[]> => {
    if (!token || !currentOrg) {
      setLoading(false)
      return []
    }
    try {
      const [tlist, mlist] = await Promise.all([
        api.listTeams(token, currentOrg.id),
        api.listMembers(token, currentOrg.id).catch(() => [] as OrgMember[]),
      ])
      setTeams(tlist)
      setMembers(mlist)
      setLoadError(null)
      return tlist
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t.errors.network_error)
      return []
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg])

  useEffect(() => {
    load()
  }, [load])

  const titles = useMemo(() => {
    const map: Record<string, string | undefined> = {}
    for (const m of members) map[m.user.id] = m.title ?? undefined
    return map
  }, [members])

  const addMember = async (teamId: string, userId: string) => {
    if (!token || !currentOrg) return
    setAdding({ teamId, userId })
    try {
      await api.addTeamMember(teamId, { userId }, token, currentOrg.id)
      const fresh = await load()
      setAddTarget((cur) => (cur ? (fresh.find((t2) => t2.id === teamId) ?? cur) : cur))
      toast.success(t.teams.add_member)
    } catch {
      toast.error(t.errors.network_error)
    } finally {
      setAdding(null)
    }
  }

  const removeMember = async (teamId: string, userId: string) => {
    if (!token || !currentOrg) return
    try {
      await api.removeTeamMember(teamId, userId, token, currentOrg.id)
      await load()
      toast.success(t.teams.remove)
    } catch {
      toast.error(t.errors.network_error)
    }
  }

  const createTeam = async () => {
    if (!token || !currentOrg || !createName.trim()) return
    setCreating(true)
    try {
      await api.createTeam(
        { name: createName.trim(), description: createDesc.trim() || undefined, color: createColor },
        token,
        currentOrg.id
      )
      setCreateName("")
      setCreateDesc("")
      setCreateColor(TEAM_COLORS[0])
      setShowCreate(false)
      await load()
      toast.success(t.teams.create)
    } catch {
      toast.error(t.errors.network_error)
    } finally {
      setCreating(false)
    }
  }

  const candidates = useMemo(() => {
    if (!addTarget) return []
    const inTeam = new Set(addTarget.members.map((m) => m.user.id))
    return members.filter((m) => !inTeam.has(m.user.id))
  }, [addTarget, members])

  const filteredCandidates = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return candidates
    return candidates.filter(
      (m) =>
        (m.user.fullName ?? "").toLowerCase().includes(q) ||
        m.user.email.toLowerCase().includes(q) ||
        (m.title ?? "").toLowerCase().includes(q)
    )
  }, [candidates, memberSearch])

  const isAddingFor = (teamId: string) => adding?.teamId === teamId

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold md:text-3xl">{t.teams.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{currentOrg?.name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setShowPlanner(true)}>
            <Sparkles className="h-4 w-4" />
            {t.planner.open}
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" />
            {t.teams.create}
          </Button>
        </div>
      </div>

      {loadError && !loading && (
        <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {loading ? (
        <TeamsSkeleton />
      ) : teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t.teams.no_teams}
          description={currentOrg?.name}
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" />
              {t.teams.create}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              titles={titles}
              t={t}
              onAddMember={(t2) => {
                setMemberSearch("")
                setAddTarget(t2)
              }}
              onRemoveMember={removeMember}
            />
          ))}
        </div>
      )}

      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title={t.teams.create}
        description={currentOrg?.name}
        size="sm"
        closeLabel={t.platform.close}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={createTeam} disabled={creating || !createName.trim()}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t.teams.create}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="team-name" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t.teams.name}
            </label>
            <input
              id="team-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTeam()}
              placeholder={t.teams.name}
              className="input"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="team-description" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t.teams.description}
            </label>
            <input
              id="team-description"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTeam()}
              placeholder={t.teams.description}
              className="input"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t.projects.color}</label>
            <div className="flex flex-wrap gap-2">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCreateColor(c)}
                  aria-label={c}
                  title={c}
                  className={cn(
                    "h-8 w-8 rounded-full transition-transform cursor-pointer",
                    createColor === c ? "ring-2 ring-ring ring-offset-2 scale-110" : "hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!addTarget}
        onClose={() => {
          setAddTarget(null)
          setMemberSearch("")
        }}
        title={t.teams.add_member}
        description={addTarget?.name}
        size="md"
        closeLabel={t.platform.close}
      >
        {addTarget && (
          <div className="space-y-3">
            <div className="relative">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 transition-shadow focus-within:ring-2 focus-within:ring-ring">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder={t.teams.search_placeholder}
                  aria-label={t.teams.search_placeholder}
                  className="h-10 w-full flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>
            {filteredCandidates.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title={memberSearch.trim() ? t.search.no_results : t.teams.no_members}
                description={
                  memberSearch.trim()
                    ? t.teams.no_members
                    : t.teams.no_candidates
                }
                className="py-8"
              />
            ) : (
              <div className="max-h-72 space-y-1 overflow-y-auto pe-1">
                {filteredCandidates.map((m) => {
                  const displayName = m.user.fullName ?? m.user.email
                  const pendingAdd = isAddingFor(addTarget.id)
                  return (
                    <div
                      key={m.user.id}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/70"
                    >
                      <Avatar name={displayName} src={m.user.avatarUrl} size="sm" title={displayName} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{displayName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {m.title && <span className="font-medium">{m.title} · </span>}
                          {m.user.email}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => addMember(addTarget.id, m.user.id)}
                        disabled={pendingAdd}
                        aria-label={`${t.teams.add_member}: ${displayName}`}
                        className="shrink-0"
                      >
                        {adding?.teamId === addTarget.id && adding?.userId === m.user.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserPlus className="h-4 w-4" />
                        )}
                        {t.teams.add_member}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Modal>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        <span>
          {teams.length} {t.platform.teams}
        </span>
      </div>

      <SprintPlannerModal open={showPlanner} onClose={() => setShowPlanner(false)} teams={teams} />
    </div>
  )
}