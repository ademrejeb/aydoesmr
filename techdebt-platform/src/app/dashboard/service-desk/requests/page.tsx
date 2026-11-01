"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Check,
  ClipboardList,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Star,
  X,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import {
  api,
  type FormField,
  type RequestStatus,
  type ServiceAgent,
  type ServiceComment,
  type ServiceItem,
  type ServiceRequest,
} from "@/lib/api"
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
  DynamicFormFields,
  formatDate,
  formatDateTime,
  isOverdue,
  PRIORITIES,
  priorityLabel,
  PriorityBadge,
  REQUEST_STATUS_LIST,
  REQUEST_TRANSITIONS,
  SlaChip,
  StatusBadge,
} from "@/components/service-desk/service-desk-ui"

type ViewFilter = "all" | "mine" | "unassigned" | "requested"

export default function ServiceRequestsPage() {
  const { token, currentOrg, user } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [requests, setRequests] = useState<ServiceRequest[]>([])
  const [catalog, setCatalog] = useState<ServiceItem[]>([])
  const [agents, setAgents] = useState<ServiceAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("")
  const [priority, setPriority] = useState<string>("")
  const [view, setView] = useState<ViewFilter>("all")
  const [selected, setSelected] = useState<ServiceRequest | null>(null)
  const [comments, setComments] = useState<ServiceComment[]>([])
  const [commentBody, setCommentBody] = useState("")
  const [commentInternal, setCommentInternal] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const canManage = currentOrg?.role === "OWNER" || currentOrg?.role === "ADMIN" || currentOrg?.role === "MANAGER"

  const load = useCallback(async () => {
    if (!token || !currentOrg) return
    setLoading(true)
    try {
      const [reqs, items, people] = await Promise.all([
        api.listServiceRequests(token, currentOrg.id, {
          status: status || undefined,
          priority: priority || undefined,
          view: view === "all" ? undefined : view,
          search: search.trim() || undefined,
        }),
        api.listCatalog(token, currentOrg.id),
        api.serviceAgents(token, currentOrg.id).catch(() => [] as ServiceAgent[]),
      ])
      setRequests(reqs)
      setCatalog(items)
      setAgents(people)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg, status, priority, view, search, toast])

  useEffect(() => {
    void load()
  }, [load])

  const loadComments = useCallback(
    async (request: ServiceRequest) => {
      if (!token || !currentOrg) return
      try {
        setComments(await api.listRequestComments(token, currentOrg.id, request.id))
      } catch {
        setComments([])
      }
    },
    [token, currentOrg]
  )

  const openDetail = async (request: ServiceRequest) => {
    setSelected(request)
    await loadComments(request)
  }

  const act = async (label: string, fn: () => Promise<ServiceRequest>) => {
    setBusy(label)
    try {
      const updated = await fn()
      setSelected(updated)
      setRequests((list) => list.map((r) => (r.id === updated.id ? updated : r)))
      toast.success(label)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setBusy(null)
    }
  }

  const submitComment = async () => {
    if (!token || !currentOrg || !selected || !commentBody.trim()) return
    try {
      const created = await api.addRequestComment(
        { body: commentBody.trim(), internal: commentInternal },
        token,
        currentOrg.id,
        selected.id
      )
      setComments((c) => [...c, created])
      setCommentBody("")
      toast.success(t.service.send)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    }
  }

  const rating = useMemo(() => (selected?.rating ?? 0), [selected])

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.service.requests}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.service.subtitle}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="me-1.5 h-4 w-4" />
          {t.service.new_request}
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[12rem]"><Input icon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.service.search_placeholder} /></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="input w-auto">
          <option value="">{t.service.status}: {t.service.filter_all}</option>
          {REQUEST_STATUS_LIST.map((s) => (
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
        <div className="flex overflow-hidden rounded-lg border border-border">
          {(["all", "mine", "unassigned", "requested"] as ViewFilter[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "px-2.5 py-2 text-xs font-semibold transition-colors cursor-pointer",
                view === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              )}
            >
              {v === "all"
                ? t.service.filter_all
                : v === "mine"
                  ? t.service.filter_mine
                  : v === "unassigned"
                    ? t.service.filter_unassigned
                    : t.service.requester}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t.service.no_requests}
          description={t.service.no_items_hint}
          action={
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              {t.service.new_request}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => (
            <li key={request.id}>
              <button
                onClick={() => void openDetail(request)}
                className={cn(
                  "w-full rounded-xl border border-border bg-card p-4 text-start shadow-sm transition-colors hover:bg-accent/40 cursor-pointer",
                  selected?.id === request.id && "border-primary/40 bg-primary/5"
                )}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">{request.number}</span>
                  <StatusBadge status={request.status} t={t} />
                  <PriorityBadge priority={request.priority} t={t} />
                  {request.rating ? (
                    <Badge variant="warning">
                      <Star className="me-1 inline h-3 w-3" />
                      {request.rating}/5
                    </Badge>
                  ) : null}
                  <span className="ms-auto text-xs text-muted-foreground">{formatDate(request.createdAt)}</span>
                </div>
                <p className="mt-2 font-semibold">{request.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{request.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  {request.item && <Badge variant="secondary">{request.item.name}</Badge>}
                  <span>
                    {t.service.assignee}: {request.assignee?.fullName ?? request.assignee?.email ?? t.service.unassigned}
                  </span>
                  <span>
                    {t.service.requester}: {request.requester?.fullName ?? request.requesterName ?? "—"}
                  </span>
                  <SlaChip dueAt={request.dueAt} label={t.service.due} t={t} />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.number} · ${selected.title}` : ""}
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={selected.status} t={t} />
              <PriorityBadge priority={selected.priority} t={t} />
              <SlaChip dueAt={selected.dueAt} label={t.service.due} t={t} />
              {selected.targetAt && <SlaChip dueAt={selected.targetAt} label={t.service.target_date} t={t} />}
            </div>

            <p className="whitespace-pre-wrap text-sm">{selected.description}</p>

            {selected.item && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                <p className="font-semibold">{selected.item.name}</p>
                {Object.keys(selected.formData ?? {}).length > 0 && (
                  <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                    {Object.entries(selected.formData ?? {}).map(([key, value]) => (
                      <div key={key} className="flex gap-1.5">
                        <dt className="font-semibold text-muted-foreground">{key}:</dt>
                        <dd className="min-w-0 break-words">{typeof value === "boolean" ? (value ? "✓" : "✗") : String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}

            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{t.service.requester}</dt>
                <dd>{selected.requester?.fullName ?? selected.requesterName ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.service.assignee}</dt>
                <dd>{selected.assignee?.fullName ?? selected.assignee?.email ?? t.service.unassigned}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.service.created}</dt>
                <dd>{formatDateTime(selected.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t.service.updated}</dt>
                <dd>{formatDateTime(selected.updatedAt)}</dd>
              </div>
              {selected.decisionNote && (
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">{t.service.decision_note}</dt>
                  <dd>{selected.decisionNote}</dd>
                </div>
              )}
            </dl>

            {canManage && (
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-3">
                <label className="flex-1 text-xs font-semibold text-muted-foreground">
                  {t.service.assignee}
                  <select
                    className="input mt-1"
                    value={selected.assigneeId ?? ""}
                    onChange={(e) =>
                      void act("updated", () =>
                        api.updateServiceRequest(
                          { assigneeId: e.target.value || undefined },
                          token!,
                          currentOrg!.id,
                          selected.id
                        )
                      )
                    }
                  >
                    <option value="">{t.service.unassigned}</option>
                    {agents.map((agent) => (
                      <option key={agent.userId} value={agent.userId}>
                        {agent.user.fullName ?? agent.user.email}
                      </option>
                    ))}
                  </select>
                </label>
                {selected.status === "PENDING_APPROVAL" || selected.status === "SUBMITTED" ? (
                  <>
                    <Button
                      disabled={busy !== null}
                      onClick={() =>
                        void act(t.service.approve, () =>
                          api.decideServiceRequest({ decision: "APPROVED" }, token!, currentOrg!.id, selected.id)
                        )
                      }
                    >
                      {busy === t.service.approve ? (
                        <Loader2 className="me-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="me-1.5 h-4 w-4" />
                      )}
                      {t.service.approve}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() =>
                        void act(t.service.reject, () =>
                          api.decideServiceRequest({ decision: "REJECTED" }, token!, currentOrg!.id, selected.id)
                        )
                      }
                    >
                      <X className="me-1.5 h-4 w-4" />
                      {t.service.reject}
                    </Button>
                  </>
                ) : (
                  REQUEST_TRANSITIONS[selected.status].map((next) => (
                    <Button
                      key={next}
                      variant={next === "CANCELLED" ? "outline" : "default"}
                      disabled={busy !== null}
                      onClick={() =>
                        void act(next, () =>
                          api.transitionServiceRequest({ status: next }, token!, currentOrg!.id, selected.id)
                        )
                      }
                    >
                      {next}
                    </Button>
                  ))
                )}
              </div>
            )}

            {(selected.status === "FULFILLED" || selected.status === "CLOSED") &&
              (user?.id === selected.requesterId || selected.requesterId === null) && (
                <div className="flex items-center gap-2 rounded-lg border border-border p-3">
                  <span className="text-sm font-semibold">{t.service.rate_request}</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        onClick={async () => {
                          try {
                            await api.rateServiceRequest(value, token!, currentOrg!.id, selected.id)
                            setSelected({ ...selected, rating: value })
                            setRequests((list) => list.map((r) => (r.id === selected.id ? { ...r, rating: value } : r)))
                            toast.success(t.service.rating_thanks)
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "error")
                          }
                        }}
                        aria-label={`${value}`}
                        className="cursor-pointer"
                      >
                        <Star
                          className={cn("h-5 w-5", value <= rating ? "fill-warning text-warning" : "text-muted-foreground")}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <MessageSquare className="h-4 w-4" />
                {t.service.comment_placeholder}
              </p>
              <ul className="mb-3 max-h-56 space-y-2 overflow-y-auto">
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
                      {comment.internal && <Badge variant="warning">{t.service.internal_note}</Badge>}
                      <span className="ms-auto font-normal text-muted-foreground">{formatDateTime(comment.createdAt)}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap">{comment.body}</p>
                  </li>
                ))}
              </ul>
              <div className="space-y-2">
                <textarea
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                  rows={3}
                  placeholder={t.service.comment_placeholder}
                  className="input"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={commentInternal}
                      onChange={(e) => setCommentInternal(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border"
                    />
                    {t.service.internal_note}
                  </label>
                  <Button size="sm" disabled={!commentBody.trim()} onClick={() => void submitComment()}>
                    {t.service.send}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <CreateRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        catalog={catalog}
        onCreated={async () => {
          setCreateOpen(false)
          await load()
        }}
      />
    </div>
  )
}

function CreateRequestModal({
  open,
  onClose,
  catalog,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  catalog: ServiceItem[]
  onCreated: () => Promise<void>
}) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [itemId, setItemId] = useState("")
  const [priority, setPriority] = useState("P3")
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTitle("")
    setDescription("")
    setItemId("")
    setPriority("P3")
    setFormData({})
  }, [open])

  const item = catalog.find((i) => i.id === itemId)
  const fields: FormField[] = item?.formSchema ?? []

  const missingRequired = fields.some((field) => field.required && !formData[field.key])

  const submit = async () => {
    if (!token || !currentOrg) return
    setSaving(true)
    try {
      const created = await api.createServiceRequest(
        {
          title: title.trim(),
          description: description.trim(),
          itemId: itemId || undefined,
          priority,
          formData: Object.keys(formData).length ? formData : undefined,
        },
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
      title={t.service.new_request}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button disabled={saving || title.trim().length < 4 || missingRequired} onClick={() => void submit()}>
            {saving && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
            {t.service.new_request}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-xs font-semibold text-muted-foreground">
          {t.service.item}
          <select
            value={itemId}
            onChange={(e) => {
              setItemId(e.target.value)
              setFormData({})
            }}
            className="input mt-1"
          >
            <option value="">{t.service.filter_all}</option>
            {catalog.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
        {item?.requiresApproval && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">{t.service.approval_required_hint}</p>
        )}
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
        <DynamicFormFields fields={fields} values={formData} onChange={(key, value) => setFormData((f) => ({ ...f, [key]: value }))} t={t} />
      </div>
    </Modal>
  )
}

export function requestIsOverdue(request: ServiceRequest): boolean {
  return isOverdue(request.dueAt) && !["FULFILLED", "CLOSED", "CANCELLED", "REJECTED"].includes(request.status)
}

export type { RequestStatus }