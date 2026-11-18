"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { CalendarDays, Check, Loader2, PartyPopper, Save, Search } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type CompanyOffDay, type Holiday, type HolidaySource } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"

function formatDateKey(dateKey: string, locale: string): string {
  const [y, m, d] = dateKey.split("-").map(Number)
  if (!y || !m || !d) return dateKey
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" })
}

export default function HolidaysPage() {
  const { token, currentOrg } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()

  const initialYear = new Date().getFullYear()

  const [year, setYear] = useState(initialYear)
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [sources, setSources] = useState<HolidaySource[]>([])
  const [country, setCountry] = useState("")
  const [region, setRegion] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [offDays, setOffDays] = useState<Map<string, CompanyOffDay>>(new Map())
  const [togglingOff, setTogglingOff] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const orgId = currentOrg?.id
  const authToken = token ?? ""
  const canManage = currentOrg?.role === "MANAGER" || currentOrg?.role === "ADMIN" || currentOrg?.role === "OWNER"

  const orgCountry = currentOrg?.holidayCountry ?? ""
  const orgRegion = currentOrg?.holidayRegion ?? ""

  useEffect(() => {
    if (!orgCountry || sources.length === 0) return
    setCountry((c) => c || orgCountry)
    setRegion((r) => r || orgRegion)
  }, [orgCountry, orgRegion, sources.length])

  useEffect(() => {
    if (!authToken || !orgId) {
      setLoading(false)
      return
    }
    api
      .listHolidaySources(authToken, orgId, locale)
      .then((list) => {
        setSources(Array.isArray(list) ? list : [])
      })
      .catch(() => setSources([]))
  }, [authToken, orgId, locale])

  const load = useCallback(
    async (yr: number, countryCode: string, regionCode: string) => {
      if (!authToken || !orgId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const data = await api.getHolidays(authToken, orgId, yr, {
          country: countryCode || undefined,
          region: regionCode || undefined,
        })
        const list = Array.isArray(data) ? data : (data as { holidays?: Holiday[] } | null)?.holidays ?? []
        setHolidays(list)
      } catch (err) {
        setHolidays([])
        setError(err instanceof Error ? err.message : t.holidays.error_load)
      } finally {
        setLoading(false)
      }
    },
    [authToken, orgId, t.holidays.error_load]
  )

  useEffect(() => {
    void load(initialYear, country, region)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialYear])

  const loadOffDays = useCallback(
    async (yr: number) => {
      if (!authToken || !orgId) return
      try {
        const list = await api.listOffDays(authToken, orgId, yr)
        setOffDays(new Map((Array.isArray(list) ? list : []).map((o) => [o.date, o])))
      } catch {
        setOffDays(new Map())
      }
    },
    [authToken, orgId]
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadOffDays(year)
  }, [year, loadOffDays])

  const toggleOffDay = async (holiday: Holiday) => {
    if (!authToken || !orgId) return
    const selected = offDays.has(holiday.date)
    setTogglingOff(holiday.date)
    try {
      if (selected) {
        await api.removeOffDay(authToken, orgId, holiday.date)
        setOffDays((prev) => {
          const next = new Map(prev)
          next.delete(holiday.date)
          return next
        })
      } else {
        await api.addOffDay(authToken, orgId, { date: holiday.date, name: holiday.name })
        setOffDays((prev) => {
          const next = new Map(prev)
          next.set(holiday.date, { date: holiday.date, name: holiday.name })
          return next
        })
      }
    } catch {
      toast.error(t.holidays.off_day_toggle_error)
    } finally {
      setTogglingOff(null)
    }
  }

  const search = (yr = year) => {
    if (yr >= 1900 && yr <= 2200) void load(yr, country, region)
  }

  const onCountryChange = (code: string) => {
    setCountry(code)
    setRegion("")
    void load(year, code, "")
  }

  const onRegionChange = (code: string) => {
    setRegion(code)
    void load(year, country, code)
  }

  const saveDefaults = async () => {
    if (!authToken || !orgId || !country) return
    setSaving(true)
    try {
      await api.updateOrganization(authToken, orgId, {
        holidayCountry: country,
        holidayRegion: region || undefined,
      })
      toast.success(t.holidays.defaults_saved)
    } catch {
      toast.error(t.holidays.defaults_error)
    } finally {
      setSaving(false)
    }
  }

  const selectedSource = sources.find((s) => s.code === country)
  const hasRegions = (selectedSource?.regions.length ?? 0) > 0

  const byMonth = useMemo(() => {
    if (holidays.length === 0) return [] as { month: number; items: Holiday[] }[]
    const groups = Array.from({ length: 12 }, (_, i) => ({ month: i, items: [] as Holiday[] }))
    const list = Array.isArray(holidays) ? holidays : []
    for (const h of list) {
      const m = parseInt(h.date.slice(5, 7), 10) - 1
      if (m >= 0 && m < 12) groups[m].items.push(h)
    }
    return groups.filter((g) => g.items.length > 0)
  }, [holidays])

  const total = Array.isArray(holidays) ? holidays.length : 0
  const sourceCountry = Array.isArray(holidays) ? holidays.find((h) => h.source)?.source : undefined

  return (
    <div className="space-y-6">
      <section className="hero-gradient relative overflow-hidden rounded-2xl p-6 text-white md:p-8">
        <div className="pointer-events-none absolute -end-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-hero">
          <p className="text-xs font-medium uppercase tracking-wider text-white/70">{t.platform.holidays}</p>
          <h2 className="mt-1 text-2xl font-extrabold leading-tight md:text-3xl">{t.holidays.title}</h2>
          <p className="mt-2 max-w-xl text-sm text-white/85 md:text-base">{t.holidays.subtitle}</p>
        </div>
      </section>

      <Card>
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="holiday-country">
              {t.holidays.country}
            </label>
            <select
              id="holiday-country"
              value={country}
              onChange={(e) => onCountryChange(e.target.value)}
              className="input h-10 w-full"
            >
              <option value="">—</option>
              {sources.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="holiday-region">
              {t.holidays.region}
            </label>
            <select
              id="holiday-region"
              value={region}
              onChange={(e) => onRegionChange(e.target.value)}
              className="input h-10 w-full"
              disabled={!hasRegions}
            >
              <option value="">{t.holidays.region_placeholder}</option>
              {selectedSource?.regions.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground" htmlFor="holiday-year">
              {t.holidays.year}
            </label>
            <input
              id="holiday-year"
              type="number"
              min={1990}
              max={2100}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || new Date().getFullYear())}
              placeholder={t.holidays.year_placeholder}
              className="input h-10 w-full"
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <Button onClick={() => search()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {t.holidays.load}
            </Button>
            {canManage && country && (
              <Button variant="outline" onClick={() => void saveDefaults()} disabled={saving || !country}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="hidden sm:inline">{t.platform.settings}</span>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-7 w-40" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-36 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ) : total === 0 ? (
        <EmptyState icon={PartyPopper} title={t.holidays.empty} description={`${t.holidays.year}: ${year}`} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <PartyPopper className="h-4 w-4 shrink-0 text-primary" />
            <h3 className="min-w-0 text-sm font-semibold">
              {total} {t.holidays.holidays} · {year}
            </h3>
            {sourceCountry && <Badge variant="outline" className="ms-auto shrink-0">{sourceCountry}</Badge>}
            {offDays.size > 0 && (
              <Badge variant="danger" dot>
                {t.holidays.off_days_selected.replace("{count}", String(offDays.size))}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {byMonth.map((group) => (
              <div key={group.month} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">{t.holidays.months[group.month]}</p>
                  <Badge variant="secondary" className="ms-auto">{group.items.length}</Badge>
                </div>
                <div className="space-y-2">
                  {group.items.map((h, i) => {
                    const isOff = offDays.has(h.date)
                    return (
                      <div
                        key={`${h.date}-${i}`}
                        className={cn(
                          "flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2",
                          isOff ? "border-primary/40 bg-primary/5" : "border-border/60 bg-muted/30"
                        )}
                      >
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-sm font-medium">
                            {h.name}
                            {isOff && (
                              <Badge variant="danger" dot>
                                {t.holidays.off_day}
                              </Badge>
                            )}
                          </p>
                          {h.localName && h.localName !== h.name && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">{h.localName}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                          <Badge variant={h.type === "public" ? "info" : "secondary"} className="font-mono text-[10px] uppercase">
                            {h.type}
                          </Badge>
                          <Badge variant="outline">{formatDateKey(h.date, locale)}</Badge>
                          {canManage && (
                            <Button
                              size="sm"
                              variant={isOff ? "default" : "outline"}
                              className={cn("h-7 px-2.5 text-xs", isOff && "bg-danger text-white hover:bg-danger/90")}
                              onClick={() => void toggleOffDay(h)}
                              disabled={togglingOff === h.date}
                            >
                              {togglingOff === h.date ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              {isOff ? t.holidays.remove_off_day : t.holidays.mark_off_day}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {canManage && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          {t.holidays.off_day_note}
        </p>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {t.holidays.source_note}
      </p>
    </div>
  )
}