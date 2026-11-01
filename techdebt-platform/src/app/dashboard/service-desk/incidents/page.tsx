"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, MessageSquare, Plus, RotateCcw, Search, Send, Siren } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type Incident, type IncidentStatus, type ServiceAgent, type ServiceComment } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CATEGORIES,
  formatDate,
  formatDateTime,
  INCIDENT_STATUS_LIST,
  INCIDENT_TRANSITIONS,
  PRIORITIES,
  priorityLabel,
  PriorityBadge,
  SlaChip,
  StatusBadge,
} from "@/components/service-desk/service-desk-ui"

export default function ServiceIncidentsPage() {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [agents, setAgents] = useState<ServiceAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [priority, setPriority] = useState("")
  const [view, setView] = useState("")
  const [breached, setBreached] = useState(false)
  const [selected, setSelected] = useState<Incident | null>(null)
  const [comments, setComments] = useState<ServiceComment[]>([])
  const [commentBody, setCommentBody] = useState("")
  const [resolution, setResolution] = useState("")
  const [rootCause, setRootCause] = useState("")
  const [createOpen, setCreateOpen] = useState(false)

  const canManage = currentOrg?.role === "OWNER" || currentOrg?.role === "ADMIN" || currentOrg?.role === "MANAGER"

  const load = useCallback(async () => {
    if (!token || !currentOrg) return
    setLoading(true)
    try {
      const [list, people] = await Promise.all([
        api.listIncidents(token, currentOrg.id, {
          status: status || undefined,
          priority: priority || undefined,
          view: view || undefined,
          breached: breached || undefined,
          search: search.trim() || undefined,
        }),
        api.serviceAgents(token, currentOrg.id).catch(() => [] as ServiceAgent[]),
      ])
      setIncidents(list)
      setAgents(people)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg, status, priority, view, breached, search, toast])

  useEffect(() => {
    void load()
  }, [load])

  const openDetail = async (incident: Incident) => {
    setSelected(incident)
    setResolution(incident.resolution ?? "")
    setRootCause(incident.rootCause ?? "")
    try {
      setComments(token && currentOrg ? await api.listIncidentComments(token, currentOrg.id, incident.id) : [])
    } catch {
      setComments([])
    }
  }

  const refreshSelected = (updated: Incident) => {
    setSelected(updated)
    setIncidents((list) => list.map((i) => (i.id === updated.id ? updated : i)))
  }

  const transition = async (next: IncidentStatus) => {
    if (!token || !currentOrg || !selected) return
    setBusy(true)
    try {
      const updated = await api.transitionIncident(
        {
          status: next,
          resolution: next === "RESOLVED" || next === "CLOSED" ? resolution || undefined : undefined,
          rootCause: next === "RESOLVED" || next === "CLOSED" ? rootCause || undefined : undefined,
        },
        token,
        currentOrg.id,
        selected.id
      )
      refreshSelected(updated)
      toast.success(next)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setBusy(false)
    }
  }

  const saveDetails = async () => {
    if (!token || !currentOrg || !selected) return
    setBusy(true)
    try {
      const updated = await api.updateIncident({ resolution: resolution || undefined, rootCause: rootCause || undefined }, token, currentOrg.id, selected.id)
      refreshSelected(updated)
      toast.success(t.common.save)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setBusy(false)
    }
  }

  const assign = async (assigneeId: string) => {
    if (!token || !currentOrg || !selected) return
    try {
      const updated = await api.updateIncident({ assigneeId: assigneeId || undefined }, token, currentOrg.id, selected.id)
      refreshSelected(updated)
      toast.success(t.service.assignee)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    }
  }

  const submitComment = async () => {
    if (!token || !currentOrg || !selected || !commentBody.trim()) return
    try {
      const created = await api.addIncidentComment({ body: commentBody.trim() }, token, currentOrg.id, selected.id)
      setComments((c) => [...c, created])
      setCommentBody("")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.service.incidents}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.service.subtitle}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="me-1.5 h-4 w-4" />
          {t.service.new_incident}
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[12rem]"><Input icon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.service.search_placeholder} /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto">
          <option value="">{t.service.status}: {t.service.filter_all}</option>
          {INCIDENT_STATUS_LIST.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input w-auto">
          <option value="">{t.service.priority}: {t.service.filter_all}</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p} · {priorityLabel(p, t)}
            </option>
          ))}
        </select>
        <select value={view} onChange={(e) => setView(e.target.value)} className="input w-auto">
          <option value="">{t.service.filter_all}</option>
          <option value="mine">{t.service.filter_mine}</option>
          <option value="unassigned">{t.service.filter_unassigned}</option>
          <option value="open">{t.service.filter_open}</option>
        </select>
        <Button
          size="sm"
          variant={breached ? "destructive" : "outline"}
          onClick={() => setBreached((b) => !b)}
        >
          {t.service.filter_breached}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : incidents.length === 0 ? (
        <EmptyState
          icon={Siren}
          title={t.service.no_incidents}
          description={t.service.no_items_hint}
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              {t.service.new_incident}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {incidents.map((incident) => (
            <li key={incident.id}>
              <button
                onClick={() => void openDetail(incident)}
                className={cn(
                  "w-full cursor-pointer rounded-xl border border-border bg-card p-4 text-start shadow-sm transition-colors hover:bg-accent/40",
                  selected?.id === incident.id && "border-primary/40 bg-primary/5"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">{incident.number}</span>
                  <StatusBadge status={incident.status} t={t} />
                  <PriorityBadge priority={incident.priority} t={t} />
                  {incident.reopenCount > 0 && (
                    <Badge variant="warning">
                      <RotateCcw className="me-1 inline h-3 w-3" />
                      {t.service.reopen_count}: {incident.reopenCount}
                    </Badge>
                  )}
                  {(incident.resolveBreached || incident.responseBreached) && (
                    <Badge variant="danger">{t.service.breached}</Badge>
                  )}
                  <span className="ms-auto text-xs text-muted-foreground">{formatDate(incident.createdAt)}</span>
                </div>
                <p className="mt-2 font-semibold">{incident.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{incident.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {incident.category && <Badge variant="secondary">{incident.category}</Badge>}
                  <span>
                    {t.service.assignee}: {incident.assignee?.fullName ?? incident.assignee?.email ?? t.service.unassigned}
                  </span>
                  {incident.linkedRequest && (
                    <Badge variant="outline">
                      {t.service.linked_request}: {incident.linkedRequest.number}
                    </Badge>
                  )}
                  <SlaChip dueAt={incident.responseDueAt} label={t.service.respond_target} t={t} />
                  <SlaChip dueAt={incident.resolveDueAt} label={t.service.resolve_target} t={t} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected ? `${selected.number} · ${selected.title}` : ""} size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} t={t} />
              <PriorityBadge priority={selected.priority} t={t} />
              <SlaChip dueAt={selected.responseDueAt} label={t.service.respond_target} t={t} />
              <SlaChip dueAt={selected.resolveDueAt} label={t.service.resolve_target} t={t} />
              {selected.responseBreached && <Badge variant="danger">{t.service.breached}</Badge>}
            </div>

            <p className="whitespace-pre-wrap text-sm">{selected.description}</p>

            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t.service.requester}</dt>
                <dd>{selected.requester?.fullName ?? selected.requesterName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.service.responded_at}</dt>
                <dd>{formatDateTime(selected.firstRespondedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.service.resolved_at}</dt>
                <dd>{formatDateTime(selected.resolvedAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.service.reopen_count}</dt>
                <dd>{selected.reopenCount}</dd>
              </div>
              {selected.linkedRequest && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">{t.service.linked_request}</dt>
                  <dd className="font-mono">{selected.linkedRequest.number}</dd>
                </div>
              )}
            </dl>

            {canManage && (
              <>
                <label className="block text-xs font-semibold text-muted-foreground">
                  {t.service.assignee}
                  <select
                    className="input mt-1"
                    value={selected.assigneeId ?? ""}
                    onChange={(e) => void assign(e.target.value)}
                  >
                    <option value="">{t.service.unassigned}</option>
                    {agents.map((agent) => (
                      <option key={agent.userId} value={agent.userId}>
                        {agent.user.fullName ?? agent.user.email}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-2 rounded-lg border border-border p-3">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    {t.service.resolution}
                    <textarea
                      value={resolution}
                      onChange={(e) => setResolution(e.target.value)}
                      rows={2}
                      placeholder={t.service.resolution_placeholder}
                      className="input mt-1"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    {t.service.root_cause}
                    <textarea
                      value={rootCause}
                      onChange={(e) => setRootCause(e.target.value)}
                      rows={2}
                      placeholder={t.service.root_cause_placeholder}
                      className="input mt-1"
                    />
                  </label>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => void saveDetails()}>
                    {busy && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
                    {t.common.save}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {INCIDENT_TRANSITIONS[selected.status].map((next) => (
                    <Button
                      key={next}
                      size="sm"
                      variant={next === "RESOLVED" ? "default" : "outline"}
                      disabled={busy}
                      onClick={() => void transition(next)}
                    >
                      {next === "RESOLVED"
                        ? t.service.resolve
                        : next === "IN_PROGRESS"
                          ? selected.status === "RESOLVED"
                            ? t.service.reopen
                            : t.service.start_work
                          : t.service.mark_closed}
                    </Button>
                  ))}
                </div>
              </>
            )}

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" />
                {t.service.public_ticket_status}
              </p>
              <ul className="mb-3 max-h-48 space-y-2 overflow-y-auto">
                {comments.length === 0 && <li className="text-xs text-muted-foreground">{t.service.no_activity}</li>}
                {comments.map((comment) => (
                  <li
                    key={comment.id}
                    className={cn(
                      "rounded-lg border p-2.5 text-xs",
                      comment.internal ? "border-warning/40 bg-warning/5" : "border-border"
                    )}
                  >
                    <p className="flex items-center gap-2 font-semibold">
                      {comment.author?.fullName ?? comment.authorName ?? "—"}
                      <span className="ms-auto font-normal text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  rows={2}
                  placeholder={t.service.comment_placeholder}
                  className="input min-w-0 flex-1"
                />
                <Button size="sm" disabled={!commentBody.trim()} onClick={() => void submitComment()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <CreateIncidentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={async () => {
          setCreateOpen(false)
          await load()
        }}
      />
    </div>
  )
}

function CreateIncidentModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => Promise<void> }) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState("P3")
  const [category, setCategory] = useState("IT")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle("")
    setDescription("")
    setPriority("P3")
    setCategory("IT")
  }, [open])

  const submit = async () => {
    if (!token || !currentOrg) return
    setSaving(true)
    try {
      const created = await api.createIncident(
        { title: title.trim(), description: description.trim(), priority, category },
        token,
        currentOrg.id
      )
      toast.success(created.number)
      await onCreated()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.service.new_incident}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button disabled={saving || title.trim().length < 4} onClick={() => void submit()}>
            {saving && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            {t.service.new_incident}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-muted-foreground">
          {t.service.title_field}
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input mt-1" maxLength={160} />
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          {t.service.description_field}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="input mt-1"
            maxLength={4000}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-muted-foreground">
            {t.service.priority}
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input mt-1">
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p} · {priorityLabel(p, t)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-muted-foreground">
            {t.service.category}
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="input mt-1">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </Modal>
  )
}