# TechVerse Platform Architecture

**Arabic-First Unified Business Collaboration Platform** fused with **TechDebt AI** — an AI-native operating platform for Arab businesses: project management, team collaboration, communication, code analysis, and AI assistance in one affordable system.

## Positioning

A regional alternative to **Jira + Microsoft Teams + Slack + Trello + Notion** that is:

- Arabic-first (RTL), multilingual (AR / EN / FR)
- AI-native (deeply integrated, provider-abstraced, permission-aware)
- Multi-tenant from day one
- Affordable (Free / Team $2–3 / Business $4–5 / Enterprise custom)
- Deployable as SaaS Cloud, Dedicated Cloud, or On-Premise (Docker/K8s)

## Fusion Strategy

TechDebt AI is **not a separate product** — it is the **Development workspace** module of the platform:

- A business **Project** can be typed `engineering` and linked to git repositories.
- Running code analysis (Rust engine via Go gateway) produces **scan reports** stored in the platform.
- Findings become **Dev Issues** that can be triaged into **Tasks** and assigned to team members.
- Dashboards show code-health metrics (LOC, complexity, maintainability, issue counts) alongside project metrics.
- The AI assistant answers questions about code health and project status using org-authorized data only.

## Monorepo Layout

```
aydoesmr/
├── apps/
│   ├── web/                 # Next.js 16 — unified platform frontend (RTL/LTR, i18n)
│   └── (future) mobile/
├── services/
│   ├── api/                 # NestJS modular monolith (REST + socket.io)   ← PRIMARY BACKEND
│   ├── gateway/             # Go REST gateway → Rust engine (code analysis)
│   ├── websocket/           # socket.io real-time gateway
│   ├── notifications/       # notification dispatch (email/push/in-app)
│   └── ai-planner/          # AI planning service (FastAPI; provider abstraction)
├── crates/                  # Rust: td-common, td-ast, td-metrics, td-rules, td-cli (engine)
├── infra/
│   ├── docker/              # Dockerfiles + compose overlays
│   ├── kubernetes/          # Helm/Kustomize manifests (on-prem / dedicated)
│   └── terraform/           # SaaS cloud provisioning
├── migrations/              # SQL migrations (PostgreSQL)
├── docs/architecture/       # ADRs + design docs
└── cli/                     # tech-debt CLI packaging
```

## Backend: NestJS Modular Monolith

One deployable process, clearly separated feature modules that can later be extracted into Go/other services under load per `extract-service` decision.

```
services/api/src/modules/
├── auth/            register, login, refresh, JWT, SSO-ready
├── users/           profiles, roles
├── organizations/   org lifecycle, membership, RBAC roles
├── teams/           teams + membership
├── projects/        business projects (source of truth)
├── boards/          kanban columns, sprint support
├── tasks/           tasks/subtasks, assignees, due dates, status
├── comments/        comments + @mentions
├── chat/            conversations, messages (via websocket)
├── calendar/        events, meetings, web hooks
├── notifications/   in-app + outbox (WS/email)
├── files/           S3-compatible object storage
├── audit/           audit logs (append-only)
├── automations/     workflow rules
├── development/     TechDebt integration: repos, scans, dev issues
├── ai/              provider-abstracted assistant + usage credits
└── billing/         plans, usage limits (Stripe-ready)
```

## Cross-Cutting Concerns

| Concern | Approach |
|---|---|
| Multi-tenancy | `organizationId` on every tenant-scoped table; central `TenancyGuard` + `@OrganizationId()` param decorator; composite indexes `(org_id, x)` |
| RBAC | Roles: `owner, admin, manager, member, viewer` (org), `lead/member` (team), `owner/editor/viewer` (project); decorator-guarded permissions |
| Real-time | socket.io gateway with per-org rooms `/org/{id}`; auth via JWT |
| Jobs | BullMQ + Redis in production; in-process fallback in dev |
| Object storage | MinIO / S3 via SDK; presigned URLs |
| AI | Provider interface (OpenAI-compatible, Anthropic, local/private); strict org-scoped RAG; per-org credit budgets |
| Auth | JWT access + refresh rotation; Argon2/bcrypt hashing; SSO-ready OIDC stubs |
| Audit | Append-only `audit_logs`; immutable actor/action/tenant/timestamp |
| Deploy | SaaS (Terraform+K8s), dedicated (Argocd), on-prem (single docker image + docker-compose) |

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript, Tailwind v4, i18n (AR/EN/FR), socket.io-client
- **Backend:** NestJS 11, TypeScript, Prisma ORM, PostgreSQL 15+, Redis, socket.io, BullMQ
- **Engines:** Rust (code analysis), Go (gateway), Python FastAPI (AI planner)
- **Infra:** Docker, Kubernetes, Terraform; MinIO for S3; Prometheus/Grafana monitoring

## Data Model Highlights

All tenant entities carry `organization_id`. Core entities: `Organization, User, OrganizationMember, Department, Team, Project, Task, Comment, Conversation, Message, CalendarEvent, Meeting, FileAttachment, Notification, AuditLog, Subscription`. Dev entities: `DevRepository, DevScan, DevIssue, MetricSnapshot`.

## MVP Roadmap (17 items)

1. Auth (register/login/JWT refresh) → 2. Organizations + members → 3. Users/teams → 4. Projects → 5. Tasks/subtasks → 6. Kanban boards → 7. Comments/mentions → 8. Real-time chat → 9. Calendar → 10. Notifications → 11. File attachments → 12. Dashboards → 13. Search → 14. RBAC → 15. Basic AI assistant → 16. AR/EN/FR → 17. Responsive web.

**Development module (TechDebt fusion):** repos + scans + dev issues woven into items 4–6, 12, 13, 15.

## Scale Path

Monolith → extract `chat`, `notifications`, `analysis`, `ai` into Go services as load grows. N+1-proof queries via Prisma, DB read replicas, partition high-volume tables (`dev_issues`, `messages`, `audit_logs`), Redis caching, object storage offload, region-aware deployment with data residency.

## Decisions Log (ADRs live in this folder)

| ADR | Decision |
|---|---|
| 001 | Modular monolith first; extract under load |
| 002 | PostgreSQL + Prisma; Row-scoped tenancy via `organization_id` |
| 003 | Next.js frontend + NestJS API; typed contracts via shared packages |
| 004 | Rust engine = source of truth for analysis; Go gateway = REST boundary; Node proxies |
| 005 | AI via provider abstraction (never vendor-locked), org-scoped permissions + credit caps |