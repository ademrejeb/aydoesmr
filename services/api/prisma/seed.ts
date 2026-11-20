import "dotenv/config"
import { PrismaClient, OrgRole, Severity, ScanStatus, SprintStatus, TaskPriority, TaskType, NotificationType } from "@prisma/client"
import * as bcrypt from "bcryptjs"

const prisma = new PrismaClient()
const PASSWORD_HASH = bcrypt.hashSync("DemoPass123!", 12)

const SEED_USERS = [
  { email: "owner@techverse.dev", fullName: "Sara Owner", locale: "en" as const },
  { email: "admin@techverse.dev", fullName: "Adam Admin", locale: "en" as const },
  { email: "manager@techverse.dev", fullName: "Malik Manager", locale: "ar" as const },
  { email: "member@techverse.dev", fullName: "Mona Member", locale: "en" as const },
  { email: "viewer@techverse.dev", fullName: "Victor Viewer", locale: "fr" as const },
  { email: "contractor@techverse.dev", fullName: "Noura Contractor", locale: "en" as const },
]

const STUDIO_MEMBERSHIP: { email: string; role: OrgRole; title: string | null }[] = [
  { email: "owner@techverse.dev", role: OrgRole.OWNER, title: "CEO & Founder" },
  { email: "admin@techverse.dev", role: OrgRole.ADMIN, title: "Platform Admin" },
  { email: "manager@techverse.dev", role: OrgRole.MANAGER, title: "Engineering Lead" },
  { email: "member@techverse.dev", role: OrgRole.MEMBER, title: "Full-Stack Engineer" },
  { email: "viewer@techverse.dev", role: OrgRole.VIEWER, title: null },
  { email: "contractor@techverse.dev", role: OrgRole.MEMBER, title: "QA Contractor" },
]

const DEMO_MEMBERSHIP: { email: string; role: OrgRole; title: string | null }[] = [
  { email: "owner@techverse.dev", role: OrgRole.ADMIN, title: "Admin" },
  { email: "admin@techverse.dev", role: OrgRole.MANAGER, title: "Manager" },
  { email: "manager@techverse.dev", role: OrgRole.MEMBER, title: "Engineer" },
  { email: "member@techverse.dev", role: OrgRole.MEMBER, title: "Engineer" },
  { email: "viewer@techverse.dev", role: OrgRole.VIEWER, title: "QA" },
  { email: "contractor@techverse.dev", role: OrgRole.MEMBER, title: "Contractor" },
]

async function upsertUser(input: { email: string; fullName: string; locale: string }) {
  return prisma.user.upsert({
    where: { email: input.email },
    create: { email: input.email, fullName: input.fullName, passwordHash: PASSWORD_HASH, locale: input.locale },
    update: {},
  })
}

async function upsertOrg(input: { name: string; slug: string }, accountsOnly = false) {
  return prisma.organization.upsert({
    where: { slug: input.slug },
    create: {
      name: input.name,
      slug: input.slug,
      plan: "pro",
      currency: "USD",
      locale: "en",
      timezone: "Africa/Tunis",
      status: "active",
      billingEmail: "billing@techverse.dev",
      billing: { create: { plan: "pro", seats: 25, usageLimit: 5000, usageThisPeriod: accountsOnly ? 0 : 412, status: "active" } },
    },
    update: { plan: "pro", status: "active" },
    include: { members: true },
  })
}

