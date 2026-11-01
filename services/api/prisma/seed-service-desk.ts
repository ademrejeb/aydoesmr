import "dotenv/config"
import {
  Prisma,
  PrismaClient,
  ServicePriority,
  ServiceRequestStatus,
  IncidentStatus,
  ServiceEntityType,
} from "@prisma/client"

const prisma = new PrismaClient()

const ORG_SLUG = process.env.SERVICE_DESK_SEED_ORG ?? "techverse-studio"

/** Next free sequential number, mirroring ServiceDeskService.nextNumber. */
async function nextNumber(organizationId: string, kind: "REQ" | "INC"): Promise<string> {
  const last = kind === "REQ"
    ? await prisma.serviceRequest.findFirst({ where: { organizationId }, orderBy: { number: "desc" }, select: { number: true } })
    : await prisma.incident.findFirst({ where: { organizationId }, orderBy: { number: "desc" }, select: { number: true } })
  let next = last ? (parseInt(last.number.split("-")[1] ?? "0", 10) || 0) + 1 : 1
  for (let i = 0; i < 50; i++) {
    const number = `${kind}-${String(next).padStart(6, "0")}`
    const clash = kind === "REQ"
      ? await prisma.serviceRequest.findFirst({ where: { organizationId, number }, select: { id: true } })
      : await prisma.incident.findFirst({ where: { organizationId, number }, select: { id: true } })
    if (!clash) return number
    next += 1
  }
  throw new Error(`Could not allocate ${kind} number`)
}

const SLA_POLICIES: {
  priority: ServicePriority
  name: string
  responseMinutes: number
  resolveMinutes: number
  businessHoursOnly: boolean
}[] = [
  { priority: "P1", name: "Critical", responseMinutes: 15, resolveMinutes: 240, businessHoursOnly: false },
  { priority: "P2", name: "High", responseMinutes: 60, resolveMinutes: 480, businessHoursOnly: false },
  { priority: "P3", name: "Normal", responseMinutes: 240, resolveMinutes: 1440, businessHoursOnly: true },
  { priority: "P4", name: "Low", responseMinutes: 480, resolveMinutes: 2880, businessHoursOnly: true },
]

type Field = { key: string; label: string; type: string; required?: boolean; options?: string[] }

