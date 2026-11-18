"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Info, Loader2, RotateCcw, Save, ShieldCheck, SlidersHorizontal } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type AnalysisConfig, type RuleCatalogEntry } from "@/lib/api"
import { can } from "@/lib/access"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { severityLabel, severityVariant } from "@/components/ui/severity-badge"

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-transparent bg-primary" : "border-border bg-muted"
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
          checked ? "start-[22px]" : "start-0.5"
        )}
      />
    </button>
  )
}

const searchInputCls =
  "h-10 w-full rounded-md border border-border bg-card ps-9 pe-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
const selectInputCls =
  "h-10 w-full cursor-pointer rounded-md border border-border bg-card px-3 text-sm text-foreground transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"

export default function DevRulesPage() {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()

  const [catalog, setCatalog] = useState<RuleCatalogEntry[]>([])
  const [config, setConfig] = useState<AnalysisConfig["config"]>({})
  const [draft, setDraft] = useState<Record<string, boolean>>({})
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedFor, setSavedFor] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("ALL")
  const [severity, setSeverity] = useState("ALL")
  const [language, setLanguage] = useState("ALL")
  const [enabledOnly, setEnabledOnly] = useState(false)

  const canEdit = can(currentOrg?.role ?? null, "git_write")
  const loading = Boolean(token && currentOrg) && loadedFor !== (currentOrg?.id ?? null)
  const saved = savedFor !== null && savedFor === (currentOrg?.id ?? null)

  useEffect(() => {
    if (!token || !currentOrg) return
    const orgId = currentOrg.id
    Promise.all([api.getRulesCatalog(token, orgId), api.getAnalysisConfig(token, orgId)])
      .then(([cat, cfg]) => {
        setCatalog(cat.rules ?? [])
        setConfig(cfg.config ?? {})
        const storedRules = (cfg.config ?? {}).rules ?? {}
        const next: Record<string, boolean> = {}
        for (const rule of cat.rules ?? []) {
          const override = storedRules[rule.id]
          next[rule.id] = typeof override?.enabled === "boolean" ? override.enabled : rule.enabled
        }
        setDraft(next)
      })
      .catch(() => toast.error(t.errors.network_error))
      .finally(() => setLoadedFor(orgId))
  }, [token, currentOrg, t.errors.network_error, toast])

  const categories = useMemo(
    () => Array.from(new Set(catalog.map((r) => r.category).filter(Boolean))).sort(),
    [catalog]
  )
  const severities = useMemo(
    () => Array.from(new Set(catalog.map((r) => r.severity.toLowerCase()))).sort(),
    [catalog]
  )
  const languages = useMemo(
    () => Array.from(new Set(catalog.flatMap((r) => r.languages).filter(Boolean))).sort(),
    [catalog]
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return catalog.filter((r) => {
      if (category !== "ALL" && r.category !== category) return false
      if (severity !== "ALL" && r.severity.toLowerCase() !== severity) return false
      if (language !== "ALL" && !r.languages.includes(language)) return false
      if (enabledOnly && !draft[r.id]) return false
      if (q) {
        const hay = `${r.id} ${r.name}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [catalog, draft, search, category, severity, language, enabledOnly])

  const enabledCount = useMemo(
    () => catalog.filter((r) => draft[r.id]).length,
    [catalog, draft]
  )
  const isDirty = useMemo(
    () =>
      catalog.some((r) => {
        const stored = config.rules?.[r.id]
        const baseline = typeof stored?.enabled === "boolean" ? stored.enabled : r.enabled
        return draft[r.id] !== baseline
      }),
    [catalog, config.rules, draft]
  )

  const toggle = (id: string) => setDraft((d) => ({ ...d, [id]: !d[id] }))

  const handleSave = async () => {
    if (!token || !currentOrg || !canEdit) return
    setSaving(true)
    try {
      const rules: Record<string, { enabled?: boolean }> = {}
      for (const rule of catalog) {
        if (draft[rule.id] !== rule.enabled) rules[rule.id] = { enabled: draft[rule.id] }
      }
      const existing = { ...config }
      existing.rules = rules
      await api.setAnalysisConfig(token, currentOrg.id, existing)
      setConfig(existing)
      setSavedFor(currentOrg.id)
      toast.success(t.dev.rules_saved)
      setTimeout(() => setSavedFor(null), 2500)
    } catch {
      toast.error(t.errors.network_error)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!token || !currentOrg || !canEdit) return
    if (!window.confirm(t.dev.rules_reset_confirm)) return
    setSaving(true)
    try {
      const existing = { ...config }
      existing.rules = undefined
      await api.setAnalysisConfig(token, currentOrg.id, existing)
      setConfig(existing)
      const next: Record<string, boolean> = {}
      for (const rule of catalog) next[rule.id] = rule.enabled
      setDraft(next)
      setSavedFor(currentOrg.id)
      toast.success(t.dev.rules_saved)
      setTimeout(() => setSavedFor(null), 2500)
    } catch {
      toast.error(t.errors.network_error)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="hero-gradient relative overflow-hidden rounded-2xl p-6 text-white md:p-8">
        <div className="pointer-events-none absolute -end-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-hero flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Link
              href="/dashboard/dev"
              className="inline-flex items-center gap-1 text-xs font-medium text-white/75 transition-colors hover:text-white"
            >
              <ArrowLeft className="rtl:rotate-180" />
              {t.platform.dev}
            </Link>
            <h2 className="mt-2 text-2xl font-extrabold leading-tight md:text-3xl">{t.dev.rules_title}</h2>
            <p className="mt-2 max-w-2xl text-sm text-white/85 md:text-base">{t.dev.rules_subtitle}</p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/20">
            <SlidersHorizontal className="h-6 w-6" />
          </span>
        </div>
      </section>

      {!canEdit && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          {t.dev.rules_readonly}
        </div>
      )}

      <section className="rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute start-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.dev.rules_search_placeholder}
                aria-label={t.dev.rules_search}
                className={searchInputCls}
              />
            </div>
            <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t.dev.rules_category} className={selectInputCls}>
              <option value="ALL">{t.dev.rules_category}: {t.dev.rules_all}</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label={t.dev.rules_severity} className={selectInputCls}>
              <option value="ALL">{t.dev.rules_severity}: {t.dev.rules_all}</option>
              {severities.map((s) => (
                <option key={s} value={s}>{s.toUpperCase()}</option>
              ))}
            </select>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label={t.dev.rules_language} className={selectInputCls}>
              <option value="ALL">{t.dev.rules_language}: {t.dev.rules_all}</option>
              {languages.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={enabledOnly}
                onChange={(e) => setEnabledOnly(e.target.checked)}
                className="h-4 w-4 cursor-pointer accent-primary"
              />
              {t.dev.rules_enabled_only}
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <span className="font-semibold text-foreground">{enabledCount}</span> {t.dev.rules_enabled}
                {" · "}
                <span className="font-semibold text-foreground">{catalog.length}</span> {t.dev.rules_total}
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs font-medium text-success">
                <Save className="h-3.5 w-3.5" />
                {t.dev.saved}
              </span>
            )}
            {canEdit && (
              <>
                <Button variant="outline" size="sm" onClick={handleReset} disabled={saving || loading || catalog.length === 0}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t.dev.rules_reset}
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving || loading || !isDirty || catalog.length === 0}>
                  {saving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t.dev.save}…
                    </>
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      {t.dev.rules_save}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0" />
        {t.dev.rules_runtime_note} {catalog.length > 0 && <span className="font-semibold text-foreground">{catalog.length}</span>}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState icon={SlidersHorizontal} title={t.dev.rules_no_results} description={t.dev.rules_search_placeholder} />
      ) : (
        <div className="space-y-3">
          {visible.map((rule) => {
            const enabled = !!draft[rule.id]
            return (
              <div
                key={rule.id}
                className={cn(
                  "flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-card p-4 shadow-sm transition-opacity",
                  enabled ? "border-border" : "border-border/50 opacity-70"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{rule.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{rule.id}</span>
                    <Badge variant={severityVariant(rule.severity)} dot>
                      {severityLabel(rule.severity, t)}
                    </Badge>
                    {rule.category && <Badge variant="secondary">{rule.category}</Badge>}
                    {rule.metric && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {t.dev.rules_metric}: {rule.metric} {rule.operator} {rule.threshold}
                      </span>
                    )}
                  </div>
                  {rule.suggestion && <p className="mt-1.5 text-xs text-muted-foreground">{rule.suggestion}</p>}
                  {rule.languages.length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <span className="text-[10px] font-medium text-muted-foreground">{t.dev.rules_applies_to}</span>
                      {rule.languages.map((l) => (
                        <span key={l} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {l}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Toggle checked={enabled} disabled={!canEdit} onChange={() => toggle(rule.id)} />
                  <span className={cn("text-[10px] font-medium", enabled ? "text-success" : "text-muted-foreground")}>
                    {enabled ? t.dev.rules_enabled : t.dev.rules_disabled}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}