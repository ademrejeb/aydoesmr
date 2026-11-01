"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { io, type Socket } from "socket.io-client"
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Calendar,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  GitBranch,
  GripVertical,
  LayoutGrid,
  List,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  Search,
  Send,
  Settings2,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import {
  api,
  type AgileSnapshot,
  type AgileTask,
  type Comment as TComment,
  type Sprint,
  type WorkflowColumn,
} from "@/lib/api"
import { useI18n, type Dictionary } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar } from "@/components/ui/avatar"
import { Modal } from "@/components/ui/modal"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { GitTab } from "@/components/projects/git-tab"

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-success/15 text-success border-success/30",
  MEDIUM: "bg-warning/15 text-warning border-warning/30",
  HIGH: "bg-danger/15 text-danger border-danger/30",
  URGENT: "bg-danger text-danger-foreground border-danger",
}

const PRIORITY_ICONS: Record<string, LucideIcon> = {
  LOW: ArrowDown,
  MEDIUM: Minus,
  HIGH: ArrowUp,
  URGENT: AlertTriangle,
}

const TYPE_STYLE: Record<string, string> = {
  EPIC: "bg-info/15 text-info border-info/30",
  STORY: "bg-primary/15 text-primary border-primary/30",
  TASK: "bg-secondary/60 text-secondary-foreground border-border",
  BUG: "bg-danger/15 text-danger border-danger/30",
  SUBTASK: "bg-muted text-muted-foreground border-border",
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  EPIC: Target,
  STORY: LayoutGrid,
  TASK: CircleDot,
  BUG: AlertTriangle,
  SUBTASK: List,
}

function wsOrigin(): string {
  try {
    return new URL(api.baseUrl).origin
  } catch {
    return "http://localhost:3001"
  }
}

function typeLabel(t: Dictionary, type: string) {
  return t.agile.types[type as keyof typeof t.agile.types] ?? type
}

function TypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = TYPE_ICONS[type] ?? CircleDot
  return <Icon className={className} />
}

function statusVariant(status: string): "success" | "secondary" | "outline" {
  const s = status?.toUpperCase()
  if (s === "ACTIVE") return "success"
  if (s === "ARCHIVED") return "secondary"
  return "outline"
}

function PriorityTag({ priority, t }: { priority: string; t: Dictionary }) {
  const labels: Record<string, string> = { LOW: t.board.low, MEDIUM: t.board.medium, HIGH: t.board.high, URGENT: t.board.urgent }
  const Icon = PRIORITY_ICONS[priority] ?? Minus
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold",
        PRIORITY_COLORS[priority] ?? "border-border bg-secondary/50 text-muted-foreground"
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {labels[priority] ?? priority}
    </span>
  )
}

function TypeTag({ type, t, className }: { type: string; t: Dictionary; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold",
        TYPE_STYLE[type] ?? TYPE_STYLE.TASK,
        className
      )}
    >
      <TypeIcon type={type} className="h-3 w-3" />
      {typeLabel(t, type)}
    </span>
  )
}

function TaskCard({
  task,
  onOpen,
  onDragStart,
  onDragEnd,
  t,
  locale,
}: {
  task: AgileTask
  onOpen: (id: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  t: Dictionary
  locale: string
}) {
  const doneSub = task.subtasks.filter((s) => s.status.toUpperCase() === "DONE").length

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id)
        onDragStart(task.id)
      }}
      onDragEnd={onDragEnd}
      onDoubleClick={() => onOpen(task.id)}
      onClick={() => onOpen(task.id)}
      className="group cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-shadow hover:border-primary/40 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold leading-snug">{task.title}</p>
        <PriorityTag priority={task.priority} t={t} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <TypeTag type={task.type} t={t} />
        {typeof task.storyPoints === "number" && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-secondary-foreground">
            {task.storyPoints} {t.agile.points}
          </span>
        )}
        {task.dueDate && (
          <span className="ms-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {new Date(task.dueDate).toLocaleDateString(locale)}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        {task.assignee ? (
          <Avatar
            name={task.assignee.fullName ?? "?"}
            src={task.assignee.avatarUrl}
            size="xs"
            title={task.assignee.fullName ?? undefined}
          />
        ) : (
          <span
            aria-hidden
            className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"
          >
            <Users className="h-3 w-3" />
          </span>
        )}
        <span className="ms-auto flex items-center gap-2.5 text-[10px] text-muted-foreground">
          {task.subtasks.length > 0 && (
            <span className="flex items-center gap-1">
              {doneSub === task.subtasks.length ? <CheckCircle2 className="h-3 w-3 text-success" /> : <List className="h-3 w-3" />}
              {doneSub}/{task.subtasks.length}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {task._count.comments}
          </span>
        </span>
      </div>
    </div>
  )
}

function BacklogRow({
  task,
  onOpen,
  onDragStart,
  onDragEnd,
  t,
  locale,
}: {
  task: AgileTask
  onOpen: (id: string) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  t: Dictionary
  locale: string
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", task.id)
        onDragStart(task.id)
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task.id)}
      className="group flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 shadow-sm transition-shadow hover:border-primary/40 hover:shadow-md active:cursor-grabbing"
    >
      <GripVertical aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground/40" />
      <span className="flex shrink-0 items-center gap-1.5">
        <TypeTag type={task.type} t={t} />
        <PriorityTag priority={task.priority} t={t} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
      <span className="flex shrink-0 items-center gap-2.5 text-[10px] text-muted-foreground">
        {typeof task.storyPoints === "number" && <span className="font-bold">{task.storyPoints} {t.agile.points}</span>}
        {task.dueDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(task.dueDate).toLocaleDateString(locale)}
          </span>
        )}
        {task.assignee ? (
          <Avatar
            name={task.assignee.fullName ?? "?"}
            src={task.assignee.avatarUrl}
            size="xs"
            title={task.assignee.fullName ?? undefined}
          />
        ) : (
          <span
            aria-hidden
            className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground"
          >
            <Users className="h-3 w-3" />
          </span>
        )}
      </span>
    </div>
  )
}

