"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2, ShieldCheck } from "lucide-react"

import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n"
import { api } from "@/lib/api"
import {
  basacoreRedirectUri,
  clearPendingBasacore,
  readPendingBasacore,
} from "@/lib/basacore"
import { Button } from "@/components/ui/button"

function CallbackInner() {
  const params = useSearchParams()
  const router = useRouter()
  const { loginWithTokens } = useAuth()
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const oauthError = params.get("error")
    if (oauthError) {
      setError(params.get("error_description") ?? oauthError)
      return
    }
    const code = params.get("code")
    const state = params.get("state")
    const pending = readPendingBasacore()
    if (!code || !state) {
      setError("The authorization response is incomplete.")
      return
    }
    if (!pending || pending.state !== state) {
      clearPendingBasacore()
      setError("The sign-in state is invalid or has expired. Start again.")
      return
    }

    void (async () => {
      try {
        const auth = await api.basacoreExchange({
          code,
          codeVerifier: pending.verifier,
          redirectUri: basacoreRedirectUri(),
          nonce: pending.nonce,
        })
        clearPendingBasacore()
        await loginWithTokens(auth)
        router.replace("/dashboard")
        router.refresh()
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Basacore sign-in failed.")
      }
    })()
  }, [loginWithTokens, params, router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        {error ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/10 text-danger">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-bold">Could not complete sign-in</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-6 w-full" onClick={() => router.replace("/login")}>
              Back to sign in
            </Button>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <h1 className="mt-4 text-lg font-bold">Finishing Basacore sign-in</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Verifying your identity and opening your workspace…
            </p>
          </>
        )}
      </div>
    </main>
  )
}

export default function BasacoreCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </main>
      }
    >
      <CallbackInner />
    </Suspense>
  )
}
