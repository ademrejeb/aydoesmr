"use client"

import { Bot, BrainCircuit, Factory } from "lucide-react"
import { SectionTabs, type SectionTab } from "@/components/platform/section-tabs"

const tabs: SectionTab[] = [
  { href: "/dashboard/factory", label: "factory", icon: Factory, nested: true },
  { href: "/dashboard/agents", label: "agent_factory", icon: Bot, nested: true },
  { href: "/dashboard/ai", label: "ai", icon: BrainCircuit, nested: true },
]

export default function FactoryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SectionTabs tabs={tabs} ariaLabel="Software factory" />
      {children}
    </div>
  )
}
