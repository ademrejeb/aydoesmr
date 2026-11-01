import { cn } from "@/lib/utils"

export function StatCard({
  icon,
  label,
  value,
  hint,
  trend,
  trendUp,
  className,
}: {
  icon: React.ReactNode
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  trend?: string
  trendUp?: boolean
  className?: string
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm card-hover", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-muted-foreground">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight">{value}</div>
      {(trend || hint) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {trend && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                trendUp ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
              )}
            >
              {trend}
            </span>
          )}
          {hint && <span className="block min-w-0 flex-1 truncate">{hint}</span>}
        </div>
      )}
    </div>
  )
}