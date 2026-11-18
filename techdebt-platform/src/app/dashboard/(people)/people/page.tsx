"use client"

import Link from "next/link"
import {
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  CalendarClock,
  PartyPopper,
  Settings2,
  Users,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { atLeast } from "@/lib/access"
import { Badge } from "@/components/ui/badge"

const COPY = {
  ar: {
    eyebrow: "العمليات",
    title: "الأشخاص",
    subtitle: "الوقت، الإجازات، الرواتب والفرق — كل ما يخص الفريق في مكان واحد.",
    myWork: "عملي",
    admin: "إدارة الفريق",
    open: "فتح",
    manager: "مدير+",
    cards: {
      timesheet: "سجّل ساعاتك الأسبوعية وقدّمها للاعتماد.",
      leave: "اطلب إجازة وتابع رصيدك وحالة الطلبات.",
      holidays: "أيام العطل الرسمية للشركة والسنة.",
      payroll: "مسير الرواتب، الكشوف والاعتمادات.",
      teams: "الفرق والأعضاء والمسؤوليات.",
      leaveSettings: "أنواع الإجازات والأرصدة والسياسات.",
    },
  },
  fr: {
    eyebrow: "Opérations",
    title: "Personnes",
    subtitle: "Temps, congés, paie et équipes — tout l’espace RH au même endroit.",
    myWork: "Mon travail",
    admin: "Administration",
    open: "Ouvrir",
    manager: "Manager+",
    cards: {
      timesheet: "Saisissez et soumettez vos heures hebdomadaires.",
      leave: "Demandez un congé et suivez votre solde.",
      holidays: "Jours fériés et fermetures de l’entreprise.",
      payroll: "Cycles de paie, bulletins et approbations.",
      teams: "Équipes, membres et responsabilités.",
      leaveSettings: "Types de congés, soldes et politiques.",
    },
  },
  en: {
    eyebrow: "Operations",
    title: "People",
    subtitle: "Time, leave, payroll and teams — the whole HR surface in one place.",
    myWork: "My work",
    admin: "Administration",
    open: "Open",
    manager: "Manager+",
    cards: {
      timesheet: "Log and submit your weekly hours.",
      leave: "Request leave and track balances and decisions.",
      holidays: "Company holidays and non-working days.",
      payroll: "Payroll runs, payslips and approvals.",
      teams: "Teams, members and responsibilities.",
      leaveSettings: "Leave types, balances and policies.",
    },
  },
} as const

export default function PeopleOverviewPage() {
  const { currentOrg } = useAuth()
  const { locale, t } = useI18n()
  const c = COPY[locale as keyof typeof COPY] ?? COPY.en
  const canManage = atLeast(currentOrg?.role, "MANAGER")

  const cards = [
    { href: "/dashboard/timesheet", label: t.platform.timesheet, description: c.cards.timesheet, icon: CalendarClock },
    { href: "/dashboard/leave", label: t.platform.leave, description: c.cards.leave, icon: CalendarCheck },
    { href: "/dashboard/holidays", label: t.platform.holidays, description: c.cards.holidays, icon: PartyPopper },
    { href: "/dashboard/teams", label: t.platform.teams, description: c.cards.teams, icon: Users },
    ...(canManage
      ? [
          { href: "/dashboard/payroll", label: t.platform.payroll, description: c.cards.payroll, icon: Banknote, admin: true },
          { href: "/dashboard/leave/settings", label: t.platform.leave_settings, description: c.cards.leaveSettings, icon: Settings2, admin: true },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 md:p-8">
        <div className="pointer-events-none absolute -end-20 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative z-hero max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{c.eyebrow}</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">{c.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">{c.subtitle}</p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex min-h-36 flex-col justify-between rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{card.label as string}</h2>
                  {card.admin && <Badge variant="outline">{c.manager}</Badge>}
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{card.description}</p>
                <span className="mt-3 inline-flex text-[11px] font-semibold text-primary">{c.open}</span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
