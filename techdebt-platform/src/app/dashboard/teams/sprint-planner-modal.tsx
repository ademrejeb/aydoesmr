"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  FileText,
  Layers,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import {
  api,
  type AppliedSprintPlan,
  type PlannedTicket,
  type Project,
  type SprintPlan,
  type Team,
} from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"

const MAX_BYTES = 20 * 1024 * 1024

const TYPE_VARIANT: Record<string, "secondary" | "outline" | "danger" | "info"> = {
  TASK: "info",
  BUG: "danger",
  EPIC: "secondary",
  SUBTASK: "outline",
}

const PRIORITY_VARIANT: Record<string, "secondary" | "outline" | "warning" | "danger"> = {
  LOW: "secondary",
  MEDIUM: "outline",
  HIGH: "warning",
  URGENT: "danger",
}

function TicketRow({ ticket }: { ticket: PlannedTicket }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <Badge variant={TYPE_VARIANT[ticket.type] ?? "outline"} className="mt-0.5 shrink-0 text-[10px]">
        {ticket.type}
      </Badge>
      <p className="min-w-0 flex-1 break-words text-sm text-foreground">{ticket.title}</p>
      <div className="flex shrink-0 items-center gap-1.5">
        {ticket.storyPoints != null && (
          <Badge variant="secondary" className="text-[10px]">
            {ticket.storyPoints}
          </Badge>
        )}
        <Badge variant={PRIORITY_VARIANT[ticket.priority] ?? "outline"} className="text-[10px]">
          {ticket.priority}
        </Badge>
      </div>
    </div>
  )
}

