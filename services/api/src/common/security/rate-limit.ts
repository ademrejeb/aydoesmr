import type { Request, Response, NextFunction } from "express"

interface Bucket {
  count: number
  resetAt: number
}

export interface RateLimitOptions {
  /** Fixed window size in milliseconds. */
  windowMs: number
  /** Maximum requests per key inside the window. */
  max: number
  /** Config label used in the 429 payload. */
  name: string
  /** Derives the bucket key. Defaults to client IP. */
  keyBy?: (req: Request) => string
}

/**
 * Dependency-free fixed-window rate limiter (in-memory).
 *
 * Single-instance only — behind a load balancer, point every replica at the
 * same `max` and accept per-replica limits, or swap this factory for a
 * Redis-backed implementation with the same signature.
 */
export function rateLimit(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>()

  const sweeper = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key)
    }
  }, Math.max(options.windowMs, 30_000))
  // Never keep the process alive just for housekeeping.
  sweeper.unref?.()

  const keyBy =
    options.keyBy ??
    ((req: Request) => req.ip || req.socket?.remoteAddress || "unknown")

  return (req: Request, res: Response, next: NextFunction) => {
    if (process.env.RATE_LIMIT_DISABLED === "true") return next()

    const now = Date.now()
    const key = keyBy(req)
    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs }
      buckets.set(key, bucket)
    }
    bucket.count += 1

    const remaining = Math.max(0, options.max - bucket.count)
    res.setHeader("X-RateLimit-Limit", String(options.max))
    res.setHeader("X-RateLimit-Remaining", String(remaining))
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)))

    if (bucket.count > options.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      res.setHeader("Retry-After", String(retryAfter))
      res.status(429).json({
        statusCode: 429,
        message: `Too many requests (${options.name}), retry in ${retryAfter}s`,
        error: "Too Many Requests",
      })
      return
    }

    next()
  }
}

/** Shared limiter state so `createRateLimiter` callers can reset between suites. */
export function authRateKey(req: Request): string {
  const ip = req.ip || req.socket?.remoteAddress || "unknown"
  const body = req.body as { email?: unknown } | undefined
  const email = typeof body?.email === "string" ? body.email.toLowerCase() : "anonymous"
  return `${ip}|${email}`
}