const CATALOG: {
  name: string
  description: string
  category: string
  icon: string
  requiresApproval: boolean
  estimatedDays: number
  sortOrder: number
  formSchema: Field[]
}[] = [
  {
    name: "New laptop request",
    description: "Order a laptop or a replacement machine for a new joiner or a broken device.",
    category: "IT",
    icon: "Laptop",
    requiresApproval: true,
    estimatedDays: 3,
    sortOrder: 10,
    formSchema: [
      { key: "model", label: "Preferred model", type: "text", required: true },
      { key: "justification", label: "Business justification", type: "textarea", required: true },
      { key: "neededBy", label: "Needed by", type: "date", required: true },
    ],
  },
  {
    name: "Software license",
    description: "Buy or renew a paid software license (IDE, design tool, cloud plan).",
    category: "IT",
    icon: "KeyRound",
    requiresApproval: true,
    estimatedDays: 2,
    sortOrder: 20,
    formSchema: [
      { key: "product", label: "Product", type: "text", required: true },
      { key: "plan", label: "Plan", type: "select", options: ["monthly", "annual"], required: true },
      { key: "seats", label: "Seats", type: "number", required: true },
    ],
  },
  {
    name: "Production access",
    description: "Request elevated access to production: deploy rights, database console, or feature flags.",
    category: "ACCESS",
    icon: "ShieldCheck",
    requiresApproval: true,
    estimatedDays: 1,
    sortOrder: 30,
    formSchema: [
      { key: "system", label: "System", type: "text", required: true },
      { key: "role", label: "Role needed", type: "text", required: true },
      { key: "duration", label: "Duration", type: "select", options: ["1 day", "1 week", "permanent"], required: true },
      { key: "reason", label: "Reason", type: "textarea", required: true },
    ],
  },
  {
    name: "Office access badge",
    description: "New badge, replacement badge, or temporary visitor badge.",
    category: "FACILITIES",
    icon: "IdCard",
    requiresApproval: false,
    estimatedDays: 1,
    sortOrder: 40,
    formSchema: [{ key: "kind", label: "Badge type", type: "select", options: ["employee", "contractor", "visitor"], required: true }],
  },
  {
    name: "Desk or meeting room",
    description: "Reserve a desk for a hybrid day or book a meeting room.",
    category: "FACILITIES",
    icon: "CalendarDays",
    requiresApproval: false,
    estimatedDays: 1,
    sortOrder: 50,
    formSchema: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "time", label: "Time", type: "text", required: true },
      { key: "capacity", label: "Capacity", type: "number" },
    ],
  },
  {
    name: "Onboarding equipment",
    description: "Desk phone, headset, monitor, or ergonomic keyboard for a new teammate.",
    category: "HR",
    icon: "Briefcase",
    requiresApproval: true,
    estimatedDays: 3,
    sortOrder: 60,
    formSchema: [
      { key: "employee", label: "Employee", type: "text", required: true },
      { key: "items", label: "Items", type: "text", required: true },
    ],
  },
  {
    name: "Payroll or payslip copy",
    description: "Request a duplicate payslip or a payroll correction.",
    category: "FINANCE",
    icon: "Receipt",
    requiresApproval: false,
    estimatedDays: 5,
    sortOrder: 70,
    formSchema: [
      { key: "period", label: "Period", type: "text", required: true },
      { key: "reason", label: "Reason", type: "textarea", required: true },
    ],
  },
  {
    name: "VPN account",
    description: "Remote access VPN profile for a new device or a new joiner.",
    category: "ACCESS",
    icon: "Network",
    requiresApproval: true,
    estimatedDays: 1,
    sortOrder: 80,
    formSchema: [
      { key: "device", label: "Device", type: "text", required: true },
      { key: "remoteOnly", label: "Remote access only", type: "checkbox" },
    ],
  },
]

const ARTICLES: {
  title: string
  summary: string
  category: string
  tags: string[]
  body: string
}[] = [
  {
    title: "How to request access to a production system",
    summary: "Production access always needs manager approval — here is the exact process.",
    category: "ACCESS",
    tags: ["access", "production", "security"],
    body: [
      "## Before you request",
      "Make sure you know the system name and the exact role you need. Requests for `owner` or `admin` are reviewed by the security team as well.",
      "",
      "## Steps",
      "1. Open **Service Desk → Catalog → Production access**.",
      "2. Fill in the system, the role, and how long you need it.",
      "3. Your manager receives an approval task; typical turnaround is one business day.",
      "4. Once approved, IT provisions the access and you get a notification.",
      "",
      "## Emergency access",
      "For a Sev-1 outage, call the on-call number and file the incident afterwards — do not wait for the portal.",
    ].join("\n"),
  },
  {
    title: "VPN setup on a new laptop",
    summary: "Install the VPN profile, enrol the device, and connect from anywhere.",
    category: "IT",
    tags: ["vpn", "remote", "laptop"],
    body: [
      "## Install",
      "1. Open the self-service portal and pick **VPN account**.",
      "2. After approval you receive a profile link by email.",
      "3. Install the profile, then enrol the device with the security key prompt.",
      "",
      "## Connect",
      "Use the client, select the nearest gateway, and sign in with your company email.",
      "",
      "## Troubleshooting",
      "If the client says *certificate expired*, re-request the profile — the device record was rotated.",
    ].join("\n"),
  },
  {
    title: "Reset your password or unlock your account",
    summary: "Self-service password reset and what to do when your account is locked.",
    category: "IT",
    tags: ["password", "account", "security"],
    body: [
      "## Reset",
      "Use the *Forgot password* link on the sign-in page. The reset link expires after 30 minutes.",
      "",
      "## Unlock",
      "After five failed attempts the account locks for 15 minutes. Wait it out, then reset.",
      "",
      "## Still stuck?",
      "File an incident with the **IT** category. Attach a screenshot of the error message.",
    ].join("\n"),
  },
  {
    title: "Requesting a new laptop",
    summary: "Standard laptop request: lead time, budget, and what happens next.",
    category: "HR",
    tags: ["laptop", "onboarding", "hardware"],
    body: [
      "## Lead time",
      "Standard delivery is 3 business days after approval. Custom configurations can take 2 weeks.",
      "",
      "## What you get",
      "A configured laptop with encryption, endpoint protection, and the standard app bundle.",
      "",
      "## Data transfer",
      "IT migrates your mailbox and documents; personal files must be moved manually.",
    ].join("\n"),
  },
]

