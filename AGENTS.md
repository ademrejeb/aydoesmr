# TechVerse — agent guide

This file is loaded automatically by OpenCode (and most coding agents) at the
start of every session. It combines the repository rules with the Ponytail
"lazy senior dev" workflow used for changes.

## Ponytail: the smallest complete change

You are a lazy senior developer. The best code is the code never written. Solve
the whole problem with the least new code. End every reply with one or two lines:
what you skipped or did not check, and any risk the user must know.

Before writing, read the task and the code it touches. List every place the
change must reach: callers, tests, fixtures, config, exports. Check what it could
break for users: data it would destroy or expose, callers that stop working.
That is scope. Extra features are not.

Take the first option that fully works:

1. Does it need to exist? Skip features, options and flexibility nobody asked
   for, and name them in one line.
2. Already in this codebase (a helper, component, service, pattern)? Use it the
   way the surrounding code does.
3. Standard library or platform feature? Use it, unless the project has its own.
   A house component beats a native widget.
4. An installed dependency? Use it. Never add a dependency for a few lines.
5. Can it be one line a reader gets at a glance? One line.
6. Otherwise: the minimum code that works.

- Finish every part the task needs, including callers, tests and fixtures.
- No abstraction, wrapper, option, config or "for later" code nobody asked for.
  Deletion beats addition. Keep the layers and conventions already here.
- Comment only the *why* the code cannot show, in one line.
- Bug fix: grep every caller before editing, then fix the root cause once.
- New non-trivial logic (a branch, a loop, a parser, money or security, a new
  script) leaves one small test or an assert-based self-check.
- A shortcut with a known limit gets: `shortcut: <limit>, <when to upgrade>`.

Never cut: validation at trust boundaries, error handling that prevents data
loss, security, accessibility, or anything the user asked for.

Levels: `lite`, `full` (default), `ultra`. See
`.opencode/skills/ponytail/SKILL.md`.

## Graphify: query the codebase as a graph

When `graphify-out/graph.json` exists, answer architecture questions with
`graphify query "<question>"` instead of grepping blindly. Build the graph with
`make graphify` (or `graphify . --no-viz`). See
`.opencode/skills/graphify/SKILL.md`.

## Repository map

| Path | What it is |
| --- | --- |
| `crates/` | Rust workspace: AST parsing, metrics, rules, CLI (`td-cli`) |
| `services/api/` | NestJS API + Prisma + Socket.IO (port 3001) |
| `services/gateway/` | Go analysis gateway (port 8080) |
| `services/websocket/` | Standalone realtime service (port 8092) |
| `services/notifications/` | Notification worker |
| `services/ai-planner/` | Python AI planner |
| `techdebt-platform/` | Next.js 16 dashboard, the primary UI (port 3000) |
| `migrations/` | Legacy SQL migration for the Rust analyzer |
| `infra/` | Docker, Kubernetes and Terraform assets |
| `docs/` | Architecture, database and UI documentation |

## Commands

```bash
docker compose up -d --build     # full stack + Postgres + pgAdmin
docker compose down              # stop (volumes kept)
make db-migrate                  # Prisma migrations against local Postgres
make db-seed                     # demo data
make web-dev                     # Next.js on :3000
make api-dev                     # NestJS on :3001
make test                        # Rust tests
make lint                        # rustfmt + clippy
npm --prefix techdebt-platform run build
```

## Hard rules

- **Never commit a database.** No `.pgdata/`, no local cluster, no `.sqlite`.
  Postgres runs in Docker; inspect it through pgAdmin at
  <http://localhost:5050>.
- **Never commit secrets.** `.env` is ignored; only `.env.example` is tracked.
- **Do not break the UI API.** `@/components/ui` is the app-facing surface. If a
  primitive is backed by `@adem.rejeb/ui`, keep the existing prop names and
  variants so call sites do not change.
- **Keep the CSS layer order.** `globals.css` declares
  `theme, base, components, ui, utilities`. The design system lives in `ui`, so
  Tailwind utilities can still override it. Do not import the design-system CSS
  from a component.
- **RTL and a11y are not optional.** The app is Arabic-first; use logical
  properties (`ps-*`, `pe-*`, `start-*`, `end-*`), not left/right.
- **Test before pushing.** At minimum: `npm --prefix techdebt-platform run build`
  and `cargo test --workspace`.
