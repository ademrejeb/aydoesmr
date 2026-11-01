"use client"

import { useCallback, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, BadgeCheck, CalendarDays, Check, Info, Loader2, Pencil, Plus, Wallet, X } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type LeaveBalance, type LeaveType, type OrgMember } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Select } from "@/components/ui/select"

/** Roles allowed to inspect/edit other members' balances. */
const REVIEWER_ROLES = ["MANAGER", "ADMIN", "OWNER"]

interface TypeForm {
  name: string
  code: string
  color: string
  isPaid: boolean
  daysPerYear: number
  carryOverDays: number
  accrualPerMonth: number
  requiresApproval: boolean
  isActive: boolean
}

function emptyForm(): TypeForm {
  return {
    name: "",
    code: "",
    color: "#2563eb",
    isPaid: true,
    daysPerYear: 20,
    carryOverDays: 0,
    accrualPerMonth: 0,
    requiresApproval: true,
    isActive: true,
  }
}

function formFromType(ty: LeaveType): TypeForm {
  return {
    name: ty.name,
    code: ty.code,
    color: ty.color ?? "#2563eb",
    isPaid: ty.isPaid,
    daysPerYear: ty.daysPerYear,
    carryOverDays: ty.carryOverDays,
    accrualPerMonth: ty.accrualPerMonth ?? 0,
    requiresApproval: ty.requiresApproval,
    isActive: ty.isActive,
  }
}

function toNumber(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm font-medium hover:bg-accent">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 shrink-0 cursor-pointer accent-primary"
      />
      <span>{label}</span>
    </label>
  )
}

