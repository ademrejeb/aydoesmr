"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Banknote,
  CheckCircle2,
  CircleAlert,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Upload,
  X,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import {
  api,
  downloadBlob,
  type PayrollImportResult,
  type PayrollOverridesResult,
  type PayrollRun,
} from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Modal } from "@/components/ui/modal"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"

function money(n: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n)
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`)
}

interface CreateForm {
  month: string
  currency: string
  notes: string
}

export default function PayrollPage() {
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()

  const orgId = currentOrg?.id ?? ""
  const authToken = token ?? ""

  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PayrollRun | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>({ month: "", currency: "USD", notes: "" })

  const [overridesOpen, setOverridesOpen] = useState(false)
  const [overrides, setOverrides] = useState<PayrollOverridesResult>({ runId: null, overrides: [] })
  const [overrideInputs, setOverrideInputs] = useState<Record<string, { rate: string; bonus: string }>>({})

  const [importOpen, setImportOpen] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const canAct = Boolean(orgId && authToken)

  const refresh = useCallback(async () => {
    if (!canAct) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const list = await api.listPayrollRuns(authToken, orgId)
      setRuns(list)
      setSelected((prev) => {
        if (!prev) return prev
        return list.find((r) => r.id === prev.id) ?? prev
      })
    } catch {
      toast.error(t.payroll.title, t.payroll.no_runs)
    } finally {
      setLoading(false)
    }
  }, [canAct, authToken, orgId, toast, t.payroll.title, t.payroll.no_runs])

  useEffect(() => {
    if (canAct) void refresh()
  }, [refresh, canAct])

  const selectRun = useCallback((runId: string) => {
    setSelected(runs.find((r) => r.id === runId) ?? null)
  }, [runs])

  const createRun = useCallback(async () => {
    if (!/^\d{4}-\d{2}$/.test(form.month)) {
      toast.error(t.payroll.title, t.payroll.month_hint)
      return
    }
    if (runs.some((r) => r.month === form.month)) {
      toast.error(t.payroll.title, t.payroll.run_exists)
      return
    }
    setBusy("create")
    try {
      const run = await api.createPayrollRun(
        { month: form.month, currency: form.currency || "USD", notes: form.notes || undefined },
        authToken,
        orgId
      )
      setRuns((prev) => [run, ...prev])
      setSelected(run)
      setCreateOpen(false)
      setForm({ month: "", currency: "USD", notes: "" })
      toast.success(t.payroll.run_created)
    } catch {
      toast.error(t.payroll.title, t.payroll.run_exists)
    } finally {
      setBusy(null)
    }
  }, [authToken, orgId, form, runs, toast, t])

  const generate = useCallback(async () => {
    if (!selected) return
    setBusy(`generate-${selected.id}`)
    try {
      const run = await api.generatePayrollRun(authToken, orgId, selected.id)
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)))
      setSelected(run)
      toast.success(t.payroll.generated_ok)
    } catch {
      toast.error(t.payroll.title, t.payroll.generate)
    } finally {
      setBusy(null)
    }
  }, [authToken, orgId, selected, toast, t])

  const markPaid = useCallback(async () => {
    if (!selected) return
    if (!window.confirm(t.payroll.mark_paid_confirm)) return
    setBusy(`pay-${selected.id}`)
    try {
      const run = await api.markPayrollRunPaid(authToken, orgId, selected.id)
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)))
      setSelected(run)
      toast.success(t.payroll.marked_paid_ok)
    } catch {
      toast.error(t.payroll.title, t.payroll.mark_paid)
    } finally {
      setBusy(null)
    }
  }, [authToken, orgId, selected, toast, t])

  const exportCsv = useCallback(async () => {
    if (!selected) return
    setBusy(`export-${selected.id}`)
    try {
      const csv = await api.exportPayslipCsv(authToken, orgId, selected.id)
      downloadBlob(csv, `payslips-${selected.month}.csv`, "text/csv")
      toast.success(t.payroll.export_ok)
    } catch {
      toast.error(t.payroll.title, t.payroll.export_csv)
    } finally {
      setBusy(null)
    }
  }, [authToken, orgId, selected, toast, t])

  const openOverrides = useCallback(async () => {
    setOverridesOpen(true)
    try {
      const res = await api.listPayrollOverrides(authToken, orgId)
      setOverrides(res)
    } catch {
      setOverrides({ runId: null, overrides: [] })
    }
  }, [authToken, orgId])

  const applyOverride = useCallback(
    async (memberId: string) => {
      const input = overrideInputs[memberId]
      if (!input) return
      const rate = input.rate === "" ? undefined : Number(input.rate)
      const bonus = input.bonus === "" ? undefined : Number(input.bonus)
      if (rate === undefined && bonus === undefined) return
      if (rate !== undefined && (Number.isNaN(rate) || rate < 0)) return
      if (bonus !== undefined && (Number.isNaN(bonus) || bonus < 0)) return
      setBusy(`override-${memberId}`)
      try {
        await api.setPayrollOverride(
          memberId,
          { rate, bonus },
          authToken,
          orgId
        )
        toast.success(t.payroll.override_ok)
        const res = await api.listPayrollOverrides(authToken, orgId)
        setOverrides(res)
        if (selected) {
          const run = await api.getPayrollRun(authToken, orgId, selected.id)
          setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)))
          setSelected(run)
        }
      } catch {
        toast.error(t.payroll.title, t.payroll.override)
      } finally {
        setBusy(null)
      }
    },
    [authToken, orgId, overrideInputs, selected, toast, t]
  )

  const onImportFile = useCallback(
    async (file: File) => {
      if (!selected) return
      setFileName(file.name)
      const text = await file.text()
      setBusy(`import-${selected.id}`)
      try {
        const res: PayrollImportResult = await api.importPayrollOverrides(selected.id, text, authToken, orgId)
        setRuns((prev) => prev.map((r) => (r.id === res.run.id ? res.run : r)))
        setSelected(res.run)
        const msg = interpolate(t.payroll.import_ok, { applied: String(res.applied) })
        toast.success(msg, res.skipped > 0 ? interpolate(t.payroll.import_errors, { skipped: String(res.skipped) }) : undefined)
        setImportOpen(false)
        setFileName(null)
      } catch {
        toast.error(t.payroll.title, t.payroll.import_csv)
      } finally {
        setBusy(null)
      }
    },
    [authToken, orgId, selected, toast, t]
  )

  const headerStats = useMemo(() => {
    const pending = runs.filter((r) => r.status === "PENDING")
    const entries = runs.reduce((n, r) => n + r.entries.length, 0)
    return { runs: runs.length, pending: pending.length, entries }
  }, [runs])

  if (!canAct) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <CircleAlert className="h-8 w-8 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold tracking-tight">{t.payroll.title}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.payroll.subtitle}</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setCreateOpen(true)
            setForm({ month: "", currency: "USD", notes: "" })
          }}
        >
          <Plus className="h-4 w-4" />
          {t.payroll.create_run_btn}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs font-medium text-muted-foreground">{t.payroll.history}</p>
          <p className="mt-1.5 text-2xl font-bold">{headerStats.runs}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-muted-foreground">{t.payroll.status_pending}</p>
          <p className="mt-1.5 text-2xl font-bold">{headerStats.pending}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium text-muted-foreground">{t.payroll.employees}</p>
          <p className="mt-1.5 text-2xl font-bold">{headerStats.entries}</p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <Card title={t.payroll.history} action={<RefreshCw className="h-4 w-4 cursor-pointer text-muted-foreground" onClick={() => refresh()} />}>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <EmptyState
              icon={Banknote}
              title={t.payroll.no_runs}
              description={t.payroll.generate_first}
            />
          ) : (
            <div className="space-y-1.5">
              {runs.map((run) => (
                <button
                  key={run.id}
                  onClick={() => selectRun(run.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-start transition-colors cursor-pointer",
                    selected?.id === run.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card hover:bg-accent"
                  )}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{run.month}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {run.entries.length} · {money(run.netTotal, run.currency, locale)}
                    </p>
                  </div>
                  <Badge variant={run.status === "PAID" ? "success" : "warning"} dot>
                    {run.status === "PAID" ? t.payroll.status_paid : t.payroll.status_pending}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {!selected ? (
            <Card>
              <EmptyState
                icon={Banknote}
                title={t.payroll.no_runs}
                description={t.payroll.generate_first}
                action={
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    {t.payroll.create_run_btn}
                  </Button>
                }
              />
            </Card>
          ) : (
            <>
              <Card
                title={selected.month}
                action={
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" disabled={selected.status === "PAID" || busy !== null} onClick={() => void generate()}>
                      {busy === `generate-${selected.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                      {t.payroll.generate}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void exportCsv()}>
                      {busy === `export-${selected.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      {t.payroll.export_csv}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setImportOpen(true)}>
                      {busy === `import-${selected.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      {t.payroll.import_csv}
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void openOverrides()}>
                      {t.payroll.overrides}
                    </Button>
                    {selected.status === "PENDING" && (
                      <Button size="sm" variant="secondary" disabled={busy !== null} onClick={() => void markPaid()}>
                        {busy === `pay-${selected.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        {t.payroll.mark_paid}
                      </Button>
                    )}
                  </div>
                }
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">{t.payroll.gross_total}</p>
                    <p className="mt-1 text-lg font-bold">{money(selected.grossTotal, selected.currency, locale)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">{t.payroll.net_total}</p>
                    <p className="mt-1 text-lg font-bold">{money(selected.netTotal, selected.currency, locale)}</p>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-xs font-medium text-muted-foreground">{t.payroll.status}</p>
                    <p className="mt-1 text-lg font-bold">
                      <Badge variant={selected.status === "PAID" ? "success" : "warning"} dot>
                        {selected.status === "PAID" ? t.payroll.status_paid : t.payroll.status_pending}
                      </Badge>
                    </p>
                  </div>
                </div>
              </Card>

              <Card title={t.payroll.entries}>
                {selected.entries.length === 0 ? (
                  <EmptyState icon={Banknote} title={t.payroll.no_entries} description={t.payroll.generate_first} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                          <th className="px-3 py-2">{t.payroll.member}</th>
                          <th className="px-3 py-2">{t.payroll.regular}</th>
                          <th className="px-3 py-2">{t.payroll.overtime}</th>
                          <th className="px-3 py-2">{t.payroll.rate}</th>
                          <th className="px-3 py-2">{t.payroll.bonus}</th>
                          <th className="px-3 py-2">{t.payroll.gross}</th>
                          <th className="px-3 py-2">{t.payroll.net}</th>
                          {selected.status === "PENDING" && <th className="px-3 py-2">{t.payroll.override}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {selected.entries.map((e) => (
                          <tr key={e.memberId} className="border-b border-border last:border-0">
                            <td className="px-3 py-2.5 font-medium">
                              {e.memberName}
                              {e.override && (
                                <Badge variant="info" className="ms-2">
                                  {t.payroll.override}
                                </Badge>
                              )}
                            </td>
                            <td className="px-3 py-2.5">{e.regularHours}</td>
                            <td className="px-3 py-2.5">{e.overtimeHours}</td>
                            <td className="px-3 py-2.5">{e.rate.toFixed(2)}</td>
                            <td className="px-3 py-2.5">{money(e.bonus, selected.currency, locale)}</td>
                            <td className="px-3 py-2.5">{money(e.gross, selected.currency, locale)}</td>
                            <td className="px-3 py-2.5 font-semibold">{money(e.net, selected.currency, locale)}</td>
                            {selected.status === "PENDING" && (
                              <td className="px-3 py-2.5">
                                <Button size="sm" variant="ghost" onClick={() => void openOverrides()}>
                                  {t.payroll.override}
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t.payroll.create_run}
        description={t.payroll.month_hint}
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t.platform.cancel}
            </Button>
            <Button disabled={busy === "create"} onClick={() => void createRun()}>
              {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t.payroll.create_run_btn}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t.payroll.month_label}</span>
            <input
              type="month"
              value={form.month}
              onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
              className="input w-full"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t.payroll.currency}</span>
            <input
              value={form.currency}
              onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              className="input w-full"
              placeholder="USD"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">{t.payroll.notes}</span>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="input w-full"
              rows={3}
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => {
          setImportOpen(false)
          setFileName(null)
        }}
        title={t.payroll.import_title}
        description={t.payroll.import_hint}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setImportOpen(false)
                setFileName(null)
              }}
            >
              <X className="h-4 w-4" />
              {t.platform.cancel}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium">{fileName ?? t.payroll.upload_csv}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={busy !== null}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void onImportFile(file)
              }}
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={overridesOpen}
        onClose={() => setOverridesOpen(false)}
        title={t.payroll.overrides}
        description={t.payroll.override}
        size="xl"
      >
        <div className="overflow-x-auto">
          {overrides.overrides.length === 0 ? (
            <EmptyState icon={Banknote} title={t.payroll.overrides} description={t.payroll.override} />
          ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">{t.payroll.member}</th>
                <th className="px-3 py-2">{t.payroll.rate}</th>
                <th className="px-3 py-2">{t.payroll.bonus}</th>
                <th className="px-3 py-2">{t.payroll.net}</th>
                <th className="px-3 py-2">{t.payroll.actions}</th>
              </tr>
            </thead>
            <tbody>
              {overrides.overrides.map((o) => {
                const input = overrideInputs[o.memberId]
                return (
                  <tr key={o.memberId} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-medium">{o.memberName}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        placeholder={String(o.rate)}
                        value={input?.rate ?? ""}
                        onChange={(e) =>
                          setOverrideInputs((m) => ({ ...m, [o.memberId]: { rate: e.target.value, bonus: m[o.memberId]?.bonus ?? "" } }))
                        }
                        className="input w-28"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        placeholder={String(o.bonus)}
                        value={input?.bonus ?? ""}
                        onChange={(e) =>
                          setOverrideInputs((m) => ({ ...m, [o.memberId]: { rate: m[o.memberId]?.rate ?? "", bonus: e.target.value } }))
                        }
                        className="input w-28"
                      />
                    </td>
                    <td className="px-3 py-2 font-semibold">{money(o.net, selected?.currency ?? "USD", locale)}</td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy !== null}
                        onClick={() => void applyOverride(o.memberId)}
                      >
                        {busy === `override-${o.memberId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {t.payroll.apply_override}
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          )}
        </div>
      </Modal>
    </div>
  )
}