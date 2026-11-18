# TechVerse — AI-powered technical debt intelligence

TechVerse detects, analyses and helps refactor technical debt across a codebase.
It combines AST analysis, complexity/maintainability metrics, a YAML rule engine,
an AI planner and a full delivery workspace (projects, pipelines, hosted Git,
service desk, chat, timesheets, payroll, leave).

The repository is a monorepo: Rust analysis crates, a NestJS API, a Go gateway,
a standalone realtime service, a Python AI planner, and a Next.js 16 dashboard
built on the personal [`@adem.rejeb/ui`](https://www.npmjs.com/package/@adem.rejeb/ui)
design system.

---

## Quick start (Docker)

```bash
git clone https://github.com/ademrejeb/aydoesmr.git
cd aydoesmr
cp .env.example .env        # optional: every value has a dev default
docker compose up -d --build
```

| Service | URL |
| --- | --- |
| Dashboard | <http://localhost:3000> |
| API | <http://localhost:3001/api> |
| API health | <http://localhost:3001/api/health> |
| Go gateway | <http://localhost:8081> (container port 8080) |
| WebSocket | <http://localhost:8092> |
| **pgAdmin** | <http://localhost:5050> (`admin@techverse.dev` / `admin`) |
| Postgres | `localhost:5432` (`techverse` / `techverse_dev`) |

The API container applies Prisma migrations on boot. Seed demo data with:

```bash
make db-seed
```

That creates **TechVerse Studio** with six users (`owner@techverse.dev`,
`admin@`, `manager@`, `member@`, `viewer@`, `contractor@techverse.dev`), all with
the password `DemoPass123!`. Log in at <http://localhost:3000/login>.

Stop everything with `docker compose down` (volumes are kept). To wipe the local
database: `docker compose down -v`.

The database is **never** stored in the repository. See
[`docs/DATABASE.md`](docs/DATABASE.md) for pgAdmin, migrations, reset and
troubleshooting.

---

## Software Factory

TechVerse now includes a governed software-factory foundation: explainable issue
triage, versioned plans, specialist agent profiles, deterministic policy rules,
isolated branch execution, real scan gates, independent review and human merge
approval. See:

- [`docs/architecture/software-factory.md`](docs/architecture/software-factory.md)
- [`docs/engineering/SOFTWARE_FACTORY_LEDGER.md`](docs/engineering/SOFTWARE_FACTORY_LEDGER.md)

The factory uses the existing project, Git, analysis, agent-connection, pipeline,
notification and tenancy modules. It does not replace them, and it never claims
test evidence that was not executed.

## Architecture

```text
techdebt-platform/      Next.js 16 dashboard (React 19, Tailwind 4, @adem.rejeb/ui)
        │  REST + Socket.IO
        ▼
services/api/           NestJS modular monolith + Prisma + Postgres + Socket.IO
        │
        ├── services/gateway/        Go analysis gateway
        ├── services/websocket/      standalone realtime fan-out
        ├── services/notifications/  notification worker
        └── services/ai-planner/     Python planning service
                │
                ▼
crates/                 Rust workspace
  td-common             shared types (ASTNode, Issue, Severity)
  td-ast                tree-sitter parsing (TS/JS, Python, Rust)
  td-metrics            complexity + maintainability
  td-rules              YAML rule engine
  td-cli                `td` command-line interface
```

### Repository layout

| Path | Purpose |
| --- | --- |
| `crates/` | Rust analysis workspace |
| `services/api/` | NestJS API, Prisma schema and migrations |
| `services/gateway/` | Go analysis gateway |
| `services/websocket/` | Realtime service |
| `services/notifications/` | Notification worker |
| `services/ai-planner/` | Python AI planner |
| `techdebt-platform/` | Next.js dashboard (primary UI) |
| `infra/` | Docker, Kubernetes, Terraform |
| `migrations/` | Legacy SQL migration for the Rust analyzer |
| `docs/` | Database, UI and architecture notes |
| `.opencode/skills/` | Agent skills (Ponytail, Graphify) |

---

## Local development (without Docker)

Prerequisites: Node.js 22+, Rust 1.70+, Go 1.22+, Python 3.11+, Docker.

```bash
# 1. Database + pgAdmin only
docker compose up -d postgres pgadmin

# 2. API
cd services/api
cp .env.example .env
npm install
npx prisma generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev            # :3001

# 3. Dashboard (new terminal)
cd techdebt-platform
npm install
npm run dev                  # :3000

# 4. Rust CLI (new terminal, repo root)
cargo build --package td-cli
cargo run --package td-cli -- analyze ./techdebt-platform/src
```

`make` wraps the common commands:

```bash
make up            # full docker stack
make down          # stop (volumes kept)
make db-migrate    # Prisma migrations
make db-seed       # demo data
make db-studio     # Prisma Studio on :5555
make web-dev       # Next.js on :3000
make api-dev       # NestJS on :3001
make build         # Rust workspace
make test          # Rust tests
make lint          # rustfmt + clippy
make graphify      # local code knowledge graph
```

---

## Design system

The dashboard uses the personal `@adem.rejeb/ui` package. The app's Tailwind
tokens are aliases of the design system's semantic tokens, so there is one
palette in light and dark mode.

- Styles are imported once from `techdebt-platform/src/app/globals.css` inside a
  dedicated `ui` cascade layer.
- `Button` and `Card` in `@/components/ui` are backed by the design system while
  keeping their existing prop names.
- Theme changes write both `class="dark"` (Tailwind) and `data-theme` (design
  system) to `<html>`.

Details and migration rules: [`docs/UI.md`](docs/UI.md).

---

## Agent workflow

This repository ships two OpenCode skills and a root `AGENTS.md`:

- **Ponytail** (`.opencode/skills/ponytail/`) — lazy-senior-dev rules: smallest
  complete change, no speculative abstractions, one test for risky logic.
- **Graphify** (`.opencode/skills/graphify/`) — build a local AST knowledge
  graph and query it for architecture questions instead of grepping blindly.

```bash
make graphify                                     # code graph (no API key)
python -m graphify query "How does auth work?"    # query it
```

---

## Testing and CI

```bash
cargo fmt --all -- --check
cargo clippy --workspace -- -D warnings
cargo test --workspace
npm --prefix services/api run typecheck
npm --prefix techdebt-platform run build
```

GitHub Actions (`.github/workflows/ci.yml`) runs the Rust lint/test jobs, the Go
build, the API typecheck and the dashboard production build.

---

## Environment

Only `.env.example` files are committed. Copy them to `.env`; the real files are
git-ignored.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | JWT signing secret |
| `AI_ENCRYPTION_KEY` | 64-hex key for AI provider keys at rest |
| `GATEWAY_URL` | Go analysis gateway |
| `WS_URL` | Realtime service |
| `NEXT_PUBLIC_API_URL` | Dashboard → API |
| `NEXT_PUBLIC_WS_URL` | Dashboard → WebSocket |

---

## License

Proprietary. All rights reserved.