function CommentsSection({ taskId, projectId, t }: { taskId: string; projectId: string; t: Dictionary }) {
  const { token, currentOrg } = useAuth()
  const [comments, setComments] = useState<TComment[]>([])
  const [body, setBody] = useState("")
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!token || !currentOrg) return
    try {
      setComments(await api.listComments(token, currentOrg.id, projectId, taskId))
    } catch {
      /* ignore */
    }
  }, [token, currentOrg, projectId, taskId])
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [comments.length])

  const post = async () => {
    if (!token || !currentOrg || !body.trim()) return
    setBusy(true)
    try {
      const c = await api.addComment(token, currentOrg.id, projectId, taskId, body.trim())
      setBody("")
      setComments((prev) => [c, ...prev])
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-4">
      <h4 className="text-xs font-bold text-muted-foreground">
        {t.agile.comments} ({comments.length})
      </h4>
      <div className="mt-3 space-y-3">
        {comments.length === 0 && <p className="text-sm text-muted-foreground">{t.agile.no_comments}</p>}
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <Avatar name={c.author.fullName ?? c.author.email} src={c.author.avatarUrl} size="sm" />
              <span className="text-xs font-semibold">{c.author.fullName ?? c.author.email}</span>
              <span className="ms-auto text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && post()}
          placeholder={t.agile.comment_placeholder}
          className="input min-w-0 flex-1"
        />
        <Button size="sm" onClick={post} disabled={busy || !body.trim()} aria-label={t.messages.send}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function TaskDrawer({
  task,
  snapshot,
  onClose,
  onChange,
  t,
}: {
  task: AgileTask
  snapshot: AgileSnapshot
  onClose: () => void
  onChange: () => void
  t: Dictionary
}) {
  const { token, currentOrg } = useAuth()
  const role = currentOrg?.role ?? "VIEWER"
  const canEdit = role !== "VIEWER"
  const project = snapshot.project
  const [members, setMembers] = useState<{ id: string; fullName: string | null; avatarUrl: string | null; email: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [fields, setFields] = useState({
    title: task.title,
    type: task.type,
    priority: task.priority,
    storyPoints: task.storyPoints?.toString() ?? "",
    assigneeId: task.assignee?.id ?? "",
    epicId: task.epic?.id ?? "",
    sprintId: task.sprintId ?? "",
    columnId: task.columnId ?? "",
  })
  const [description, setDescription] = useState(task.description ?? "")

  useEffect(() => {
    if (!token || !currentOrg) return
    api
      .listMembers(token, currentOrg.id)
      .then((list) =>
        setMembers(list.map((m) => ({ id: m.user.id, fullName: m.user.fullName, avatarUrl: m.user.avatarUrl, email: m.user.email })))
      )
      .catch(() => {
        /* ignore */
      })
  }, [token, currentOrg])

  const sprints = snapshot.sprints.filter((s) => s.status !== "COMPLETED")
  const assignableHuman = useMemo(() => {
    const set = new Set<string>()
    const out: typeof members = []
    for (const m of members) {
      set.add(m.id)
      out.push(m)
    }
    for (const team of snapshot.teams) {
      for (const tm of team.members) {
        if (!set.has(tm.userId)) {
          set.add(tm.userId)
          out.push({ id: tm.userId, fullName: tm.user.fullName, avatarUrl: tm.user.avatarUrl, email: "" })
        }
      }
    }
    return out
  }, [members, snapshot.teams])

  const save = async () => {
    if (!token || !currentOrg || !fields.title.trim()) return
    setSaving(true)
    try {
      await api.updateTask(token, currentOrg.id, project.id, task.id, {
        title: fields.title.trim(),
        type: fields.type,
        priority: fields.priority,
        storyPoints: fields.storyPoints ? Number(fields.storyPoints) : null,
        assigneeId: fields.assigneeId || null,
        epicId: fields.epicId || null,
        sprintId: fields.sprintId || null,
        columnId: fields.columnId || null,
        description: description.trim() ? description : null,
      })
      onChange()
    } catch {
      /* ignore */
    } finally {
      setSaving(false)
    }
  }

  const labelCls = "mb-1 block text-xs font-medium text-muted-foreground"

  return (
    <div className="fixed inset-0 z-drawer flex justify-end animate-overlay-in">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md animate-drawer flex-col border-s border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <TypeTag type={task.type} t={t} />
            <span className="text-xs text-muted-foreground">#{task.id.slice(0, 8)}</span>
          </div>
          <button onClick={onClose} aria-label={t.platform.close} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <input
            value={fields.title}
            onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
            disabled={!canEdit}
            className="input text-lg font-bold"
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t.agile.type}</label>
              <select
                value={fields.type}
                disabled={!canEdit}
                onChange={(e) => setFields((f) => ({ ...f, type: e.target.value }))}
                className="input cursor-pointer"
              >
                {Object.keys(t.agile.types).map((ty) => (
                  <option key={ty} value={ty}>
                    {typeLabel(t, ty)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.board.priority}</label>
              <select
                value={fields.priority}
                disabled={!canEdit}
                onChange={(e) => setFields((f) => ({ ...f, priority: e.target.value }))}
                className="input cursor-pointer"
              >
                <option value="LOW">{t.board.low}</option>
                <option value="MEDIUM">{t.board.medium}</option>
                <option value="HIGH">{t.board.high}</option>
                <option value="URGENT">{t.board.urgent}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.agile.point_estimate}</label>
              <input
                type="number"
                min={0}
                value={fields.storyPoints}
                disabled={!canEdit}
                onChange={(e) => setFields((f) => ({ ...f, storyPoints: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className={labelCls}>{t.agile.assignee}</label>
              <select
                value={fields.assigneeId}
                disabled={!canEdit}
                onChange={(e) => setFields((f) => ({ ...f, assigneeId: e.target.value }))}
                className="input cursor-pointer"
              >
                <option value="">{t.agile.no_assignee}</option>
                {assignableHuman.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName ?? m.email}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.agile.epic}</label>
              <select
                value={fields.epicId}
                disabled={!canEdit}
                onChange={(e) => setFields((f) => ({ ...f, epicId: e.target.value }))}
                className="input cursor-pointer"
              >
                <option value="">{t.agile.no_epic}</option>
                {snapshot.epics.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t.agile.sprints}</label>
              <select
                value={fields.sprintId}
                disabled={!canEdit}
                onChange={(e) => setFields((f) => ({ ...f, sprintId: e.target.value }))}
                className="input cursor-pointer"
              >
                <option value="">{t.agile.unassigned}</option>
                {sprints.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>{t.agile.board}</label>
              <select
                value={fields.columnId}
                disabled={!canEdit}
                onChange={(e) => setFields((f) => ({ ...f, columnId: e.target.value }))}
                className="input cursor-pointer"
              >
                <option value="">{t.agile.unassigned}</option>
                {snapshot.workflow.columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>{t.board.task_title}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!canEdit}
              rows={4}
              placeholder="…"
              className="input"
            />
          </div>

          {canEdit ? (
            <Button onClick={save} disabled={saving || !fields.title.trim()} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t.common.save}
            </Button>
          ) : (
            <p className="rounded-lg bg-secondary/50 px-3 py-2 text-center text-xs text-muted-foreground">{t.agile.read_only}</p>
          )}

          <CommentsSection taskId={task.id} projectId={project.id} t={t} />
        </div>
      </div>
    </div>
  )
}

function Column({
  column,
  canEdit,
  onQuickAdd,
  onOpen,
  onDropTask,
  dropActive,
  onDropOver,
  busy,
  filterTasks,
  boardFiltering,
  onAdd,
  t,
  locale,
}: {
  column: WorkflowColumn & { tasks: AgileTask[] }
  canEdit: boolean
  onQuickAdd: (colId: string, title: string, priority: string) => void
  onOpen: (id: string) => void
  onDropTask: (colId: string, taskId: string) => void
  dropActive: boolean
  onDropOver: (colId: string | null) => void
  busy: boolean
  filterTasks?: (task: AgileTask) => boolean
  boardFiltering?: boolean
  onAdd?: () => void
  t: Dictionary
  locale: string
}) {
  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState("MEDIUM")
  const overLimit = column.wipLimit !== null && column.wipLimit !== undefined && column.tasks.length >= column.wipLimit
  const tasks = filterTasks ? column.tasks.filter(filterTasks) : column.tasks

  return (
    <div
      className={cn("w-72 shrink-0 rounded-xl bg-secondary/40 p-2", dropActive && "ring-2 ring-primary/60")}
      style={{ minHeight: 160 }}
      onDragOver={(e) => {
        e.preventDefault()
        onDropOver(column.id)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onDropOver(null)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDropOver(null)
        const id = e.dataTransfer.getData("text/plain")
        if (id) onDropTask(column.id, id)
      }}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: column.color ?? "var(--muted)" }} />
          <h3 className="truncate text-sm font-bold">{column.name}</h3>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className={cn(
              "rounded-full px-2 text-xs font-semibold",
              overLimit ? "bg-danger/20 text-danger" : "bg-background text-secondary-foreground"
            )}
            title={overLimit ? t.agile.wip_limit : undefined}
          >
            {tasks.length}
            {boardFiltering && tasks.length !== column.tasks.length ? `/${column.tasks.length}` : ""}
            {column.wipLimit !== null && column.wipLimit !== undefined ? `/${column.wipLimit}` : ""}
          </span>
          {canEdit && onAdd && (
            <button
              onClick={onAdd}
              aria-label={t.agile.add}
              title={t.agile.add}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onOpen={onOpen}
            onDragStart={() => undefined}
            onDragEnd={() => onDropOver(null)}
            t={t}
            locale={locale}
          />
        ))}
        {tasks.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            {boardFiltering ? t.search.no_results : "—"}
          </p>
        )}
      </div>

      {canEdit && (
        <div className="mt-2 flex items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && title.trim() && onQuickAdd(column.id, title, priority)}
            placeholder={t.board.task_placeholder}
            className="input min-w-0 flex-1"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="h-10 shrink-0 cursor-pointer rounded-md border border-border bg-card px-2 text-xs"
            aria-label={t.board.priority}
          >
            <option value="LOW">{t.board.low}</option>
            <option value="MEDIUM">{t.board.medium}</option>
            <option value="HIGH">{t.board.high}</option>
            <option value="URGENT">{t.board.urgent}</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            aria-label={t.board.add_task}
            disabled={busy || !title.trim()}
            onClick={() => {
              if (title.trim()) {
                onQuickAdd(column.id, title, priority)
                setTitle("")
              }
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

function CreateTaskModal({
  snapshot,
  defaultColumnId,
  onClose,
  onCreated,
  t,
}: {
  snapshot: AgileSnapshot
  defaultColumnId: string
  onClose: () => void
  onCreated: () => void
  t: Dictionary
}) {
  const { token, currentOrg } = useAuth()
  const [busy, setBusy] = useState(false)
  const [fields, setFields] = useState({
    title: "",
    type: "TASK",
    priority: "MEDIUM",
    storyPoints: "",
    assigneeId: "",
    epicId: "",
    sprintId: "",
    columnId: defaultColumnId,
    description: "",
  })
  const [members, setMembers] = useState<{ id: string; fullName: string | null; email: string }[]>([])

  useEffect(() => {
    if (!token || !currentOrg) return
    api
      .listMembers(token, currentOrg.id)
      .then((list) => setMembers(list.map((m) => ({ id: m.user.id, fullName: m.user.fullName, email: m.user.email }))))
      .catch(() => {
        /* ignore */
      })
  }, [token, currentOrg])

  const create = async () => {
    if (!token || !currentOrg || !fields.title.trim()) return
    setBusy(true)
    try {
      await api.createTask(
        {
          title: fields.title.trim(),
          type: fields.type,
          priority: fields.priority,
          assigneeId: fields.assigneeId || undefined,
          epicId: fields.epicId || undefined,
          sprintId: fields.sprintId || undefined,
          columnId: fields.columnId || undefined,
          storyPoints: fields.storyPoints ? Number(fields.storyPoints) : undefined,
          description: fields.description || undefined,
        },
        token,
        currentOrg.id,
        snapshot.project.id
      )
      onCreated()
      onClose()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  const lbl = "mb-1 block text-xs font-medium text-muted-foreground"

  return (
    <Modal
      open
      onClose={onClose}
      title={t.agile.add}
      size="md"
      closeLabel={t.platform.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.agile.cancel}
          </Button>
          <Button onClick={create} disabled={busy || !fields.title.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t.agile.create}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={lbl}>{t.board.task_title}</label>
          <input
            value={fields.title}
            onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
            className="input"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>{t.agile.type}</label>
            <select
              value={fields.type}
              onChange={(e) => setFields((f) => ({ ...f, type: e.target.value }))}
              className="input cursor-pointer"
            >
              {Object.keys(t.agile.types).map((ty) => (
                <option key={ty} value={ty}>
                  {typeLabel(t, ty)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>{t.board.priority}</label>
            <select
              value={fields.priority}
              onChange={(e) => setFields((f) => ({ ...f, priority: e.target.value }))}
              className="input cursor-pointer"
            >
              <option value="LOW">{t.board.low}</option>
              <option value="MEDIUM">{t.board.medium}</option>
              <option value="HIGH">{t.board.high}</option>
              <option value="URGENT">{t.board.urgent}</option>
            </select>
          </div>
          <div>
            <label className={lbl}>{t.agile.point_estimate}</label>
            <input
              type="number"
              min={0}
              value={fields.storyPoints}
              onChange={(e) => setFields((f) => ({ ...f, storyPoints: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className={lbl}>{t.agile.assignee}</label>
            <select
              value={fields.assigneeId}
              onChange={(e) => setFields((f) => ({ ...f, assigneeId: e.target.value }))}
              className="input cursor-pointer"
            >
              <option value="">{t.agile.no_assignee}</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName ?? m.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>{t.agile.epic}</label>
            <select
              value={fields.epicId}
              onChange={(e) => setFields((f) => ({ ...f, epicId: e.target.value }))}
              className="input cursor-pointer"
            >
              <option value="">{t.agile.no_epic}</option>
              {snapshot.epics.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={lbl}>{t.agile.sprints}</label>
            <select
              value={fields.sprintId}
              onChange={(e) => setFields((f) => ({ ...f, sprintId: e.target.value }))}
              className="input cursor-pointer"
            >
              <option value="">{t.agile.unassigned}</option>
              {snapshot.sprints
                .filter((s) => s.status !== "COMPLETED")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div>
          <label className={lbl}>{t.board.task_title}</label>
          <textarea
            value={fields.description}
            onChange={(e) => setFields((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="input"
          />
        </div>
      </div>
    </Modal>
  )
}

function SprintModal({
  snapshot,
  sprint,
  onClose,
  onSaved,
  t,
}: {
  snapshot: AgileSnapshot
  sprint: Sprint | null
  onClose: () => void
  onSaved: () => void
  t: Dictionary
}) {
  const { token, currentOrg } = useAuth()
  const [busy, setBusy] = useState(false)
  const [fields, setFields] = useState({
    name: sprint?.name ?? "",
    goal: sprint?.goal ?? "",
    teamId: sprint?.teamId ?? "",
    startDate: sprint?.startDate ? sprint.startDate.slice(0, 10) : "",
    endDate: sprint?.endDate ? sprint.endDate.slice(0, 10) : "",
  })

  const save = async () => {
    if (!token || !currentOrg || !fields.name.trim()) return
    setBusy(true)
    try {
      const dto = {
        name: fields.name.trim(),
        goal: fields.goal || undefined,
        teamId: fields.teamId || undefined,
        startDate: fields.startDate || undefined,
        endDate: fields.endDate || undefined,
      }
      if (sprint) await api.updateSprint(token, currentOrg.id, snapshot.project.id, sprint.id, dto)
      else await api.createSprint(token, currentOrg.id, snapshot.project.id, dto)
      onSaved()
      onClose()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  const lbl = "mb-1 block text-xs font-medium text-muted-foreground"

  return (
    <Modal
      open
      onClose={onClose}
      title={t.agile.new_sprint}
      size="md"
      closeLabel={t.platform.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.agile.cancel}
          </Button>
          <Button onClick={save} disabled={busy || !fields.name.trim()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t.agile.create}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={lbl}>{t.agile.sprint_name}</label>
          <input
            value={fields.name}
            onChange={(e) => setFields((f) => ({ ...f, name: e.target.value }))}
            className="input"
            autoFocus
          />
        </div>
        <div>
          <label className={lbl}>{t.agile.sprint_goal}</label>
          <input
            value={fields.goal}
            onChange={(e) => setFields((f) => ({ ...f, goal: e.target.value }))}
            className="input"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl}>{t.agile.start_date}</label>
            <input
              type="date"
              value={fields.startDate}
              onChange={(e) => setFields((f) => ({ ...f, startDate: e.target.value }))}
              className="input"
            />
          </div>
          <div>
            <label className={lbl}>{t.agile.end_date}</label>
            <input
              type="date"
              value={fields.endDate}
              onChange={(e) => setFields((f) => ({ ...f, endDate: e.target.value }))}
              className="input"
            />
          </div>
        </div>
        <div>
          <label className={lbl}>{t.agile.team}</label>
          <select
            value={fields.teamId}
            onChange={(e) => setFields((f) => ({ ...f, teamId: e.target.value }))}
            className="input cursor-pointer"
          >
            <option value="">—</option>
            {snapshot.teams.map((tm) => (
              <option key={tm.id} value={tm.id}>
                {tm.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  )
}

function WorkflowModal({
  snapshot,
  onClose,
  onSaved,
  t,
}: {
  snapshot: AgileSnapshot
  onClose: () => void
  onSaved: () => void
  t: Dictionary
}) {
  const { token, currentOrg } = useAuth()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(snapshot.workflow.name)
  const [columns, setColumns] = useState<{ id?: string; name: string; status: string; color: string | null; wipLimit: string; isBacklog: boolean }[]>(
    snapshot.workflow.columns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      color: c.color,
      wipLimit: c.wipLimit?.toString() ?? "",
      isBacklog: c.isBacklog,
    }))
  )

  const save = async () => {
    if (!token || !currentOrg) return
    setBusy(true)
    try {
      await api.saveWorkflow(
        token,
        currentOrg.id,
        snapshot.project.id,
        {
          name: name.trim() || "Board",
          columns: columns.map((c, i) => ({
            id: c.id,
            name: c.name.trim(),
            status: c.status.trim() || `STATUS_${i}`,
            color: c.color,
            isBacklog: c.isBacklog,
            wipLimit: c.wipLimit ? Number(c.wipLimit) : null,
          })),
        }
      )
      onSaved()
      onClose()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t.agile.configure_workflow}
      size="xl"
      closeLabel={t.platform.close}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t.agile.cancel}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.agile.workflow_name}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
        </div>

        <div className="space-y-2">
          {columns.map((c, i) => (
            <div key={i} className="grid grid-cols-[18px_1fr_1fr_70px_90px_28px] items-center gap-2">
              <span aria-hidden className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color || "var(--muted)" }} />
              <input
                value={c.name}
                placeholder={t.agile.column_name}
                onChange={(e) => setColumns((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                className="input"
              />
              <input
                value={c.status}
                placeholder={t.agile.column_status}
                onChange={(e) => setColumns((cs) => cs.map((x, j) => (j === i ? { ...x, status: e.target.value } : x)))}
                className="input"
              />
              <input
                type="number"
                min={0}
                placeholder={t.agile.wip_limit}
                value={c.wipLimit}
                onChange={(e) => setColumns((cs) => cs.map((x, j) => (j === i ? { ...x, wipLimit: e.target.value } : x)))}
                className="input"
              />
              <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={c.isBacklog}
                  onChange={(e) => setColumns((cs) => cs.map((x, j) => (j === i ? { ...x, isBacklog: e.target.checked } : x)))}
                />
                {t.agile.is_backlog}
              </label>
              <button
                type="button"
                onClick={() => setColumns((cs) => cs.filter((_, j) => j !== i))}
                title={t.agile.delete}
                aria-label={t.agile.delete}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-danger transition-colors hover:bg-danger/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setColumns((cs) => [...cs, { name: "", status: "", color: "#94a3b8", wipLimit: "", isBacklog: false }])}
        >
          <Plus className="h-4 w-4" />
          {t.agile.new_column}
        </Button>
      </div>
    </Modal>
  )
}

function SprintCard({
  sprint,
  canManage,
  onStart,
  onComplete,
  onDelete,
  onOpenTask,
  t,
  locale,
}: {
  sprint: Sprint
  canManage: boolean
  onStart: (id: string) => void
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onOpenTask: (id: string) => void
  t: Dictionary
  locale: string
}) {
  const pin =
    sprint.status === "ACTIVE" ? "border-primary/50 bg-primary/5" : sprint.status === "COMPLETED" ? "opacity-70" : ""
  const statusVariant = sprint.status === "ACTIVE" ? "success" : sprint.status === "COMPLETED" ? "info" : "secondary"
  const statusLabel = sprint.status === "ACTIVE" ? "Active" : sprint.status === "COMPLETED" ? "Completed" : "Planning"
  const donePoints = sprint.tasks.filter((task) => task.status.toUpperCase() === "DONE").reduce((s, task) => s + (task.storyPoints ?? 0), 0)
  const totalPoints = sprint.tasks.reduce((s, task) => s + (task.storyPoints ?? 0), 0)
  const pct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", pin)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold">{sprint.name}</h3>
            <Badge variant={statusVariant} dot className="text-[10px]">
              {statusLabel}
            </Badge>
          </div>
          {sprint.goal && <p className="mt-1 text-xs text-muted-foreground">{sprint.goal}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            {sprint.team && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {t.agile.team}: {sprint.team.name}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {sprint.startDate ? new Date(sprint.startDate).toLocaleDateString(locale) : "—"}
              <ChevronRight className="h-3 w-3 rtl:rotate-180" />
              {sprint.endDate ? new Date(sprint.endDate).toLocaleDateString(locale) : "—"}
            </span>
          </div>
        </div>
        <div className="text-end">
          <p className="text-lg font-black">{sprint.points}</p>
          <p className="text-[10px] uppercase text-muted-foreground">{t.agile.points}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-secondary-foreground">
          {sprint.tasks.length} {t.agile.tasks_in_sprint}
        </span>
        {canManage && sprint.status === "PLANNING" && (
          <Button size="sm" variant="outline" onClick={() => onStart(sprint.id)}>
            {t.agile.start}
          </Button>
        )}
        {canManage && sprint.status === "ACTIVE" && (
          <Button size="sm" onClick={() => onComplete(sprint.id)}>
            {t.agile.complete}
          </Button>
        )}
        {canManage && sprint.status !== "ACTIVE" && (
          <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => onDelete(sprint.id)}>
            <Trash2 className="h-3.5 w-3.5" />
            {t.agile.delete}
          </Button>
        )}
      </div>

      <div className="mt-3 space-y-2">
        {sprint.tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onOpenTask(task.id)}
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2 text-start text-sm hover:border-primary/40"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold", TYPE_STYLE[task.type] ?? TYPE_STYLE.TASK)}>
                <TypeIcon type={task.type} className="h-3 w-3" />
              </span>
              <span className="truncate">{task.title}</span>
            </span>
            {typeof task.storyPoints === "number" && (
              <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
                {task.storyPoints} {t.agile.points}
              </span>
            )}
          </button>
        ))}
        {sprint.tasks.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">—</p>}
      </div>

      {totalPoints > 0 && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
            <span>
              {donePoints}/{totalPoints} {t.agile.points}
            </span>
            <span className="font-bold">{sprint.status === "COMPLETED" ? 100 : pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
            <div
              className="h-full rounded-full bg-success transition-all duration-500"
              style={{ width: `${sprint.status === "COMPLETED" ? 100 : pct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>
      <Skeleton className="h-9 w-full max-w-lg rounded-lg" />
      <div className="flex gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-72 shrink-0 rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function ProjectBoardPage() {
  const params = useParams<{ id: string }>()
  const { token, currentOrg, user } = useAuth()
  const { t, locale } = useI18n()
  const role = currentOrg?.role ?? "VIEWER"
  const canEdit = role !== "VIEWER"
  const canManage = ["MANAGER", "ADMIN", "OWNER"].includes(role as string)

  const [snapshot, setSnapshot] = useState<AgileSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"board" | "backlog" | "sprints" | "git">("board")
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showSprint, setShowSprint] = useState(false)
  const [showWorkflow, setShowWorkflow] = useState(false)
  const [createColumnId, setCreateColumnId] = useState("")
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")
  const [dropColId, setDropColId] = useState<string | null>(null)
  const [boardQuery, setBoardQuery] = useState("")
  const [prioFilter, setPrioFilter] = useState("ALL")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [mineOnly, setMineOnly] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  const load = useCallback(async () => {
    if (!token || !currentOrg || !params.id) {
      setLoading(false)
      return
    }
    try {
      setSnapshot(await api.getProject(token, currentOrg.id, params.id))
    } catch (e) {
      setError((e as Error)?.message ?? "Error")
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg, params.id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!token || !currentOrg || !params.id) return
    const socket = io(wsOrigin(), {
      auth: { token, organizationId: currentOrg.id },
      transports: ["websocket"],
    })
    socketRef.current = socket
    socket.on("task:updated", () => load())
    socket.on("sprint:updated", () => load())
    socket.on("workflow:updated", () => load())
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, currentOrg, params.id, load])

  const addQuick = async (colId: string, title: string, priority: string) => {
    if (!token || !currentOrg || !snapshot) return
    setBusy(true)
    try {
      await api.createTask({ title, priority, columnId: colId }, token, currentOrg.id, snapshot.project.id)
      await load()
    } catch {
      /* ignore */
    } finally {
      setBusy(false)
    }
  }

  const dropTask = async (colId: string, taskId: string) => {
    setDropColId(null)
    if (!token || !currentOrg || !snapshot) return
    const moving = snapshot.workflow.columns.flatMap((c) => c.tasks).find((task) => task.id === taskId)
    if (!moving || moving.columnId === colId) return
    try {
      await api.moveTask(token, currentOrg.id, snapshot.project.id, taskId, colId, 0)
      await load()
    } catch {
      /* ignore */
    }
  }

  const drawerTaskData = useMemo(() => {
    if (!snapshot || !drawerTaskId) return null
    const all = [
      ...snapshot.workflow.columns.flatMap((c) => c.tasks),
      ...snapshot.backlog,
      ...snapshot.sprints.flatMap((s) => s.tasks),
    ]
    return all.find((task) => task.id === drawerTaskId) ?? null
  }, [snapshot, drawerTaskId])

  const filteredBacklog = useMemo(() => {
    if (!snapshot) return []
    const q = search.trim().toLowerCase()
    if (!q) return snapshot.backlog
    return snapshot.backlog.filter((task) => task.title.toLowerCase().includes(q))
  }, [snapshot, search])

  const sortedSprints = useMemo(() => {
    if (!snapshot) return []
    const rank: Record<string, number> = { ACTIVE: 0, PLANNING: 1, COMPLETED: 2 }
    return [...snapshot.sprints].sort((a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3))
  }, [snapshot])

  const isFiltering = boardQuery.trim() !== "" || prioFilter !== "ALL" || typeFilter !== "ALL" || mineOnly

  const taskVisible = useCallback(
    (task: AgileTask) => {
      if (mineOnly && task.assignee?.id !== user?.id) return false
      if (prioFilter !== "ALL" && task.priority !== prioFilter) return false
      if (typeFilter !== "ALL" && task.type !== typeFilter) return false
      const q = boardQuery.trim().toLowerCase()
      if (q && !task.title.toLowerCase().includes(q)) return false
      return true
    },
    [mineOnly, prioFilter, typeFilter, boardQuery, user?.id]
  )

  const boardStats = useMemo(() => {
    if (!snapshot) return { byPriority: { CRITICAL: 0, URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }, visible: 0, total: 0 }
    const all = snapshot.workflow.columns.flatMap((c) => c.tasks)
    const byPriority: Record<string, number> = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    let visible = 0
    for (const task of all) {
      if (taskVisible(task)) visible += 1
      if (task.priority in byPriority) byPriority[task.priority] += 1
    }
    return { byPriority, visible, total: all.length }
  }, [snapshot, taskVisible])

  const activeSprint = useMemo(() => {
    if (!snapshot) return null
    const sprint = snapshot.sprints.find((s) => s.status === "ACTIVE")
    if (!sprint) return null
    const done = sprint.tasks.filter((task) => task.status.toUpperCase() === "DONE").reduce((s, task) => s + (task.storyPoints ?? 0), 0)
    const total = sprint.tasks.reduce((s, task) => s + (task.storyPoints ?? 0), 0)
    return { sprint, donePoints: done, totalPoints: total, pct: total > 0 ? Math.round((done / total) * 100) : 0 }
  }, [snapshot])

  if (loading) return <ProjectLoading />
  if (error) return <div className="rounded-xl border border-danger/50 bg-danger/10 p-6 text-sm font-medium text-danger">{error}</div>
  if (!snapshot) return null

  const project = snapshot.project

  const TABS = [
    { key: "board" as const, icon: LayoutGrid, label: t.agile.board },
    { key: "backlog" as const, icon: List, label: t.agile.backlog },
    { key: "sprints" as const, icon: Target, label: t.agile.sprints },
    { key: "git" as const, icon: GitBranch, label: t.repo.tab },
  ]

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t.projects.title}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-sm"
            style={{ backgroundColor: project.color }}
          >
            {(project.key ?? project.name).slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold md:text-2xl">{project.name}</h2>
              <Badge variant={project.type === "ENGINEERING" ? "default" : "secondary"} className="text-[10px]">
                {project.type === "ENGINEERING" ? "SCRUM" : "KANBAN"}
              </Badge>
              {project.key && (
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-secondary-foreground">
                  {project.key}
                </span>
              )}
            </div>
            {project.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(project.status)} dot className="text-[10px]">
            {project.status}
          </Badge>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => setShowWorkflow(true)}>
              <Settings2 className="h-4 w-4" />
              {t.agile.configure_workflow}
            </Button>
          )}
          {canEdit && (
            <Button
              size="sm"
              onClick={() => {
                setCreateColumnId(snapshot.workflow.columns[0]?.id ?? "")
                setShowCreate(true)
              }}
            >
              <Plus className="h-4 w-4" />
              {t.agile.add}
            </Button>
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="rounded-lg bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">{t.agile.read_only}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label={t.agile.board} className="inline-flex items-center gap-1 rounded-lg bg-secondary p-1">
          {TABS.map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              aria-current={tab === key ? "page" : undefined}
              onClick={() => setTab(key)}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary/70 px-2.5 py-1 text-[10px] font-semibold text-secondary-foreground">
            <Users className="h-3 w-3" />
            {t.agile.teams}: {snapshot.teams.length > 0 ? snapshot.teams.map((tm) => tm.name).join(", ") : t.agile.no_teams_linked}
          </span>
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-bold text-success">
            {snapshot.workflow.columns.reduce((acc, c) => acc + c.tasks.length, 0)} {t.projects.tasks}
          </span>
        </div>
      </div>

      {tab === "board" && (
        <>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-48 flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={boardQuery}
                  onChange={(e) => setBoardQuery(e.target.value)}
                  placeholder={t.agile.search}
                  aria-label={t.agile.search}
                  className="input ps-9"
                />
              </div>
              <select
                value={prioFilter}
                onChange={(e) => setPrioFilter(e.target.value)}
                aria-label={t.board.priority}
                className="h-10 cursor-pointer rounded-lg border border-border bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ALL">{t.agile.all_priorities}</option>
                <option value="LOW">{t.board.low}</option>
                <option value="MEDIUM">{t.board.medium}</option>
                <option value="HIGH">{t.board.high}</option>
                <option value="URGENT">{t.board.urgent}</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label={t.agile.type}
                className="h-10 cursor-pointer rounded-lg border border-border bg-background px-3 text-sm focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ALL">{t.agile.all_types}</option>
                {Object.keys(t.agile.types).map((ty) => (
                  <option key={ty} value={ty}>
                    {typeLabel(t, ty)}
                  </option>
                ))}
              </select>
              <Button
                size="sm"
                variant={mineOnly ? "default" : "outline"}
                onClick={() => setMineOnly((v) => !v)}
                aria-pressed={mineOnly}
              >
                <Users className="h-3.5 w-3.5" />
                {t.agile.my_tasks}
              </Button>
              {isFiltering && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setBoardQuery("")
                    setPrioFilter("ALL")
                    setTypeFilter("ALL")
                    setMineOnly(false)
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  {t.agile.clear}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="rounded-full bg-secondary/70 px-2.5 py-1 font-semibold text-secondary-foreground">
                {boardStats.visible}
                {isFiltering ? ` / ${boardStats.total}` : ""} {t.projects.tasks}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {(["URGENT", "HIGH", "MEDIUM", "LOW"] as const).map((p) => {
                  const Icon = PRIORITY_ICONS[p]
                  return (
                    <span
                      key={p}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-bold",
                        PRIORITY_COLORS[p] ?? "border-border bg-secondary/50 text-muted-foreground"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {boardStats.byPriority[p]}
                    </span>
                  )
                })}
              </div>
              {activeSprint && (
                <div className="ms-auto flex min-w-40 flex-1 basis-52 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5">
                  <span className="truncate text-xs font-semibold text-muted-foreground">{activeSprint.sprint.name}</span>
                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary/60">
                    <div
                      className="h-full rounded-full bg-success transition-all"
                      style={{ width: `${activeSprint.pct}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[10px] font-bold">
                    {activeSprint.donePoints}/{activeSprint.totalPoints} · {activeSprint.pct}%
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto pb-2">
            <div className="flex min-w-max gap-4" dir="ltr">
              {snapshot.workflow.columns.map((column) => (
                <Column
                  key={column.id}
                  column={column as WorkflowColumn & { tasks: AgileTask[] }}
                  canEdit={canEdit}
                  onQuickAdd={addQuick}
                  onOpen={(id) => setDrawerTaskId(id)}
                  onDropTask={(colId, taskId) => dropTask(colId, taskId)}
                  dropActive={dropColId === column.id}
                  onDropOver={setDropColId}
                  busy={busy}
                  filterTasks={taskVisible}
                  boardFiltering={isFiltering}
                  onAdd={() => {
                    setCreateColumnId(column.id)
                    setShowCreate(true)
                  }}
                  t={t}
                  locale={locale}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {tab === "backlog" && (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{t.agile.epics_title}</h3>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setCreateColumnId(snapshot.workflow.columns.find((c) => c.isBacklog)?.id ?? "")
                    setShowCreate(true)
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t.agile.new_epic}
                </Button>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {snapshot.epics.map((ep) => (
                <div key={ep.id} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                      <Target className="h-4 w-4" />
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold">{ep.title}</p>
                  </div>
                  {typeof ep.storyPoints === "number" && ep.storyPoints > 0 && (
                    <p className="mt-1 ps-10 text-[10px] font-bold text-muted-foreground">
                      {ep.storyPoints} {t.agile.points}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.agile.search}
                  aria-label={t.agile.search}
                  className="h-10 w-full rounded-md border border-border bg-card ps-9 pe-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {filteredBacklog.length} {t.projects.tasks}
              </span>
            </div>
            <div className="space-y-2">
              {filteredBacklog.map((task) => (
                <BacklogRow
                  key={task.id}
                  task={task}
                  onOpen={(id) => setDrawerTaskId(id)}
                  onDragStart={() => undefined}
                  onDragEnd={() => undefined}
                  t={t}
                  locale={locale}
                />
              ))}
              {filteredBacklog.length === 0 && (
                <EmptyState
                  icon={List}
                  title={search.trim() ? t.search.no_results : t.agile.backlog}
                  description={search.trim() ? undefined : t.agile.unassigned}
                  className="py-12"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "sprints" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-muted-foreground">{t.agile.sprints}</h3>
            {canManage && (
              <Button size="sm" onClick={() => setShowSprint(true)}>
                <Plus className="h-4 w-4" />
                {t.agile.new_sprint}
              </Button>
            )}
          </div>
          {sortedSprints.map((sprint) => (
            <SprintCard
              key={sprint.id}
              sprint={sprint}
              canManage={canManage}
              onStart={async (id) => {
                if (!token || !currentOrg) return
                try {
                  await api.setSprintStatus(token, currentOrg.id, project.id, id, "ACTIVE")
                  await load()
                } catch {
                  /* ignore */
                }
              }}
              onComplete={async (id) => {
                if (!token || !currentOrg) return
                try {
                  await api.setSprintStatus(token, currentOrg.id, project.id, id, "COMPLETED")
                  await load()
                } catch {
                  /* ignore */
                }
              }}
              onDelete={async (id) => {
                if (!token || !currentOrg || !window.confirm("Delete sprint?")) return
                try {
                  await api.deleteSprint(token, currentOrg.id, project.id, id)
                  await load()
                } catch {
                  /* ignore */
                }
              }}
              onOpenTask={(id) => setDrawerTaskId(id)}
              t={t}
              locale={locale}
            />
          ))}
          {sortedSprints.length === 0 && (
            <EmptyState
              icon={Target}
              title={t.agile.planned_sprints}
              action={
                canManage ? (
                  <Button size="sm" onClick={() => setShowSprint(true)}>
                    <Plus className="h-4 w-4" />
                    {t.agile.new_sprint}
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>
      )}

      {tab === "git" && <GitTab projectId={project.id} canManage={canManage} />}

      {drawerTaskData && (
        <TaskDrawer task={drawerTaskData} snapshot={snapshot} onClose={() => setDrawerTaskId(null)} onChange={load} t={t} />
      )}
      {showCreate && (
        <CreateTaskModal snapshot={snapshot} defaultColumnId={createColumnId} onClose={() => setShowCreate(false)} onCreated={load} t={t} />
      )}
      {showSprint && <SprintModal snapshot={snapshot} sprint={null} onClose={() => setShowSprint(false)} onSaved={load} t={t} />}
      {showWorkflow && <WorkflowModal snapshot={snapshot} onClose={() => setShowWorkflow(false)} onSaved={load} t={t} />}
    </div>
  )
}