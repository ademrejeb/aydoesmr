"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Bot,
  CheckCircle2,
  Clock3,
  KeyRound,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Trash2,
  TriangleAlert,
} from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { api, type AgentConnection, type AgentRun } from "@/lib/api"
import { atLeast, can } from "@/lib/access"
import { cn, timeAgo } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Select } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"

const DEFAULT_INPUT = JSON.stringify(
  {
    task: "technical_debt_review",
    project: "TechVerse",
    language: "typescript",
    metrics: {
      lines_of_code: 0,
      cyclomatic_complexity: 0,
      maintainability_index: 100,
      debt_score: 0,
    },
    issues: [],
  },
  null,
  2,
)

const COPY = {
  ar: {
    eyebrow: "الذكاء الاصطناعي التشغيلي",
    title: "وكلاء الذكاء الاصطناعي",
    subtitle: "اربط وكيلاً منشوراً في AI Agent Factory وشغّله من داخل TechVerse — مع سجل لكل تشغيل.",
    new: "اتصال وكيل جديد",
    empty: "لا يوجد وكيل مرتبط بعد. انشر وكيلاً في AI Agent Factory، أنشئ مفتاح agents:run، ثم اربطه هنا.",
    connections: "الاتصالات",
    noConnections: "لا اتصالات",
    agentId: "معرّف الوكيل",
    baseUrl: "عنوان الـ Factory",
    key: "المفتاح",
    configured: "مضبوط",
    test: "اختبار",
    edit: "تعديل",
    remove: "حذف",
    testOk: "الاتصال والوكيل المنشور جاهزان",
    testFail: "فشل الاختبار",
    runPanel: "تشغيل الوكيل",
    runHint: "أرسل JSON إلى الوكيل. الوكيل يعيد قرار المراجعة أو الخطة.",
    loadScan: "تحميل آخر فحص",
    run: "تشغيل الوكيل",
    running: "جارٍ التحضير…",
    output: "النتيجة",
    noOutput: "شغّل الوكيل لعرض النتيجة.",
    history: "سجل التشغيل",
    noHistory: "لا تشغيلات بعد.",
    statusOk: "مكتمل",
    statusFail: "فشل",
    selectConnection: "اختر اتصالاً",
    save: "حفظ",
    cancel: "إلغاء",
    name: "اسم الاتصال",
    nameHint: "مثال: مراجع الدين التقني",
    agentIdHint: "المعرّف من صفحة الوكيل في AI Agent Factory.",
    baseUrlHint: "مثال: http://localhost:8080",
    apiKeyHint: "مفتاح aaf_ بصلاحية agents:run. يُخزَّن مشفّراً.",
    leaveEmptyToKeep: "اتركه فارغاً للاحتفاظ بالمفتاح الحالي.",
    deleteTitle: "حذف الاتصال؟",
    deleteBody: "سيُحذف الاتصال وسجل تشغيلاته. لا يمكن التراجع.",
    required: "املأ الحقول المطلوبة.",
    invalidJson: "المدخل يجب أن يكون JSON صالحاً.",
    delete: "حذف",
    loadingScan: "جارٍ تحميل الفحص…",
    noScan: "لا يوجد فحص ناجح بعد.",
    scanLoaded: "تم تحميل آخر فحص.",
    fromScan: "آخر فحص",
    requiresManager: "يتطلب دور مدير أو أعلى.",
    docs: "وثائق الـ API",
  },
  fr: {
    eyebrow: "Intelligence opérationnelle",
    title: "Agents IA",
    subtitle: "Branchez un agent publié dans AI Agent Factory et exécutez-le depuis TechVerse, avec un historique complet.",
    new: "Nouvelle connexion",
    empty: "Aucun agent connecté. Publiez un agent dans AI Agent Factory, créez une clé agents:run, puis connectez-le ici.",
    connections: "Connexions",
    noConnections: "Aucune connexion",
    agentId: "ID de l’agent",
    baseUrl: "URL Factory",
    key: "Clé",
    configured: "Configurée",
    test: "Tester",
    edit: "Modifier",
    remove: "Supprimer",
    testOk: "Connexion et déploiement actif vérifiés",
    testFail: "Échec du test",
    runPanel: "Exécuter l’agent",
    runHint: "Envoyez un JSON à l’agent. Il renvoie sa revue ou son plan.",
    loadScan: "Charger le dernier scan",
    run: "Exécuter",
    running: "Préparation…",
    output: "Résultat",
    noOutput: "Exécutez l’agent pour voir le résultat.",
    history: "Historique",
    noHistory: "Aucune exécution.",
    statusOk: "Terminé",
    statusFail: "Échec",
    selectConnection: "Choisir une connexion",
    save: "Enregistrer",
    cancel: "Annuler",
    name: "Nom de la connexion",
    nameHint: "Ex. : Revue de dette technique",
    agentIdHint: "L’identifiant visible sur la page de l’agent dans AI Agent Factory.",
    baseUrlHint: "Ex. : http://localhost:8080",
    apiKeyHint: "Clé aaf_ avec le scope agents:run. Stockée chiffrée.",
    leaveEmptyToKeep: "Laisser vide pour conserver la clé actuelle.",
    deleteTitle: "Supprimer la connexion ?",
    deleteBody: "La connexion et son historique seront supprimés définitivement.",
    required: "Remplissez les champs requis.",
    invalidJson: "L’entrée doit être un JSON valide.",
    delete: "Supprimer",
    loadingScan: "Chargement du scan…",
    noScan: "Aucun scan réussi.",
    scanLoaded: "Dernier scan chargé.",
    fromScan: "Dernier scan",
    requiresManager: "Rôle manager ou supérieur requis.",
    docs: "Documentation API",
  },
  en: {
    eyebrow: "Operational intelligence",
    title: "AI Agents",
    subtitle: "Connect a published agent from AI Agent Factory and run it inside TechVerse, with a complete execution history.",
    new: "New agent connection",
    empty: "No agent connected yet. Publish an agent in AI Agent Factory, create an agents:run key, then connect it here.",
    connections: "Connections",
    noConnections: "No connections",
    agentId: "Agent ID",
    baseUrl: "Factory URL",
    key: "Key",
    configured: "Configured",
    test: "Test",
    edit: "Edit",
    remove: "Delete",
    testOk: "Connection and active deployment verified",
    testFail: "Test failed",
    runPanel: "Run agent",
    runHint: "Send JSON to the agent. It returns its review or plan.",
    loadScan: "Load latest scan",
    run: "Run agent",
    running: "Preparing…",
    output: "Result",
    noOutput: "Run the agent to see its result.",
    history: "Run history",
    noHistory: "No runs yet.",
    statusOk: "Completed",
    statusFail: "Failed",
    selectConnection: "Select a connection",
    save: "Save",
    cancel: "Cancel",
    name: "Connection name",
    nameHint: "e.g. Technical debt reviewer",
    agentIdHint: "The id shown on the agent page in AI Agent Factory.",
    baseUrlHint: "e.g. http://localhost:8080",
    apiKeyHint: "An aaf_ key with agents:run. Stored encrypted.",
    leaveEmptyToKeep: "Leave empty to keep the current key.",
    deleteTitle: "Delete this connection?",
    deleteBody: "The connection and its run history will be removed permanently.",
    required: "Fill in the required fields.",
    invalidJson: "Input must be valid JSON.",
    delete: "Delete",
    loadingScan: "Loading scan…",
    noScan: "No successful scan found.",
    scanLoaded: "Latest scan loaded.",
    fromScan: "Latest scan",
    requiresManager: "Manager role or higher required.",
    docs: "API docs",
  },
} as const

