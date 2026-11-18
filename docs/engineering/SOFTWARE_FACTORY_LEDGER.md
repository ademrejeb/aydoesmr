# Software Factory — Implementation Ledger

Date: 2026-11-18
Repository: `aydoesmr` (TechVerse)
Branch: `main` (working tree)

## Completed and verified

| Capability | Evidence |
|---|---|
| Deterministic policy engine with priorities, specificity, condition operators, reasons | `src/modules/policies/policy.engine.ts`; 4 unit suites |
| Policy CRUD + version snapshots + evaluation audit | `policies.service.ts`, migration `20261118120000_software_factory` |
| Conservative baseline policies seeded lazily | `policies/defaults.ts`; `GET /policies` returned 4 rules |
| Policy enforced on factory merge/patch/review/execute, `agent.run`, `pipeline.run` | `PoliciesService.check` calls in services |
| Explainable issue triage (classification, labels, complexity, risk, duplicates, autonomy) | `factory.rules.ts`; API profile returned `agent-ready` / `needs-human` correctly |
| Automatic triage on task creation | `TasksService` emits `task.created`; `FactoryService.onTaskCreated` |
| Specialist agent registry with connection, tools, budgets, retries, version | `AgentProfile`; `POST /factory/agents` |
| Versioned structured plans with files, tests, acceptance criteria, risks, out-of-scope | `FactoryPlan`; plan generation from repo tree keywords |
| Optional AI enrichment for triage and planning, with heuristic fallback | `classifyWithAi`, `planWithAi` |
| Full run state machine with correlation and idempotency | `FACTORY_TRANSITIONS`, `FactoryRun.correlationId/idempotencyKey`; duplicate create returned the same run |
| Agent dispatch through the existing published agent connection | `AgentFactoryService.run`; mock agent returned files |
| Patch validation and protected-path approval | `validatePatch`, `factory.patch` policy; traversal/git/oversize rejected in tests |
| Real hosted-Git branch commit and fast-forward merge | `commitFilesInBare`, `mergeFastForward`; merged commit `73dbbff` verified with `git log`/`ls-tree` |
| Quality gates with real engine evidence | `secret_scan`, `plan_completeness`, `repository_scan`; zero analyzed files blocks; mock gateway produced PASSED |
| Secret detection before commit | High-confidence patterns (AWS, private keys, GitHub/Slack/Google/Stripe/JWT); secret values never stored; end-to-end run blocked and no branch/file was created |
| Internal pull requests | `FactoryPullRequest` per run with real `git diff` stats, changed files, commits, checks, risk, findings, security findings; `OPEN → MERGED/CLOSED` |
| Approval queue | `GET /factory/approvals` and dashboard queue with inline approve/reject |
| Tenant path/header binding | `OrgGuard` now rejects a route `:id` that differs from `X-Organization-Id`; cross-tenant smoke test passes |
| Tenant isolation tests | `npm run test:tenant` covers cross-tenant reads/writes and member-vs-manager boundaries |
| Isolated command runner | Docker (networkless, CPU/memory-limited) preferred; local fallback only with `FACTORY_ALLOW_LOCAL_EXEC=true`; allowlisted binaries, no shell operators, temp worktree, timeout/output caps |
| Real `tests` gate | `npm test` executed against the factory branch; pass/fail/blocked evidence stored in `FactoryCommandRun`; no command = `SKIPPED` (never fake PASSED) |
| Cost accounting | `FactoryCostEvent` for triage/plan/agent, token totals and optional USD estimate; per-run AI budget and agent budget enforcement |
| Project knowledge | Versioned `ProjectKnowledge`; CRUD endpoints; relevant entries selected by keyword overlap and attached to plans/AI prompts |
| Cross-repo impact | Static dependency overlap across hosted `package.json` manifests; returns shared dependencies and risk |
| Dependency audit gate | Optional `auditCommand` runs through the same isolated runner and creates `dependency_audit` gate |
| Independent AI reviewer | `POST /runs/:runId/review/agent` selects a REVIEWER profile with a different connection, sends the diff/plan, records cost and applies the decision; self-review is rejected before dispatch |
| Independent review + same-agent denial | `factory.review` deny rule returned HTTP 403 for the execution agent run |
| Human merge approval | `factory.merge` returned `WAITING_APPROVAL`; approval produced `MERGED` |
| Append-only run trace + audit log | `FactoryEvent`, `AuditLog`; event sequence verified |
| Automation discovery + explicit decision | `GET /factory/automation` returned a 10x triage proposal; `POST .../decision` recorded `APPROVED` |
| Dashboard integrated into existing navigation/design system | `/dashboard/factory`, RTL screenshot verified; `next build` passes |

