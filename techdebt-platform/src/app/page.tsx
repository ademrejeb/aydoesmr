"use client"

import Link from "next/link"
import {
  Activity,
  ArrowRight,
  GitBranch,
  KanbanSquare,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useI18n, LOCALES, LOCALE_LABELS, type Dictionary } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

const NAV_LINKS: { href: string; label: string }[] = [
  { href: "/dashboard", label: "dashboard" },
  { href: "/dashboard/dev", label: "dev" },
  { href: "/dashboard/repositories", label: "repositories" },
  { href: "/dashboard/teams", label: "teams" },
]

function linkLabel(key: string, t: Dictionary): string {
  switch (key) {
    case "dashboard":
      return t.nav.dashboard
    case "dev":
      return t.platform.dev
    case "repositories":
      return t.platform.repositories
    case "teams":
      return t.platform.teams
    default:
      return key
  }
}

const FEATURES = [
  {
    icon: ScanSearch,
    title: "AI-powered code scanning",
    text: "Identify technical debt, complexity, and security issues across your codebase in seconds with the Rust analysis engine.",
  },
  {
    icon: GitBranch,
    title: "Hosted Git repositories",
    text: "Create repositories, track branches and commits, and run automated quality scans on every push.",
  },
  {
    icon: Users,
    title: "Focused team collaboration",
    text: "Real-time messaging, shared projects, and notifications keep everyone aligned — in Arabic, English, or French.",
  },
  {
    icon: KanbanSquare,
    title: "Agile project management",
    text: "Plan sprints, manage boards and backlogs, and track epics with story-point estimation built in.",
  },
  {
    icon: Activity,
    title: "Code health metrics",
    text: "Maintainability index, cyclomatic complexity, and issue triage — all surfaced in a single dashboard.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by design",
    text: "Role-based access controls, organization-level permissions, and hosted Git keep your work protected.",
  },
]

export default function Home() {
  const { locale, t, dir, setLocale } = useI18n()
  const { token } = useAuth()
  const appHref = token ? "/dashboard" : "/login"

  return (
    <div className="flex min-h-screen flex-col" dir={dir}>
      <header className="sticky top-0 z-flyout border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
            <div className="hero-gradient flex h-9 w-9 items-center justify-center rounded-lg text-lg font-black text-white">
              T
            </div>
            <span className="text-base font-bold">{t.nav.title}</span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {linkLabel(link.label, t)}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-0.5">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer",
                    locale === l
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {LOCALE_LABELS[l]}
                </button>
              ))}
            </div>
            <Link
              href={appHref}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {token ? t.nav.dashboard : t.auth.sign_in}
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-40 start-1/2 h-[30rem] w-[30rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl rtl:translate-x-1/2" />
            <div className="absolute -bottom-32 -end-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -start-28 top-24 h-72 w-72 rounded-full bg-accent blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 md:pb-28 md:pt-24">
            <Badge variant="outline" className="mx-auto gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              {t.nav.subtitle}
            </Badge>
            <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
              {t.hero.title}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
              {t.hero.description}
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={appHref}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {t.hero.analyze_now}
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
              <Link
                href={appHref}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 text-base font-semibold text-foreground shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {token ? t.platform.overview : t.auth.sign_in}
              </Link>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <Badge className="mb-4">{t.platform.workspace}</Badge>
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Everything your team needs</h2>
            <p className="mt-3 text-base text-muted-foreground">
              {t.hero.description}
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card-hover flex flex-col rounded-2xl border border-border bg-card p-6 shadow-sm"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 md:pb-28">
          <div className="hero-gradient relative overflow-hidden rounded-3xl px-6 py-12 text-center md:px-12 md:py-16">
            <div aria-hidden className="pointer-events-none absolute inset-0">
              <div className="absolute -top-24 start-10 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
              <div className="absolute -bottom-28 end-6 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-extrabold leading-tight text-white md:text-4xl">
                Ready to ship your team with a clean codebase?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/85">
                Sign in and run your first analysis — complexity, security, maintainability, and more.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href={appHref}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-white px-6 text-base font-semibold text-black shadow-lg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
                >
                  {t.hero.analyze_now}
                  <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                </Link>
                <Link
                  href={appHref}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/10 px-6 text-base font-semibold text-white backdrop-blur transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2"
                >
                  {t.nav.dashboard}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 py-10 sm:flex-row sm:px-6">
          <div className="flex items-center gap-3">
            <div className="hero-gradient flex h-9 w-9 items-center justify-center rounded-lg text-lg font-black text-white">
              T
            </div>
            <div>
              <p className="text-sm font-bold">{t.nav.title}</p>
              <p className="text-xs text-muted-foreground">
                {t.footer.built_with} {t.footer.rust_go_next}
              </p>
            </div>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {linkLabel(link.label, t)}
              </Link>
            ))}
          </nav>

          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {t.nav.title}
          </p>
        </div>
      </footer>
    </div>
  )
}