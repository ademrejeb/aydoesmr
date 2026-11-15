"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useRouter } from "next/navigation"
import { api, onSessionTokenChange, type AuthUser, type Organization } from "@/lib/api"

/** Legacy keys, cleared on boot. Auth now lives in memory + the httpOnly refresh cookie. */
const LEGACY_TOKEN_KEY = "techverse_token"
const LEGACY_REFRESH_KEY = "techverse_refresh"
const ORG_KEY = "techverse_org"

interface AuthContextValue {
  user: AuthUser | null
  token: string | null
  organizations: Organization[]
  currentOrg: Organization | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithTokens: (auth: { user: AuthUser; accessToken: string; organizationId?: string | null }) => Promise<void>
  register: (email: string, password: string, fullName?: string, locale?: string, inviteToken?: string) => Promise<void>
  logout: () => void
  setOrganization: (org: Organization) => void
  refreshOrganizations: () => Promise<Organization[]>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null
  return window.localStorage.getItem(key)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  const applyAuth = useCallback((auth: { user: AuthUser; accessToken: string }) => {
    setUser(auth.user)
    setToken(auth.accessToken)
  }, [])

  // api.ts rotates the refresh cookie and retries on 401; keep our copy of the
  // (short-lived) access token in sync with whatever it ended up using.
  useEffect(() => {
    onSessionTokenChange((t) => {
      setToken(t)
    })
    return () => onSessionTokenChange(null)
  }, [])

  const refreshOrganizations = useCallback(async (tok: string, preferredOrgId?: string | null) => {
    const orgs = await api.listOrganizations(tok)
    setOrganizations(orgs)
    const preferred = preferredOrgId ? orgs.find((o) => o.id === preferredOrgId) : null
    const savedOrgId = safeGet(ORG_KEY)
    const saved = savedOrgId ? orgs.find((o) => o.id === savedOrgId) : null
    const next = preferred ?? saved ?? orgs[0] ?? null
    setCurrentOrg(next)
    if (next) window.localStorage.setItem(ORG_KEY, next.id)
    return orgs
  }, [])

  const bootstrap = useCallback(async () => {
    // Purge tokens written by older builds; the access token is memory-only now.
    window.localStorage.removeItem(LEGACY_TOKEN_KEY)
    window.localStorage.removeItem(LEGACY_REFRESH_KEY)

    let tok: string | null = null
    try {
      // The httpOnly refresh cookie is the durable session.
      const auth = await api.refresh()
      applyAuth(auth)
      tok = auth.accessToken
    } catch {
      /* no cookie session */
    }
    if (!tok) {
      setLoading(false)
      return
    }
    try {
      const me = await api.me(tok)
      setUser(me)
      await refreshOrganizations(tok)
    } catch {
      setUser(null)
      setToken(null)
      setOrganizations([])
      setCurrentOrg(null)
    } finally {
      setLoading(false)
    }
  }, [refreshOrganizations, applyAuth])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  const login = useCallback(
    async (email: string, password: string) => {
      const auth = await api.login({ email, password })
      applyAuth(auth)
      await refreshOrganizations(auth.accessToken)
    },
    [applyAuth, refreshOrganizations]
  )

  const loginWithTokens = useCallback(
    async (auth: { user: AuthUser; accessToken: string; organizationId?: string | null }) => {
      applyAuth(auth)
      await refreshOrganizations(auth.accessToken, auth.organizationId)
    },
    [applyAuth, refreshOrganizations]
  )

  const register = useCallback(
    async (email: string, password: string, fullName?: string, locale?: string, inviteToken?: string) => {
      const auth = await api.register({ email, password, fullName, locale, inviteToken })
      applyAuth(auth)
      await refreshOrganizations(auth.accessToken)
    },
    [applyAuth, refreshOrganizations]
  )

  const logout = useCallback(() => {
    // Best-effort server-side revocation of the refresh session + cookie clear.
    api.logout().catch(() => {})
    window.localStorage.removeItem(LEGACY_TOKEN_KEY)
    window.localStorage.removeItem(LEGACY_REFRESH_KEY)
    window.localStorage.removeItem(ORG_KEY)
    setUser(null)
    setToken(null)
    setOrganizations([])
    setCurrentOrg(null)
    router.push("/login")
  }, [router])

  const setOrganization = useCallback((org: Organization) => {
    setCurrentOrg(org)
    window.localStorage.setItem(ORG_KEY, org.id)
  }, [])

  const value = useMemo(
    () => ({
      user,
      token,
      organizations,
      currentOrg,
      loading,
      login,
      loginWithTokens,
      register,
      logout,
      setOrganization,
      refreshOrganizations: () => (token ? refreshOrganizations(token) : Promise.resolve([])),
    }),
    [
      user,
      token,
      organizations,
      currentOrg,
      loading,
      login,
      loginWithTokens,
      register,
      logout,
      setOrganization,
      refreshOrganizations,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
