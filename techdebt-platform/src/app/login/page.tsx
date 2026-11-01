"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  GitBranch,
  Loader2,
  Lock,
  LogIn,
  Mail,
  ScanSearch,
  UserPlus,
  Users,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useI18n, LOCALES, LOCALE_LABELS } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ERR_FN_REQUIRED = "Full name is required"
const ERR_EMAIL_REQUIRED = "Email is required"
const ERR_EMAIL_INVALID = "Enter a valid email address"
const ERR_PASSWORD_REQUIRED = "Password is required"

interface FieldErrors {
  fullName?: string
  email?: string
  password?: string
}

function AuthField({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  icon,
  trailing,
  autoComplete,
  autoFocus,
}: {
  id: string
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  error?: string
  icon?: React.ComponentType<{ className?: string }>
  trailing?: React.ReactNode
  autoComplete?: string
  autoFocus?: boolean
}) {
  return (
    <Field id={id} label={label} error={error}>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        icon={icon}
        trailing={trailing}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        invalid={Boolean(error)}
      />
    </Field>
  )
}

const BRAND_FEATURES = [
  {
    icon: ScanSearch,
    title: "AI code scanning",
    text: "Detect technical debt and security issues before they ship.",
  },
  {
    icon: GitBranch,
    title: "Hosted Git & scans",
    text: "Repositories, branches, and automated quality checks in one place.",
  },
  {
    icon: Users,
    title: "Team collaboration",
    text: "Projects, boards, sprints, and messaging — truly unified.",
  },
]

export default function LoginPage() {
  const { locale, t, dir, setLocale } = useI18n()
  const { login, register, loading } = useAuth()
  const router = useRouter()

  const [mode, setMode] = useState<"login" | "register">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const switchMode = (m: "login" | "register") => {
    setMode(m)
    setErrors({})
    setError(null)
  }

  const validate = (): boolean => {
    const next: FieldErrors = {}
    if (mode === "register" && !fullName.trim()) next.fullName = ERR_FN_REQUIRED
    if (!email.trim()) next.email = ERR_EMAIL_REQUIRED
    else if (!EMAIL_RE.test(email.trim())) next.email = ERR_EMAIL_INVALID
    if (!password) next.password = ERR_PASSWORD_REQUIRED
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (!validate()) return
    setSubmitting(true)
    setError(null)
    try {
      if (mode === "login") {
        await login(email.trim(), password)
      } else {
        await register(email.trim(), password, fullName.trim(), locale)
      }
      router.push("/dashboard")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t.auth.err_generic)
    } finally {
      setSubmitting(false)
    }
  }

  const passwordTrailing = (
    <button
      type="button"
      onClick={() => setShowPass((v) => !v)}
      aria-label={showPass ? "Hide password" : "Show password"}
      className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
    >
      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  )

  return (
    <div className="flex min-h-screen flex-col lg:flex-row" dir={dir}>
      <aside className="hero-gradient relative hidden overflow-hidden lg:flex lg:w-1/2 lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -start-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-32 -end-16 h-96 w-96 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute end-10 top-1/3 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        </div>

        <div className="relative z-hero flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl font-black text-white backdrop-blur-sm">
            T
          </div>
          <div>
            <p className="text-lg font-bold leading-tight text-white">{t.nav.title}</p>
            <p className="text-xs text-white/75">{t.nav.subtitle}</p>
          </div>
        </div>

        <div className="relative z-hero">
          <h2 className="max-w-lg text-3xl font-extrabold leading-tight text-white xl:text-4xl">{t.hero.title}</h2>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-white/85">{t.hero.description}</p>

          <ul className="mt-10 space-y-5">
            {BRAND_FEATURES.map((f) => (
              <li key={f.title} className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                  <f.icon className="h-5 w-5 text-white" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">{f.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/75">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-hero text-xs text-white/60">
          © {new Date().getFullYear()} {t.nav.title}
        </p>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border bg-background/80 px-4 py-3 backdrop-blur sm:px-8 lg:justify-end lg:border-0 lg:bg-transparent">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="hero-gradient flex h-9 w-9 items-center justify-center rounded-lg text-lg font-black text-white">
              T
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">{t.nav.title}</h1>
              <p className="text-xs text-muted-foreground">{t.auth.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => setLocale(l)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold transition-colors cursor-pointer",
                  locale === l
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {LOCALE_LABELS[l]}
              </button>
            ))}
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1" role="tablist" aria-label={t.auth.subtitle}>
                {(["login", "register"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => switchMode(m)}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer",
                      mode === m
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m === "login" ? t.auth.login_title : t.auth.register_title}
                  </button>
                ))}
              </div>

              <div className="mt-6 space-y-4">
                {mode === "register" && (
                  <AuthField
                    id="auth-full-name"
                    label={t.auth.full_name}
                    value={fullName}
                    onChange={setFullName}
                    error={errors.fullName}
                    autoComplete="name"
                  />
                )}
                <AuthField
                  id="auth-email"
                  label={t.auth.email}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@company.com"
                  error={errors.email}
                  icon={Mail}
                  autoComplete="email"
                  autoFocus
                />
                <AuthField
                  id="auth-password"
                  label={t.auth.password}
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder="••••••••"
                  error={errors.password}
                  icon={Lock}
                  trailing={passwordTrailing}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </div>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                onClick={submit}
                disabled={submitting || loading}
                size="lg"
                className="mt-5 w-full"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "login" ? (
                  <LogIn className="h-4 w-4" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}
                {submitting
                  ? t.auth.submitting
                  : mode === "login"
                    ? t.auth.sign_in
                    : t.auth.sign_up}
              </Button>

              <button
                onClick={() => switchMode(mode === "login" ? "register" : "login")}
                className="mt-4 w-full text-center text-sm font-medium text-primary hover:underline cursor-pointer"
              >
                {mode === "login" ? t.auth.switch_to_register : t.auth.switch_to_login}
                <ArrowRight className="ms-1 inline-block h-3.5 w-3.5 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}