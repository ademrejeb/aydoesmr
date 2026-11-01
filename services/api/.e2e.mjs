const BASE = "http://localhost:3001"
const H = { "Content-Type": "application/json" }
const j = (s) => JSON.parse(s)

async function call(method, path, headers = {}, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...H, ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? j(text) : null } catch { data = text }
  return { status: res.status, data }
}

const main = async () => {
  const login = await call("POST", "/api/auth/login", {}, {
    email: "owner@techverse.dev",
    password: "DemoPass123!",
  })
  if (login.status !== 201 && login.status !== 200) {
    console.log("LOGIN FAIL " + login.status + ": " + JSON.stringify(login.data))
    return
  }
  const raw = login.data.accessToken ?? login.data.token
  const token =
    typeof raw === "string"
      ? raw
      : raw?.accessToken ?? raw?.token ?? raw
  const A = { Authorization: "Bearer " + token }
  console.log("login ok")

  const orgs = await call("GET", "/api/organizations", A)
  const org = Array.isArray(orgs.data) ? orgs.data[0] : orgs.data
  const oid = org?.id
  console.log("org: " + (org?.slug ?? org?.name) + " (" + oid + ")")
  if (!oid) { console.log("NO ORG"); return }

  const cat = await call("GET", "/api/organizations/" + oid + "/ai-actions/catalog", A)
  console.log("catalog [" + (Array.isArray(cat.data) ? cat.data.length : "?") + "]:")
  if (Array.isArray(cat.data)) for (const d of cat.data) console.log("  - " + (d.key ?? d.name))
}

main().catch((e) => console.log("ERR: " + e.message))
