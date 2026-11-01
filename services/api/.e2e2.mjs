const BASE = "http://localhost:3001"
const H = { "Content-Type": "application/json" }
const j = JSON.parse
async function call(method, path, headers, body) {
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
async function main() {
  const l = await call("POST", "/api/auth/login", {}, {
    email: "owner@techverse.dev",
    password: "DemoPass123!",
  })
  console.log("login status " + l.status)
  if (l.status !== 200 && l.status !== 201) { console.log(JSON.stringify(l.data)); return }
  console.log("login keys: " + Object.keys(l.data).join(","))
  const raw = l.data.accessToken ?? l.data.access_token ?? l.data.token
  const token =
    typeof raw === "string"
      ? raw
      : raw?.accessToken ?? raw?.token ?? ""
  console.log("token len " + token.length)
  const A = { Authorization: "Bearer " + token }
  const o = await call("GET", "/api/organizations", A)
  console.log("orgs status " + o.status)
  const arr = Array.isArray(o.data) ? o.data : o.data?.items ?? o.data?.data
  console.log("org count: " + (Array.isArray(arr) ? arr.length : "n/a"))
  if (Array.isArray(arr) && arr.length) {
    console.log("first org: " + JSON.stringify(arr[0]).slice(0, 120))
  } else {
    console.log("orgs raw: " + JSON.stringify(o.data).slice(0, 200))
  }
}
main().catch((e) => { console.log("ERR " + e.message); process.exit(1) })
