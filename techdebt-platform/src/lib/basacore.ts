/**
 * Basacore hosted sign-in (authorization code + PKCE).
 *
 * The browser keeps only the short-lived PKCE verifier, state and nonce. The
 * authorization code is exchanged by the TechVerse API, which holds the client
 * secret and verifies the ID token against Basacore's JWKS.
 */
const ISSUER = (process.env.NEXT_PUBLIC_BASACORE_ISSUER ?? "").replace(/\/+$/, "")
const CLIENT_ID = process.env.NEXT_PUBLIC_BASACORE_CLIENT_ID ?? ""
const TENANT_HINT = process.env.NEXT_PUBLIC_BASACORE_TENANT_HINT ?? ""
const STORAGE_KEY = "techverse_basacore_pkce"

export const basacoreEnabled = Boolean(ISSUER && CLIENT_ID)

export function basacoreRedirectUri(): string {
  return `${window.location.origin}/auth/basacore/callback`
}

function base64url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function randomValue(length = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(length)))
}

export interface BasacorePending {
  verifier: string
  state: string
  nonce: string
  createdAt: number
}

export function readPendingBasacore(): BasacorePending | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as BasacorePending
    if (!parsed.verifier || !parsed.state || Date.now() - parsed.createdAt > 10 * 60_000) {
      window.sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPendingBasacore(): void {
  window.sessionStorage.removeItem(STORAGE_KEY)
}

export async function startBasacoreLogin(): Promise<void> {
  if (!basacoreEnabled) throw new Error("Basacore sign-in is not configured")
  const verifier = randomValue(64)
  const challengeBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  const challenge = base64url(new Uint8Array(challengeBytes))
  const state = randomValue(16)
  const nonce = randomValue(16)
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ verifier, state, nonce, createdAt: Date.now() } satisfies BasacorePending),
  )
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: basacoreRedirectUri(),
    scope: "openid profile email",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
  })
  if (TENANT_HINT) params.set("tenant", TENANT_HINT)
  window.location.assign(`${ISSUER}/v1/oauth/authorize?${params.toString()}`)
}
