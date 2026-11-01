import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Runtime origins must line up with the CSP connect-src. The API serves the
// backend (Nest) and the websocket push server, so both the API origin and its
// ws/wss counterpart must be allowed.
const apiOrigin = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api")
  .replace(/\/api\/?$/, "")
  .replace(/\/+$/, "")
const apiWs = apiOrigin.replace(/^http/, "ws")
const apiWss = apiOrigin.replace(/^http/, "wss")

function buildCsp(isDev: boolean, nonce: string): string {
  const directives = [
    "default-src 'self'",
    // The theme bootstrap in src/app/layout.tsx is an inline script (deliberately
    // nonce-less, it must run before hydration) so it is allowlisted by its exact
    // sha256 hash; the nonce covers everything Next.js emits for the request.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'sha256-ghxXvNRpg+HfCDZo9LvkreOJPP5Ut1j4s4m0g3IjBpU='${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: ${apiOrigin} https://media.giphy.com https://i.giphy.com`,
    "font-src 'self' data:",
    `connect-src 'self' ${apiOrigin} ${apiWs} ${apiWss} https://api.giphy.com`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    // In dev (http://localhost) this would force the API/websocket backends to
    // https; only meaningful once the whole stack is served over TLS.
    ...(!isDev ? ["upgrade-insecure-requests"] : []),
  ]
  return directives.join("; ")
}

/**
 * Security proxy: attaches a per-request CSP nonce (Next.js auto-applies it to
 * inline scripts) plus a consistent set of hardening headers to every page
 * response. Static assets are excluded via the matcher.
 */
export function proxy(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development"
  const nonce = crypto.randomUUID().replace(/-/g, "")

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  response.headers.set("Content-Security-Policy", buildCsp(isDev, nonce))
  response.headers.set("X-Frame-Options", "SAMEORIGIN")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), browsing-topics=()"
  )
  response.headers.set("X-DNS-Prefetch-Control", "on")
  // Allow the detached chat window (window.open) to keep its opener handle;
  // cross-origin popups are still blocked from tampering with the app.
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    )
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Every non-static request path gets the CSP + hardening headers.
     * Static bundles, images, and metadata files are excluded.
     */
    {
      source: "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
}