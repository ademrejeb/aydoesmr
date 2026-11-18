"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Factory,
  GitBranch,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react"
import { api, type AgentConnection, type AgileTask, type AutomationProposal, type FactoryAgentProfile, type FactoryGateStatus, type FactoryRun, type FactoryRunSummary, type FactoryStats, type GitRepository, type Project } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { atLeast } from "@/lib/access"
import { cn, timeAgo } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { StatCard } from "@/components/ui/stat-card"
import { Textarea } from "@/components/ui/textarea"

const COPY = {
  ar: {
    eyebrow: "مصنع البرمجيات",
    title: "مصنع البرمجيات",
    subtitle: "من المشكلة إلى خطة، فرع، فحص جودة، مراجعة مستقلة وموافقة بشرية — كل خطوة مسجلة.",
    newRun: "تشغيل جديد",
    agents: "سجل الوكلاء",
    runs: "التشغيلات",
    empty: "لا توجد تشغيلات بعد. أنشئ تشغيلاً من مهمة لبدء المصنع.",
    active: "نشطة",
    waiting: "بانتظار الموافقة",
    review: "بانتظار المراجعة",
    gates: "بوابات مفتوحة",
    status: "الحالة",
    task: "المهمة",
    project: "المشروع",
    repository: "المستودع",
    agent: "الوكيل",
    branch: "الفرع",
    plan: "الخطة",
    issue: "تحليل المشكلة",
    events: "الأحداث",
    approvals: "الموافقات",
    quality: "الجودة",
    execute: "تنفيذ",
    replan: "إعادة تخطيط",
    approve: "موافقة",
    reject: "رفض",
    reviewApprove: "اعتماد المراجعة",
    merge: "دمج",
    cancel: "إلغاء",
    close: "إغلاق",
    selectProject: "اختر مشروعاً",
    selectTask: "اختر مهمة",
    selectRepo: "مستودع (اختياري)",
    selectAgent: "وكيل (اختياري)",
    create: "إنشاء التشغيل",
    creating: "جارٍ الإنشاء…",
    noPlan: "لا خطة بعد.",
    loaded: "تم التحديث",
    failed: "فشل الإجراء",
    managerOnly: "يتطلب دور مدير أو أعلى.",
    steps: "الخطوات",
    acceptance: "معايير القبول",
    risks: "المخاطر",
    findings: "ملاحظات المراجعة",
    agentName: "اسم الوكيل",
    agentSlug: "المعرّف",
    agentRole: "الدور",
    connection: "اتصال الوكيل",
    addAgent: "إضافة وكيل",
    noAgents: "لا وكلاء مسجلون. أضف وكيلاً وربطه باتصال منشور.",
    noConnections: "لا اتصالات وكلاء. اربط واحداً من صفحة وكلاء الذكاء أولاً.",
    disabled: "معطّل",
    enabled: "نشط",
    retryHint: "أصلح المشكلة ثم أعد المحاولة.",
    noRepository: "لا مستودع مرتبط",
    automation: "فرص الأتمتة",
    automationHint: "أنماط متكررة من سجل التدقيق. الموافقة تسجل القرار فقط؛ التفعيل يتطلب تعريف سير عمل صريح.",
    noAutomation: "لا توجد أنماط متكررة كافية بعد.",
    frequency: "مرات",
    minutesSaved: "دقيقة/شهر",
  },
  fr: {
    eyebrow: "Usine logicielle",
    title: "Usine logicielle",
    subtitle: "De l’issue au plan, à la branche, au contrôle qualité, à la revue indépendante et à l’approbation humaine — chaque étape est tracée.",
    newRun: "Nouveau run",
    agents: "Registre des agents",
    runs: "Runs",
    empty: "Aucun run. Créez-en un depuis une tâche pour démarrer l’usine.",
    active: "Actifs",
    waiting: "En attente d’approbation",
    review: "En attente de revue",
    gates: "Portes ouvertes",
    status: "Statut",
    task: "Tâche",
    project: "Projet",
    repository: "Dépôt",
    agent: "Agent",
    branch: "Branche",
    plan: "Plan",
    issue: "Analyse de l’issue",
    events: "Événements",
    approvals: "Approbations",
    quality: "Qualité",
    execute: "Exécuter",
    replan: "Replanifier",
    approve: "Approuver",
    reject: "Rejeter",
    reviewApprove: "Valider la revue",
    merge: "Fusionner",
    cancel: "Annuler",
    close: "Fermer",
    selectProject: "Choisir un projet",
    selectTask: "Choisir une tâche",
    selectRepo: "Dépôt (optionnel)",
    selectAgent: "Agent (optionnel)",
    create: "Créer le run",
    creating: "Création…",
    noPlan: "Aucun plan.",
    loaded: "Actualisé",
    failed: "Action échouée",
    managerOnly: "Rôle manager ou supérieur requis.",
    steps: "Étapes",
    acceptance: "Critères d’acceptation",
    risks: "Risques",
    findings: "Constats de revue",
    agentName: "Nom de l’agent",
    agentSlug: "Identifiant",
    agentRole: "Rôle",
    connection: "Connexion agent",
    addAgent: "Ajouter un agent",
    noAgents: "Aucun agent. Ajoutez un profil et liez une connexion publiée.",
    noConnections: "Aucune connexion. Liez-en une depuis la page Agents IA.",
    disabled: "Désactivé",
    enabled: "Actif",
    retryHint: "Corrigez le problème puis réessayez.",
    noRepository: "Aucun dépôt lié",
    automation: "Opportunités d’automatisation",
    automationHint: "Motifs répétés dans le journal d’audit. Approuver enregistre la décision ; l’activation exige une définition de workflow explicite.",
    noAutomation: "Pas encore assez de motifs répétés.",
    frequency: "fois",
    minutesSaved: "min/mois",
  },
  en: {
    eyebrow: "Software factory",
    title: "Software Factory",
    subtitle: "From issue to plan, branch, quality scan, independent review and human approval — every step is traceable.",
    newRun: "New run",
    agents: "Agent registry",
    runs: "Runs",
    empty: "No runs yet. Start one from a task to boot the factory.",
    active: "Active",
    waiting: "Waiting approval",
    review: "Waiting review",
    gates: "Open gates",
    status: "Status",
    task: "Task",
    project: "Project",
    repository: "Repository",
    agent: "Agent",
    branch: "Branch",
    plan: "Plan",
    issue: "Issue analysis",
    events: "Events",
    approvals: "Approvals",
    quality: "Quality",
    execute: "Execute",
    replan: "Replan",
    approve: "Approve",
    reject: "Reject",
    reviewApprove: "Approve review",
    merge: "Merge",
    cancel: "Cancel",
    close: "Close",
    selectProject: "Select a project",
    selectTask: "Select a task",
    selectRepo: "Repository (optional)",
    selectAgent: "Agent (optional)",
    create: "Create run",
    creating: "Creating…",
    noPlan: "No plan yet.",
    loaded: "Refreshed",
    failed: "Action failed",
    managerOnly: "Requires manager role or higher.",
    steps: "Steps",
    acceptance: "Acceptance criteria",
    risks: "Risks",
    findings: "Review findings",
    agentName: "Agent name",
    agentSlug: "Slug",
    agentRole: "Role",
    connection: "Agent connection",
    addAgent: "Add agent",
    noAgents: "No agents registered. Add a profile linked to a published connection.",
    noConnections: "No agent connections. Link one from the AI Agents page first.",
    disabled: "Disabled",
    enabled: "Active",
    retryHint: "Fix the problem, then retry.",
    noRepository: "No linked repository",
    automation: "Automation opportunities",
    automationHint: "Repeated patterns from the audit log. Approval records the decision; activation still requires an explicit workflow definition.",
    noAutomation: "Not enough repeated patterns yet.",
    frequency: "times",
    minutesSaved: "min/month",
  },
} as const

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "info" | "secondary" | "outline"> = {
  MERGED: "success",
  READY_TO_MERGE: "info",
  WAITING_REVIEW: "warning",
  WAITING_APPROVAL: "warning",
  PLANNED: "info",
  TRIAGED: "secondary",
  QUEUED: "secondary",
  EXECUTING: "info",
  QUALITY_CHECK: "info",
  FAILED: "danger",
  BLOCKED: "danger",
  CANCELLED: "outline",
  PASSED: "success",
  PENDING: "warning",
}

