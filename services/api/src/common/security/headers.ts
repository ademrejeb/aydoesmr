import type { Request, Response, NextFunction } from "express"

/**
 * Baseline HTTP hardening for the JSON API.
 *
 * Deliberately hand-rolled (no helmet dependency): this API only serves JSON,
 * CSV and git packfiles, so a full CSP would add little — the browser-facing
 * policies (`frame-ancestors`, sniffing, referrer, permissions) are what
 * matter here. The Next.js app ships its own CSP via `next.config.ts`.
 */
export function securityHeaders() {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Content-Type-Options", "nosniff")
    res.setHeader("X-Frame-Options", "DENY")
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
    res.setHeader(
      "Permissions-Policy",
      "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()"
    )
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups")
    res.setHeader("Cross-Origin-Resource-Policy", "same-site")
    res.setHeader("X-DNS-Prefetch-Control", "off")
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none")
    // Do not advertise the stack.
    res.removeHeader("X-Powered-By")

    // HSTS only makes sense behind TLS — never emit it for plain-HTTP dev.
    const isHttps = process.env.FORCE_HTTPS === "true" || process.env.NODE_ENV === "production"
    if (isHttps) {
      res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains")
    }

    next()
  }
}