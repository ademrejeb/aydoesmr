/**
 * Tenant-isolation smoke test for the factory and policy endpoints.
 * Requires a running API with seeded demo users (see README).
 *
 *   API_URL=http://localhost:3001/api npm run test:tenant
 */
import assert from "node:assert/strict"

const API = process.env.API_URL ?? "http://localhost:3001/api"

async function req(path, { token, orgId, method = "GET", body } = {}) {
  const headers = { "content-type": "application/json" }
  if (token) headers.authorization = `Bearer ${token}`
  if (orgId) headers["x-organization-id"] = orgId
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = text
  try { data = JSON.parse(text) } catch { /* text */ }
  return { status: res.status, data }
}

async function login(email) {
  const res = await req("/auth/login", { method: "POST", body: { email, password: "DemoPass123!" } })
  assert.equal(res.status, 201, `login failed for ${email}`)
  return res.data.accessToken
}

const owner = await login("owner@techverse.dev")
const member = await login("member@techverse.dev")

const orgs = await req("/organizations", { token: owner })
assert.equal(orgs.status, 200)
const orgA = orgs.data.find((org) => org.slug === "techverse-studio") ?? orgs.data[0]
assert.ok(orgA, "seed organization is required")

const suffix = Date.now().toString(36)
const created = await req("/organizations", {
  token: owner,
  method: "POST",
  body: { name: `Tenant B ${suffix}`, slug: `tenant-b-${suffix}` },
})
assert.equal(created.status, 201, "could not create second organization")
const orgB = created.data

const cases = [
  ["header B, path A (factory runs)", `/organizations/${orgA.id}/factory/runs`, orgB.id, "GET"],
  ["header A, path B (projects)", `/organizations/${orgB.id}/projects`, orgA.id, "GET"],
  ["header B, path A (policies)", `/organizations/${orgA.id}/policies`, orgB.id, "GET"],
  ["header B, path A (approvals)", `/organizations/${orgA.id}/factory/approvals`, orgB.id, "GET"],
]
for (const [name, path, orgId, method] of cases) {
  const res = await req(path, { token: owner, orgId, method })
  assert.equal(res.status, 403, `${name}: expected 403, got ${res.status}`)
}

const agentAttempt = await req(`/organizations/${orgA.id}/factory/agents`, {
  token: owner,
  orgId: orgB.id,
  method: "POST",
  body: { name: "Cross tenant", slug: "cross-tenant", role: "BACKEND" },
})
assert.equal(agentAttempt.status, 403, "cross-tenant agent creation must be denied")

const policyAttempt = await req(`/organizations/${orgA.id}/policies`, {
  token: owner,
  orgId: orgB.id,
  method: "POST",
  body: { key: "cross.tenant", name: "Cross tenant", effect: "ALLOW", subject: "factory.merge" },
})
assert.equal(policyAttempt.status, 403, "cross-tenant policy creation must be denied")

// Member can read but cannot manage agents or policies.
const memberRead = await req(`/organizations/${orgA.id}/factory/runs`, { token: member, orgId: orgA.id })
assert.equal(memberRead.status, 200, "member should read factory runs")
const memberAgent = await req(`/organizations/${orgA.id}/factory/agents`, {
  token: member,
  orgId: orgA.id,
  method: "POST",
  body: { name: "Member agent", slug: `member-agent-${suffix}`, role: "BACKEND" },
})
assert.equal(memberAgent.status, 403, "member must not manage agents")
const memberPolicy = await req(`/organizations/${orgA.id}/policies`, {
  token: member,
  orgId: orgA.id,
  method: "POST",
  body: { key: `member.policy.${suffix}`, name: "Member policy", effect: "ALLOW", subject: "factory.merge" },
})
assert.equal(memberPolicy.status, 403, "member must not manage policies")

console.log(`tenant isolation: PASS (orgA=${orgA.id}, orgB=${orgB.id})`)
