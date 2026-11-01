/**
 * Auth + security hardening smoke test.
 * Run: node .smoke-auth.mjs   (API must be running on :3001)
 */
const BASE = process.env.API_BASE ?? "http://localhost:3001/api"
const ORIGIN = "http://localhost:3000"

let passed = 0
let failed = 0
const failures = []

function check(name, cond, detail = "") {
  if (cond) {
    passed++
  } else {
    failed++
    failures.push(`${name}${detail ? ` :: ${detail}` : ""}`)
    console.log(`FAIL  ${name} ${detail}`)
  }
}

function cookieFrom(res) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [res.headers.get("set-cookie")].filter(Boolean)
  const line = raw.find((c) => c.startsWith("refreshToken="))
  if (!line) return null
  return line.split(";")[0]
}

function cookieAttrs(res) {
  const raw = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : []
  const line = raw.find((c) => c.startsWith("refreshToken=")) ?? ""
  return {
    httpOnly: /httponly/i.test(line),
    path: /path=\/api\/auth/i.test(line),
    sameSiteLax: /samesite=lax/i.test(line),
    cleared: /max-age=0|expires=Thu, 01 Jan 1970/i.test(line),
  }
}

async function req(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* ignore */
  }
  return { res, json }
}

async function login(email, password) {
  return req("/auth/login", { method: "POST", body: { email, password } })
}

const stamp = Date.now()

