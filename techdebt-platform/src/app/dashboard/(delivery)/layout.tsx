"use client"

import { Server, Workflow } from "lucide-react"
import { SectionTabs, type SectionTab } from "@/components/platform/section-tabs"

const tabs: SectionTab[] = [
  { href: "/dashboard/pipelines", label: "pipelines", icon: Workflow, nested: true },
  { href: "/dashboard/servers", label: "servers", icon: Server, nested: true },
]

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SectionTabs tabs={tabs} ariaLabel="Delivery" />
      {children}
    </div>
  )
}