const ROLES = ["TRIAGE", "ARCHITECT", "PLANNER", "FRONTEND", "BACKEND", "RUST", "QA", "REVIEWER", "SECURITY", "DEVOPS", "DOCS"]

function statusBadge(status: string) {
  return <Badge variant={STATUS_VARIANT[status] ?? "outline"}>{status.replace(/_/g, " ")}</Badge>
}

function gateIcon(status: FactoryGateStatus) {
  if (status === "PASSED") return <CheckCircle2 className="h-4 w-4 text-success" />
  if (status === "FAILED" || status === "BLOCKED") return <CircleAlert className="h-4 w-4 text-danger" />
  return <Loader2 className="h-4 w-4 text-warning" />
}

export default function FactoryPage() {
  const { token, currentOrg, user } = useAuth()
  const { locale } = useI18n()
  const toast = useToast()
  const c = COPY[locale as keyof typeof COPY] ?? COPY.en
  const role = currentOrg?.role ?? null
  const canManage = atLeast(role, "MANAGER")

  const [runs, setRuns] = useState<FactoryRunSummary[]>([])
  const [stats, setStats] = useState<FactoryStats | null>(null)
  const [profiles, setProfiles] = useState<FactoryAgentProfile[]>([])
  const [connections, setConnections] = useState<AgentConnection[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [proposals, setProposals] = useState<AutomationProposal[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [detail, setDetail] = useState<FactoryRun | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [runOpen, setRunOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)

  const [newProject, setNewProject] = useState("")
  const [tasks, setTasks] = useState<AgileTask[]>([])
  const [newTask, setNewTask] = useState("")
  const [repos, setRepos] = useState<GitRepository[]>([])
  const [newRepo, setNewRepo] = useState("")
  const [newAgent, setNewAgent] = useState("")

  const [agentName, setAgentName] = useState("")
  const [agentSlug, setAgentSlug] = useState("")
  const [agentRole, setAgentRole] = useState("BACKEND")
  const [agentConnection, setAgentConnection] = useState("")
  const [agentInstructions, setAgentInstructions] = useState("")
  const [reviewFindings, setReviewFindings] = useState("")

  const load = useCallback(async () => {
    if (!token || !currentOrg) {
      setLoading(false)
      return
    }
    try {
      const [r, s, p, c, pr, proposals] = await Promise.all([
        api.listFactoryRuns(token, currentOrg.id),
        api.factoryStats(token, currentOrg.id),
        api.listFactoryAgents(token, currentOrg.id),
        api.listAgentConnections(token, currentOrg.id).catch(() => [] as AgentConnection[]),
        api.listProjects(token, currentOrg.id),
        api.factoryAutomation(token, currentOrg.id).catch(() => [] as AutomationProposal[]),
      ])
      setRuns(r)
      setStats(s)
      setProfiles(p)
      setConnections(c)
      setProjects(pr)
      setProposals(proposals)
    } catch {
      toast.error(c.failed)
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg, toast, c.failed])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!token || !currentOrg || !newProject) {
      setTasks([])
      setRepos([])
      return
    }
    Promise.all([
      api.listTasks(token, currentOrg.id, newProject).catch(() => [] as AgileTask[]),
      api.gitListRepositories(token, currentOrg.id).catch(() => [] as GitRepository[]),
    ]).then(([t, r]) => {
      setTasks(t)
      setRepos(r.filter((repo) => repo.project?.id === newProject || repo.projectId === newProject))
    })
  }, [token, currentOrg, newProject])

  const pendingApproval = detail?.approvals.find((approval) => approval.status === "PENDING") ?? null
  const openGates = detail?.gates.filter((gate) => gate.status !== "PASSED").length ?? 0
  const latestPlan = detail?.plans?.[0] ?? null

  const openRun = async (runId: string) => {
    if (!token || !currentOrg) return
    setDetailLoading(true)
    setDetail(null)
    try {
      setDetail(await api.getFactoryRun(token, currentOrg.id, runId))
    } catch {
      toast.error(c.failed)
    } finally {
      setDetailLoading(false)
    }
  }

  const act = async (runId: string, label: string, action: () => Promise<FactoryRun>) => {
    setBusy(label)
    try {
      const updated = await action()
      setDetail(updated)
      await load()
      toast.success(c.loaded)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : c.failed)
    } finally {
      setBusy(null)
    }
  }

  const createRun = async () => {
    if (!token || !currentOrg || !newTask) return
    setBusy("create")
    try {
      const created = await api.createFactoryRun(
        { taskId: newTask, repositoryId: newRepo || undefined, agentProfileId: newAgent || undefined },
        token,
        currentOrg.id
      )
      setRunOpen(false)
      setNewTask("")
      setNewRepo("")
      setNewAgent("")
      setDetail(created)
      await load()
      toast.success(c.loaded)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : c.failed)
    } finally {
      setBusy(null)
    }
  }

  const createAgent = async () => {
    if (!token || !currentOrg || !agentName.trim() || !agentSlug.trim()) return
    setBusy("agent")
    try {
      await api.createFactoryAgent(
        {
          name: agentName.trim(),
          slug: agentSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-"),
          role: agentRole,
          connectionId: agentConnection || undefined,
          instructions: agentInstructions.trim() || undefined,
        },
        token,
        currentOrg.id
      )
      setAgentOpen(false)
      setAgentName("")
      setAgentSlug("")
      setAgentConnection("")
      setAgentInstructions("")
      await load()
      toast.success(c.loaded)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : c.failed)
    } finally {
      setBusy(null)
    }
  }

  const decideProposal = async (proposal: AutomationProposal, decision: "APPROVED" | "REJECTED") => {
    if (!token || !currentOrg) return
    setBusy(`automation-${proposal.id}`)
    try {
      await api.decideFactoryAutomation(token, currentOrg.id, proposal.id, decision, decision === "APPROVED" ? "Approved from the factory dashboard" : "Rejected from the factory dashboard")
      await load()
      toast.success(c.loaded)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : c.failed)
    } finally {
      setBusy(null)
    }
  }

  const counts = useMemo(() => {
    const by = stats?.runs ?? {}
    const active = ["QUEUED", "TRIAGED", "PLANNED", "EXECUTING", "QUALITY_CHECK"].reduce((sum, key) => sum + (by[key] ?? 0), 0)
    return {
      active,
      waiting: by.WAITING_APPROVAL ?? 0,
      review: by.WAITING_REVIEW ?? 0,
      openGates: Object.entries(stats?.gates ?? {}).filter(([status]) => status !== "PASSED").reduce((sum, [, count]) => sum + count, 0),
    }
  }, [stats])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="hero-gradient relative overflow-hidden rounded-2xl p-6 text-white">
        <div className="pointer-events-none absolute -end-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-hero flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">{c.eyebrow}</p>
            <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">{c.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/85">{c.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRunOpen(true)} className="border-transparent bg-white text-slate-900 hover:bg-white/90">
              <Plus className="h-4 w-4" /> {c.newRun}
            </Button>
            <Button variant="outline" onClick={() => setAgentOpen(true)} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
              <Bot className="h-4 w-4" /> {c.agents}
            </Button>
            <Button variant="outline" onClick={() => load()} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Factory className="h-4 w-4" />} label={c.active} value={counts.active} hint={`${profiles.filter((p) => p.status === "active").length} ${c.enabled}`} />
        <StatCard icon={<ShieldCheck className="h-4 w-4" />} label={c.waiting} value={counts.waiting} />
        <StatCard icon={<Bot className="h-4 w-4" />} label={c.review} value={counts.review} />
        <StatCard icon={<CircleAlert className="h-4 w-4" />} label={c.gates} value={counts.openGates} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">{c.runs}</h2>
            <Badge variant="outline">{runs.length}</Badge>
          </div>
          {runs.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={Factory} title={c.empty} action={<Button onClick={() => setRunOpen(true)}><Plus className="h-4 w-4" /> {c.newRun}</Button>} />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => openRun(run.id)}
                  className="flex w-full items-start gap-3 px-5 py-4 text-start transition-colors hover:bg-accent/50"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Factory className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{run.task.title}</span>
                      {statusBadge(run.status)}
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{run.project.name}</span>
                      {run.repository && <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3" />{run.repository.name}</span>}
                      {run.agentProfile && <span className="inline-flex items-center gap-1"><Bot className="h-3 w-3" />{run.agentProfile.name}</span>}
                      <span>{timeAgo(run.updatedAt)}</span>
                    </span>
                    {(run.gates.length > 0 || run.approvals.length > 0) && (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {run.gates.map((gate) => (
                          <span key={gate.name} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            {gateIcon(gate.status)} {gate.name.replace(/_/g, " ")}
                          </span>
                        ))}
                        {run.approvals.map((approval) => (
                          <Badge key={approval.id} variant="warning">{approval.stage}</Badge>
                        ))}
                      </span>
                    )}
                  </span>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold">{c.agents}</h2>
              <Button size="sm" variant="outline" onClick={() => setAgentOpen(true)}><Plus className="h-3.5 w-3.5" /> {c.addAgent}</Button>
            </div>
            {profiles.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">{c.noAgents}</p>
            ) : (
              <div className="divide-y divide-border">
                {profiles.map((profile) => (
                  <div key={profile.id} className="flex items-start gap-3 px-5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium">{profile.name}</p>
                        <Badge variant={profile.status === "active" ? "success" : "outline"}>{profile.status === "active" ? c.enabled : c.disabled}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {profile.role} · {profile.connection?.name ?? c.noConnections}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" /> {c.quality}</div>
            <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li>Plan completeness is checked before execution.</li>
              <li>Repository scans use the Rust engine; zero analyzed files blocks delivery.</li>
              <li>Independent review is required before merge; policy decides human approval.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" /> {c.automation}</h2>
              <Badge variant="outline">{proposals.filter((proposal) => proposal.status === "PENDING").length}</Badge>
            </div>
            <div className="px-5 py-3 text-xs text-muted-foreground">{c.automationHint}</div>
            {proposals.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">{c.noAutomation}</p>
            ) : (
              <div className="divide-y divide-border">
                {proposals.slice(0, 5).map((proposal) => (
                  <div key={proposal.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{proposal.title}</p>
                      <Badge variant={proposal.status === "APPROVED" ? "success" : proposal.status === "REJECTED" ? "outline" : "warning"}>{proposal.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{proposal.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{proposal.frequency} {c.frequency}</span>
                      <span>·</span>
                      <span>{proposal.estimatedMinutesSaved} {c.minutesSaved}</span>
                      <span>·</span>
                      <Badge variant="outline">{proposal.complexity}</Badge>
                      <Badge variant={proposal.risk === "high" ? "danger" : proposal.risk === "medium" ? "warning" : "outline"}>{proposal.risk}</Badge>
                    </div>
                    {proposal.status === "PENDING" && canManage && (
                      <div className="mt-2 flex gap-2">
                        <Button size="sm" onClick={() => decideProposal(proposal, "APPROVED")} disabled={busy === `automation-${proposal.id}`}>{c.approve}</Button>
                        <Button size="sm" variant="ghost" onClick={() => decideProposal(proposal, "REJECTED")} disabled={busy === `automation-${proposal.id}`}>{c.reject}</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <Modal open={runOpen} onClose={() => setRunOpen(false)} title={c.newRun} description={c.subtitle} size="lg">
        <div className="space-y-4">
          <Field label={c.project}>
            <Select value={newProject} onChange={(event) => { setNewProject(event.target.value); setNewTask(""); setNewRepo("") }}>
              <option value="">{c.selectProject}</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </Select>
          </Field>
          <Field label={c.task}>
            <Select value={newTask} onChange={(event) => setNewTask(event.target.value)} disabled={!newProject}>
              <option value="">{c.selectTask}</option>
              {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </Select>
          </Field>
          <Field label={c.repository}>
            <Select value={newRepo} onChange={(event) => setNewRepo(event.target.value)} disabled={!newProject}>
              <option value="">{c.selectRepo}</option>
              {repos.map((repo) => <option key={repo.id} value={repo.id}>{repo.name}</option>)}
            </Select>
          </Field>
          <Field label={c.selectAgent}>
            <Select value={newAgent} onChange={(event) => setNewAgent(event.target.value)}>
              <option value="">{c.selectAgent}</option>
              {profiles.filter((profile) => profile.status === "active").map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.name} — {profile.role}</option>
              ))}
            </Select>
          </Field>
          <p className="text-xs text-muted-foreground">{c.retryHint}</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRunOpen(false)}>{c.close}</Button>
          <Button onClick={createRun} disabled={!newTask || busy === "create"}>
            {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {busy === "create" ? c.creating : c.create}
          </Button>
        </div>
      </Modal>

      <Modal open={agentOpen} onClose={() => setAgentOpen(false)} title={c.addAgent} size="lg">
        <div className="space-y-4">
          <Field label={c.agentName} required>
            <Input value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder="Backend Agent" />
          </Field>
          <Field label={c.agentSlug} required>
            <Input value={agentSlug} onChange={(event) => setAgentSlug(event.target.value)} placeholder="backend-agent" />
          </Field>
          <Field label={c.agentRole}>
            <Select value={agentRole} onChange={(event) => setAgentRole(event.target.value)}>
              {ROLES.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </Field>
          <Field label={c.connection} hint={connections.length === 0 ? c.noConnections : undefined}>
            <Select value={agentConnection} onChange={(event) => setAgentConnection(event.target.value)}>
              <option value="">{c.selectAgent}</option>
              {connections.filter((connection) => connection.status === "active").map((connection) => (
                <option key={connection.id} value={connection.id}>{connection.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Instructions">
            <Textarea value={agentInstructions} onChange={(event) => setAgentInstructions(event.target.value)} placeholder="Follow the project conventions; return full file contents." />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setAgentOpen(false)}>{c.close}</Button>
          <Button onClick={createAgent} disabled={!agentName.trim() || !agentSlug.trim() || busy === "agent"}>
            {busy === "agent" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {c.addAgent}
          </Button>
        </div>
      </Modal>

      <Modal
        open={Boolean(detail) || detailLoading}
        onClose={() => setDetail(null)}
        title={detail?.task.title ?? c.runs}
        description={detail ? `${detail.project.name} · ${detail.correlationId.slice(0, 8)}` : undefined}
        size="xl"
      >
        {detailLoading || !detail ? (
          <div className="space-y-3"><Skeleton className="h-10 w-full" /><Skeleton className="h-40 w-full" /></div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(detail.status)}
              {detail.stage !== detail.status && <Badge variant="outline">{detail.stage}</Badge>}
              {detail.issueProfile && <Badge variant="info">{detail.issueProfile.classification}</Badge>}
              {detail.issueProfile?.labels.map((label) => <Badge key={label} variant="outline">{label}</Badge>)}
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.branch}</p>
                <p className="mt-1 break-all font-mono text-xs">{detail.branch ?? "—"}</p>
                {detail.commitSha && <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">{detail.commitSha.slice(0, 12)}</p>}
              </div>
              <div className="rounded-xl border border-border bg-muted/20 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.agent}</p>
                <p className="mt-1 text-xs">{detail.agentProfile?.name ?? "—"}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{detail.repository?.name ?? c.noRepository}</p>
              </div>
            </div>

            {detail.error && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{detail.error}</span>
              </div>
            )}

            {latestPlan ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{c.plan} v{latestPlan.version}</h3>
                  <Badge variant={latestPlan.approvalRequired ? "warning" : "success"}>{latestPlan.generatedBy}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{latestPlan.summary}</p>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.steps}</p>
                  <ol className="mt-2 space-y-1.5 text-sm">
                    {latestPlan.steps.map((step, index) => (
                      <li key={`${step.title}-${index}`}><span className="font-medium">{index + 1}. {step.title}</span> — <span className="text-muted-foreground">{step.detail}</span></li>
                    ))}
                  </ol>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.acceptance}</p>
                    <ul className="mt-2 list-disc space-y-1 ps-4 text-sm">
                      {latestPlan.acceptanceCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.risks}</p>
                    <ul className="mt-2 list-disc space-y-1 ps-4 text-sm text-muted-foreground">
                      {latestPlan.risks.length ? latestPlan.risks.map((risk) => <li key={risk}>{risk}</li>) : <li>—</li>}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{c.noPlan}</p>
            )}

            {detail.gates.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.quality}</p>
                <div className="mt-2 space-y-2">
                  {detail.gates.map((gate) => (
                    <div key={gate.id} className="flex items-start gap-2 rounded-lg border border-border p-2.5 text-sm">
                      {gateIcon(gate.status)}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{gate.name.replace(/_/g, " ")} · {gate.status}</p>
                        {gate.detail && <p className="text-xs text-muted-foreground">{gate.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.events.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.events}</p>
                <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto">
                  {detail.events.slice().reverse().map((event) => (
                    <div key={event.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-mono">{event.type}</span>
                      <span className="shrink-0 text-muted-foreground">{timeAgo(event.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex flex-wrap gap-2">
                {pendingApproval && canManage && (
                  <>
                    <Button onClick={() => act(detail.id, "approve", () => api.approveFactoryRun(token!, currentOrg!.id, detail.id, "APPROVED", "Approved from factory dashboard"))} disabled={Boolean(busy)}>
                      <CheckCircle2 className="h-4 w-4" /> {c.approve} {pendingApproval.stage}
                    </Button>
                    <Button variant="destructive" onClick={() => act(detail.id, "reject", () => api.approveFactoryRun(token!, currentOrg!.id, detail.id, "REJECTED", "Rejected from factory dashboard"))} disabled={Boolean(busy)}>
                      <XCircle className="h-4 w-4" /> {c.reject}
                    </Button>
                  </>
                )}
                {["PLANNED", "BLOCKED", "WAITING_APPROVAL"].includes(detail.status) && !pendingApproval && (
                  <Button onClick={() => act(detail.id, "execute", () => api.executeFactoryRun(token!, currentOrg!.id, detail.id))} disabled={Boolean(busy)}>
                    <Play className="h-4 w-4" /> {c.execute}
                  </Button>
                )}
                {["PLANNED", "BLOCKED"].includes(detail.status) && (
                  <Button variant="outline" onClick={() => act(detail.id, "replan", () => api.planFactoryRun(token!, currentOrg!.id, detail.id, false))} disabled={Boolean(busy)}>
                    <RefreshCw className="h-4 w-4" /> {c.replan}
                  </Button>
                )}
                {detail.status === "WAITING_REVIEW" && canManage && (
                  <>
                    <Field label={c.findings}>
                      <Textarea value={reviewFindings} onChange={(event) => setReviewFindings(event.target.value)} rows={2} placeholder="Optional findings" />
                    </Field>
                    <Button onClick={() => act(detail.id, "review", () => api.reviewFactoryRun(token!, currentOrg!.id, detail.id, { decision: "APPROVED", findings: reviewFindings.split("\n").map((line) => line.trim()).filter(Boolean) }))} disabled={Boolean(busy)}>
                      <ShieldCheck className="h-4 w-4" /> {c.reviewApprove}
                    </Button>
                    <Button variant="destructive" onClick={() => act(detail.id, "review-reject", () => api.reviewFactoryRun(token!, currentOrg!.id, detail.id, { decision: "REJECTED", reason: "Rejected from factory dashboard" }))} disabled={Boolean(busy)}>
                      <XCircle className="h-4 w-4" /> {c.reject}
                    </Button>
                  </>
                )}
                {detail.status === "READY_TO_MERGE" && canManage && (
                  <Button onClick={() => act(detail.id, "merge", () => api.mergeFactoryRun(token!, currentOrg!.id, detail.id))} disabled={Boolean(busy)}>
                    <GitBranch className="h-4 w-4" /> {c.merge}
                  </Button>
                )}
                {!["MERGED", "CANCELLED", "FAILED"].includes(detail.status) && (
                  <Button variant="ghost" onClick={() => act(detail.id, "cancel", () => api.cancelFactoryRun(token!, currentOrg!.id, detail.id))} disabled={Boolean(busy)}>
                    {c.cancel}
                  </Button>
                )}
                {busy && <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> {busy}</span>}
                {!canManage && pendingApproval && <span className="text-xs text-muted-foreground">{c.managerOnly}</span>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