## Modified existing modules

| File | Change |
|---|---|
| `services/api/prisma/schema.prisma` | New enums/models; additive relations only |
| `services/api/src/app.module.ts` | Register `PoliciesModule`, `FactoryModule` |
| `services/api/src/modules/agent-factory/agent-factory.service.ts` | Policy check before external agent run |
| `services/api/src/modules/agent-factory/agent-factory.module.ts` | Import policies; export service |
| `services/api/src/modules/pipelines/pipelines.service.ts` | Policy check before pipeline trigger |
| `services/api/src/modules/pipelines/pipelines.module.ts` | Import policies |
| `services/api/src/modules/tasks/tasks.service.ts` | Emit `task.created` |
| `services/api/src/modules/git/git.service.ts` | `scanHosted` accepts a branch |
| `services/api/src/modules/git/git-host.ts` | `commitFilesInBare`, `mergeFastForward`, `diffBetween`, `showBlob` |
| `services/api/src/common/guards/org.guard.ts` | Enforce route `:id` equals tenant header |
| `services/api/src/common/interfaces/authenticated-request.interface.ts` | Add `params` to the typed request |
| `techdebt-platform/src/lib/api.ts` | Factory/policy types and calls |
| `techdebt-platform/src/lib/access.ts` | Factory nav item |
| `techdebt-platform/src/lib/i18n/dictionaries.ts` | Factory labels (AR/FR/EN) |
| `techdebt-platform/src/components/platform/app-shell.tsx` | Factory route/icon |
| `services/api/package.json` | `npm test` script |

## New database objects

- `PolicyRule`, `PolicyRuleVersion`, `PolicyEvaluation`
- `AgentProfile`, `FactoryIssueProfile`, `FactoryRun`, `FactoryPlan`,
  `FactoryEvent`, `FactoryApproval`, `FactoryQualityGate`
- `FactoryPullRequest`
- `FactoryCommandRun`, `FactoryCostEvent`, `ProjectKnowledge`
- `AutomationProposal`
- Enums: `PolicyEffect`, `FactoryRunStatus`, `FactoryApprovalStatus`,
  `FactoryGateStatus`

Migrations:
- `20261118120000_software_factory`
- `20261118130000_automation_proposals`
- `20261118140000_factory_pull_requests`
- `20261118150000_factory_runner_cost_knowledge`

Both applied cleanly to a fresh PostgreSQL 18 database with `prisma migrate deploy`.
No existing table or column was altered or dropped. New files follow the
repository's LF convention.

## API additions