async function upsertMembership(organizationId: string, userId: string, role: OrgRole, title: string | null) {
  return prisma.organizationMember.upsert({
    where: { organizationId_userId: { organizationId, userId } },
    create: { organizationId, userId, role, title },
    update: { role, title },
  })
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

async function main() {
  console.log("[seed] upserting users...")
  const users = await Promise.all(SEED_USERS.map(upsertUser))
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u]))

  // -----------------------------------------------------------------
  //  Organization: TechVerse Studio
  // -----------------------------------------------------------------
  console.log("[seed] creating TechVerse Studio...")
  const studioOrg = await upsertOrg(
    { name: "TechVerse Studio", slug: "techverse-studio" },
    process.argv.includes("--accounts"),
  )

  // Ensure billing row exists
  const billing = await prisma.billing.findUnique({ where: { organizationId: studioOrg.id } })
  if (!billing) {
    await prisma.billing.create({
      data: { organizationId: studioOrg.id, plan: "pro", seats: 25, usageLimit: 5000, usageThisPeriod: 412, status: "active" },
    })
  }

  // Members for studio
  for (const m of STUDIO_MEMBERSHIP) {
    const user = byEmail[m.email]
    if (user) await upsertMembership(studioOrg.id, user.id, m.role, m.title)
  }

  // Demo production: accounts only, no projects, scans, runs or tasks.
  if (process.argv.includes("--accounts")) {
    console.log("[seed] accounts only: users, organization, memberships")
    return
  }

  // -----------------------------------------------------------------
  //  Augment existing tv-e2e org (skip gracefully if absent)
  // -----------------------------------------------------------------
  const e2eOrg = await prisma.organization.findUnique({ where: { slug: "tv-e2e" } })
  if (e2eOrg) {
    console.log("[seed] augmenting tv-e2e org...")
    for (const m of DEMO_MEMBERSHIP) {
      const user = byEmail[m.email]
      if (user) await upsertMembership(e2eOrg.id, user.id, m.role, m.title)
    }
    // Augment invites
    for (const inv of [
      { email: "external-qa@outlook.com", role: OrgRole.MEMBER, title: "QA Tester" },
      { email: "designer@external.io", role: OrgRole.VIEWER, title: "Design Consultant" },
    ]) {
      const existing = await prisma.invite.findFirst({ where: { organizationId: e2eOrg.id, email: inv.email, status: "PENDING" } })
      if (!existing) {
        await prisma.invite.create({
          data: {
            organizationId: e2eOrg.id,
            email: inv.email,
            role: inv.role,
            title: inv.title,
            token: require("crypto").randomBytes(32).toString("hex"),
            invitedById: byEmail["owner@techverse.dev"].id,
            expiresAt: new Date(Date.now() + 14 * 86400_000),
          },
        })
      }
    }
    // Audit logs in tv-e2e
    await createAuditLogs(e2eOrg.id)
  }

  // -----------------------------------------------------------------
  //  Departments & Teams
  // -----------------------------------------------------------------
  const eng = await findOrCreateDepartment(studioOrg.id, "Engineering", "Platform & infrastructure")
  const des = await findOrCreateDepartment(studioOrg.id, "Design", "UX & brand")

  const coreTeam = await findOrCreateTeam(studioOrg.id, "Core Platform Team", "Backend & infrastructure", eng?.id)
  const mobileTeam = await findOrCreateTeam(studioOrg.id, "Mobile Squad", "React Native apps", eng?.id)
  const designTeam = await findOrCreateTeam(studioOrg.id, "Design Guild", "Design system & UX", des?.id)

  // Team members
  for (const [teamId, emails] of [
    [coreTeam.id, ["manager@techverse.dev", "member@techverse.dev", "admin@techverse.dev"]],
    [mobileTeam.id, ["contractor@techverse.dev", "member@techverse.dev"]],
    [designTeam.id, ["viewer@techverse.dev"]],
  ] as const) {
    for (const email of emails) {
      const user = byEmail[email]
      if (user) {
        await prisma.teamMember.upsert({
          where: { teamId_userId: { teamId, userId: user.id } },
          create: { teamId, userId: user.id, role: email === emails[0] ? "lead" : "member" },
          update: {},
        })
      }
    }
  }

  // -----------------------------------------------------------------
  //  Project: Platform Core
  // -----------------------------------------------------------------
  const projectCore = await findOrCreateProject(
    studioOrg.id,
    byEmail["manager@techverse.dev"].id,
    "Platform Core",
    "Main platform API and frontend",
    "ENGINEERING"
  )

  const workflow = await prisma.workflow.upsert({
    where: { projectId_name: { projectId: projectCore.id, name: "Board" } },
    create: { organizationId: studioOrg.id, projectId: projectCore.id, name: "Board" },
    update: {},
  })

  const colBacklog = await findOrCreateColumn(workflow.id, "Backlog", "BACKLOG", "#6b7280", true, 0)
  const colTodo = await findOrCreateColumn(workflow.id, "To Do", "TODO", "#2563eb", false, 1)
  const colInProgress = await findOrCreateColumn(workflow.id, "In Progress", "IN_PROGRESS", "#f59e0b", false, 2)
  const colDone = await findOrCreateColumn(workflow.id, "Done", "DONE", "#22c55e", false, 3)

  // Sprints
  const sprintCompleted = await findOrCreateSprint(studioOrg.id, projectCore.id, "Sprint 22", SprintStatus.COMPLETED, daysAgo(24), daysAgo(10))
  const sprintActive = await findOrCreateSprint(studioOrg.id, projectCore.id, "Sprint 23", SprintStatus.ACTIVE, daysAgo(3), daysAgo(11))
  const sprintPlanning = await findOrCreateSprint(studioOrg.id, projectCore.id, "Sprint 24", SprintStatus.PLANNING, daysAgo(-7), daysAgo(-7).getTime() + 14 * 86400_000)

  // Tasks (epics, stories, bugs)
  const epicAuth = await findOrCreateTask(studioOrg.id, projectCore.id, sprintActive.id, colInProgress.id, "Authentication system", TaskType.EPIC, TaskPriority.HIGH, byEmail["manager@techverse.dev"].id, byEmail["manager@techverse.dev"].id, 13)
  const epicSearch = await findOrCreateTask(studioOrg.id, projectCore.id, sprintActive.id, colTodo.id, "Search & filtering", TaskType.EPIC, TaskPriority.MEDIUM, byEmail["manager@techverse.dev"].id, byEmail["manager@techverse.dev"].id, 8)

  await findOrCreateTask(studioOrg.id, projectCore.id, sprintActive.id, colInProgress.id, "Implement JWT refresh rotation", TaskType.STORY, TaskPriority.HIGH, byEmail["member@techverse.dev"].id, byEmail["manager@techverse.dev"].id, 5, epicAuth.id)
  await findOrCreateTask(studioOrg.id, projectCore.id, sprintActive.id, colTodo.id, "Add SAML SSO connector", TaskType.STORY, TaskPriority.URGENT, byEmail["admin@techverse.dev"].id, byEmail["manager@techverse.dev"].id, 8, epicAuth.id)
  await findOrCreateTask(studioOrg.id, projectCore.id, sprintActive.id, colBacklog.id, "Password strength validation", TaskType.STORY, TaskPriority.LOW, null, byEmail["member@techverse.dev"].id, 3, epicAuth.id)

  await findOrCreateTask(studioOrg.id, projectCore.id, sprintActive.id, colTodo.id, "Full-text project search", TaskType.STORY, TaskPriority.MEDIUM, byEmail["member@techverse.dev"].id, byEmail["member@techverse.dev"].id, 5, epicSearch.id)
  await findOrCreateTask(studioOrg.id, projectCore.id, sprintActive.id, colBacklog.id, "Fuzzy task title search", TaskType.STORY, TaskPriority.LOW, null, byEmail["viewer@techverse.dev"].id, 3, epicSearch.id)

  await findOrCreateTask(studioOrg.id, projectCore.id, sprintActive.id, colInProgress.id, "Race condition on project create", TaskType.BUG, TaskPriority.URGENT, byEmail["contractor@techverse.dev"].id, byEmail["member@techverse.dev"].id, 3)

  await findOrCreateTask(studioOrg.id, projectCore.id, sprintCompleted.id, colDone.id, "Setup CI/CD pipeline", TaskType.TASK, TaskPriority.HIGH, byEmail["admin@techverse.dev"].id, byEmail["admin@techverse.dev"].id, 5, null, "DONE")
  await findOrCreateTask(studioOrg.id, projectCore.id, sprintCompleted.id, colDone.id, "Database migration scripts", TaskType.TASK, TaskPriority.MEDIUM, byEmail["member@techverse.dev"].id, byEmail["member@techverse.dev"].id, 3, null, "DONE")

  // -----------------------------------------------------------------
  //  Project: Design System
  // -----------------------------------------------------------------
  const projectDs = await findOrCreateProject(studioOrg.id, byEmail["member@techverse.dev"].id, "Design System", "Shared component library", "ENGINEERING")
  await prisma.workflow.upsert({
    where: { projectId_name: { projectId: projectDs.id, name: "Board" } },
    create: { organizationId: studioOrg.id, projectId: projectDs.id, name: "Board" },
    update: {},
  })

  // -----------------------------------------------------------------
  //  Conversations & Messages
  // -----------------------------------------------------------------
  const teamConv = await findOrCreateConversation(studioOrg.id, "Team Lounge", "GROUP")
  for (const email of Object.keys(byEmail)) {
    const user = byEmail[email]
    if (user) {
      await prisma.conversationMember.upsert({
        where: { conversationId_userId: { conversationId: teamConv.id, userId: user.id } },
        create: { conversationId: teamConv.id, userId: user.id },
        update: {},
      })
    }
  }
  const convMsgs = [
    { sender: "owner@techverse.dev", body: "Welcome to TechVerse Studio! Excited to have everyone here." },
    { sender: "manager@techverse.dev", body: "Sprint 23 kicks off Monday. Please review your assigned tickets." },
    { sender: "member@techverse.dev", body: "On it! I'll start with the JWT refresh rotation." },
    { sender: "contractor@techverse.dev", body: "I'll pick up the race condition bug today." },
  ]
  for (const msg of convMsgs) {
    const sender = byEmail[msg.sender]
    if (sender) {
      const exists = await prisma.message.findFirst({ where: { conversationId: teamConv.id, senderId: sender.id, body: msg.body } })
      if (!exists) await prisma.message.create({ data: { organizationId: studioOrg.id, conversationId: teamConv.id, senderId: sender.id, body: msg.body } })
    }
  }

  // -----------------------------------------------------------------
  //  Notifications
  // -----------------------------------------------------------------
  const tasks = await prisma.task.findMany({ where: { organizationId: studioOrg.id }, take: 3 })
  for (const task of tasks) {
    if (!task.assigneeId) continue
    const exists = await prisma.notification.findFirst({ where: { organizationId: studioOrg.id, userId: task.assigneeId, type: NotificationType.TASK_ASSIGNED, title: `Assigned to: ${task.title}` } })
    if (!exists) {
      await prisma.notification.create({
        data: {
          organizationId: studioOrg.id,
          userId: task.assigneeId,
          type: NotificationType.TASK_ASSIGNED,
          title: `Assigned to: ${task.title}`,
          body: task.description?.slice(0, 120) ?? null,
        },
      })
    }
  }
  // System notifications for all users
  for (const email of Object.keys(byEmail)) {
    const user = byEmail[email]
    if (!user) continue
    const exists = await prisma.notification.findFirst({ where: { organizationId: studioOrg.id, userId: user.id, type: NotificationType.SYSTEM, title: "Organization created" } })
    if (!exists) {
      await prisma.notification.create({
        data: { organizationId: studioOrg.id, userId: user.id, type: NotificationType.SYSTEM, title: "Organization created", body: "TechVerse Studio is now active." },
      })
    }
  }

  // -----------------------------------------------------------------
  //  Git & Dev Repositories
  // -----------------------------------------------------------------
  const storagePath = `data/git/${studioOrg.id}/studio-core.git`
  const existsGit = await prisma.gitRepository.findFirst({ where: { organizationId: studioOrg.id, name: "studio-core" } })
  if (!existsGit) {
    await prisma.gitRepository.create({
      data: {
        organizationId: studioOrg.id,
        projectId: projectCore.id,
        name: "studio-core",
        description: "Core platform monorepo",
        visibility: "private",
        storagePath,
        defaultBranch: "main",
        sizeKb: 24500,
        fileCount: 187,
        lastCommitSha: "a3f2c1d9e4b5",
        lastPushAt: daysAgo(0),
      },
    })
  }

  const devRepoExists = await prisma.devRepository.findFirst({ where: { organizationId: studioOrg.id, name: "studio-api" } })
  let devRepo: { id: string }
  if (!devRepoExists) {
    devRepo = await prisma.devRepository.create({
      data: {
        organizationId: studioOrg.id,
        projectId: projectCore.id,
        name: "studio-api",
        url: "https://github.com/techverse/studio-api",
        provider: "github",
        language: "TypeScript",
        sizeKb: 42100,
        scanOnPush: true,
      },
    })
  } else {
    devRepo = devRepoExists as any
  }

  const scanExists = await prisma.devScan.findFirst({ where: { organizationId: studioOrg.id, repositoryId: devRepo.id } })
  let scan: { id: string }
  if (!scanExists) {
    scan = await prisma.devScan.create({
      data: {
        organizationId: studioOrg.id,
        repositoryId: devRepo.id,
        projectId: projectCore.id,
        status: ScanStatus.SUCCESS,
        startedAt: daysAgo(1),
        completedAt: daysAgo(1),
        durationMs: 14200,
        filesScanned: 124,
        linesAnalyzed: 8450,
        metrics: { lines_of_code: 8450, files_scanned: 124, complexity_avg: 4.2, debt_ratio: 12.3 },
      },
    })
  } else {
    scan = scanExists as any
  }

  const issuesData = [
    { filePath: "src/services/auth.service.ts", message: "Unhandled promise rejection in token refresh", severity: Severity.CRITICAL, category: "reliability", ruleId: "E001" },
    { filePath: "src/modules/git/git-http.controller.ts", message: "N+1 query on info/refs", severity: Severity.HIGH, category: "performance", ruleId: "P001" },
    { filePath: "src/modules/projects/projects.controller.ts", message: "Missing input validation on project name", severity: Severity.MEDIUM, category: "security", ruleId: "S003" },
    { filePath: "src/modules/conversations/conversations.service.ts", message: "Deprecated API usage in message pagination", severity: Severity.LOW, category: "maintainability", ruleId: "M002" },
    { filePath: "src/lib/mail/mail.service.ts", message: "Unused import in mail service", severity: Severity.INFO, category: "code-quality", ruleId: "Q001" },
  ]
  for (const issue of issuesData) {
    const exists = await prisma.devIssue.findFirst({ where: { scanId: scan.id, filePath: issue.filePath, message: issue.message } })
    if (!exists) {
      await prisma.devIssue.create({
        data: {
          organizationId: studioOrg.id,
          scanId: scan.id,
          filePath: issue.filePath,
          lineNumber: Math.floor(Math.random() * 200) + 1,
          message: issue.message,
          severity: issue.severity,
          category: issue.category,
          ruleId: issue.ruleId,
          fingerprint: require("crypto").createHash("sha1").update(`${scan.id}:${issue.filePath}:${issue.ruleId}`).digest("hex"),
        },
      })
    }
  }

  // -----------------------------------------------------------------
  //  Invites (studio org)
  // -----------------------------------------------------------------
  const inv1Exists = await prisma.invite.findFirst({ where: { organizationId: studioOrg.id, email: "external-qa@outlook.com", status: "PENDING" } })
  if (!inv1Exists) {
    await prisma.invite.create({
      data: {
        organizationId: studioOrg.id,
        email: "external-qa@outlook.com",
        role: OrgRole.MEMBER,
        title: "QA Tester",
        token: require("crypto").randomBytes(32).toString("hex"),
        invitedById: byEmail["owner@techverse.dev"].id,
        expiresAt: new Date(Date.now() + 14 * 86400_000),
      },
    })
  }
  const inv2Exists = await prisma.invite.findFirst({ where: { organizationId: studioOrg.id, email: "designer@external.io", status: "PENDING" } })
  if (!inv2Exists) {
    await prisma.invite.create({
      data: {
        organizationId: studioOrg.id,
        email: "designer@external.io",
        role: OrgRole.VIEWER,
        title: "Design Consultant",
        token: require("crypto").randomBytes(32).toString("hex"),
        invitedById: byEmail["admin@techverse.dev"].id,
        expiresAt: new Date(Date.now() + 14 * 86400_000),
      },
    })
  }
  const invAcceptedExists = await prisma.invite.findFirst({ where: { organizationId: studioOrg.id, email: "contractor@techverse.dev", status: "ACCEPTED" } })
  if (!invAcceptedExists) {
    await prisma.invite.create({
      data: {
        organizationId: studioOrg.id,
        email: "contractor@techverse.dev",
        role: OrgRole.MEMBER,
        title: "QA Contractor",
        token: require("crypto").randomBytes(32).toString("hex"),
        invitedById: byEmail["owner@techverse.dev"].id,
        expiresAt: daysAgo(-10),
        status: "ACCEPTED",
        acceptedAt: daysAgo(8),
      },
    })
  }

  // -----------------------------------------------------------------
  //  CI/CD Pipelines (studio org)
  // -----------------------------------------------------------------
  const studioGitRepo = await prisma.gitRepository.findFirst({ where: { organizationId: studioOrg.id, name: "studio-core" } })
  const pipelineExists = await prisma.pipeline.findFirst({ where: { organizationId: studioOrg.id, name: "CI: Studio Core" } })
  let pipeline: { id: string }
  if (studioGitRepo) {
    if (!pipelineExists) {
      pipeline = await prisma.pipeline.create({
        data: {
          organizationId: studioOrg.id,
          repositoryId: studioGitRepo.id,
          name: "CI: Studio Core",
          description: "Lint, test and build the platform monorepo on every push.",
          trigger: "push",
          branch: "main",
          status: "active",
          createdById: byEmail["owner@techverse.dev"].id,
          steps: [
            { id: "ci-install", name: "Install dependencies", command: "npm ci" },
            { id: "ci-lint", name: "Lint & typecheck", command: "npm run lint && tsc --noEmit" },
            { id: "ci-test", name: "Run tests", command: "npm test" },
            { id: "ci-build", name: "Build", command: "npm run build" },
          ],
        },
      })
    } else {
      pipeline = pipelineExists
    }

    // Historical runs
    const runsData = [
      {
        status: "SUCCESS" as const,
        trigger: "push",
        commitSha: "a3f2c1d9e4b5",
        daysAgo: 1,
        durationMs: 48300,
        error: null,
      },
      {
        status: "FAILED" as const,
        trigger: "push",
        commitSha: "b7d4a1f3c9e2",
        daysAgo: 2,
        durationMs: 12700,
        error: 'Command failed: npm run lint — 3 errors in src/services/auth.service.ts',
      },
      {
        status: "SUCCESS" as const,
        trigger: "manual",
        commitSha: "b7d4a1f3c9e2",
        daysAgo: 4,
        durationMs: 51200,
        error: null,
      },
    ]
    for (const r of runsData) {
      const exists = await prisma.pipelineRun.findFirst({ where: { organizationId: studioOrg.id, pipelineId: pipeline.id, commitSha: r.commitSha, status: r.status } })
      if (!exists) {
        const stepNames = [
          { name: "Install dependencies", command: "npm ci" },
          { name: "Lint & typecheck", command: "npm run lint && tsc --noEmit" },
          { name: "Run tests", command: "npm test" },
          { name: "Build", command: "npm run build" },
        ]
        const lastFailed = r.status === "FAILED"
        await prisma.pipelineRun.create({
          data: {
            organizationId: studioOrg.id,
            pipelineId: pipeline.id,
            status: r.status,
            trigger: r.trigger,
            branch: "main",
            commitSha: r.commitSha,
            createdAt: daysAgo(r.daysAgo),
            startedAt: daysAgo(r.daysAgo),
            completedAt: daysAgo(r.daysAgo),
            durationMs: r.durationMs,
            error: r.error,
            createdById: byEmail["owner@techverse.dev"].id,
            steps: stepNames.map((s, i) => ({
              id: `seed-${i}`,
              name: s.name,
              command: s.command,
              status: lastFailed ? (i === 1 ? "FAILED" : i < 1 ? "SUCCESS" : "QUEUED") : "SUCCESS",
              startedAt: daysAgo(r.daysAgo),
              completedAt: daysAgo(r.daysAgo),
              durationMs: lastFailed && i === 1 ? 3400 : 5200 + i * 3100,
              output: lastFailed && i === 1 ? "npm ERR! 3 errors found in src/services/auth.service.ts" : "exit code 0",
            })),
          },
        })
      }
    }
  }

  // -----------------------------------------------------------------
  //  Git Tokens (for owner)
  // -----------------------------------------------------------------
  const tokenExists = await prisma.gitToken.findFirst({ where: { organizationId: studioOrg.id, userId: byEmail["owner@techverse.dev"].id, name: "CI Deploy" } })
  if (!tokenExists) {
    const tok = require("crypto").randomBytes(30).toString("hex")
    await prisma.gitToken.create({
      data: {
        organizationId: studioOrg.id,
        userId: byEmail["owner@techverse.dev"].id,
        name: "CI Deploy",
        tokenHash: require("crypto").createHash("sha256").update(tok).digest("hex"),
        prefix: tok.slice(0, 8),
        createdAt: daysAgo(12),
        lastUsedAt: daysAgo(1),
      },
    })
  }

  // -----------------------------------------------------------------
  //  AI Providers (studio org) — sample cloud + local configs
  // -----------------------------------------------------------------
  const aiOllamaExists = await prisma.aiProvider.findFirst({ where: { organizationId: studioOrg.id, name: "Ollama (Local)" } })
  if (!aiOllamaExists) {
    await prisma.aiProvider.create({
      data: {
        organizationId: studioOrg.id,
        name: "Ollama (Local)",
        type: "ollama",
        baseUrl: "http://localhost:11434",
        models: ["qwen2.5-coder:7b", "gemma4:12b", "mistral", "qwen3.5:4b", "deepseek-coder"],
        defaultModel: "qwen2.5-coder:7b",
        status: "active",
        createdById: byEmail["owner@techverse.dev"].id,
      },
    })
  }
  const aiOpenaiExists = await prisma.aiProvider.findFirst({ where: { organizationId: studioOrg.id, name: "OpenAI Cloud" } })
  if (!aiOpenaiExists) {
    await prisma.aiProvider.create({
      data: {
        organizationId: studioOrg.id,
        name: "OpenAI Cloud",
        type: "openai",
        baseUrl: "https://api.openai.com",
        models: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "o4-mini"],
        defaultModel: "gpt-4o-mini",
        status: "disabled",
        createdById: byEmail["owner@techverse.dev"].id,
      },
    })
  }

  // -----------------------------------------------------------------
  //  Audit Logs (studio org)
  // -----------------------------------------------------------------
  await createAuditLogs(studioOrg.id)

  console.log("[seed] done.")
  console.log("       login with any of: owner@techverse.dev / admin@techverse.dev / manager@techverse.dev / member@techverse.dev / viewer@techverse.dev / contractor@techverse.dev")
  console.log("       password: DemoPass123!")
  console.log(`       org: TechVerse Studio (slug: techverse-studio, id: ${studioOrg.id})`)
  if (e2eOrg) console.log(`       tv-e2e org (slug: tv-e2e, id: ${e2eOrg.id}) — augmented with members + invites`)
}

