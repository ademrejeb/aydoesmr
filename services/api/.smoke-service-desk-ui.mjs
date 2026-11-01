const BASE = "http://localhost:3001/api"
const ORG = "8b1ca0cf-6323-40b0-8d29-dc59b8393ecc"
let pass = 0, fail = 0
const ok = (label, cond, extra = "") => { if (cond) { pass++; console.log("PASS  " + label) } else { fail++; console.log("FAIL  " + label + " " + extra) } }

async function call(path, { token, orgId = ORG, method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(orgId ? { "x-organization-id": orgId } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  return { status: res.status, data, res }
}

const login = await call("/auth/login", { method: "POST", body: { email: "manager@techverse.dev", password: "DemoPass123!" } })
ok("login 2xx", login.status >= 200 && login.status < 300, JSON.stringify(login.data).slice(0, 120))
const token = login.data?.accessToken ?? login.data?.token

const ov = await call("/organizations/" + ORG + "/service-desk/overview", { token })
ok("overview 200", ov.status === 200)
const o = ov.data ?? {}
ok("overview.requests.byStatus", !!o.requests?.byStatus)
ok("overview.incidents.byPriority", !!o.incidents?.byPriority)
ok("overview.sla fields", "compliance" in (o.sla ?? {}), JSON.stringify(o.sla))
ok("overview.satisfaction.average", "average" in (o.satisfaction ?? {}))
ok("overview.myQueue.requests", !!o.myQueue?.requests)
ok("overview.workload array", Array.isArray(o.workload))
ok("overview.topItems array", Array.isArray(o.topItems))
ok("overview.recentActivity array", Array.isArray(o.recentActivity))

const agents = await call("/organizations/" + ORG + "/service-desk/agents", { token })
ok("agents array", Array.isArray(agents.data) && agents.data.length > 0, String(agents.status))

const cat = await call("/organizations/" + ORG + "/service-desk/catalog?includeInactive=true", { token })
ok("catalog array", Array.isArray(cat.data) && cat.data.length > 0)
ok("catalog formSchema array", Array.isArray(cat.data?.[0]?.formSchema))
ok("catalog active flag", typeof cat.data?.[0]?.active === "boolean")

const reqs = await call("/organizations/" + ORG + "/service-desk/requests", { token })
ok("requests array", Array.isArray(reqs.data) && reqs.data.length > 0, String(reqs.status))
const one = reqs.data?.[0]
ok("request has number/targetAt/item", !!one?.number && "targetAt" in one && "item" in one)
const detail = await call(`/organizations/${ORG}/service-desk/requests/${one.id}`, { token })
ok("request detail 200", detail.status === 200)
const comments = await call(`/organizations/${ORG}/service-desk/requests/${one.id}/comments`, { token })
ok("request comments array", Array.isArray(comments.data))

const views = ["mine", "unassigned", "requested"]
for (const view of views) {
  const r = await call(`/organizations/${ORG}/service-desk/requests?view=${view}`, { token })
  ok("requests view=" + view, r.status === 200 && Array.isArray(r.data), String(r.status))
}

const incs = await call(`/organizations/${ORG}/service-desk/incidents`, { token })
ok("incidents array", Array.isArray(incs.data) && incs.data.length > 0, String(incs.status))
ok("incident sla fields", "responseDueAt" in (incs.data?.[0] ?? {}))
for (const view of ["mine", "unassigned", "open"]) {
  const r = await call(`/organizations/${ORG}/service-desk/incidents?view=${view}`, { token })
  ok("incidents view=" + view, r.status === 200 && Array.isArray(r.data), String(r.status))
}

const arts = await call(`/organizations/${ORG}/service-desk/knowledge?publishedOnly=false`, { token })
ok("knowledge array", Array.isArray(arts.data) && arts.data.length > 0, String(arts.status))
ok("article tags array", Array.isArray(arts.data?.[0]?.tags))

const sla = await call(`/organizations/${ORG}/service-desk/sla`, { token })
ok("sla 4 policies", Array.isArray(sla.data) && sla.data.length === 4, String(sla.status) + " " + JSON.stringify(sla.data).slice(0, 120))
ok("sla custom flag", typeof sla.data?.[0]?.custom === "boolean")

const pub = await call("/service-desk/public/catalog")
ok("public catalog 200", pub.status === 200, String(pub.status))
ok("public catalog items", Array.isArray(pub.data?.items) && pub.data.items.length > 0)
ok("public catalog hides formData", !("formData" in (pub.data?.items?.[0] ?? {})))
ok("public catalog hides id? (has id)", "id" in (pub.data?.items?.[0] ?? {}))
const corsResp = await fetch(BASE + "/service-desk/public/catalog", { headers: { origin: "http://localhost:3000" } }); const cors = corsResp.headers.get("access-control-allow-origin")
ok("CORS allow-origin present", Boolean(cors), String(cors))

const track = await call("/service-desk/public/track?number=REQ-000001&email=manager@techverse.dev")
ok("public track responds", track.status === 200 || track.status === 404, String(track.status))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
