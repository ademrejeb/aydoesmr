"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  Activity,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  FolderKanban,
  GitBranch,
  HeartPulse,
  Loader2,
  MessageSquare,
  Plus,
  ScanSearch,
  ShieldAlert,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type DevScan, type DevIssue, type Project } from "@/lib/api"
import { useI18n } from "@/lib/i18n"
import { useToast } from "@/lib/toast-context"
import { timeAgo } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { StatCard } from "@/components/ui/stat-card"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { Badge } from "@/components/ui/badge"
import { ManagerAssistant } from "@/components/platform/manager-assistant"

export default function DashboardPage() {
  const { token, currentOrg, user } = useAuth()
  const { t, locale } = useI18n()
  const toast = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [scans, setScans] = useState<DevScan[]>([])
  const [issues, setIssues] = useState<DevIssue[]>([])
  const [loading, setLoading] = useState(true)

  const miHistory = scans
    .filter((s) => s.status === "SUCCESS")
    .map((s) => s.metrics?.maintainability_index ?? 0)
  const latestMI = miHistory.length > 0 ? miHistory[miHistory.length - 1] : null

  const load = useCallback(async () => {
    if (!token || !currentOrg) {
      setLoading(false)
      return
    }
    try {
      const [p, s, i] = await Promise.all([
        api.listProjects(token, currentOrg.id),
        api.listScans(token, currentOrg.id).catch(() => [] as DevScan[]),
        api.listIssues(token, currentOrg.id).catch(() => [] as DevIssue[]),
      ])
      setProjects(p)
      setScans(s)
      setIssues(i)
    } catch {
      toast.error(t.errors.network_error)
    } finally {
      setLoading(false)
    }
  }, [token, currentOrg, toast, t.errors.network_error])

  useEffect(() => {
    load()
  }, [load])

  const firstName = (user?.fullName ?? user?.email ?? "").split(/[ @]/)[0]

  return (
    <div className="space-y-6">
      <section className="hero-gradient relative overflow-hidden rounded-2xl p-6 text-white md:p-8">
        <div className="pointer-events-none absolute -end-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-28 end-32 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <div className="relative z-hero">
          {currentOrg && (
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">{currentOrg.name}</p>
          )}
          <h2 className="mt-1 text-2xl font-extrabold leading-tight md:text-3xl">
            {t.platform.welcome}
            {firstName ? `, ${firstName}` : ""}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-white/85 md:text-base">{t.overview.subheading}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/dashboard/dev">
              <Button className="border-transparent bg-white text-slate-900 hover:bg-white/90">
                <ScanSearch className="h-4 w-4" />
                {t.dev.analyze}
              </Button>
            </Link>
            <Link href="/dashboard/projects?new=1">
              <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                <Plus className="h-4 w-4" />
                {t.platform.new_project}
              </Button>
            </Link>
            <Link href="/dashboard/repositories?new=1">
              <Button variant="outline" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
                <GitBranch className="h-4 w-4" />
                {t.platform.new_repository}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<FolderKanban className="h-4 w-4" />}
          label={t.overview.projects_count}
          value={loading ? <Skeleton className="h-7 w-12" /> : projects.length}
          hint={t.platform.projects}
        />
        <StatCard
          icon={<ShieldAlert className="h-4 w-4" />}
          label={t.overview.issues_count}
          value={
            loading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <span className={issues.length > 0 ? "text-danger" : "text-success"}>{issues.length}</span>
            )
          }
          hint={issues.length > 0 ? t.platform.issues : t.dev.no_issues}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label={t.dev.recent_scans}
          value={loading ? <Skeleton className="h-7 w-12" /> : scans.length}
          hint={t.dev.scan_now}
        />
        <StatCard
          icon={<HeartPulse className="h-4 w-4" />}
          label={t.dev.code_health}
          value={
            loading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <span className="flex items-end gap-2">
                <span className="text-success">{latestMI !== null ? Math.round(latestMI) : "—"}</span>
                {miHistory.length >= 2 && <MiniTrend values={miHistory} color="#16a34a" />}
              </span>
            )
          }
          hint={latestMI !== null ? t.dev.maintainability : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">{t.dev.recent_scans}</h3>
            <Link
              href="/dashboard/dev"
              className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
            >
              {t.dev.scan_now}
              <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : scans.length === 0 ? (
            <EmptyState
              icon={ScanSearch}
              title={t.dev.no_issues}
              description={t.dev.subtitle}
              action={
                <Link href="/dashboard/dev">
                  <Button size="sm">
                    <ScanSearch className="h-4 w-4" />
                    {t.dev.scan_now}
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="space-y-2">
              {scans.slice(0, 6).map((scan) => {
                const StatusIcon =
                  scan.status === "SUCCESS" ? CircleCheck : scan.status === "FAILED" ? CircleAlert : Loader2
                return (
                  <div
                    key={scan.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm card-hover"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <StatusIcon
                        className={
                          scan.status === "SUCCESS"
                            ? "h-4 w-4 shrink-0 text-success"
                            : scan.status === "FAILED"
                              ? "h-4 w-4 shrink-0 text-danger"
                              : "h-4 w-4 shrink-0 animate-spin text-warning"
                        }
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {scan.project?.name ?? scan.repository?.name ?? t.dev.inline}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {scan.linesAnalyzed?.toLocaleString(locale) ?? 0} LOC · {scan.issues?.length ?? 0} {t.platform.issues}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeAgo(scan.createdAt, locale)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">{t.platform.new}</h3>
          <div className="space-y-2">
            <QuickAction
              icon={<FolderKanban className="h-4 w-4" />}
              title={t.platform.new_project}
              description={t.projects.title}
              href="/dashboard/projects?new=1"
            />
            <QuickAction
              icon={<GitBranch className="h-4 w-4" />}
              title={t.platform.new_repository}
              description={t.platform.repositories}
              href="/dashboard/repositories?new=1"
            />
            <QuickAction
              icon={<MessageSquare className="h-4 w-4" />}
              title={t.platform.new_message}
              description={t.platform.messages}
              href="/dashboard/messages?new=1"
            />
            <QuickAction
              icon={<ScanSearch className="h-4 w-4" />}
              title={t.dev.analyze}
              description={t.dev.subtitle}
              href="/dashboard/dev"
            />
          </div>

          {["MANAGER", "ADMIN", "OWNER"].includes(currentOrg?.role ?? "") && <ManagerAssistant />}

          {issues.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">{t.platform.issues}</h4>
                <Link href="/dashboard/dev/issues" className="text-xs font-medium text-primary hover:underline">
                  {t.projects.view}
                </Link>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((sev) => {
                  const count = issues.filter((i) => i.severity === sev).length
                  if (count === 0) return null
                  return (
                    <Badge
                      key={sev}
                      variant={sev === "CRITICAL" || sev === "HIGH" ? "danger" : sev === "MEDIUM" ? "warning" : "success"}
                      dot
                    >
                      {count} {t.results[`severity_${sev.toLowerCase()}` as "severity_critical"]}
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function QuickAction({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 shadow-sm card-hover"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
    </Link>
  )
}

function MiniTrend({ values, color }: { values: number[]; color: string }) {
  const W = 72
  const H = 24
  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = max - min || 1
  const points = values
    .map((v, i) => `${(i / Math.max(values.length - 1, 1)) * W},${H - ((v - min) / span) * (H - 4) - 2}`)
    .join(" ")
  return (
    <svg width={W} height={H} className="shrink-0" aria-label="trend">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}