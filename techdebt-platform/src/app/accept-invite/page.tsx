"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useI18n, LOCALES, LOCALE_LABELS } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ERR_FN_REQUIRED = "Full name is required"
const ERR_EMAIL_REQUIRED = "Email is required"
const ERR_EMAIL_INVALID = "Enter a valid email address"
const ERR_PASSWORD_REQUIRED = "Password is required"
const ERR_CONFIRM_REQUIRED = "Please confirm your password"

interface FieldErrors {
  fullName?: string
  email?: string
  password?: string
  confirm?: string
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  error,
  icon: Icon,
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
    <div>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-card px-3 transition-shadow focus-within:ring-2 focus-within:ring-ring",
          error && "border-danger"
        )}
        style={error ? { borderColor: "var(--danger)" } : undefined}
      >
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-10 w-full flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        {trailing}
      </div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 flex items-center gap-1 text-xs font-medium text-danger">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

function AcceptInviteInner() {
  const { locale, t, dir } = useI18n()
  const { user, token, register, refreshOrganizations, setOrganization } = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const inviteToken = params.get("token") ?? ""

  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState(params.get("email") ?? "")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const switchToOrg = async (organizationId: string) => {
    const orgs = await refreshOrganizations()
    const target = orgs.find((o) => o.id === organizationId)
    if (target) setOrganization(target)
  }

  const joinExisting = async () => {
    if (!token) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"}/organizations/invites/accept`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.organizationId) throw new Error(data?.message?.[0] ?? data?.message ?? t.invite.invalid_token)
      await switchToOrg(data.organizationId)
      router.push("/dashboard")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t.invite.invalid_token)
    } finally {
      setSubmitting(false)
    }
  }

  const createAccount = async () => {
    const next: FieldErrors = {}
    if (!fullName.trim()) next.fullName = ERR_FN_REQUIRED
    if (!email.trim()) next.email = ERR_EMAIL_REQUIRED
    else if (!EMAIL_RE.test(email.trim())) next.email = ERR_EMAIL_INVALID
    if (!password) next.password = ERR_PASSWORD_REQUIRED
    if (!confirm.trim()) next.confirm = ERR_CONFIRM_REQUIRED
    else if (password !== confirm) next.confirm = t.invite.password_mismatch
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    setError(null)
    try {
      await register(email.trim(), password, fullName.trim(), locale, inviteToken)
      await switchToOrg("")
      router.push("/dashboard")
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t.auth.err_generic)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10" dir={dir}>
      {!inviteToken ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-danger/10 text-danger animate-pop-in">
            <AlertCircle className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">{t.invite.invalid_token}</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 text-center">
            <div className="hero-gradient mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-black text-white">
              T
            </div>
            <h2 className="text-xl font-extrabold">{t.invite.welcome_title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t.invite.welcome_subtitle}</p>
          </div>

          {email && (
            <div className="mb-5 flex items-center gap-3 rounded-lg bg-accent/70 px-3.5 py-2.5 text-sm">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 truncate font-medium">{email}</span>
              <Users className="ms-auto h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
          )}

          {user ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 px-3.5 py-3 text-sm">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <p className="text-foreground">{t.invite.already_member}</p>
              </div>
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
              <Button onClick={joinExisting} disabled={submitting} size="lg" className="w-full">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4 rtl:rotate-180" />}
                {t.invite.join_org}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Field
                id="invite-full-name"
                label={t.auth.full_name}
                value={fullName}
                onChange={setFullName}
                error={errors.fullName}
                autoComplete="name"
                autoFocus
              />
              <Field
                id="invite-email"
                label={t.auth.email}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@company.com"
                error={errors.email}
                icon={Mail}
                autoComplete="email"
              />
              <Field
                id="invite-password"
                label={t.auth.password}
                type={showPass ? "text" : "password"}
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                error={errors.password}
                icon={Lock}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                autoComplete="new-password"
              />
              <Field
                id="invite-confirm"
                label={t.invite.confirm_password}
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={setConfirm}
                placeholder="••••••••"
                error={errors.confirm}
                icon={Lock}
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                autoComplete="new-password"
              />

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-sm font-medium text-danger">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                onClick={createAccount}
                disabled={submitting}
                size="lg"
                className="w-full"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {t.invite.create_account}
              </Button>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

export default function AcceptInvitePage() {
  const { locale, setLocale, t } = useI18n()
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-hero border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="hero-gradient flex h-9 w-9 items-center justify-center rounded-lg text-lg font-black text-white">
              T
            </div>
            <h1 className="text-base font-bold leading-tight">{t.nav.title}</h1>
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
        </div>
      </header>

      <Suspense fallback={<main className="flex-1" />}>
        <AcceptInviteInner />
      </Suspense>
    </div>
  )
}