function daysFromNow(days: number, hourOffset = 0) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(d.getHours() + hourOffset)
  return d
}

async function main() {
  const org = await prisma.organization.findUnique({ where: { slug: ORG_SLUG } })
  if (!org) throw new Error(`Organization "${ORG_SLUG}" not found — run npm run prisma:seed first`)

  const users = await prisma.user.findMany({
    where: { email: { in: ["owner@techverse.dev", "admin@techverse.dev", "manager@techverse.dev", "member@techverse.dev"] } },
    select: { id: true, email: true },
  })
  const userByEmail = new Map(users.map((u) => [u.email, u.id]))
  const managerId = userByEmail.get("manager@techverse.dev") ?? null
  const memberId = userByEmail.get("member@techverse.dev") ?? null
  const adminId = userByEmail.get("admin@techverse.dev") ?? null
  const authorId = managerId ?? adminId

  console.log(`[seed:service-desk] org=${org.name} (${org.id})`)

  // SLA policies
  for (const policy of SLA_POLICIES) {
    await prisma.serviceSlaPolicy.upsert({
      where: { organizationId_priority: { organizationId: org.id, priority: policy.priority } },
      create: { organizationId: org.id, ...policy },
      update: policy,
    })
  }
  console.log(`[seed:service-desk] sla policies: ${SLA_POLICIES.length}`)

  // Catalog
  let createdItems = 0
  const itemByName = new Map<string, string>()
  for (const item of CATALOG) {
    const existing = await prisma.serviceItem.findFirst({ where: { organizationId: org.id, name: item.name } })
    const row = existing
      ? await prisma.serviceItem.update({
          where: { id: existing.id },
          data: { ...item, formSchema: item.formSchema as unknown as Prisma.InputJsonValue },
        })
      : await prisma.serviceItem.create({
          data: {
            organizationId: org.id,
            ...item,
            formSchema: item.formSchema as unknown as Prisma.InputJsonValue,
            createdById: authorId,
          },
        })
    itemByName.set(item.name, row.id)
    if (!existing) createdItems += 1
  }
  console.log(`[seed:service-desk] catalog items: ${CATALOG.length} (${createdItems} new)`)

  // Knowledge base
  let createdArticles = 0
  for (const article of ARTICLES) {
    const existing = await prisma.knowledgeArticle.findFirst({ where: { organizationId: org.id, title: article.title } })
    if (existing) continue
    await prisma.knowledgeArticle.create({
      data: {
        organizationId: org.id,
        title: article.title,
        slug: article.title
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, "")
          .trim()
          .replace(/\s+/g, "-")
          .slice(0, 60),
        summary: article.summary,
        body: article.body,
        category: article.category,
        tags: article.tags,
        published: true,
        authorId,
        views: 40 + Math.floor(Math.random() * 200),
        helpful: 10 + Math.floor(Math.random() * 25),
      },
    })
    createdArticles += 1
  }
  console.log(`[seed:service-desk] articles: ${ARTICLES.length} (${createdArticles} new)`)

  // Sample requests
  const requestSeeds: {
    title: string
    description: string
    item: string
    priority: ServicePriority
    status: ServiceRequestStatus
    days: number
    assigneeId: string | null
  }[] = [
    {
      title: "Laptop for new backend engineer",
      description: "New joiner starts next Monday, needs a 14-inch machine with the backend stack.",
      item: "New laptop request",
      priority: "P2",
      status: "PENDING_APPROVAL",
      days: -1,
      assigneeId: null,
    },
    {
      title: "JetBrains All Products Pack renewal",
      description: "Renew the team license for 6 engineers, annual plan.",
      item: "Software license",
      priority: "P3",
      status: "APPROVED",
      days: -3,
      assigneeId: memberId,
    },
    {
      title: "Read-only production logs access",
      description: "Need log read access for the API service to debug an alert.",
      item: "Production access",
      priority: "P2",
      status: "IN_PROGRESS",
      days: -5,
      assigneeId: memberId,
    },
    {
      title: "Replacement badge (lost)",
      description: "Lost the office badge during the office move.",
      item: "Office access badge",
      priority: "P4",
      status: "FULFILLED",
      days: -12,
      assigneeId: adminId,
    },
  ]

  let createdRequests = 0
  for (const seed of requestSeeds) {
    const existing = await prisma.serviceRequest.findFirst({ where: { organizationId: org.id, title: seed.title } })
    if (existing) continue
    const created = new Date()
    created.setDate(created.getDate() + seed.days)
    const itemId = itemByName.get(seed.item) ?? null
    await prisma.serviceRequest.create({
      data: {
        organizationId: org.id,
        number: await nextNumber(org.id, "REQ"),
        itemId,
        title: seed.title,
        description: seed.description,
        priority: seed.priority,
        status: seed.status,
        formData: itemId
          ? { justification: seed.description, neededBy: daysFromNow(7).toISOString().slice(0, 10), seats: 6, plan: "annual", system: "api", role: "logs-reader", duration: "1 week", reason: seed.description, period: "2026-08", employee: "N. Contractor", items: "Headset", remoteOnly: true }
          : {},
        requesterId: memberId,
        requesterEmail: memberId ? "member@techverse.dev" : null,
        requesterName: "Mona Member",
        assigneeId: seed.assigneeId,
        approverId: seed.status === "PENDING_APPROVAL" ? null : managerId,
        approvedAt: seed.status === "PENDING_APPROVAL" ? null : created,
        resolvedAt: seed.status === "FULFILLED" ? daysFromNow(-10) : null,
        closedAt: null,
        targetAt: daysFromNow(3),
        dueAt: daysFromNow(1),
        rating: seed.status === "FULFILLED" ? 5 : null,
        source: "app",
        createdAt: created,
        updatedAt: created,
      },
    })
    createdRequests += 1
  }
  console.log(`[seed:service-desk] requests: ${requestSeeds.length} (${createdRequests} new)`)

  // Sample incidents
  const incidentSeeds: {
    title: string
    description: string
    priority: ServicePriority
    status: IncidentStatus
    days: number
    assigneeId: string | null
    resolution?: string
    rootCause?: string
  }[] = [
    {
      title: "Checkout API returning 502 for 4% of traffic",
      description: "Load balancer reports upstream connection resets since 09:20.",
      priority: "P1",
      status: "IN_PROGRESS",
      days: 0,
      assigneeId: memberId,
    },
    {
      title: "Users cannot reset passwords (SMTP timeout)",
      description: "Password reset emails time out after the mail provider migration.",
      priority: "P2",
      status: "NEW",
      days: 0,
      assigneeId: null,
    },
    {
      title: "Nightly database backup job failed",
      description: "Backup job exited with code 1; last successful run was 26 hours ago.",
      priority: "P2",
      status: "RESOLVED",
      days: -2,
      assigneeId: adminId,
      resolution: "Increased the statement timeout and re-ran the job manually; next run succeeded.",
      rootCause: "Maintenance queries exceeded the default 5 minute statement timeout after the index rebuild.",
    },
  ]

  let createdIncidents = 0
  for (const seed of incidentSeeds) {
    const existing = await prisma.incident.findFirst({ where: { organizationId: org.id, title: seed.title } })
    if (existing) continue
    const created = new Date()
    created.setDate(created.getDate() + seed.days)
    const number = await nextNumber(org.id, "INC")
    const resolvedAt = seed.status === "RESOLVED" ? daysFromNow(-1) : null
    await prisma.incident.create({
      data: {
        organizationId: org.id,
        number,
        title: seed.title,
        description: seed.description,
        priority: seed.priority,
        status: seed.status,
        category: "IT",
        assigneeId: seed.assigneeId,
        requesterId: memberId,
        requesterEmail: "member@techverse.dev",
        requesterName: "Mona Member",
        resolution: seed.resolution ?? null,
        rootCause: seed.rootCause ?? null,
        firstRespondedAt: seed.status === "NEW" ? null : new Date(created.getTime() + 12 * 60_000),
        resolvedAt,
        responseDueAt: new Date(created.getTime() + 60 * 60_000),
        resolveDueAt: new Date(created.getTime() + 8 * 60 * 60_000),
        responseBreached: seed.status === "NEW",
        resolveBreached: false,
        source: "app",
        createdAt: created,
        updatedAt: created,
      },
    })

    if (seed.status === "RESOLVED" && seed.rootCause) {
      const incident = await prisma.incident.findFirst({ where: { organizationId: org.id, number } })
      const existingArticle = await prisma.knowledgeArticle.findFirst({
        where: { organizationId: org.id, title: "Database backup failures after index rebuilds" },
      })
      if (incident && !existingArticle) {
        await prisma.knowledgeArticle.create({
          data: {
            organizationId: org.id,
            title: "Database backup failures after index rebuilds",
            slug: "database-backup-failures-after-index-rebuilds",
            summary: "Why nightly backups stop after a large index rebuild, and the fix.",
            category: "IT",
            body: [
              "## Symptom",
              "The nightly `pg_dump` job exits with code 1 shortly after a large `CREATE INDEX`.",
              "",
              "## Cause",
              "Long-running maintenance queries exceeded the default statement timeout, which aborts the dump.",
              "",
              "## Fix",
              "Raise the timeout for the maintenance role, then re-run the job. Schedule index rebuilds outside backup windows.",
            ].join("\n"),
            tags: ["database", "backup", "postgres"],
            published: true,
            authorId: adminId,
            incidentId: incident.id,
          },
        })
      }
    }
    createdIncidents += 1
  }
  console.log(`[seed:service-desk] incidents: ${incidentSeeds.length} (${createdIncidents} new)`)

  // A short comment thread so the UI is not empty on first load.
  const firstIncident = await prisma.incident.findFirst({
    where: { organizationId: org.id, assigneeId: memberId },
    orderBy: { createdAt: "desc" },
  })
  if (firstIncident) {
    const existingComment = await prisma.serviceComment.findFirst({
      where: { organizationId: org.id, entityType: ServiceEntityType.INCIDENT, entityId: firstIncident.id },
    })
    if (!existingComment) {
      await prisma.serviceComment.createMany({
        data: [
          {
            organizationId: org.id,
            entityType: ServiceEntityType.INCIDENT,
            entityId: firstIncident.id,
            authorId: memberId,
            body: "Confirmed on staging as well — looks related to the connection pool limits.",
            internal: false,
          },
          {
            organizationId: org.id,
            entityType: ServiceEntityType.INCIDENT,
            entityId: firstIncident.id,
            authorId: managerId ?? adminId,
            body: "Raised with the platform team, they are rolling back the pool change now.",
            internal: true,
          },
        ],
      })
      console.log("[seed:service-desk] comments: 2 new")
    }
  }

  const totals = {
    items: await prisma.serviceItem.count({ where: { organizationId: org.id } }),
    requests: await prisma.serviceRequest.count({ where: { organizationId: org.id } }),
    incidents: await prisma.incident.count({ where: { organizationId: org.id } }),
    articles: await prisma.knowledgeArticle.count({ where: { organizationId: org.id } }),
    comments: await prisma.serviceComment.count({ where: { organizationId: org.id } }),
    sla: await prisma.serviceSlaPolicy.count({ where: { organizationId: org.id } }),
  }
  console.log(`[seed:service-desk] totals: ${JSON.stringify(totals)}`)
}

main()
  .catch((e) => {
    console.error("[seed:service-desk] failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())