import * as dns from "node:dns/promises"
import * as http from "node:http"
import * as https from "node:https"
import * as net from "node:net"

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024

export interface JsonResponse {
  ok: boolean
  status: number
  body: unknown
}

export interface JsonRequestOptions {
  method: "GET" | "POST"
  headers?: Record<string, string>
  body?: string
  timeoutMs: number
  allowPrivate: boolean
  maxBytes?: number
}

interface EgressTarget {
  hostname: string
  address: string
  family: number
}

const PRIVATE_TARGET_MESSAGE =
  "Agent base URL cannot target a private or link-local address. " +
  "Set AGENT_FACTORY_ALLOW_PRIVATE=true only for trusted internal services."

export function isPrivateAddress(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number)
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    )
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase()
    // DNS commonly returns IPv4-mapped IPv6 addresses for dual-stack hosts.
    // Treat the embedded IPv4 address with the same rules instead of letting
    // ::ffff:127.0.0.1 (and friends) through.
    const mapped = normalized.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/)
    if (mapped) return isPrivateAddress(mapped[1])
    const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
    if (mappedHex) {
      const high = Number.parseInt(mappedHex[1], 16)
      const low = Number.parseInt(mappedHex[2], 16)
      return isPrivateAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
    }
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80")
    )
  }
  return true
}

async function resolveTarget(url: URL, allowPrivate: boolean): Promise<EgressTarget> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "")
  if (!hostname) throw new Error("Agent base URL is missing a hostname")
  const literalFamily = net.isIP(hostname)
  if (literalFamily) {
    if (!allowPrivate && isPrivateAddress(hostname)) throw new Error(PRIVATE_TARGET_MESSAGE)
    return { hostname, address: hostname, family: literalFamily }
  }

  // Resolve once, validate the answer, and pin the connection to that address.
  // This prevents a second lookup from returning a different (private) IP
  // between authorization and the actual request (DNS rebinding).
  const addresses = await dns.lookup(hostname, { all: true }).catch(() => [])
  if (addresses.length === 0) throw new Error("Agent base URL host could not be resolved")
  const usable = allowPrivate ? addresses : addresses.filter((entry) => !isPrivateAddress(entry.address))
  if (usable.length === 0) throw new Error(PRIVATE_TARGET_MESSAGE)
  // Prefer IPv4 when both families resolve; it avoids pinning localhost to ::1
  // when only a 127.0.0.1 listener exists, while still supporting IPv6-only hosts.
  const target = usable.find((entry) => entry.family === 4) ?? usable[0]
  return { hostname, address: target.address, family: target.family }
}

/**
 * Minimal JSON HTTP client for the Agent Factory.
 *
 * Redirects are rejected rather than followed: a validated public endpoint
 * must not be able to redirect the request into the private network. The
 * resolved address is pinned through `lookup`, so the socket cannot be
 * redirected by a second DNS answer.
 */
export async function requestJson(rawUrl: string, options: JsonRequestOptions): Promise<JsonResponse> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error("Agent base URL is not a valid URL")
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Agent base URL must use http or https")
  }
  if (url.username || url.password) {
    throw new Error("Agent base URL must not contain userinfo")
  }

  const target = await resolveTarget(url, options.allowPrivate)
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const transport = url.protocol === "https:" ? https : http
  const headers: http.OutgoingHttpHeaders = { ...(options.headers ?? {}), host: url.host, connection: "close" }
  if (options.body) headers["content-length"] = String(Buffer.byteLength(options.body, "utf8"))

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
  const requestOptions: http.RequestOptions = {
    protocol: url.protocol,
    hostname: target.hostname,
    family: target.family,
    port: url.port || undefined,
    path: `${url.pathname}${url.search}`,
    method: options.method,
    headers,
    signal: controller.signal,
    lookup: (_hostname, _lookupOptions, callback) => callback(null, target.address, target.family),
  }
  if (url.protocol === "https:" && !net.isIP(target.hostname)) {
    ;(requestOptions as https.RequestOptions).servername = target.hostname
  }

  const { promise, resolve, reject } = Promise.withResolvers<JsonResponse>()
  let settled = false
  const fail = (error: unknown) => {
    if (settled) return
    settled = true
    clearTimeout(timeout)
    reject(error)
  }
  const succeed = (value: JsonResponse) => {
    if (settled) return
    settled = true
    clearTimeout(timeout)
    resolve(value)
  }

  const req = transport.request(requestOptions, (res) => {
    const status = res.statusCode ?? 0
    if (status >= 300 && status < 400) {
      res.resume()
      succeed({
        ok: false,
        status,
        body: { error: { message: "Agent Factory returned a redirect; configure the final URL" } },
      })
      return
    }

    const chunks: Buffer[] = []
    let size = 0
    res.on("data", (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) {
        fail(new Error("Agent Factory response is too large"))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    res.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf8")
      let body: unknown = {}
      if (text) {
        try {
          body = JSON.parse(text)
        } catch {
          body = {}
        }
      }
      succeed({ ok: status >= 200 && status < 300, status, body })
    })
    res.on("error", fail)
  })
  req.on("error", fail)
  if (options.body) req.write(options.body)
  req.end()
  return promise
}