async function createAuditLogs(organizationId: string) {
  // Wipe previously seeded logs
  await prisma.auditLog.deleteMany({ where: { organizationId, metadata: { path: ["seed"], equals: true } } })

  const userIds = (await prisma.organizationMember.findMany({ where: { organizationId }, select: { userId: true } })).map((m) => m.userId)
  const ownerUserId = userIds[0] ?? userIds.find(Boolean)
  const managerUserId = userIds[2] ?? ownerUserId
  const adminUserId = userIds[1] ?? ownerUserId
  const memberUserId = userIds[3] ?? managerUserId

  const entries: { action: string; entityType: string; entityId: string | null; userId: string | null; metadata: Record<string, unknown>; daysAgo: number }[] = [
    { action: "organization.created", entityType: "organization", entityId: organizationId, userId: ownerUserId, metadata: { name: "TechVerse Studio", slug: "techverse-studio" }, daysAgo: 30 },
    { action: "member.invited", entityType: "member", entityId: null, userId: ownerUserId, metadata: { email: "adam.admin@techverse.dev", role: "ADMIN" }, daysAgo: 30 },
    { action: "member.joined", entityType: "member", entityId: null, userId: adminUserId, metadata: { email: "admin@techverse.dev", via: "invite" }, daysAgo: 29 },
    { action: "member.invited", entityType: "member", entityId: null, userId: adminUserId, metadata: { email: "malik.manager@techverse.dev", role: "MANAGER" }, daysAgo: 25 },
    { action: "member.joined", entityType: "member", entityId: null, userId: managerUserId, metadata: { email: "manager@techverse.dev", via: "invite" }, daysAgo: 24 },
    { action: "organization.updated", entityType: "organization", entityId: organizationId, userId: ownerUserId, metadata: { currency: "USD" }, daysAgo: 20 },
    { action: "member.added_existing", entityType: "member", entityId: null, userId: adminUserId, metadata: { email: "member@techverse.dev", role: "MEMBER" }, daysAgo: 15 },
    { action: "member.role_updated", entityType: "member", entityId: null, userId: adminUserId, metadata: { email: "member@techverse.dev", from: "MEMBER", to: "MEMBER", title: "Full-Stack Engineer" }, daysAgo: 15 },
    { action: "invite.created", entityType: "invite", entityId: null, userId: adminUserId, metadata: { email: "contractor@techverse.dev", role: "MEMBER" }, daysAgo: 12 },
    { action: "member.joined", entityType: "member", entityId: null, userId: memberUserId, metadata: { email: "contractor@techverse.dev", via: "invite" }, daysAgo: 8 },
    { action: "member.invited", entityType: "member", entityId: null, userId: managerUserId, metadata: { email: "viewer@techverse.dev", role: "VIEWER" }, daysAgo: 5 },
    { action: "invite.revoked", entityType: "invite", entityId: null, userId: managerUserId, metadata: { email: "old-contract@external.io", role: "VIEWER" }, daysAgo: 3 },
    { action: "organization.updated", entityType: "organization", entityId: organizationId, userId: adminUserId, metadata: { billingEmail: "billing@techverse.dev" }, daysAgo: 2 },
    { action: "token.created", entityType: "token", entityId: null, userId: ownerUserId, metadata: { name: "CI Deploy", prefix: "a1b2c3d4" }, daysAgo: 12 },
    { action: "token.revoked", entityType: "token", entityId: null, userId: ownerUserId, metadata: { name: "Old CI Token", prefix: "e5f6g7h8" }, daysAgo: 6 },
    { action: "pipeline.created", entityType: "pipeline", entityId: null, userId: ownerUserId, metadata: { name: "CI: Studio Core", trigger: "push" }, daysAgo: 12 },
    { action: "pipeline.run_completed", entityType: "pipeline", entityId: null, userId: ownerUserId, metadata: { name: "CI: Studio Core", result: "SUCCESS" }, daysAgo: 1 },
    { action: "pipeline.run_failed", entityType: "pipeline", entityId: null, userId: ownerUserId, metadata: { name: "CI: Studio Core", result: "FAILED" }, daysAgo: 2 },
    { action: "ai.provider.created", entityType: "ai_provider", entityId: null, userId: ownerUserId, metadata: { name: "Ollama (Local)", type: "ollama" }, daysAgo: 9 },
    { action: "ai.provider.created", entityType: "ai_provider", entityId: null, userId: ownerUserId, metadata: { name: "OpenAI Cloud", type: "openai" }, daysAgo: 9 },
    { action: "ai.test_ok", entityType: "ai_provider", entityId: null, userId: ownerUserId, metadata: { name: "Ollama (Local)", models: 5 }, daysAgo: 4 },
  ]

  for (const e of entries) {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId: e.userId,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        metadata: { ...e.metadata, seed: true },
        createdAt: daysAgo(e.daysAgo),
      },
    })
  }
}