export function SprintPlannerModal({
  open,
  onClose,
  teams,
}: {
  open: boolean
  onClose: () => void
  teams: Team[]
}) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<"upload" | "preview" | "done">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [sprintName, setSprintName] = useState("")
  const [generating, setGenerating] = useState(false)
  const [plan, setPlan] = useState<SprintPlan | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState("")
  const [teamId, setTeamId] = useState("")
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<AppliedSprintPlan | null>(null)
  const [error, setError] = useState<string | null>(null)

  const closeModal = () => {
    setStep("upload")
    setFile(null)
    setPlan(null)
    setResult(null)
    setError(null)
    setSprintName("")
    setProjectId("")
    setTeamId("")
    setApplying(false)
    setGenerating(false)
    onClose()
  }

  useEffect(() => {
    if (!open || !token || !currentOrg) return
    api
      .listProjects(token, currentOrg.id)
      .then((list) => setProjects(list))
      .catch(() => setProjects([]))
  }, [open, token, currentOrg])

  const grouped = useMemo(() => {
    const map = new Map<string, PlannedTicket[]>()
    for (const ticket of plan?.tickets ?? []) {
      const key = ticket.epic || ""
      const arr = map.get(key) ?? []
      arr.push(ticket)
      map.set(key, arr)
    }
    return Array.from(map.entries())
  }, [plan])

  const epicCount = grouped.filter(([key]) => key).length
  const totalTickets = plan?.tickets?.length ?? 0

  const pickFile = (f: File | null | undefined) => {
    if (!f) return
    if (f.size > MAX_BYTES) {
      setError(t.planner.upload_hint)
      return
    }
    setError(null)
    setFile(f)
  }

  const generate = async () => {
    if (!token || !currentOrg || !file) return
    setGenerating(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      if (sprintName.trim()) form.append("sprintName", sprintName.trim())
      const created = await api.planFromDocument(token, currentOrg.id, form)
      setPlan(created)
      if (created.sprintName) setSprintName(created.sprintName)
      setStep("preview")
    } catch (e) {
      setError(e instanceof Error ? e.message : t.planner.error)
    } finally {
      setGenerating(false)
    }
  }

  const apply = async () => {
    if (!token || !currentOrg || !plan?.id) return
    if (!projectId) {
      setError(t.planner.select_project)
      return
    }
    setApplying(true)
    setError(null)
    try {
      const res = await api.applySprintPlan(token, currentOrg.id, plan.id, {
        projectId,
        teamId: teamId || undefined,
        sprintName: sprintName.trim() || undefined,
      })
      setResult(res)
      setStep("done")
      toast.success(t.planner.success_title)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.planner.error)
    } finally {
      setApplying(false)
    }
  }

  const modalTitle =
    step === "upload" ? t.planner.title : step === "preview" ? t.planner.preview_title : t.planner.success_title

  return (
    <Modal
      open={open}
      onClose={closeModal}
      size="xl"
      title={modalTitle}
      description={step === "upload" ? t.planner.subtitle : plan?.fileName}
      closeLabel={t.planner.back}
      footer={
        step === "upload" ? (
          <>
            <Button variant="ghost" onClick={closeModal}>
              {t.planner.back}
            </Button>
            <Button onClick={generate} disabled={generating || !file}>
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? t.planner.generating : t.planner.generate}
            </Button>
          </>
        ) : step === "preview" ? (
          <>
            <Button variant="ghost" onClick={() => setStep("upload")}>
              <ArrowLeft className="h-4 w-4" />
              {t.planner.back}
            </Button>
            <Button onClick={apply} disabled={applying || !projectId || totalTickets === 0}>
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {applying ? t.planner.applying : t.planner.apply}
            </Button>
          </>
        ) : (
          <Button onClick={closeModal}>{t.planner.done}</Button>
        )
      }
    >
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}

      {step === "upload" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t.planner.upload_title}</label>
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                pickFile(e.dataTransfer.files?.[0])
              }}
              className={cn(
                "cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors",
                dragOver ? "border-ring bg-accent/50" : "border-border bg-card/50 hover:bg-accent/40"
              )}
            >
              {file ? (
                <div className="flex items-center gap-3 text-start">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    aria-label={t.planner.change_file}
                    onClick={(e) => {
                      e.stopPropagation()
                      setFile(null)
                      setError(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{t.planner.choose_file}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t.planner.upload_hint}</p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md,.markdown,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
            </div>
          </div>

          <div>
            <label htmlFor="planner-sprint-name" className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t.planner.sprint_name}
            </label>
            <input
              id="planner-sprint-name"
              value={sprintName}
              onChange={(e) => setSprintName(e.target.value)}
              placeholder={t.planner.sprint_name_placeholder}
              className="input"
            />
          </div>
        </div>
      )}

      {step === "preview" && plan && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">
              <FileText className="h-3 w-3" />
              <span className="max-w-[220px] truncate">{plan.fileName}</span>
            </Badge>
            <Badge variant="secondary">
              <ListChecks className="h-3 w-3" />
              {t.planner.tickets_count.replace("{count}", String(totalTickets))}
            </Badge>
            {epicCount > 0 && (
              <Badge variant="outline">
                <Layers className="h-3 w-3" />
                {t.planner.epics_count.replace("{count}", String(epicCount))}
              </Badge>
            )}
            <Badge variant="outline">{t.planner.chars_count.replace("{count}", String(plan.charCount))}</Badge>
          </div>

          {plan.error && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0 break-words">{t.planner.ai_note}</span>
            </div>
          )}

          {totalTickets === 0 ? (
            <p className="rounded-lg border border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
              {t.planner.no_tickets}
            </p>
          ) : (
            <div className="max-h-72 space-y-4 overflow-y-auto pe-1">
              {grouped.map(([epic, tickets]) => (
                <div key={epic || "__none"}>
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Layers className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 truncate">{epic || t.planner.document}</span>
                    <span className="shrink-0 font-normal text-muted-foreground/70">{tickets.length}</span>
                  </div>
                  <div className="space-y-1">
                    {tickets.map((ticket, i) => (
                      <TicketRow key={`${ticket.title}-${i}`} ticket={ticket} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <div>
              <label htmlFor="planner-project" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t.planner.project}
              </label>
              <Select id="planner-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">{t.planner.select_project}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key ? `${p.key} · ${p.name}` : p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="planner-team" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t.planner.team}
              </label>
              <Select id="planner-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                <option value="">{t.planner.no_team}</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="planner-sprint-name-2" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t.planner.sprint_name}
              </label>
              <input
                id="planner-sprint-name-2"
                value={sprintName}
                onChange={(e) => setSprintName(e.target.value)}
                placeholder={t.planner.sprint_name_placeholder}
                className="input"
              />
            </div>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success/10 text-success">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{t.planner.success_title}</p>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                {t.planner.success_desc
                  .replace("{epics}", String(result.createdEpics))
                  .replace("{tasks}", String(result.createdTasks))
                  .replace("{sprint}", result.sprint.name)}
              </p>
            </div>
          </div>
          <div className="flex justify-center gap-2">
            <Link
              href={`/dashboard/projects/${result.project.id}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-input bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <LayoutDashboard className="h-4 w-4" />
              {t.planner.view_board}
            </Link>
            <Button variant="ghost" onClick={closeModal}>
              {t.planner.done}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}