type Copy = (typeof COPY)[keyof typeof COPY]

function statusBadge(status: string) {
  return status === "ok" || status === "completed" ? "success" : status === "fail" || status === "failed" ? "danger" : "outline"
}

export default function AgentsPage() {
  const { token, currentOrg } = useAuth()
  const { locale } = useI18n()
  const copy: Copy = COPY[locale] ?? COPY.en
  const toast = useToast()
  const role = currentOrg?.role ?? "VIEWER"
  const canManage = atLeast(role, "MANAGER")
  const canRun = can(role, "ai_use")

  const [connections, setConnections] = useState<AgentConnection[]>([])
  const [runs, setRuns] = useState<AgentRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState("")
  const [editor, setEditor] = useState<{ connection: AgentConnection | null } | null>(null)
  const [deleting, setDeleting] = useState<AgentConnection | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [input, setInput] = useState(DEFAULT_INPUT)
  const [result, setResult] = useState<AgentRun | null>(null)
  const [form, setForm] = useState({ name: "", baseUrl: "http://localhost:8080", agentId: "", apiKey: "" })

  const selected = useMemo(
    () => connections.find((connection) => connection.id === selectedId) ?? null,
    [connections, selectedId]
  )

  const load = useCallback(async () => {
    if (!token || !currentOrg) return
    setError(null)
    try {
      const items = await api.listAgentConnections(token, currentOrg.id)
      setConnections(items)
      setSelectedId((current) => current || items[0]?.id || "")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load agent connections")
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg])

  const loadRuns = useCallback(async () => {
    if (!token || !currentOrg || !selectedId) return
    try {
      setRuns(await api.listAgentRuns(token, currentOrg.id, selectedId))
    } catch {
      setRuns([])
    }
  }, [token, currentOrg, selectedId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setResult(null)
    void loadRuns()
  }, [loadRuns])

  const openCreate = () => {
    setForm({ name: "", baseUrl: "http://localhost:8080", agentId: "", apiKey: "" })
    setEditor({ connection: null })
  }

  const openEdit = (connection: AgentConnection) => {
    setForm({
      name: connection.name,
      baseUrl: connection.baseUrl,
      agentId: connection.agentId,
      apiKey: "",
    })
    setEditor({ connection })
  }

  const save = async () => {
    if (!token || !currentOrg || !editor) return
    if (!form.name.trim() || !form.baseUrl.trim() || !form.agentId.trim()) {
      toast.error(copy.required)
      return
    }
    setBusy("save")
    try {
      if (editor.connection) {
        await api.updateAgentConnection(
          editor.connection.id,
          {
            name: form.name.trim(),
            baseUrl: form.baseUrl.trim(),
            agentId: form.agentId.trim(),
            ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
          },
          token,
          currentOrg.id
        )
      } else {
        await api.createAgentConnection(
          {
            name: form.name.trim(),
            baseUrl: form.baseUrl.trim(),
            agentId: form.agentId.trim(),
            ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
          },
          token,
          currentOrg.id
        )
      }
      setEditor(null)
      await load()
      toast.success(copy.save)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.testFail)
    } finally {
      setBusy(null)
    }
  }

  const test = async (connection: AgentConnection) => {
    if (!token || !currentOrg) return
    setBusy(connection.id)
    try {
      const outcome = await api.testAgentConnection(connection.id, token, currentOrg.id)
      if (outcome.ok) toast.success(copy.testOk)
      else toast.error(copy.testFail, outcome.error)
      await load()
    } catch (e) {
      toast.error(copy.testFail, e instanceof Error ? e.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!token || !currentOrg || !deleting) return
    setBusy(deleting.id)
    try {
      await api.deleteAgentConnection(deleting.id, token, currentOrg.id)
      setDeleting(null)
      setSelectedId("")
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : copy.testFail)
    } finally {
      setBusy(null)
    }
  }

  const loadScan = async () => {
    if (!token || !currentOrg) return
    setBusy("scan")
    try {
      const scans = await api.listScans(token, currentOrg.id)
      const latest = scans.find((scan) => scan.status === "SUCCESS" && (scan.issues?.length ?? 0) > 0)
      if (!latest) {
        toast.error(copy.noScan)
        return
      }
      const issues = latest.issues.slice(0, 30).map((issue) => ({
        severity: issue.severity,
        file: issue.filePath,
        line: issue.lineNumber,
        rule: issue.ruleId,
        message: issue.message,
        category: issue.category,
      }))
      setInput(
        JSON.stringify(
          {
            task: "technical_debt_review",
            project: latest.project?.name ?? "TechVerse",
            repository: latest.repository?.name ?? null,
            metrics: latest.metrics,
            issues,
            requested_output: {
              summary: "string",
              priority_fixes: [{ title: "string", why: "string", files: ["string"], effort: "S|M|L" }],
              risks: ["string"],
            },
          },
          null,
          2
        )
      )
      toast.success(copy.scanLoaded)
    } catch (e) {
      toast.error(copy.noScan, e instanceof Error ? e.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  const run = async () => {
    if (!token || !currentOrg || !selected) return
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(input) as Record<string, unknown>
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("object")
    } catch {
      toast.error(copy.invalidJson)
      return
    }
    setBusy("run")
    try {
      const outcome = await api.runAgent(selected.id, parsed, token, currentOrg.id)
      setResult(outcome)
      if (outcome.status === "completed") toast.success(copy.statusOk)
      else toast.error(copy.statusFail, outcome.error ?? undefined)
      await loadRuns()
    } catch (e) {
      toast.error(copy.statusFail, e instanceof Error ? e.message : undefined)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{copy.eyebrow}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{copy.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{copy.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          {canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-3.5 w-3.5" />
              {copy.new}
            </Button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      ) : connections.length === 0 ? (
        <EmptyState
          icon={Bot}
          title={copy.title}
          description={copy.empty}
          action={
            canManage ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                {copy.new}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {copy.connections}
              </h2>
              <span className="text-xs text-muted-foreground">{connections.length}</span>
            </div>
            {connections.map((connection) => (
              <div
                key={connection.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(connection.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    setSelectedId(connection.id)
                  }
                }}
                className={cn(
                  "w-full cursor-pointer rounded-2xl border p-4 text-start transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  selectedId === connection.id
                    ? "border-primary/40 bg-primary/5 shadow-sm"
                    : "border-border bg-card hover:border-primary/20"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Bot className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{connection.name}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{connection.agentId}</p>
                    </div>
                  </div>
                  <Badge variant={connection.status === "active" ? "success" : "outline"}>
                    {connection.status}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
                  <span className="truncate" dir="ltr">{connection.baseUrl}</span>
                  <span className="shrink-0">
                    {connection.lastTestAt
                      ? `${connection.lastTestStatus === "ok" ? "✓" : "!"} ${timeAgo(connection.lastTestAt)}`
                      : copy.key}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={(event) => {
                      event.stopPropagation()
                      void test(connection)
                    }}
                  >
                    {busy === connection.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                    {copy.test}
                  </Button>
                  {canManage ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          openEdit(connection)
                        }}
                      >
                        {copy.edit}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.stopPropagation()
                          setDeleting(connection)
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </aside>

          <div className="space-y-5">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold">{copy.runPanel}</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{copy.runHint}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="min-w-44">
                    {connections.map((connection) => (
                      <option key={connection.id} value={connection.id}>
                        {connection.name}
                      </option>
                    ))}
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => void loadScan()} disabled={busy !== null}>
                    {busy === "scan" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />}
                    {copy.loadScan}
                  </Button>
                </div>
              </div>
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                rows={14}
                dir="ltr"
                className="mt-4 font-mono text-[12px] leading-relaxed"
                aria-label={copy.runPanel}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[11px] text-muted-foreground">
                  {selected ? `${copy.baseUrl}: ${selected.baseUrl}` : copy.selectConnection}
                </span>
                <Button onClick={() => void run()} disabled={!canRun || !selected || busy !== null}>
                  {busy === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {busy === "run" ? copy.running : copy.run}
                </Button>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-bold">{copy.output}</h2>
              {result ? (
                <>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
                    <Badge variant={statusBadge(result.status)}>
                      {result.status === "completed" ? copy.statusOk : copy.statusFail}
                    </Badge>
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3 w-3" /> {result.durationMs ?? 0} ms
                    </span>
                    <span>{timeAgo(result.createdAt)}</span>
                    {result.providerRunId ? <span className="font-mono">{result.providerRunId.slice(0, 16)}</span> : null}
                  </div>
                  {result.error ? (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {result.error}
                    </div>
                  ) : (
                    <pre className="mt-3 max-h-96 overflow-auto rounded-xl bg-muted/60 p-4 text-[11.5px] leading-relaxed" dir="ltr">
                      {JSON.stringify(result.output, null, 2)}
                    </pre>
                  )}
                </>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">{copy.noOutput}</p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card shadow-sm">
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-bold">{copy.history}</h2>
                <Button variant="ghost" size="sm" onClick={() => void loadRuns()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
              {runs.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">{copy.noHistory}</p>
              ) : (
                <ul className="divide-y divide-border">
                  {runs.slice(0, 12).map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => setResult(entry)}
                        className="flex w-full items-center gap-3 px-5 py-3 text-start hover:bg-accent/40"
                      >
                        <span className={cn("grid h-7 w-7 place-items-center rounded-full", entry.status === "completed" ? "bg-success/10 text-success" : "bg-danger/10 text-danger")}>
                          {entry.status === "completed" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold">{entry.connection?.name ?? selected?.name ?? "Agent"}</span>
                          <span className="block text-[11px] text-muted-foreground">{timeAgo(entry.createdAt)} · {entry.durationMs ?? 0} ms</span>
                        </span>
                        <Badge variant={statusBadge(entry.status)}>{entry.status}</Badge>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <KeyRound className="h-3 w-3" />
              {copy.apiKeyHint}
            </p>
          </div>
        </div>
      )}

      <Modal
        open={editor !== null}
        onClose={() => setEditor(null)}
        title={editor?.connection ? copy.edit : copy.new}
        description={copy.subtitle}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditor(null)}>
              {copy.cancel}
            </Button>
            <Button onClick={() => void save()} disabled={busy !== null}>
              {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {copy.save}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label={copy.name} hint={copy.nameHint} required>
            <Input value={form.name} onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))} autoFocus />
          </Field>
          <Field label={copy.baseUrl} hint={copy.baseUrlHint} required>
            <Input value={form.baseUrl} onChange={(event) => setForm((f) => ({ ...f, baseUrl: event.target.value }))} dir="ltr" />
          </Field>
          <Field label={copy.agentId} hint={copy.agentIdHint} required>
            <Input value={form.agentId} onChange={(event) => setForm((f) => ({ ...f, agentId: event.target.value }))} dir="ltr" className="font-mono" />
          </Field>
          <Field label={copy.key} hint={editor?.connection ? copy.leaveEmptyToKeep : copy.apiKeyHint}>
            <Input
              type="password"
              value={form.apiKey}
              onChange={(event) => setForm((f) => ({ ...f, apiKey: event.target.value }))}
              autoComplete="new-password"
              dir="ltr"
              placeholder="aaf_…"
            />
          </Field>
          {!canManage ? <p className="text-xs text-muted-foreground">{copy.requiresManager}</p> : null}
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={copy.deleteTitle}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {copy.cancel}
            </Button>
            <Button variant="destructive" onClick={() => void remove()} disabled={busy !== null}>
              {busy === deleting?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {copy.delete}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">{copy.deleteBody}</p>
      </Modal>
    </div>
  )
}
