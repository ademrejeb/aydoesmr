"use client"

import { useCallback, useEffect, useState } from "react"
import { io } from "socket.io-client"
import { BrainCircuit, Download, KeyRound, Loader2, MessageSquare, Pencil, Plus, RefreshCw, ScanSearch, Trash2, X, Zap } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, wsOrigin, type AiProvider, type AiProviderSpec, type AiProviderType, type AiChatMessageData } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn, timeAgo } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip } from "@/components/ui/tooltip"
import { AnalysisTab } from "./analysis-tab"
import { AiActionsTab } from "./actions-tab"

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === "object" && e !== null && "message" in e) return String((e as { message: unknown }).message)
  return "Error"
}

const FALLBACK_SPECS: AiProviderSpec[] = [
  { type: "openai", label: "OpenAI", needsBaseUrl: false, hasDefaultBaseUrl: true, defaultBaseUrl: "https://api.openai.com/v1", needsKey: true, keyOptional: false, baseUrlPlaceholder: "https://...", defaultModels: ["gpt-4o-mini", "gpt-4o"] },
  { type: "anthropic", label: "Anthropic", needsBaseUrl: false, hasDefaultBaseUrl: true, defaultBaseUrl: "https://api.anthropic.com/v1", needsKey: true, keyOptional: false, baseUrlPlaceholder: "https://...", defaultModels: ["claude-sonnet-4", "claude-haiku-4"] },
  { type: "google", label: "Google Gemini", needsBaseUrl: false, hasDefaultBaseUrl: true, defaultBaseUrl: "https://generativelanguage.googleapis.com", needsKey: true, keyOptional: false, baseUrlPlaceholder: "https://...", defaultModels: ["gemini-1.5-pro", "gemini-1.5-flash"] },
  { type: "groq", label: "Groq", needsBaseUrl: false, hasDefaultBaseUrl: true, defaultBaseUrl: "https://api.groq.com/openai", needsKey: true, keyOptional: false, baseUrlPlaceholder: "https://...", defaultModels: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"] },
  { type: "mistral", label: "Mistral AI", needsBaseUrl: false, hasDefaultBaseUrl: true, defaultBaseUrl: "https://api.mistral.ai/v1", needsKey: true, keyOptional: false, baseUrlPlaceholder: "https://...", defaultModels: ["mistral-large-latest", "mistral-small-latest"] },
  { type: "openrouter", label: "OpenRouter", needsBaseUrl: false, hasDefaultBaseUrl: true, defaultBaseUrl: "https://openrouter.ai/api/v1", needsKey: true, keyOptional: false, baseUrlPlaceholder: "https://...", defaultModels: ["openai/gpt-4o-mini", "anthropic/claude-sonnet-4"] },
  { type: "azure", label: "Azure OpenAI", needsBaseUrl: true, hasDefaultBaseUrl: false, defaultBaseUrl: "", needsKey: true, keyOptional: false, baseUrlPlaceholder: "https://your-resource.openai.azure.com", defaultModels: ["gpt-4o-mini", "gpt-4o"] },
  { type: "ollama", label: "Ollama (Local)", needsBaseUrl: false, hasDefaultBaseUrl: true, defaultBaseUrl: "http://localhost:11434/v1", needsKey: false, keyOptional: true, baseUrlPlaceholder: "http://localhost:11434/v1", defaultModels: ["llama3.2", "mistral"] },
  { type: "openai_compatible", label: "OpenAI-Compatible (Self-hosted)", needsBaseUrl: true, hasDefaultBaseUrl: false, defaultBaseUrl: "", needsKey: true, keyOptional: true, baseUrlPlaceholder: "https://...", defaultModels: ["gpt-4o-mini"] },
]

export default function AiPage() {
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()
  const [view, setView] = useState<"providers" | "actions" | "analysis">("providers")
  const [providers, setProviders] = useState<AiProvider[]>([])
  const [specs, setSpecs] = useState<AiProviderSpec[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ provider: AiProvider | null } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AiProvider | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [fetchingId, setFetchingId] = useState<string | null>(null)
  const [playground, setPlayground] = useState<AiProvider | null>(null)

  const role = currentOrg?.role ?? "VIEWER"
  const canManage = role === "MANAGER" || role === "ADMIN" || role === "OWNER"
  const canUse = role !== "VIEWER"

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("view") === "analysis") {
      setView("analysis")
    }
  }, [])

  const tabItems = [
    { id: "providers" as const, label: t.ai.tab_providers, icon: BrainCircuit },
    { id: "actions" as const, label: t.ai_actions.tab_actions, icon: Zap },
    { id: "analysis" as const, label: t.ai.tab_analysis, icon: ScanSearch },
  ]

  const load = useCallback(async () => {
    if (!token || !currentOrg) {
      setLoading(false)
      return
    }
    try {
      setProviders(await api.listAiProviders(token, currentOrg.id))
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!token || !currentOrg) return
    api
      .aiProviderSpecs(token, currentOrg.id)
      .then(setSpecs)
      .catch(() => {
        /* ignore */
      })
  }, [token, currentOrg])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("new") === "1" && canManage) {
      setEditor({ provider: null })
    }
  }, [canManage])

  useEffect(() => {
    if (!token || !currentOrg) return
    const socket = io(wsOrigin(), {
      auth: { token, organizationId: currentOrg.id },
      transports: ["websocket"],
    })
    socket.on("ai:updated", () => load())
    return () => {
      socket.disconnect()
    }
  }, [token, currentOrg, load])

  const handleTest = async (p: AiProvider) => {
    if (!token || !currentOrg) return
    setTestingId(p.id)
    try {
      const res = await api.testAiProvider(token, currentOrg.id, p.id)
      if (res.ok) {
        toast.success(t.ai.test_ok)
      } else if (res.error) {
        toast.error(res.error)
      } else {
        toast.error(t.ai.test_fail)
      }
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setTestingId(null)
    }
  }

  const handleFetch = async (p: AiProvider) => {
    if (!token || !currentOrg) return
    setFetchingId(p.id)
    try {
      await api.fetchAiModels(token, currentOrg.id, p.id)
      toast.success(t.ai.models_fetched)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setFetchingId(null)
    }
  }

  const handleDelete = async () => {
    if (!token || !currentOrg || !confirmDelete) return
    setDeleting(true)
    try {
      await api.deleteAiProvider(token, currentOrg.id, confirmDelete.id)
      toast.success(t.ai.deleted)
      setConfirmDelete(null)
      load()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setDeleting(false)
    }
  }

  const allSpecs = specs.length > 0 ? specs : FALLBACK_SPECS

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{t.ai.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{view === "analysis" ? t.ai.analysis_subtitle : view === "actions" ? t.ai_actions.subtitle : t.ai.subtitle}</p>
        </div>
        {view === "providers" && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5 me-1.5" />
              {t.repo.refresh}
            </Button>
            {canManage && (
              <Button size="sm" onClick={() => setEditor({ provider: null })}>
                <Plus className="h-3.5 w-3.5 me-1.5" />
                {t.ai.new_provider}
              </Button>
            )}
          </div>
        )}
      </div>

      <div
        role="tablist"
        aria-label={t.ai.title}
        className="grid w-full grid-cols-3 gap-1 rounded-xl border border-border bg-muted p-1"
      >
        {tabItems.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={view === item.id}
            onClick={() => setView(item.id)}
            className={cn(
              "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              view === item.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>
      )}

      {view === "actions" ? (
        <AiActionsTab providers={providers} />
      ) : view === "analysis" ? (
        <AnalysisTab />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : providers.length === 0 ? (
        <EmptyState
          icon={BrainCircuit}
          title={t.ai.title}
          description={t.ai.empty}
          action={
            canManage ? (
              <Button size="sm" onClick={() => setEditor({ provider: null })}>
                <Plus className="h-3.5 w-3.5 me-1.5" />
                {t.ai.new_provider}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/30">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BrainCircuit className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{t.ai.provider_type[p.type] ?? p.type}</p>
                  </div>
                </div>
                <Badge variant={p.status === "active" ? "success" : "outline"}>
                  {p.status === "active" ? t.ai.active : t.ai.disabled}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {p.defaultModel && <Badge variant="secondary">{p.defaultModel}</Badge>}
                <Badge variant="secondary">{p.models.length} {t.ai.models}</Badge>
                {p.lastTestStatus ? (
                  <Badge variant={p.lastTestStatus === "ok" ? "success" : "danger"} dot dotClassName={p.lastTestStatus === "ok" ? "bg-success" : "bg-danger"}>
                    {p.lastTestStatus === "ok" ? t.ai.test_ok : t.ai.test_fail}
                  </Badge>
                ) : (
                  <Badge variant="outline">{t.ai.never_tested}</Badge>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3 text-xs">
                <div className="min-w-0">
                  {p.lastTestAt ? (
                    <span className="text-muted-foreground">{timeAgo(p.lastTestAt, locale)}</span>
                  ) : (
                    <span className="text-muted-foreground">{t.ai.status}: {p.status === "active" ? t.ai.active : t.ai.disabled}</span>
                  )}
                </div>
              </div>

              {canUse && (
                <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={testingId === p.id}
                    onClick={() => handleTest(p)}
                  >
                    {testingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    {t.ai.test}
                  </Button>
                  {p.type === "ollama" || p.type === "openai_compatible" ? (
                    <Button size="sm" variant="outline" disabled={fetchingId === p.id} onClick={() => handleFetch(p)}>
                      {fetchingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                      {t.ai.fetch_models}
                    </Button>
                  ) : (
                    <Tooltip tip={t.ai.no_key}>
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/50">
                        <Download className="h-3.5 w-3.5" />
                      </span>
                    </Tooltip>
                  )}
                  <Button size="sm" variant="outline" disabled={!p.defaultModel || p.models.length === 0} onClick={() => setPlayground(p)}>
                    <MessageSquare className="h-3.5 w-3.5" />
                    {t.ai.playground}
                  </Button>
                </div>
              )}

              {canManage && (
                <div className="flex flex-wrap items-center justify-end gap-1 border-t border-border/60 pt-2">
                  <button
                    onClick={() => setEditor({ provider: p })}
                    aria-label={t.ai.edit}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <Tooltip tip={t.ai.delete}>
                    <button
                      onClick={() => setConfirmDelete(p)}
                      aria-label={t.ai.delete}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editor && (
        <AiEditorModal
          key={editor.provider?.id ?? "new"}
          provider={editor.provider}
          specs={allSpecs}
          onClose={() => setEditor(null)}
          onSaved={(msg) => {
            toast.success(msg)
            setEditor(null)
            load()
          }}
        />
      )}

      {playground && (
        <PlaygroundModal
          key={playground.id}
          provider={playground}
          onClose={() => setPlayground(null)}
        />
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={confirmDelete ? `${t.ai.delete}: ${confirmDelete.name}` : ""}
        closeLabel={t.platform.close}
        footer={<>
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>
            {t.platform.cancel}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            {t.ai.delete}
          </Button>
        </>}
      >
        <p className="text-sm text-muted-foreground">{t.ai.delete_confirm}</p>
      </Modal>
    </div>
  )
}

function AiEditorModal({
  provider,
  specs,
  onClose,
  onSaved,
}: {
  provider: AiProvider | null
  specs: AiProviderSpec[]
  onClose: () => void
  onSaved: (msg: string) => void
}) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [name, setName] = useState(provider?.name ?? "")
  const [type, setType] = useState<AiProviderType>(provider?.type ?? "openai")
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? specs[0]?.defaultBaseUrl ?? "")
  const [apiKey, setApiKey] = useState("")
  const [models, setModels] = useState<string[]>(provider?.models ?? specs[0]?.defaultModels ?? [])
  const [defaultModel, setDefaultModel] = useState(provider?.defaultModel ?? provider?.models?.[0] ?? specs[0]?.defaultModels?.[0] ?? "")
  const [status, setStatus] = useState<"active" | "disabled">(provider?.status ?? "active")
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [fetching, setFetching] = useState(false)

  const spec = specs.find((s) => s.type === type) ?? specs[0]

  const changeType = (next: AiProviderType) => {
    const nextSpec = specs.find((s) => s.type === next)
    if (!nextSpec) return
    setType(next)
    if (baseUrl === spec?.defaultBaseUrl || !baseUrl) {
      setBaseUrl(nextSpec.defaultBaseUrl)
    }
    if (nextSpec.defaultModels.length > 0) {
      setModels(nextSpec.defaultModels)
      setDefaultModel(nextSpec.defaultModels[0])
    }
  }

  const anySpecNeedsKey = spec?.needsKey && !spec.keyOptional
  const hasKey = Boolean(provider?.apiKeyHint)
  const canSubmit =
    name.trim() &&
    (type !== "openai_compatible" || baseUrl.trim()) &&
    models.length > 0 &&
    models.every((m) => m.trim()) &&
    (!anySpecNeedsKey || apiKey || hasKey) &&
    !busy

  const persist = async (dto: {
    name: string
    type: AiProviderType
    baseUrl?: string
    apiKey?: string
    models?: string[]
    defaultModel?: string
    status?: "active" | "disabled"
  }): Promise<AiProvider> => {
    if (!token || !currentOrg) throw new Error("Not authenticated")
    if (provider) {
      return api.updateAiProvider(dto, token, currentOrg.id, provider.id)
    }
    return api.createAiProvider(dto, token, currentOrg.id)
  }

  const submit = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      await persist({
        name: name.trim(),
        type,
        baseUrl: baseUrl.trim() || undefined,
        apiKey: apiKey.trim() || undefined,
        models: models.map((m) => m.trim()).filter(Boolean),
        defaultModel: (defaultModel || models[0] || "").trim() || undefined,
        status,
      })
      onSaved(provider ? t.ai.updated : t.ai.created)
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  const runTest = async () => {
    if (!token || !currentOrg) return
    if ((anySpecNeedsKey && !apiKey && !hasKey) || !baseUrl.trim()) {
      toast.error(t.ai.no_key)
      return
    }
    setTesting(true)
    try {
      const saved = provider ?? (await persist({ name: name.trim() || spec.label, type, models, defaultModel: defaultModel || models[0] }))
      const res = await api.testAiProvider(token, currentOrg.id, saved.id)
      if (res.ok) toast.success(t.ai.test_ok)
      else if (res.error) toast.error(res.error)
      else toast.error(t.ai.test_fail)
      onSaved(provider ? t.ai.saved : t.ai.created)
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setTesting(false)
    }
  }

  const runFetch = async () => {
    if (!token || !currentOrg) return
    if ((anySpecNeedsKey && !apiKey && !hasKey) || !baseUrl.trim()) {
      toast.error(t.ai.no_key)
      return
    }
    setFetching(true)
    try {
      const saved = provider ?? (await persist({ name: name.trim() || spec.label, type, models }))
      const fetched = await api.fetchAiModels(token, currentOrg.id, saved.id)
      setModels((m) => Array.from(new Set([...m, ...fetched])))
      toast.success(t.ai.models_fetched)
      if (!provider) {
        await api.updateAiProvider({ models: Array.from(new Set([...models, ...fetched])) }, token, currentOrg.id, saved.id)
      }
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setFetching(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={provider ? `${t.ai.edit}: ${provider.name}` : t.ai.new_provider}
      description={t.ai.subtitle}
      closeLabel={t.platform.close}
      size="xl"
      footer={<>
        <Button variant="outline" onClick={onClose}>
          {t.platform.cancel}
        </Button>
        <Button variant="secondary" onClick={runTest} disabled={busy || testing || fetching}>
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {t.ai.test}
        </Button>
        {provider && (
          <Button variant="secondary" onClick={runFetch} disabled={busy || testing || fetching}>
            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t.ai.fetch_models}
          </Button>
        )}
        <Button onClick={submit} disabled={!canSubmit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {provider ? t.ai.save : t.ai.create}
        </Button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.ai.name}</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.ai.name_placeholder} className="input" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.ai.provider}</label>
            <select value={type} onChange={(e) => changeType(e.target.value as AiProviderType)} className="input h-10 cursor-pointer">
              {specs.map((s) => (
                <option key={s.type} value={s.type}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.ai.base_url}</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={spec?.baseUrlPlaceholder ?? t.ai.base_url_placeholder}
            className="input"
            dir="ltr"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.ai.api_key}</label>
          <div className="relative">
            <KeyRound className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                hasKey
                  ? `${t.ai.key_configured} — ${provider?.apiKeyHint ?? ""}`
                  : (spec?.keyOptional ? `${t.ai.api_key_placeholder} (${t.ai.api_key_optional})` : t.ai.api_key_placeholder)
              }
              className="input ps-9"
              dir="ltr"
              autoComplete="new-password"
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">{t.ai.models}</label>
            <button
              onClick={() => setModels((m) => [...m, ""])}
              className="text-xs font-medium text-primary hover:underline cursor-pointer"
            >
              {t.ai.add_model}
            </button>
          </div>
          <div className="space-y-2">
            {models.map((m, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-2">
                <input
                  value={m}
                  onChange={(e) => setModels((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                  placeholder={t.ai.model_placeholder}
                  className="input min-w-0 flex-1"
                  dir="ltr"
                />
                <button
                  onClick={() => setModels((arr) => arr.filter((_, j) => j !== i))}
                  aria-label={t.ai.remove}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.ai.default_model}</label>
            <select value={defaultModel} onChange={(e) => setDefaultModel(e.target.value)} className="input h-10 cursor-pointer">
              {models.length === 0 && <option value="">{t.ai.default_model_placeholder}</option>}
              {models.filter((m) => m.trim()).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.ai.status}</label>
            <div className="flex items-center gap-2">
              {(
                [
                  ["active", t.ai.active],
                  ["disabled", t.ai.disabled],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setStatus(value)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer",
                    status === value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function PlaygroundModal({ provider, onClose }: { provider: AiProvider; onClose: () => void }) {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [model, setModel] = useState(provider.defaultModel ?? provider.models[0] ?? "")
  const [messages, setMessages] = useState<AiChatMessageData[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [reply, setReply] = useState<{ content: string; tokens: number | null; durationMs: number } | null>(null)

  const canSend = Boolean(model) && input.trim() && !busy

  const send = async () => {
    if (!token || !currentOrg || !canSend) return
    const next = [...messages, { role: "user" as const, content: input.trim() }]
    setMessages(next)
    setInput("")
    setReply(null)
    setBusy(true)
    try {
      const res = await api.chatAiProvider(provider.id, { model, messages: next }, token, currentOrg.id)
      setMessages((m) => [...m, { role: "assistant", content: res.reply }])
      setReply({ content: res.reply, tokens: res.usage.total, durationMs: res.durationMs })
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${t.ai.playground}: ${provider.name}`}
      description={t.ai.playground_hint}
      closeLabel={t.platform.close}
      size="xl"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">{t.ai.default_model}</label>
          <select value={model} onChange={(e) => setModel(e.target.value)} className="input h-10 cursor-pointer">
            {provider.models.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-xl border border-border bg-muted/30 p-3">
          {messages.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t.ai.playground_hint}</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "border border-border bg-card"
                )}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              </div>
            </div>
          )}
        </div>

        {reply && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="success" dot>
              {t.ai.reply}
            </Badge>
            {typeof reply.tokens === "number" && (
              <Badge variant="secondary">{t.ai.total_tokens}: {reply.tokens}</Badge>
            )}
            <Badge variant="secondary">{t.ai.duration}: {reply.durationMs}ms</Badge>
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) send()
            }}
            placeholder={t.ai.chat_placeholder}
            className="input min-w-0 flex-1"
            disabled={busy}
          />
          <Button onClick={send} disabled={!canSend}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
            {t.ai.send}
          </Button>
        </div>
      </div>
    </Modal>
  )
}