"use client"

import { useCallback, useEffect, useState } from "react"
import { Clock, Loader2, RotateCcw, Save } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type ServicePriority, type SlaPolicy } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PRIORITIES, priorityLabel, PriorityBadge } from "@/components/service-desk/service-desk-ui"

const DEFAULTS: Record<ServicePriority, { response: number; resolve: number; business: boolean }> = {
  P1: { response: 15, resolve: 240, business: false },
  P2: { response: 60, resolve: 480, business: false },
  P3: { response: 240, resolve: 1440, business: true },
  P4: { response: 480, resolve: 2880, business: true },
}

function toHours(minutes: number): string {
  const h = minutes / 60
  return Number.isInteger(h) ? `${h}` : h.toFixed(1)
}

export default function ServiceSlaPage() {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const toast = useToast()
  const [policies, setPolicies] = useState<SlaPolicy[]>([])
  const [draft, setDraft] = useState<Record<string, { response: string; resolve: string; business: boolean }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const canManage = currentOrg?.role === "OWNER" || currentOrg?.role === "ADMIN" || currentOrg?.role === "MANAGER"

  const load = useCallback(async () => {
    if (!token || !currentOrg) return
    setLoading(true)
    try {
      const list = await api.listSlaPolicies(token, currentOrg.id)
      setPolicies(list)
      setDraft(
        Object.fromEntries(
          list.map((policy) => [
            policy.priority,
            { response: String(policy.responseMinutes), resolve: String(policy.resolveMinutes), business: policy.businessHoursOnly },
          ])
        )
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg, toast])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (policy: SlaPolicy) => {
    if (!token || !currentOrg) return
    const values = draft[policy.priority]
    const response = Number(values?.response)
    const resolve = Number(values?.resolve)
    if (!Number.isFinite(response) || !Number.isFinite(resolve) || response < 1 || resolve < response) {
      toast.error(`${t.service.respond_target} / ${t.service.resolve_target}`)
      return
    }
    setSaving(policy.priority)
    try {
      const updated = await api.updateSlaPolicy(
        {
          priority: policy.priority,
          name: policy.name,
          responseMinutes: Math.round(response),
          resolveMinutes: Math.round(resolve),
          businessHoursOnly: Boolean(values?.business),
        },
        token,
        currentOrg.id
      )
      setPolicies((list) => list.map((p) => (p.priority === updated.priority ? updated : p)))
      toast.success(t.service.sla_save)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "error")
    } finally {
      setSaving(null)
    }
  }

  const restore = (policy: SlaPolicy) => {
    const fallback = DEFAULTS[policy.priority]
    setDraft((d) => ({ ...d, [policy.priority]: { response: String(fallback.response), resolve: String(fallback.resolve), business: fallback.business } }))
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold">{t.service.sla}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.service.sla_defaults_hint}</p>
      </header>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {PRIORITIES.map((priority) => {
            const policy = policies.find((p) => p.priority === priority)
            const values = draft[priority]
            if (!policy || !values) return null
            const fallback = DEFAULTS[priority]
            const dirty =
              Number(values.response) !== policy.responseMinutes ||
              Number(values.resolve) !== policy.resolveMinutes ||
              values.business !== policy.businessHoursOnly
            const hint: Record<ServicePriority, string> = {
              P1: t.service.p1_hint,
              P2: t.service.p2_hint,
              P3: t.service.p3_hint,
              P4: t.service.p4_hint,
            }
            return (
              <Card key={priority} className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <PriorityBadge priority={priority} t={t} />
                  <span className="text-sm font-semibold">{policy.name}</span>
                  {policy.custom && <Badge variant="info">{t.common.edit}</Badge>}
                  {!policy.active && <Badge variant="outline">{t.service.inactive}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{hint[priority]}</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    {t.service.respond_target} ({t.service.minutes_unit})
                    <input
                      type="number"
                      min={1}
                      disabled={!canManage}
                      value={values.response}
                      onChange={(e) => setDraft((d) => ({ ...d, [priority]: { ...values, response: e.target.value } }))}
                      className="input mt-1"
                    />
                    <span className="mt-1 block font-normal">
                      ≈ {toHours(Number(values.response) || 0)}h
                    </span>
                  </label>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    {t.service.resolve_target} ({t.service.minutes_unit})
                    <input
                      type="number"
                      min={1}
                      disabled={!canManage}
                      value={values.resolve}
                      onChange={(e) => setDraft((d) => ({ ...d, [priority]: { ...values, resolve: e.target.value } }))}
                      className="input mt-1"
                    />
                    <span className="mt-1 block font-normal">
                      ≈ {toHours(Number(values.resolve) || 0)}h
                    </span>
                  </label>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    disabled={!canManage}
                    checked={values.business}
                    onChange={(e) => setDraft((d) => ({ ...d, [priority]: { ...values, business: e.target.checked } }))}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                  <Clock className="h-3.5 w-3.5" />
                  {t.service.business_hours_only}
                </label>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" disabled={!dirty || saving !== null} onClick={() => void save(policy)}>
                      {saving === priority ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : <Save className="me-1.5 h-4 w-4" />}
                      {t.common.save}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restore(policy)}
                      disabled={Number(values.response) === fallback.response && Number(values.resolve) === fallback.resolve}
                    >
                      <RotateCcw className="me-1.5 h-4 w-4" />
                      {t.service.restore_defaults}
                    </Button>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}