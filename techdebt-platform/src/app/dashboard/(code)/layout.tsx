"use client"

import { Activity, GitBranch, ShieldAlert, SlidersHorizontal } from "lucide-react"
import { SectionTabs, type SectionTab } from "@/components/platform/section-tabs"

const tabs: SectionTab[] = [
  { href: "/dashboard/dev", label: "dev", icon: Activity },
  { href: "/dashboard/dev/rules", label: "dev_rules", icon: SlidersHorizontal, nested: true },
  { href: "/dashboard/dev/issues", label: "issues", icon: ShieldAlert, nested: true },
  { href: "/dashboard/repositories", label: "repositories", icon: GitBranch, nested: true },
]

export default function CodeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SectionTabs tabs={tabs} ariaLabel="Code health" />
      {children}
    </div>
  )
}