```
GET    /organizations/:id/policies
POST   /organizations/:id/policies
PATCH  /organizations/:id/policies/:ruleId
DELETE /organizations/:id/policies/:ruleId
POST   /organizations/:id/policies/evaluate
GET    /organizations/:id/policies/evaluations
POST   /organizations/:id/policies/defaults

GET    /organizations/:id/factory/agents
POST   /organizations/:id/factory/agents
PATCH  /organizations/:id/factory/agents/:profileId
DELETE /organizations/:id/factory/agents/:profileId
GET    /organizations/:id/factory/runs
POST   /organizations/:id/factory/runs
GET    /organizations/:id/factory/runs/:runId
POST   /organizations/:id/factory/runs/:runId/plan
POST   /organizations/:id/factory/runs/:runId/approve
POST   /organizations/:id/factory/runs/:runId/execute
POST   /organizations/:id/factory/runs/:runId/review
POST   /organizations/:id/factory/runs/:runId/review/agent
POST   /organizations/:id/factory/runs/:runId/merge
POST   /organizations/:id/factory/runs/:runId/cancel
GET    /organizations/:id/factory/stats
GET    /organizations/:id/factory/approvals
GET    /organizations/:id/factory/pull-requests
GET    /organizations/:id/factory/runs/:runId/pull-request
GET    /organizations/:id/factory/projects/:projectId/config
PUT    /organizations/:id/factory/projects/:projectId/config
GET    /organizations/:id/factory/knowledge
POST   /organizations/:id/factory/knowledge
PATCH  /organizations/:id/factory/knowledge/:knowledgeId
DELETE /organizations/:id/factory/knowledge/:knowledgeId
GET    /organizations/:id/factory/impact
GET    /organizations/:id/factory/automation
POST   /organizations/:id/factory/automation/:proposalId/decision
GET    /organizations/:id/factory/issues/:taskId/profile
POST   /organizations/:id/factory/issues/:taskId/classify
```

## Tests executed

| Command | Result |
|---|---|
| `cd services/api && npm test` | 16 tests, 16 pass, 0 fail |
| `npx tsc --noEmit` (API) | pass |
| `npm run build` (API) | pass |
| `npx tsc --noEmit` (dashboard) | pass |
| `npm run build` (dashboard) | pass; `/dashboard/factory` generated |
| `prisma validate` / `prisma generate` | pass |
| `prisma migrate deploy` on fresh Postgres 18 | pass |
| End-to-end API scenario | task → auto-triage → run → plan → execute (mock agent + gateway) → secret/scan gates → PR with diff stats → same-agent deny 403 → review → merge approval → `MERGED`; PR became `MERGED`; `git log` shows the merged commit |
| Secret-gate scenario | agent output with an AWS key → `secret_scan FAILED`, run `FAILED`, no branch and no file created |
| Tenant isolation | `npm run test:tenant` → PASS (cross-tenant 403 for runs/projects/policies/approvals/agents; member cannot manage agents or policies) |
| Runner scenario | `npm test` executed in a temp worktree → `tests PASSED`, exit 0, output captured; mock agent reported 150 tokens and a USD cost |
| Knowledge/impact scenario | Knowledge entry selected into `plan.knowledgeRefs`; cross-repo impact returned a shared `typescript` dependency |
| Runner unavailable | Without Docker and without local opt-in, `tests` becomes `BLOCKED`; no false pass |
| AI review scenario | Reviewer profile with a different connection returned `APPROVED`; run moved `WAITING_REVIEW → READY_TO_MERGE`; 100 review tokens recorded |
| UI scenario | logged in, opened `/dashboard/factory`, opened a merged run detail, full-page screenshots verified |

Unit tests cover: policy priority/specificity/conditions/glob/overlap; triage
missing AC, agent-ready, duplicates; patch traversal/git/protected paths; secret
detection; command allowlist/shell-operator rejection; plan validation; state
transitions; branch naming.

## Architectural decisions

1. **Rust remains the analysis engine.** No competing policy/workflow logic was
   added to `td-rules`; action governance is deterministic TypeScript evaluated
   at API boundaries.
2. **No second workflow engine.** NestJS owns orchestration because it already
   owns persistence, events, tenancy and audit.
3. **No fake quality evidence.** A scan with `analyzed_files == 0` blocks.
4. **No agent code execution.** The platform commits validated full file
   contents; it never runs generated code.
5. **Idempotency and traceability are first-class.** Every run has a
   correlation id; client idempotency keys return the existing run.
6. **AI is advisory.** AI enriches classification/plans only; the model never
   grants autonomy, never approves, and never changes policy.
7. **Automation proposals are advisory.** User approval records intent; nothing
   is activated without an explicit workflow definition.

