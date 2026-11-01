const BASE = "http://localhost:3001"
const ORG = "8b1ca0cf-6323-40b0-8d29-dc59b8393ecc"
const J = { "Content-Type": "application/json" }
const j = JSON.parse
let pass = 0
let fail = 0
const failures = []

function check(name, cond, extra) {
  if (cond) { pass++; console.log("PASS  " + name) }
  else { fail++; failures.push(name + (extra ? " :: " + extra : "")); console.log("FAIL  " + name + (extra ? " :: " + extra : "")) }
}

async function call(method, path, headers, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...J, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let data = null
  try { data = text ? j(text) : null } catch { data = text }
  return { status: res.status, data }
}

async function login(email) {
  const r = await call("POST", "/api/auth/login", {}, { email, password: "DemoPass123!" })
  const a = r.data?.accessToken
  const token = typeof a === "string" ? a : a?.accessToken ?? a?.token ?? r.data?.token ?? ""
  return { token, status: r.status }
}

async function main() {
  const mgr = await login("manager@techverse.dev")
  const viewer = await login("viewer@techverse.dev")
  const member = await login("member@techverse.dev")
  check("manager login", mgr.token.length > 20, "status " + mgr.status)
  check("viewer login", viewer.token.length > 20)
  check("member login", member.token.length > 20)

  const M = { Authorization: "Bearer " + mgr.token, "X-Organization-Id": ORG }
  const V = { Authorization: "Bearer " + viewer.token, "X-Organization-Id": ORG }
  const U = { Authorization: "Bearer " + member.token, "X-Organization-Id": ORG }
  const sd = "/api/organizations/" + ORG + "/service-desk"

  // ---------- auth boundaries ----------
  const noAuth = await call("GET", sd + "/overview", {})
  check("overview requires auth", noAuth.status === 401, "status " + noAuth.status)
  const noOrg = await call("GET", sd + "/overview", { Authorization: "Bearer " + mgr.token })
  check("overview requires org header", noOrg.status === 403, "status " + noOrg.status)
  const otherOrg = await call("GET", sd + "/overview", { Authorization: "Bearer " + mgr.token, "X-Organization-Id": "290396c5-d38f-4893-915e-f470ee7a0cd5" })
  check("non-member blocked", otherOrg.status === 403, "status " + otherOrg.status)

  // ---------- overview ----------
  const ov = await call("GET", sd + "/overview", M)
  check("overview 200", ov.status === 200)
  check("overview shape", ov.data?.requests && ov.data?.incidents && ov.data?.sla && ov.data?.satisfaction && Array.isArray(ov.data?.topItems))
  check("overview workload", Array.isArray(ov.data?.workload))
  check("overview activity", Array.isArray(ov.data?.recentActivity))
  const agents = await call("GET", sd + "/agents", M)
  check("agents list", agents.status === 200 && agents.data.length >= 5, "len " + (agents.data?.length ?? "?"))
  const queue = await call("GET", sd + "/queue", U)
  check("queue 200", queue.status === 200 && queue.data?.requests && queue.data?.incidents)

  // ---------- catalog ----------
  const cat = await call("GET", sd + "/catalog", M)
  check("catalog seeded", cat.status === 200 && cat.data.length === 8, "len " + (cat.data?.length ?? "?"))
  const approvalItem = cat.data.find((i) => i.requiresApproval)
  const noApprovalItem = cat.data.find((i) => !i.requiresApproval)
  check("catalog has approval + auto items", Boolean(approvalItem && noApprovalItem))
  check("catalog formSchema parsed", Array.isArray(approvalItem?.formSchema) && approvalItem.formSchema.length > 0)

  const created = await call("POST", sd + "/catalog", M, {
    name: "E2E test item " + Date.now(),
    description: "Created by the service desk e2e run",
    category: "it",
    requiresApproval: false,
    estimatedDays: 2,
    sortOrder: 999,
    formSchema: [{ key: "note", label: "Note", type: "text", required: true }],
  })
  check("catalog create 201", created.status === 201, "status " + created.status + " " + JSON.stringify(created.data).slice(0, 160))
  check("catalog uppercases category", created.data?.category === "IT")
  const createdId = created.data?.id
  const upd = await call("PATCH", sd + "/catalog/" + createdId, M, { active: false, estimatedDays: 5 })
  check("catalog update 200", upd.status === 200 && upd.data?.active === false && upd.data?.estimatedDays === 5)
  const viewerCreate = await call("POST", sd + "/catalog", V, { name: "nope nope nope", description: "x", category: "IT" })
  check("viewer cannot create catalog", viewerCreate.status === 403, "status " + viewerCreate.status)
  const badCreate = await call("POST", sd + "/catalog", M, { name: "ab", description: "x", category: "IT" })
  check("catalog name length validated", badCreate.status === 400, "status " + badCreate.status)

  // ---------- request lifecycle ----------
  const req = await call("POST", sd + "/requests", U, {
    title: "E2E laptop request " + Date.now(),
    description: "Need a machine for the E2E run",
    itemId: approvalItem.id,
    priority: "P2",
    formData: { model: "MBP14", justification: "testing", neededBy: "2026-11-01" },
  })
  check("request create 201", req.status === 201, "status " + req.status + " " + JSON.stringify(req.data).slice(0, 200))
  const requestId = req.data?.id
  check("request number format", /^REQ-\d{6}$/.test(req.data?.number ?? ""), "number " + req.data?.number)
  check("request starts pending approval", req.data?.status === "PENDING_APPROVAL", "status " + req.data?.status)
  check("request has SLA due date", Boolean(req.data?.dueAt), "dueAt " + req.data?.dueAt)
  check("request stores form data", req.data?.formData?.model === "MBP14")

  const autoReq = await call("POST", sd + "/requests", U, {
    title: "E2E auto-approved " + Date.now(),
    description: "Badge replacement without approval",
    itemId: noApprovalItem.id,
  })
  check("no-approval item auto-approves", autoReq.data?.status === "APPROVED", "status " + autoReq.data?.status)
  check("auto-approved sets approvedAt", Boolean(autoReq.data?.approvedAt))

  const badTransition = await call("POST", sd + "/requests/" + requestId + "/status", M, { status: "FULFILLED" })
  check("illegal transition rejected", badTransition.status === 400, "status " + badTransition.status)

  const viewerDecision = await call("POST", sd + "/requests/" + requestId + "/decision", V, { decision: "APPROVED" })
  check("viewer cannot approve", viewerDecision.status === 403, "status " + viewerDecision.status)

  const approve = await call("POST", sd + "/requests/" + requestId + "/decision", M, { decision: "APPROVED", note: "Approved by E2E" })
  check("manager approves", approve.status === 201 && approve.data?.status === "APPROVED", "status " + approve.status)
  check("approval records approver", approve.data?.approverId === mgrUserId(approve.data))
  const reApprove = await call("POST", sd + "/requests/" + requestId + "/decision", M, { decision: "APPROVED" })
  check("double approval rejected", reApprove.status === 400, "status " + reApprove.status)

  const start = await call("POST", sd + "/requests/" + requestId + "/status", M, { status: "IN_PROGRESS" })
  check("request in progress", start.status === 201 && start.data?.status === "IN_PROGRESS")
  const fulfil = await call("POST", sd + "/requests/" + requestId + "/status", M, { status: "FULFILLED", note: "Delivered to the E2E desk" })
  check("request fulfilled", fulfil.status === 201 && fulfil.data?.status === "FULFILLED" && Boolean(fulfil.data?.resolvedAt))
  const rate = await call("POST", sd + "/requests/" + requestId + "/rate", U, { rating: 5 })
  check("rating stored", rate.status === 200 && rate.data?.rating === 5, "rating " + rate.data?.rating)
  const badRate = await call("POST", sd + "/requests/" + requestId + "/rate", U, { rating: 9 })
  check("rating range validated", badRate.status === 400, "status " + badRate.status)
  const close = await call("POST", sd + "/requests/" + requestId + "/status", M, { status: "CLOSED" })
  check("request closed", close.status === 201 && close.data?.status === "CLOSED" && Boolean(close.data?.closedAt))
  const afterClose = await call("PATCH", sd + "/requests/" + requestId, M, { title: "should fail" })
  check("closed request not editable", afterClose.status === 400, "status " + afterClose.status)

  const reassign = await call("POST", sd + "/requests", M, { title: "E2E reassign " + Date.now(), description: "assignee test" })
  const memberId = agents.data.find((a) => a.user.email === "member@techverse.dev")?.userId
  const assign = await call("PATCH", sd + "/requests/" + reassign.data.id, M, { assigneeId: memberId })
  check("assign request", assign.status === 200 && assign.data?.assignee?.id === memberId)
  const mineView = await call("GET", sd + "/requests?view=mine", U)
  check("my requests filter", mineView.status === 200 && mineView.data.some((r) => r.id === reassign.data.id))
  const unassigned = await call("GET", sd + "/requests?view=unassigned", M)
  check("unassigned filter", unassigned.status === 200 && unassigned.data.every((r) => r.assigneeId === null))
  const search = await call("GET", sd + "/requests?search=" + encodeURIComponent("E2E"), M)
  check("request search", search.status === 200 && search.data.length >= 1)
  const filtered = await call("GET", sd + "/requests?status=PENDING_APPROVAL", M)
  check("request status filter", filtered.status === 200 && filtered.data.every((r) => r.status === "PENDING_APPROVAL"))
  const badFilter = await call("GET", sd + "/requests?status=NOPE", M)
  check("bad status filter rejected", badFilter.status === 400, "status " + badFilter.status)

  // ---------- comments ----------
  const c1 = await call("POST", sd + "/requests/" + reassign.data.id + "/comments", U, { body: "Public reply from E2E" })
  check("comment created", c1.status === 201 && c1.data?.body === "Public reply from E2E")
  const c2 = await call("POST", sd + "/requests/" + reassign.data.id + "/comments", M, { body: "Internal note", internal: true })
  check("internal comment created", c2.status === 201 && c2.data?.internal === true)
  const list = await call("GET", sd + "/requests/" + reassign.data.id + "/comments", M)
  check("comments listed", list.status === 200 && list.data.length === 2, "len " + (list.data?.length ?? "?"))
  check("comment author joined", Boolean(list.data[0]?.author?.fullName || list.data[0]?.authorName))
  const emptyComment = await call("POST", sd + "/requests/" + reassign.data.id + "/comments", U, { body: "" })
  check("empty comment rejected", emptyComment.status === 400, "status " + emptyComment.status)

  // ---------- incidents ----------
  const inc = await call("POST", sd + "/incidents", M, {
    title: "E2E incident " + Date.now(),
    description: "Synthetic outage for the e2e run",
    priority: "P1",
    category: "IT",
    assigneeId: memberId,
  })
  check("incident create 201", inc.status === 201, "status " + inc.status + " " + JSON.stringify(inc.data).slice(0, 200))
  const incId = inc.data?.id
  check("incident number format", /^INC-\d{6}$/.test(inc.data?.number ?? ""), "number " + inc.data?.number)
  check("incident has response + resolve due", Boolean(inc.data?.responseDueAt && inc.data?.resolveDueAt))
  const incStart = await call("POST", sd + "/incidents/" + incId + "/status", M, { status: "IN_PROGRESS" })
  check("incident in progress", incStart.status === 201 && incStart.data?.status === "IN_PROGRESS" && Boolean(incStart.data?.firstRespondedAt))
  const resolve1 = await call("POST", sd + "/incidents/" + incId + "/status", M, { status: "RESOLVED", resolution: "Rolled back", rootCause: "Bad deploy" })
  check("incident resolved", resolve1.status === 201 && resolve1.data?.status === "RESOLVED" && resolve1.data?.resolution === "Rolled back")
  check("resolve recalculates breach flag", resolve1.data?.resolveBreached === false)
  const reopen = await call("POST", sd + "/incidents/" + incId + "/status", M, { status: "IN_PROGRESS" })
  check("incident reopened", reopen.status === 201 && reopen.data?.status === "IN_PROGRESS" && reopen.data?.reopenCount === 1, "reopenCount " + reopen.data?.reopenCount)
  check("reopen clears resolvedAt", reopen.data?.resolvedAt === null)
  const resolve2 = await call("POST", sd + "/incidents/" + incId + "/status", M, { status: "RESOLVED", resolution: "Fixed properly" })
  const closeInc = await call("POST", sd + "/incidents/" + incId + "/status", M, { status: "CLOSED" })
  check("incident closed", closeInc.status === 201 && closeInc.data?.status === "CLOSED" && Boolean(closeInc.data?.closedAt))
  const afterCloseInc = await call("POST", sd + "/incidents/" + incId + "/status", M, { status: "IN_PROGRESS" })
  check("closed incident immutable", afterCloseInc.status === 400, "status " + afterCloseInc.status)
  const incComments = await call("POST", sd + "/incidents/" + incId + "/comments", U, { body: "Investigating now" })
  check("incident comment", incComments.status === 201)
  const incListComments = await call("GET", sd + "/incidents/" + incId + "/comments", M)
  check("incident comments listed", incListComments.status === 200 && incListComments.data.length === 1)
  const breached = await call("GET", sd + "/incidents?breached=true", M)
  check("breached filter", breached.status === 200 && breached.data.every((i) => i.resolveBreached || i.responseBreached))
  const openView = await call("GET", sd + "/incidents?view=open", M)
  check("open incident filter", openView.status === 200 && openView.data.every((i) => i.status === "NEW" || i.status === "IN_PROGRESS"))

  // ---------- SLA ----------
  const sla = await call("GET", sd + "/sla", M)
  check("sla list", sla.status === 200 && sla.data.length === 4)
  check("sla p1 default", sla.data.find((p) => p.priority === "P1")?.responseMinutes === 15)
  const slaUpdate = await call("PUT", sd + "/sla", M, { priority: "P2", name: "High (tuned)", responseMinutes: 30, resolveMinutes: 300 })
  check("sla updated", slaUpdate.status === 200 && slaUpdate.data?.responseMinutes === 30, "status " + slaUpdate.status)
  const viewerSla = await call("PUT", sd + "/sla", V, { priority: "P3", name: "x", responseMinutes: 10, resolveMinutes: 20 })
  check("viewer cannot change sla", viewerSla.status === 403, "status " + viewerSla.status)
  const badSla = await call("PUT", sd + "/sla", M, { priority: "P3", name: "x", responseMinutes: 300, resolveMinutes: 30 })
  check("sla ordering validated", badSla.status === 400, "status " + badSla.status)
  const restoreSla = await call("PUT", sd + "/sla", M, { priority: "P2", name: "High", responseMinutes: 60, resolveMinutes: 480 })
  check("sla restored", restoreSla.status === 200)

  // ---------- knowledge ----------
  const kb = await call("GET", sd + "/knowledge", M)
  check("kb seeded", kb.status === 200 && kb.data.length >= 5, "len " + (kb.data?.length ?? "?"))
  const articleId = kb.data[0].id
  const before = kb.data[0].views
  const art = await call("GET", sd + "/knowledge/" + articleId, M)
  check("kb article read increments view", art.status === 200 && art.data?.views === before + 1, `views ${art.data?.views} vs ${before}`)
  const artCreate = await call("POST", sd + "/knowledge", M, {
    title: "E2E article " + Date.now(),
    body: "Body text for the e2e article.",
    summary: "summary",
    category: "it",
    tags: ["e2e"],
  })
  check("kb article created", artCreate.status === 201 && artCreate.data?.slug?.startsWith("e2e-article"), "slug " + artCreate.data?.slug)
  const fb = await call("POST", sd + "/knowledge/" + articleId + "/feedback", M, { helpful: true })
  check("kb feedback", fb.status === 200 && fb.data?.helpful > 0, JSON.stringify(fb.data))
  const fbBad = await call("POST", sd + "/knowledge/" + articleId + "/feedback", M, { helpful: "maybe" })
  check("kb feedback validated", fbBad.status === 400, "status " + fbBad.status)
  const kbSearch = await call("GET", sd + "/knowledge?search=vpn", M)
  check("kb search", kbSearch.status === 200 && kbSearch.data.length >= 1)
  const kbCat = await call("GET", sd + "/knowledge?category=access", M)
  check("kb category filter", kbCat.status === 200 && kbCat.data.every((a) => a.category === "ACCESS"))
  const viewerEdit = await call("PATCH", sd + "/knowledge/" + articleId, V, { title: "hijacked title" })
  check("viewer cannot edit article", viewerEdit.status === 403, "status " + viewerEdit.status)
  const missing = await call("GET", sd + "/requests/00000000-0000-0000-0000-000000000000", M)
  check("missing request 404", missing.status === 404, "status " + missing.status)

  // ---------- public portal ----------
  const pub = await call("GET", "/api/service-desk/public/catalog", {})
  check("public catalog without auth", pub.status === 200 && pub.data?.items?.length === 8, "status " + pub.status)
  check("public catalog resolves org", pub.data?.organization?.slug === "techverse-studio")
  check("public catalog hides internals", pub.data?.items?.every((i) => i.createdById === undefined))

  const honeypot = await call("POST", "/api/service-desk/public/requests", {}, {
    name: "Bot", email: "bot@spam.example", title: "Buy cheap things", description: "spam", website: "http://spam.example",
  })
  check("honeypot answered without error", honeypot.status === 201 && honeypot.data?.received === true, "status " + honeypot.status)
  const reqsAfterHoney = await call("GET", sd + "/requests?search=Buy cheap things", M)
  check("honeypot stored nothing", reqsAfterHoney.status === 200 && reqsAfterHoney.data.length === 0, "len " + (reqsAfterHoney.data?.length ?? "?"))

  const email = "customer@example.com"
  const pubReq = await call("POST", "/api/service-desk/public/requests", {}, {
    name: "Amel Customer", email, title: "Portal request " + Date.now(), description: "Submitted from the public portal",
    itemId: approvalItem.id, priority: "P3", formData: { model: "ThinkPad" },
  })
  check("public request 201", pubReq.status === 201 && /^REQ-\d{6}$/.test(pubReq.data?.number ?? ""), JSON.stringify(pubReq.data).slice(0, 200))
  check("public request pending approval", pubReq.data?.status === "PENDING_APPROVAL")
  check("public request carries org name", typeof pubReq.data?.organization === "string")

  const badEmail = await call("POST", "/api/service-desk/public/requests", {}, { name: "X Y", email: "not-an-email", title: "bad email test", description: "x" })
  check("public email validated", badEmail.status === 400, "status " + badEmail.status)

  const track = await call("GET", "/api/service-desk/public/track?number=" + pubReq.data.number + "&email=" + encodeURIComponent(email), {})
  check("public track 200", track.status === 200 && track.data?.ticket?.number === pubReq.data.number, "status " + track.status)
  check("track returns kind", track.data?.ticket?.kind === "request")
  const trackWrong = await call("GET", "/api/service-desk/public/track?number=" + pubReq.data.number + "&email=nobody@example.com", {})
  check("track wrong email 404", trackWrong.status === 404, "status " + trackWrong.status)

  const pubInc = await call("POST", "/api/service-desk/public/incidents", {}, {
    name: "Amel Customer", email, title: "Portal outage " + Date.now(), description: "Cannot log in since 10:00", priority: "P1", category: "IT",
  })
  check("public incident 201", pubInc.status === 201 && /^INC-\d{6}$/.test(pubInc.data?.number ?? ""), JSON.stringify(pubInc.data).slice(0, 160))
  const trackInc = await call("GET", "/api/service-desk/public/track?number=" + pubInc.data.number + "&email=" + encodeURIComponent(email), {})
  check("track incident", trackInc.status === 200 && trackInc.data?.ticket?.kind === "incident")

  const badSlug = await call("GET", "/api/service-desk/public/catalog?orgSlug=does-not-exist", {})
  check("unknown org slug 404", badSlug.status === 404, "status " + badSlug.status)

  // rate limit: submissions used = 3 so far (honeypot, request, incident)
  let limited = null
  for (let i = 0; i < 12; i++) {
    const r = await call("POST", "/api/service-desk/public/requests", {}, {
      name: "Load Bot", email, title: "Rate limit probe " + i, description: "probe",
    })
    if (r.status === 429) { limited = r; break }
  }
  check("submission rate limit 429", limited !== null, "never limited")
  check("rate limit message", typeof limited?.data?.message === "string", JSON.stringify(limited?.data))
  const trackAfterLimit = await call("GET", "/api/service-desk/public/track?number=" + pubReq.data.number + "&email=" + encodeURIComponent(email), {})
  check("tracking still works after limit", trackAfterLimit.status === 200, "status " + trackAfterLimit.status)

  console.log("\n" + pass + " passed, " + fail + " failed")
  if (failures.length) { console.log("failures:"); failures.forEach((f) => console.log(" - " + f)) }
  process.exit(fail > 0 ? 1 : 0)
}

function mgrUserId(approveData) {
  return approveData?.approverId ?? null
}

main().catch((e) => { console.log("ERR " + (e && e.stack ? e.stack : e)); process.exit(1) })