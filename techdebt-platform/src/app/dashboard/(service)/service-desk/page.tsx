"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  ClipboardList,
  Gauge,
  Siren,
  Star,
  Timer,
  TriangleAlert,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type ServiceDeskOverview } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { StatCard } from "@/components/ui/stat-card"
import { formatDateTime, PRIORITIES, PriorityBadge } from "@/components/service-desk/service-desk-ui"

export default function ServiceDeskOverviewPage() {
  const { token, currentOrg } = useAuth()
  const { t } = useI18n()
  const [data, setData] = useState<ServiceDeskOverview | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!token || !currentOrg) return
    setLoading(true)
    try {
      setData(await api.serviceOverview(token, currentOrg.id))
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg])

  useEffect(() => {
    void load()
  }, [load])

  const openIncidents = data?.incidents.open ?? 0
  const totalIncidents = data?.incidents.total ?? 0
  const requestTotal = data?.requests.total ?? 0
  const openRequests = data?.requests.open ?? 0

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold">
            {t.service.title}
            <Badge variant="outline" className="font-normal">
              {t.service.overview}
            </Badge>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.service.subtitle}</p>
        </div>
        <a
          href="/support"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {t.service.link_portal}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </header>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : !data ? (
        <EmptyState icon={TriangleAlert} title="Error" description={t.service.subtitle} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<ClipboardList className="h-4 w-4" />}
              label={t.service.open_tickets}
              value={openRequests + openIncidents}
              hint={`${requestTotal} ${t.service.requests} · ${totalIncidents} ${t.service.incidents}`}
            />
            <StatCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label={t.service.pending_approvals}
              value={data.requests.pendingApprovals}
              hint={t.service.approval_required_hint}
            />
            <StatCard
              icon={<TriangleAlert className="h-4 w-4" />}
              label={t.service.breached_incidents}
              value={data.incidents.breached}
              hint={`${data.incidents.unassigned} ${t.service.unassigned}`}
            />
            <StatCard
              icon={<Gauge className="h-4 w-4" />}
              label={t.service.sla_compliance}
              value={data.sla.compliance === null ? "—" : `${data.sla.compliance}%`}
              hint={`${data.sla.measurable} ${t.service.incidents}`}
            />
            <StatCard
              icon={<Timer className="h-4 w-4" />}
              label={t.service.avg_resolution}
              value={data.sla.avgResolutionHours === null ? "—" : `${data.sla.avgResolutionHours}${t.service.hours_unit}`}
              hint="30d"
            />
            <StatCard
              icon={<Activity className="h-4 w-4" />}
              label={t.service.avg_response}
              value={
                data.sla.avgFirstResponseMinutes === null
                  ? "—"
                  : `${data.sla.avgFirstResponseMinutes}${t.service.minutes_unit}`
              }
              hint={t.service.responded_at}
            />
            <StatCard
              icon={<Star className="h-4 w-4" />}
              label={t.service.satisfaction}
              value={data.satisfaction.average === null ? "—" : `${data.satisfaction.average}/5`}
              hint={`${data.satisfaction.responses} ${t.service.rate_request}`}
            />
            <StatCard
              icon={<Siren className="h-4 w-4" />}
              label={t.service.incidents}
              value={data.incidents.open}
              hint={PRIORITIES.map((p) => `${p}:${data.incidents.byPriority[p] ?? 0}`).join(" · ")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card title={t.service.my_queue} className="lg:col-span-1">
              {Object.values(data.myQueue.requests).reduce((a, b) => a + b, 0) +
                Object.values(data.myQueue.incidents).reduce((a, b) => a + b, 0) ===
              0 ? (
                <p className="text-sm text-muted-foreground">{t.service.filter_all} · 0</p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t.service.requests}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(data.myQueue.requests).length === 0 && (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                      {Object.entries(data.myQueue.requests).map(([status, count]) => (
                        <Badge key={status} variant="secondary">
                          {status}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {t.service.incidents}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(data.myQueue.incidents).length === 0 && (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                      {Object.entries(data.myQueue.incidents).map(([status, count]) => (
                        <Badge key={status} variant="secondary">
                          {status}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            <Card title={t.service.workload} className="lg:col-span-1">
              {data.workload.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.service.unassigned}: {data.incidents.unassigned}</p>
              ) : (
                <ul className="space-y-2">
                  {data.workload.map((row) => (
                    <li key={row.assigneeId ?? "none"} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">
                        {row.name ?? t.service.unassigned}
                      </span>
                      <Badge variant={row.open > 0 ? "default" : "outline"}>{row.open}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card title={t.service.top_items} className="lg:col-span-1">
              {data.topItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.service.no_items}</p>
              ) : (
                <ul className="space-y-2">
                  {data.topItems.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{item.name}</span>
                      <Badge variant="outline">{item.requests}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title={t.service.recent_activity}>
            {data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.service.no_activity}</p>
            ) : (
              <ul className="space-y-3">
                {data.recentActivity.map((activity) => (
                  <li key={activity.id} className="flex items-start gap-3 text-sm">
                    <AvatarDot name={activity.author} />
                    <div className="min-w-0 flex-1">
                      <p className="min-w-0 break-words">
                        <span className="font-semibold">{activity.author}</span>
                        {activity.reference && (
                          <span className="ms-1.5 font-mono text-xs text-muted-foreground">{activity.reference}</span>
                        )}
                      </p>
                      <p className="min-w-0 break-words text-muted-foreground">{activity.body}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(activity.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

        </>
      )}
    </div>
  )
}

function AvatarDot({ name }: { name: string }) {
  return (
    <span className="hero-gradient flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white">
      {(name ?? "?").trim().charAt(0).toUpperCase()}
    </span>
  )
}