async function findOrCreateDepartment(orgId: string, name: string, description: string | null) {
  const existing = await prisma.department.findFirst({ where: { organizationId: orgId, name } })
  if (existing) return existing
  return prisma.department.create({ data: { organizationId: orgId, name, description } })
}

async function findOrCreateTeam(orgId: string, name: string, description: string, departmentId?: string) {
  const existing = await prisma.team.findFirst({ where: { organizationId: orgId, name } })
  if (existing) return existing
  return prisma.team.create({ data: { organizationId: orgId, name, description, departmentId: departmentId ?? null } })
}

async function findOrCreateProject(orgId: string, ownerId: string, name: string, description: string, type: string) {
  const existing = await prisma.project.findFirst({ where: { organizationId: orgId, name } })
  if (existing) return existing
  return prisma.project.create({ data: { organizationId: orgId, ownerId, name, description, type: type as any } })
}

async function findOrCreateColumn(workflowId: string, name: string, status: string, color: string, isBacklog: boolean, position: number) {
  const existing = await prisma.workflowColumn.findFirst({ where: { workflowId, name } })
  if (existing) return existing
  return prisma.workflowColumn.create({ data: { workflowId, name, status, color, isBacklog, position } })
}

async function findOrCreateSprint(orgId: string, projectId: string, name: string, status: SprintStatus, startDate?: Date, endDate?: Date | number) {
  const existing = await prisma.sprint.findFirst({ where: { organizationId: orgId, projectId, name } })
  if (existing) return existing
  return prisma.sprint.create({
    data: {
      organizationId: orgId,
      projectId,
      name,
      status,
      startDate: startDate ?? null,
      endDate: typeof endDate === "number" ? new Date(endDate) : (endDate ?? null),
      completedAt: status === SprintStatus.COMPLETED ? (startDate ? new Date(startDate.getTime() + 10 * 86400_000) : new Date()) : null,
    },
  })
}

