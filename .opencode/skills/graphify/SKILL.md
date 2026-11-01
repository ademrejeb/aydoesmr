---
name: graphify
description: >
  Query this repository as a knowledge graph. Use for architecture questions,
  "what calls X", dependency tracing, onboarding, or when graphify-out/ exists
  and the question is about code structure. Builds a local, deterministic AST
  graph with community detection and an audit trail (EXTRACTED vs INFERRED).
---

# Graphify

Graphify turns a folder of code, docs, SQL and configs into a persistent,
queryable knowledge graph. Code is parsed with tree-sitter locally; no vector
store and no embeddings. Each edge is tagged `EXTRACTED` or `INFERRED`.

Upstream: <https://github.com/Graphify-Labs/graphify> · docs:
<https://docs.graphify.com>

## When to use it

Use a graph when:

- the question is structural: communities, bridges, import cycles, god nodes;
- the answer needs links that text search cannot see (doc ↔ code, service ↔ DB);
- the codebase is large or unfamiliar and you expect several questions.

For a single "where is X defined" lookup, use `grep`/`Read` directly. Building a
graph for one lookup is slower than searching.

## Install (Windows)

```powershell
py -m pip install --upgrade graphifyy
graphify --version
```

If `graphify` is not on `PATH`, use `py -m graphify`.

## Build the graph

From the repository root:

```powershell
# Code only, no HTML (fast; what CI / local agents should use)
graphify . --no-viz

# Full pipeline with the interactive graph.html
graphify .

# Incremental after code changes
graphify . --update

# Deep extraction (more INFERRED edges, slower)
graphify . --mode deep
```

`make graphify` runs the fast path. Output lands in `graphify-out/` and is
git-ignored: regenerate it, never commit it.

## Query it

```powershell
graphify query "How does a chat message reach the websocket service?"
graphify query "Where is technical debt analysis triggered?" --dfs
graphify query "Auth flow" --budget 1500
graphify path "AuthModule" "PrismaService"
graphify explain "td-rules"
```

Always try `graphify-out/graph.json` first when it exists: query the graph before
falling back to grep. Cite the files the graph points at, then read those files
to confirm — the graph is a map, not the source of truth.

## This repository's shape

| Node family | Lives in |
| --- | --- |
| Dashboard routes / React components | `techdebt-platform/src/app`, `techdebt-platform/src/components` |
| Design-system bridge | `techdebt-platform/src/components/ui`, `globals.css` |
| API modules (NestJS) | `services/api/src/modules` |
| Persistence | `services/api/prisma/schema.prisma` |
| Realtime | `services/api/src/realtime`, `services/websocket` |
| Analysis engine | `crates/`, `services/gateway` |
| AI planner | `services/ai-planner` |

Useful first questions:

```powershell
graphify query "How does the dashboard authenticate and attach an organization?"
graphify query "Trace a pipeline run from the UI to the gateway"
graphify query "Which modules depend on PrismaService?"
```

## Guardrails

- Do not add `graphify-out/` to git.
- Do not let the semantic pass run over `node_modules`, `target`, `.next` or
  `graphify-out`; they are ignored by `.gitignore` and should stay out.
- The graph does not replace tests or type-checking. Verify changes with
  `npm --prefix techdebt-platform run build` and `cargo test --workspace`.

## Source

Skill adapted from [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify)
(Apache-2.0). The upstream `graphify/skill-opencode.md` has the full pipeline
internals; this version is scoped to this repository.