export default function LeaveSettingsPage() {
  const { token, currentOrg, user } = useAuth()
  const { t } = useI18n()
  const toast = useToast()

  const orgId = currentOrg?.id
  const authToken = token ?? ""
  const currentYear = new Date().getFullYear()
  const isReviewer = !!currentOrg?.role && REVIEWER_ROLES.includes(currentOrg.role)

  const [types, setTypes] = useState<LeaveType[]>([])
  const [balances, setBalances] = useState<LeaveBalance[]>([])
  const [members, setMembers] = useState<OrgMember[]>([])
  const [memberId, setMemberId] = useState<string>(() => user?.id ?? "")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [year, setYear] = useState(currentYear)
  const [form, setForm] = useState<TypeForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<TypeForm>(emptyForm)
  const [editingBalanceId, setEditingBalanceId] = useState<string | null>(null)
  const [balanceDraft, setBalanceDraft] = useState<{ granted: string; carriedOver: string; adjusted: string } | null>(null)
  const [savingBalanceId, setSavingBalanceId] = useState<string | null>(null)

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  // The context may hydrate after mount; make sure a reviewer defaults to
  // inspecting their own balances rather than an empty selection.
  useEffect(() => {
    if (isReviewer && !memberId && user?.id) setMemberId(user.id)
  }, [isReviewer, memberId, user?.id])

  const load = useCallback(async () => {
    if (!authToken || !orgId) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const targetMemberId = memberId || user?.id || undefined
      const [typesList, balancesList, membersList] = await Promise.all([
        api.listLeaveTypes(authToken, orgId).catch(() => [] as LeaveType[]),
        api.listLeaveBalances(authToken, orgId, year, targetMemberId).catch(() => [] as LeaveBalance[]),
        isReviewer ? api.listMembers(authToken, orgId).catch(() => [] as OrgMember[]) : Promise.resolve([] as OrgMember[]),
      ])
      setTypes(typesList)
      setBalances(balancesList)
      setMembers(membersList)
    } catch (err) {
      setError(err instanceof Error ? err.message : t.leave_settings.error_load)
      toast.error(t.leave_settings.error_load, err instanceof Error ? err.message : undefined)
    } finally {
      setLoading(false)
    }
  }, [authToken, orgId, year, memberId, user?.id, isReviewer, t.leave_settings.error_load, toast])

  useEffect(() => {
    load()
  }, [load])

  const patchForm = (patch: Partial<TypeForm>) => setForm((prev) => ({ ...prev, ...patch }))
  const patchEdit = (patch: Partial<TypeForm>) => setEditForm((prev) => ({ ...prev, ...patch }))

  const startEdit = (ty: LeaveType) => {
    setEditingId(ty.id)
    setEditForm(formFromType(ty))
    setError(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setError(null)
  }

  const startBalanceEdit = (b: LeaveBalance) => {
    setEditingBalanceId(b.id)
    setBalanceDraft({
      granted: String(b.granted),
      carriedOver: String(b.carriedOver),
      adjusted: String(b.adjusted),
    })
    setError(null)
  }

  const cancelBalanceEdit = () => {
    setEditingBalanceId(null)
    setBalanceDraft(null)
    setError(null)
  }

  const patchBalanceDraft = (patch: Partial<NonNullable<typeof balanceDraft>>) =>
    setBalanceDraft((prev) => ({ ...(prev ?? { granted: "", carriedOver: "", adjusted: "" }), ...patch }))

  const parseAmount = (value: string | undefined): number => {
    if (value === undefined || value.trim() === "") return 0
    return parseFloat(value)
  }

  const saveBalance = async (b: LeaveBalance) => {
    if (!authToken || !orgId || !editingBalanceId) return
    const granted = parseAmount(balanceDraft?.granted)
    const carriedOver = parseAmount(balanceDraft?.carriedOver)
    const adjusted = parseAmount(balanceDraft?.adjusted)
    if ([granted, carriedOver, adjusted].some((n) => !Number.isFinite(n) || n < 0)) {
      toast.error(t.leave_settings.error_save)
      return
    }
    setSavingBalanceId(b.id)
    setError(null)
    try {
      await api.updateLeaveBalance(authToken, orgId, b.id, { granted, carriedOver, adjusted })
      toast.success(t.leave_settings.balance_updated)
      setEditingBalanceId(null)
      setBalanceDraft(null)
      void load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.leave_settings.error_save
      setError(msg)
      toast.error(t.leave_settings.error_save, msg)
    } finally {
      setSavingBalanceId(null)
    }
  }

  const create = async () => {
    if (!authToken || !orgId) return
    if (!form.name.trim() || !form.code.trim()) {
      toast.error(t.leave_settings.error_save)
      return
    }
    setSaving(true)
    setSavingId("__new__")
    setError(null)
    try {
      await api.createLeaveType(authToken, orgId, {
        name: form.name.trim(),
        code: form.code.trim(),
        color: form.color,
        isPaid: form.isPaid,
        daysPerYear: form.daysPerYear,
        carryOverDays: form.carryOverDays,
        accrualPerMonth: form.accrualPerMonth,
        requiresApproval: form.requiresApproval,
        isActive: form.isActive,
      })
      toast.success(t.leave_settings.created)
      setForm(emptyForm())
      void load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.leave_settings.error_save
      setError(msg)
      toast.error(t.leave_settings.error_save, msg)
    } finally {
      setSaving(false)
      setSavingId(null)
    }
  }

  const update = async () => {
    if (!authToken || !orgId || !editingId) return
    if (!editForm.name.trim() || !editForm.code.trim()) {
      toast.error(t.leave_settings.error_save)
      return
    }
    setSaving(true)
    setSavingId(editingId)
    setError(null)
    try {
      await api.updateLeaveType(authToken, orgId, editingId, {
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        color: editForm.color,
        isPaid: editForm.isPaid,
        daysPerYear: editForm.daysPerYear,
        carryOverDays: editForm.carryOverDays,
        accrualPerMonth: editForm.accrualPerMonth,
        requiresApproval: editForm.requiresApproval,
        isActive: editForm.isActive,
      })
      toast.success(t.leave_settings.updated)
      setEditingId(null)
      void load()
    } catch (err) {
      const msg = err instanceof Error ? err.message : t.leave_settings.error_save
      setError(msg)
      toast.error(t.leave_settings.error_save, msg)
    } finally {
      setSaving(false)
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="hero-gradient relative overflow-hidden rounded-2xl p-6 text-white md:p-8">
        <div className="pointer-events-none absolute -end-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-hero">
          <p className="text-xs font-medium uppercase tracking-wider text-white/70">{t.platform.leave_settings}</p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight md:text-3xl">{t.leave_settings.title}</h2>
          <p className="mt-2 max-w-xl text-sm text-white/85 md:text-base">{t.leave_settings.subtitle}</p>
        </div>
      </section>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <BadgeCheck className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">{t.leave_settings.types}</h3>
            </div>
            {loading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-xl" />
                ))}
              </div>
            ) : types.length === 0 ? (
              <EmptyState icon={BadgeCheck} title={t.leave_settings.empty_types} description={t.leave_settings.subtitle} />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {types.map((ty) => (
                  <div key={ty.id} className="rounded-xl border border-border bg-card p-4 shadow-sm card-hover">
                    {editingId === ty.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Field label={t.leave_settings.name} htmlFor={`edit-name-${ty.id}`}>
                            <input
                              id={`edit-name-${ty.id}`}
                              value={editForm.name}
                              onChange={(e) => patchEdit({ name: e.target.value })}
                              className="input h-10"
                            />
                          </Field>
                          <Field label={t.leave_settings.code} htmlFor={`edit-code-${ty.id}`}>
                            <input
                              id={`edit-code-${ty.id}`}
                              value={editForm.code}
                              onChange={(e) => patchEdit({ code: e.target.value })}
                              className="input h-10 font-mono uppercase"
                            />
                          </Field>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label={t.leave_settings.color} htmlFor={`edit-color-${ty.id}`}>
                            <input
                              id={`edit-color-${ty.id}`}
                              type="color"
                              value={editForm.color}
                              onChange={(e) => patchEdit({ color: e.target.value })}
                              className="h-10 w-14 cursor-pointer rounded-md border border-input bg-card px-1"
                            />
                          </Field>
                          <Field label={t.leave_settings.days_per_year} htmlFor={`edit-days-${ty.id}`}>
                            <input
                              id={`edit-days-${ty.id}`}
                              type="number"
                              min={0}
                              step={1}
                              value={editForm.daysPerYear}
                              onChange={(e) => patchEdit({ daysPerYear: Math.max(0, toNumber(e.target.value)) })}
                              className="input h-10"
                            />
                          </Field>
                          <Field label={t.leave_settings.carry_over} htmlFor={`edit-carry-${ty.id}`}>
                            <input
                              id={`edit-carry-${ty.id}`}
                              type="number"
                              min={0}
                              step={1}
                              value={editForm.carryOverDays}
                              onChange={(e) => patchEdit({ carryOverDays: Math.max(0, toNumber(e.target.value)) })}
                              className="input h-10"
                            />
                          </Field>
                          <Field label={t.leave_settings.accrual_per_month} htmlFor={`edit-accrual-${ty.id}`}>
                            <input
                              id={`edit-accrual-${ty.id}`}
                              type="number"
                              min={0}
                              step={0.5}
                              value={editForm.accrualPerMonth}
                              onChange={(e) => patchEdit({ accrualPerMonth: Math.max(0, toNumber(e.target.value)) })}
                              className="input h-10"
                            />
                          </Field>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <ToggleRow
                            checked={editForm.isPaid}
                            onChange={(v) => patchEdit({ isPaid: v })}
                            label={t.leave_settings.is_paid}
                          />
                          <ToggleRow
                            checked={editForm.requiresApproval}
                            onChange={(v) => patchEdit({ requiresApproval: v })}
                            label={t.leave_settings.requires_approval}
                          />
                          <ToggleRow
                            checked={editForm.isActive}
                            onChange={(v) => patchEdit({ isActive: v })}
                            label={t.leave_settings.is_active}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            onClick={update}
                            disabled={saving}
                            className="flex-1"
                          >
                            {saving && savingId === ty.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Plus className="h-4 w-4" />
                            )}
                            {saving && savingId === ty.id ? t.leave_settings.saving : t.leave_settings.save_changes}
                          </Button>
                          <Button variant="outline" size="sm" onClick={cancelEdit} disabled={saving}>
                            <X className="h-4 w-4" />
                            {t.common.cancel}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: ty.color ?? "#64748b" }} />
                          <p className="min-w-0 flex-1 truncate text-sm font-semibold">{ty.name}</p>
                          <Badge variant="outline" className="font-mono text-[10px] uppercase">{ty.code}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant={ty.isPaid ? "success" : "secondary"} dot>
                            {ty.isPaid ? t.leave_settings.paid : t.leave_settings.unpaid}
                          </Badge>
                          <Badge variant={ty.isActive ? "info" : "secondary"} dot>
                            {ty.isActive ? t.leave_settings.active : t.leave_settings.inactive}
                          </Badge>
                          <Badge variant="outline">
                            {ty.daysPerYear} {t.leave.days}
                          </Badge>
                          {ty.carryOverDays > 0 && (
                            <Badge variant="outline">
                              {t.leave_settings.carry_over}: {ty.carryOverDays}
                            </Badge>
                          )}
                          {(ty.accrualPerMonth ?? 0) > 0 && (
                            <Badge variant="outline">
                              {t.leave_settings.accrual_per_month}: {ty.accrualPerMonth}
                            </Badge>
                          )}
                          {isReviewer && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="ms-auto h-8 w-8"
                              onClick={() => startEdit(ty)}
                              aria-label={t.leave_settings.edit_type}
                              disabled={saving}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">{t.leave_settings.balances}</h3>
              <div className="ms-auto flex items-center gap-2">
                {isReviewer && members.length > 0 && (
                  <Select
                    size="sm"
                    value={memberId || user?.id || ""}
                    onChange={(e) => {
                      setMemberId(e.target.value)
                      setEditingBalanceId(null)
                      setBalanceDraft(null)
                    }}
                    aria-label={t.leave_settings.member}
                    wrapperClassName="w-40"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.user.id}>
                        {m.user.fullName || m.user.email}
                      </option>
                    ))}
                  </Select>
                )}
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || currentYear)}
                  aria-label={t.leave.year}
                  className="input h-9 w-24 cursor-pointer text-xs"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {loading ? (
              <Skeleton className="h-32 w-full rounded-xl" />
            ) : balances.length === 0 ? (
              <EmptyState icon={Wallet} title={t.leave_settings.no_balances} description={`${t.leave_settings.balances} · ${year}`} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold text-muted-foreground">
                      <th className="px-4 py-2.5">{t.leave.leave_type}</th>
                      <th className="px-4 py-2.5 text-end">{t.leave_settings.granted}</th>
                      <th className="px-4 py-2.5 text-end">{t.leave_settings.carried_over}</th>
                      <th className="px-4 py-2.5 text-end">{t.leave_settings.used}</th>
                      <th className="px-4 py-2.5 text-end">{t.leave_settings.pending}</th>
                      <th className="px-4 py-2.5 text-end">{t.leave_settings.adjusted}</th>
                      <th className="px-4 py-2.5 text-end">{t.leave_settings.remaining}</th>
                      <th className="px-4 py-2.5" aria-hidden="true" />
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((b) => {
                      const isEditing = editingBalanceId === b.id
                      const remaining = b.granted + b.carriedOver + b.adjusted - b.used - b.pending
                      const liveRemaining = isEditing
                        ? toNumber(balanceDraft?.granted ?? "") +
                          toNumber(balanceDraft?.carriedOver ?? "") +
                          toNumber(balanceDraft?.adjusted ?? "") -
                          b.used -
                          b.pending
                        : remaining
                      const setCell = (
                        value: string,
                        onError: (v: string) => void
                      ) => (
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          inputMode="decimal"
                          value={value}
                          onChange={(e) => onError(e.target.value)}
                          className="input h-8 w-20 text-end"
                        />
                      )
                      return (
                        <tr key={b.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2.5 font-medium">
                            <span
                              className="me-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                              style={{ backgroundColor: b.type.color ?? "#64748b" }}
                            />
                            {b.type.name}
                          </td>
                          <td className="px-4 py-2.5 text-end text-muted-foreground">
                            {isEditing
                              ? setCell(balanceDraft?.granted ?? "", (v) => patchBalanceDraft({ granted: v }))
                              : b.granted}
                          </td>
                          <td className="px-4 py-2.5 text-end text-muted-foreground">
                            {isEditing
                              ? setCell(balanceDraft?.carriedOver ?? "", (v) => patchBalanceDraft({ carriedOver: v }))
                              : b.carriedOver}
                          </td>
                          <td className="px-4 py-2.5 text-end text-muted-foreground">{b.used}</td>
                          <td className="px-4 py-2.5 text-end text-muted-foreground">{b.pending}</td>
                          <td className="px-4 py-2.5 text-end text-muted-foreground">
                            {isEditing
                              ? setCell(balanceDraft?.adjusted ?? "", (v) => patchBalanceDraft({ adjusted: v }))
                              : b.adjusted}
                          </td>
                          <td className="px-4 py-2.5 text-end font-semibold">
                            <span
                              className={
                                liveRemaining < 0 ? "text-danger" : liveRemaining <= 2 ? "text-warning" : "text-success"
                              }
                            >
                              {liveRemaining}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => void saveBalance(b)}
                                  disabled={savingBalanceId === b.id || savingBalanceId !== null}
                                  aria-label={t.leave_settings.save_changes}
                                >
                                  {savingBalanceId === b.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Check className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={cancelBalanceEdit}
                                  disabled={savingBalanceId !== null}
                                  aria-label={t.common.cancel}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : isReviewer ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => startBalanceEdit(b)}
                                aria-label={t.common.edit}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <span aria-hidden="true" />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Pencil className="h-3.5 w-3.5 shrink-0" />
              {t.leave_settings.balances_note}
            </p>
          </div>
        </div>

        <aside className="space-y-5 lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{t.leave_settings.calendar_source}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{t.leave_settings.calendar_hint}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Badge variant="info" dot>{currentOrg?.holidayCountry || "—"}</Badge>
              {!!currentOrg?.holidayRegion && (
                <Badge variant="secondary" dot>{currentOrg.holidayRegion}</Badge>
              )}
            </div>
            <Link
              href="/dashboard/holidays"
              className="mt-4 inline-flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-medium text-card-foreground transition-colors hover:bg-accent"
            >
              {t.leave_settings.manage_holidays}
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </div>

          {isReviewer && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-20">
              <div className="mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">{t.leave_settings.new_type}</h3>
              </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label={t.leave_settings.name} htmlFor="new-name">
                  <input
                    id="new-name"
                    value={form.name}
                    onChange={(e) => patchForm({ name: e.target.value })}
                    placeholder={t.leave_settings.name}
                    className="input h-10"
                  />
                </Field>
                <Field label={t.leave_settings.code} htmlFor="new-code">
                  <input
                    id="new-code"
                    value={form.code}
                    onChange={(e) => patchForm({ code: e.target.value })}
                    placeholder={t.leave_settings.code}
                    className="input h-10 font-mono uppercase"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t.leave_settings.color} htmlFor="new-color">
                  <input
                    id="new-color"
                    type="color"
                    value={form.color}
                    onChange={(e) => patchForm({ color: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-md border border-input bg-card px-1"
                  />
                </Field>
                <Field label={t.leave_settings.days_per_year} htmlFor="new-days">
                  <input
                    id="new-days"
                    type="number"
                    min={0}
                    step={1}
                    value={form.daysPerYear}
                    onChange={(e) => patchForm({ daysPerYear: Math.max(0, toNumber(e.target.value)) })}
                    className="input h-10"
                  />
                </Field>
                <Field label={t.leave_settings.carry_over} htmlFor="new-carry">
                  <input
                    id="new-carry"
                    type="number"
                    min={0}
                    step={1}
                    value={form.carryOverDays}
                    onChange={(e) => patchForm({ carryOverDays: Math.max(0, toNumber(e.target.value)) })}
                    className="input h-10"
                  />
                </Field>
                <Field label={t.leave_settings.accrual_per_month} htmlFor="new-accrual">
                  <input
                    id="new-accrual"
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.accrualPerMonth}
                    onChange={(e) => patchForm({ accrualPerMonth: Math.max(0, toNumber(e.target.value)) })}
                    className="input h-10"
                  />
                </Field>
              </div>

              <div className="flex flex-wrap gap-2">
                <ToggleRow checked={form.isPaid} onChange={(v) => patchForm({ isPaid: v })} label={t.leave_settings.is_paid} />
                <ToggleRow
                  checked={form.requiresApproval}
                  onChange={(v) => patchForm({ requiresApproval: v })}
                  label={t.leave_settings.requires_approval}
                />
                <ToggleRow checked={form.isActive} onChange={(v) => patchForm({ isActive: v })} label={t.leave_settings.is_active} />
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {form.daysPerYear} {t.leave.days} · {t.leave_settings.accrual_per_month}: {form.accrualPerMonth}
                </span>
              </div>

              <Button className="w-full" size="sm" onClick={create} disabled={saving || loading}>
                {saving && savingId === "__new__" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {saving && savingId === "__new__" ? t.leave_settings.creating : t.leave_settings.create}
              </Button>
            </div>
          </div>
          )}
        </aside>
      </div>
    </div>
  )
}