## Outstanding gaps / risks

| Gap | Impact | Next step |
|---|---|---|
| Docker path untested here | Local fallback verified; Docker daemon was unavailable in this environment | Run the runner suite on a Docker host and assert `--network none` behavior |
| No install step before tests | A repo without committed dependencies may fail the test command in Docker | Add an explicit install command (network policy decided per project) |
| Dependency audit is opt-in | Only runs when `auditCommand` is configured | Add a default OSV/npm-audit adapter with evidence |
| No coverage measurement | Tests execute, but coverage is not collected | Add coverage command/parser and a coverage threshold gate |
| Pipelines are still simulated (pre-existing) | Cannot be used as CI evidence | Implement real step execution or integrate an external CI provider |
| PR is internal only | No GitHub/GitLab push/sync or threaded comments | Add provider adapters on top of `FactoryPullRequest` |
| No deployment/monitoring/rollback | Factory stops at merge | Add environment/pipeline adapters and approval-gated deploy |
| Automation proposals are not executable workflows | Discovery only | Add a workflow definition/trigger engine and activate approved proposals explicitly |
| UI page is large (single file) | Maintainability | Extract plan/gates/automation panels into components after the surface stabilizes |

## Next steps (ordered)

1. Add an install step plus Docker-host CI coverage for the runner.
2. Add GitHub/GitLab adapters that mirror the internal PR and push checks.
3. Add real CI pipeline execution (or external provider integration) and a
   deployment gate.
4. Add coverage collection and a coverage threshold gate.
5. Add a default dependency-audit adapter (OSV/npm audit).
6. Add deployment orchestration, rollback and monitoring/self-healing.
7. Activate approved automation proposals through a real workflow engine.
8. Extract dashboard panels and add a dedicated approvals page.

## Suite onboarding and integration verification (2026-11-18)

Three application repositories were imported into TechVerse Studio and driven
through the Factory end to end. Each project has an explicit test command and
real test files committed to the hosted repository.

| Project | Hosted repo | Test command | Result | Merged commit |
|---|---|---|---|---|
| FieldOps | `fieldops` | `node --test test/techverse-smoke.test.mjs` | PASSED (192 ms) | `9e09d8f` |
| AI Agent Factory | `ai-agent-factory` | `python -m pytest -q services/api/tests/test_control_plane.py` | PASSED, 7 tests (7.9 s) | `fbf694b` |
| Design System | `design-system-ui` | `node --test test/techverse-smoke.test.mjs` | PASSED (181 ms) | `e50d2c7` |

The AI Agent Factory run proves the Python test path and `pytest` allowlist.
FieldOps and Design System prove the Node test path. Every run completed
`secret_scan`, `plan_completeness`, `repository_scan`, `tests` and
`independent_review`, then `READY_TO_MERGE -> WAITING_APPROVAL -> MERGED`.

A separate published hosted agent (`TechVerse Reviewer`) is wired through its
own TechVerse connection and REVIEWER profile. The coding profile is rejected
with HTTP 403 when it attempts to review its own run; the reviewer profile
approves it.

### Integration fixes found by these runs

| Defect | Fix | Evidence |
|---|---|---|
| `commitFilesInBare` returned the default-branch head instead of the pushed branch head | Resolve `refs/heads/<branch>` after push | Second FieldOps run reported `9e09d8f`, matching `git rev-parse`; prior run reported the base import commit |
| Hosted agent graphs require a `message` input | Include `message` in execution and review payloads | Factory run applied a real patch instead of failing validation |
| Reviewer received only diff statistics | Attach changed file contents (150 KB total, 50 KB/file cap) to the review payload and message | Review gate PASSED with file content present |
| Provider gateway nests review JSON under `message`/`output` strings | Parse nested object/JSON candidates before accepting a decision | Independent review returned `APPROVED` and moved the run to `READY_TO_MERGE` |

Verification commit: `dffbd16 fix(factory): preserve commit SHA and reviewer payloads`.
