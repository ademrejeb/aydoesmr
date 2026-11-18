"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { LucideIcon } from "lucide-react"
import { useI18n, type Dictionary } from "@/lib/i18n"
import { useAuth } from "@/lib/auth-context"
import { can, atLeast, type OrgRoleName } from "@/lib/access"
import { cn } from "@/lib/utils"

export interface SectionTab {
  href: string
  label: keyof Dictionary["platform"]
  icon: LucideIcon
  /** Exact URL match (default) or match nested routes too. */
  nested?: boolean
  /** Optional capability / minimum role required to see the tab. */
  cap?: string
  min?: OrgRoleName
}

export function SectionTabs({ tabs, ariaLabel }: { tabs: SectionTab[]; ariaLabel: string }) {
  const pathname = usePathname()
  const { t } = useI18n()
  const { currentOrg } = useAuth()
  const role = currentOrg?.role ?? null
  const visible = tabs.filter((tab) => (!tab.cap || can(role, tab.cap)) && (!tab.min || atLeast(role, tab.min)))

  return (
    <div className="mb-5 overflow-x-auto pb-0.5">
      <nav
        aria-label={ariaLabel}
        className="inline-flex min-w-full items-center gap-1 rounded-xl border border-border bg-muted/40 p-1 sm:min-w-0"
      >
        {visible.map((tab) => {
          const Icon = tab.icon
          const active = pathname === tab.href || (tab.nested && pathname.startsWith(`${tab.href}/`))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                active
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", active ? "text-primary" : "text-muted-foreground")} />
              {t.platform[tab.label] as string}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
