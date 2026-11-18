"use client"

import { Banknote, CalendarCheck, CalendarClock, LayoutGrid, PartyPopper, Users } from "lucide-react"
import { SectionTabs, type SectionTab } from "@/components/platform/section-tabs"

const tabs: SectionTab[] = [
  { href: "/dashboard/people", label: "people", icon: LayoutGrid },
  { href: "/dashboard/timesheet", label: "timesheet", icon: CalendarClock, nested: true },
  { href: "/dashboard/leave", label: "leave", icon: CalendarCheck, nested: true },
  { href: "/dashboard/holidays", label: "holidays", icon: PartyPopper, nested: true },
  { href: "/dashboard/payroll", label: "payroll", icon: Banknote, min: "MANAGER" },
  { href: "/dashboard/teams", label: "teams", icon: Users, nested: true },
]

export default function PeopleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SectionTabs tabs={tabs} ariaLabel="People operations" />
      {children}
    </div>
  )
}