async function findOrCreateTask(
  orgId: string,
  projectId: string,
  sprintId: string | null,
  columnId: string | null,
  title: string,
  type: TaskType,
  priority: TaskPriority,
  assigneeId: string | null,
  reporterId: string | null,
  storyPoints: number | null,
  parentId: string | null = null,
  statusOverride?: string
) {
  const status = statusOverride ?? (columnId === null ? "TODO" : (await prisma.workflowColumn.findUnique({ where: { id: columnId } }))?.status ?? "TODO")
  const existing = await prisma.task.findFirst({ where: { projectId, title, parentId: parentId ?? null } })
  if (existing) return existing
  return prisma.task.create({
    data: {
      organizationId: orgId,
      projectId,
      sprintId,
      columnId,
      parentId,
      title,
      type,
      priority,
      status,
      storyPoints,
      assigneeId,
      reporterId,
      order: Math.floor(Math.random() * 1000),
    },
  })
}

async function findOrCreateConversation(orgId: string, name: string, type: string) {
  const existing = await prisma.conversation.findFirst({ where: { organizationId: orgId, name } })
  if (existing) return existing
  return prisma.conversation.create({ data: { organizationId: orgId, name, type: type as any } })
}

main()
  .catch((e) => {
    console.error("[seed] failed:", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())