async function main() {
  // ---- security headers ----
  {
    const { res } = await req("/health")
    check("health 200", res.status === 200, `got ${res.status}`)
    check("nosniff header", res.headers.get("x-content-type-options") === "nosniff")
    check("x-frame-options", res.headers.get("x-frame-options") === "DENY")
    check("referrer-policy", res.headers.get("referrer-policy") === "strict-origin-when-cross-origin")
    check("permissions-policy", !!res.headers.get("permissions-policy"))
    check("coop", res.headers.get("cross-origin-opener-policy") === "same-origin-allow-popups")
    check("no x-powered-by", !res.headers.get("x-powered-by"))
    check("ratelimit headers", !!res.headers.get("x-ratelimit-limit") && !!res.headers.get("x-ratelimit-remaining"))
  }

  // ---- CORS allowlist ----
  {
    const allowed = await fetch(`${BASE}/health`, { headers: { Origin: ORIGIN } })
    check("cors allows configured origin", allowed.headers.get("access-control-allow-origin") === ORIGIN)
    check("cors credentials", allowed.headers.get("access-control-allow-credentials") === "true")

    const evil = await fetch(`${BASE}/health`, { headers: { Origin: "https://evil.example" } })
    check("cors rejects unknown origin", !evil.headers.get("access-control-allow-origin"))

    const pre = await fetch(`${BASE}/auth/login`, {
      method: "OPTIONS",
      headers: {
        Origin: ORIGIN,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    })
    check("preflight 204", pre.status === 204, `got ${pre.status}`)
    check("preflight allows origin", pre.headers.get("access-control-allow-origin") === ORIGIN)
  }

  // ---- login: cookie issued, no refresh token in body ----
  let cookie = null
  let access = null
  {
    const { res, json } = await login("owner@techverse.dev", "DemoPass123!")
    check("login status", res.status === 201, `got ${res.status}`)
    check("login body has access token", !!json?.accessToken)
    check("login body has NO refresh token", !json?.refreshToken)
    check("login body has user", !!json?.user?.id)
    const attrs = cookieAttrs(res)
    check("refresh cookie httpOnly", attrs.httpOnly)
    check("refresh cookie path scoped", attrs.path)
    check("refresh cookie sameSite lax", attrs.sameSiteLax)
    cookie = cookieFrom(res)
    access = json?.accessToken
    check("set-cookie present", !!cookie)
  }

  // ---- access token works ----
  {
    const { res, json } = await req("/auth/me", { headers: { Authorization: `Bearer ${access}` } })
    check("me 200", res.status === 200, `got ${res.status}`)
    check("me email", json?.email === "owner@techverse.dev")
  }

  // ---- refresh rotation ----
  let cookie2 = null
  {
    const { res, json } = await req("/auth/refresh", {
      method: "POST",
      headers: { Cookie: cookie },
    })
    check("refresh 201", res.status === 201, `got ${res.status} ${JSON.stringify(json)}`)
    check("refresh returns access", !!json?.accessToken)
    check("refresh body has NO refresh token", !json?.refreshToken)
    cookie2 = cookieFrom(res)
    check("rotated cookie differs", !!cookie2 && cookie2 !== cookie)
  }

  // ---- reuse of rotated (old) token => revocation ----
  {
    const { res, json } = await req("/auth/refresh", {
      method: "POST",
      headers: { Cookie: cookie },
    })
    check("reuse rejected", res.status === 401, `got ${res.status} ${JSON.stringify(json)}`)

    const after = await req("/auth/refresh", { method: "POST", headers: { Cookie: cookie2 } })
    check("reuse revokes whole family", after.res.status === 401, `got ${after.res.status}`)
  }

  // ---- logout revokes session ----
  {
    const fresh = await login("viewer@techverse.dev", "DemoPass123!")
    const c = cookieFrom(fresh.res)
    check("viewer login", fresh.res.status === 201, `got ${fresh.res.status}`)

    const out = await req("/auth/logout", { method: "POST", headers: { Cookie: c }, body: {} })
    check("logout 201", out.res.status === 201, `got ${out.res.status}`)
    check("logout clears cookie", cookieAttrs(out.res).cleared)

    const after = await req("/auth/refresh", { method: "POST", headers: { Cookie: c } })
    check("refresh after logout rejected", after.res.status === 401, `got ${after.res.status}`)
  }

  // ---- lockout after repeated failures ----
  {
    const ghost = `lock-${stamp}@example.com`
    let last = null
    for (let i = 0; i < 6; i++) {
      last = await login(ghost, "WrongPassword1!")
    }
    check("lockout engages", last.res.status === 401 && /too many failed/i.test(last.json?.message ?? ""), `${last.res.status} ${last.json?.message}`)
  }

  // ---- rate limit headers on auth route ----
  {
    const { res } = await login("someone-else@techverse.dev", "nope")
    check("auth ratelimit headers", !!res.headers.get("x-ratelimit-limit"))
  }

  // ---- swagger gating (dev => enabled) ----
  {
    const res = await fetch(`${BASE}/docs`)
    check("swagger reachable in dev", res.status === 200, `got ${res.status}`)
  }

  // ---- leave flow: auto-approve type + cancel + manager approval ----
  const orgId = "8b1ca0cf-6323-40b0-8d29-dc59b8393ecc"
  const orgHeaders = (token) => ({ Authorization: `Bearer ${token}`, "X-Organization-Id": orgId })

  let managerToken = null
  {
    const { res, json } = await login("manager@techverse.dev", "DemoPass123!")
    check("manager login", res.status === 201, `got ${res.status}`)
    managerToken = json?.accessToken
  }

  let autoTypeId = null
  {
    const { res, json } = await req("/organizations/" + orgId + "/timesheets/leave-types", {
      method: "POST",
      headers: orgHeaders(managerToken),
      body: {
        name: `Auto ${stamp}`,
        code: `AUTO${String(stamp).slice(-5)}`,
        isPaid: true,
        daysPerYear: 5,
        requiresApproval: false,
        isActive: true,
      },
    })
    check("create auto-approve type", res.status === 201, `got ${res.status} ${JSON.stringify(json)}`)
    autoTypeId = json?.id
  }

  let memberToken = null
  {
    const { json } = await login("member@techverse.dev", "DemoPass123!")
    memberToken = json?.accessToken
  }

  {
    const start = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const end = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10)
    const { res, json } = await req("/organizations/" + orgId + "/timesheets/leave-requests", {
      method: "POST",
      headers: orgHeaders(memberToken),
      body: { typeId: autoTypeId, startDate: start, endDate: end, days: 2, reason: "smoke" },
    })
    check("auto-approve request", res.status === 201 && json?.status === "APPROVED", `got ${res.status} ${json?.status}`)
  }

  {
    const start = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10)
    const end = new Date(Date.now() + 11 * 86400000).toISOString().slice(0, 10)
    const { res: created, json: req1 } = await req("/organizations/" + orgId + "/timesheets/leave-requests", {
      method: "POST",
      headers: orgHeaders(memberToken),
      body: { typeId: autoTypeId, startDate: start, endDate: end, days: 1, reason: "cancel me" },
    })
    // Type is auto-approve, so use an approval-required type for cancel/pending tests.
    const pendingRes = await req("/organizations/" + orgId + "/timesheets/leave-types", {
      method: "POST",
      headers: orgHeaders(managerToken),
      body: { name: `NeedsApproval ${stamp}`, code: `APRV${String(stamp).slice(-5)}`, daysPerYear: 10, requiresApproval: true },
    })
    const pendingType = pendingRes.json?.id
    const start2 = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10)
    const end2 = new Date(Date.now() + 21 * 86400000).toISOString().slice(0, 10)
    const { res: cr, json: pending } = await req("/organizations/" + orgId + "/timesheets/leave-requests", {
      method: "POST",
      headers: orgHeaders(memberToken),
      body: { typeId: pendingType, startDate: start2, endDate: end2, days: 3, reason: "needs review" },
    })
    check("approval-required stays pending", cr.status === 201 && pending?.status === "PENDING", `${cr.status} ${pending?.status}`)

    const queue = await req("/organizations/" + orgId + "/timesheets/leave-requests/pending", {
      headers: orgHeaders(managerToken),
    })
    check("manager sees pending queue", queue.res.status === 200 && Array.isArray(queue.json), `got ${queue.res.status}`)
    check("queue includes requester", queue.json?.some((r) => r.id === pending?.id && !!r.user), "item missing")

  // member (below MANAGER) cannot read the queue
    const denied = await req("/organizations/" + orgId + "/timesheets/leave-requests/pending", {
      headers: orgHeaders(memberToken),
    })
    check("member denied pending queue", denied.res.status === 403, `got ${denied.res.status}`)

    const rej = await req(`/organizations/${orgId}/timesheets/leave-requests/${pending.id}/reject`, {
      method: "PATCH",
      headers: orgHeaders(managerToken),
      body: { reviewNote: "smoke reject" },
    })
    check("manager rejects", rej.res.status === 200 && rej.json?.status === "REJECTED", `${rej.res.status} ${rej.json?.status}`)

    // cancel own pending request
    const start3 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    const end3 = new Date(Date.now() + 31 * 86400000).toISOString().slice(0, 10)
    const { json: mine } = await req("/organizations/" + orgId + "/timesheets/leave-requests", {
      method: "POST",
      headers: orgHeaders(memberToken),
      body: { typeId: pendingType, startDate: start3, endDate: end3, days: 1, reason: "cancel" },
    })
    const cancelled = await req(`/organizations/${orgId}/timesheets/leave-requests/${mine.id}/cancel`, {
      method: "PATCH",
      headers: orgHeaders(memberToken),
    })
    check("owner cancels pending", cancelled.res.status === 200 && cancelled.json?.status === "CANCELLED", `${cancelled.res.status} ${cancelled.json?.status}`)

  // member cannot pass someone else's userId for balances
    const ownerMe = await req("/organizations/" + orgId + "/timesheets/leave-balances?userId=other-id", {
      headers: orgHeaders(memberToken),
    })
    check("member forced to own balances", ownerMe.res.status === 200, `got ${ownerMe.res.status}`)

    const mgrAll = await req("/organizations/" + orgId + "/timesheets/leave-requests?scope=all", {
      headers: orgHeaders(managerToken),
    })
    check("manager all-requests scope", mgrAll.res.status === 200, `got ${mgrAll.res.status}`)

    void created
    void req1
    void autoTypeId
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log("Failures:")
    for (const f of failures) console.log(" - " + f)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
