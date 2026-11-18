"use client"

import { BookOpenText, ClipboardList, Headset, Settings2, ShoppingBag, Siren } from "lucide-react"
import { SectionTabs, type SectionTab } from "@/components/platform/section-tabs"

const tabs: SectionTab[] = [
  { href: "/dashboard/service-desk", label: "service_desk", icon: Headset },
  { href: "/dashboard/service-desk/requests", label: "service_requests", icon: ClipboardList, nested: true },
  { href: "/dashboard/service-desk/incidents", label: "service_incidents", icon: Siren, nested: true },
  { href: "/dashboard/service-desk/knowledge", label: "service_knowledge", icon: BookOpenText, nested: true },
  { href: "/dashboard/service-desk/catalog", label: "service_catalog", icon: ShoppingBag, nested: true },
  { href: "/dashboard/service-desk/sla", label: "service_sla", icon: Settings2, nested: true },
]

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SectionTabs tabs={tabs} ariaLabel="Service desk" />
      {children}
    </div>
  )
}
