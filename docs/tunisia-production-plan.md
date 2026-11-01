# Tunisia Production Plan — TechVerse Platform

Status: proposal, verified 2026-10-02. Every price below carries its source and date; **re-verify before
signing a contract**. Legal and tax statements are marked as items to confirm with counsel, not as legal advice.

---

## 1. What we are deploying

| Service | Stack | Local port | Prod role |
|---|---|---|---|
| `techdebt-platform` | Next.js (App Router) | 3000 | Web UI, server rendering, static assets |
| `services/api` | NestJS + Prisma | 3001 | Domain API, auth, ITSM, code analysis, payroll |
| `services/gateway` | Go | 8080 | Edge routing, auth middleware, rate limiting |
| `services/websocket` | Node (`ws`) | 8092 | Realtime fan-out (`service:updated`, notifications) |
| `services/notifications` | Node | — | Email / push delivery |
| `services/ai-planner` | Python | — | AI planning + agent orchestration |
| PostgreSQL | 16+ | 5433 | System of record |
| Redis | 7 | — | Required in prod: queues, realtime fan-out, rate-limit state |
| Object storage | S3-compatible | — | Repo bundles, scan artifacts, article attachments, exports |

Objective: serve Tunisian customers in French and Arabic with local-currency billing, sub-second page
loads, and personal data held under Tunisian control.

---

## 2. Traffic model used for sizing

Load is expressed as **peak API requests per second** and **concurrent WebSocket connections**, derived from:

- 0.15 sustained API rps per active user (list + detail + poll), 0.25 at peak bursts
- 1 WebSocket connection per active dashboard session, 40% of API users
- Public service-desk portal: 1 page load + 1 catalog fetch per anonymous visitor, bursty

| Tier | Concurrent users | API rps (peak) | WS connections | Portal visits/day | New tickets/day |
|---|---|---|---|---|---|
| **T1 — pilot** | 100 | ~25 | ~40 | 500 | 20 |
| **T2 — growth** | 1,000 | ~150 | ~400 | 5,000 | 200 |
| **T3 — scale** | 10,000 | ~1,000 | ~4,000 | 50,000 | 2,000 |

Revenue-relevant assumption: SaaS seat + AI usage tiers are billed in TND, collected monthly in advance.

---

## 3. Hosting topology (three options)

### Option A — EU-region cloud, Tunisia-facing CDN *(recommended for T1 and T2)*

Application runs on Hetzner Cloud (Falkenstein/Nuremberg/Helsinki) or OVHcloud (Strasbourg/Gravelines),
static assets and images behind a CDN with a Tunis/Africa PoP, and a managed PostgreSQL with EU-resident
backups.

- Pros: no local power/connectivity risk, quote-free self-serve pricing, hourly billing, easy horizontal
  scaling, 60–90 ms RTT to Tunis (acceptable for JSON APIs behind a CDN).
- Cons: data physically outside Tunisia (see §7), and TND→EUR/USD FX exposure on the provider bill.

### Option B — Hybrid: EU compute + Tunisian colocation for regulated data *(recommended for T3)*

Same as A, plus a rack at **DataXion** (ZI El Agba, Tunis) — described by the operator as the only
Uptime Institute Tier IV certified facility in Tunisia, with dual STEG feeds, >1 week of diesel autonomy,
2N cooling, APSAD-certified inert-gas suppression, and ISO 27001/PCI-DSS-style certifications
(`dataxion.com`, accessed 2026-10-02). DataXion also sells Cloudaxion (cloud), BaaS and DRaaS, is a
Microsoft SPLA partner, and is a Veeam Cloud Service Provider. The same site is a practical DR target
because it is inside the jurisdiction.

- Pros: satisfies "data in Tunisia" expectations without giving up managed elasticity; DR inside the
  country; 24/7 on-site staff.
- Cons: quote-based pricing (no public list price — must request a brochure/RFP), contract and onboarding
  lead time, and a single-country concentration risk.

Other Tunisian providers identified during research, useful as alternatives or for redundancy:
OxaCloud (Tunis — multi-cloud + managed DevOps), Zenhosting (Sousse — hosting/domains/cloud),
TE (local ISP with IaaS/VPS). None publish list prices.

### Option C — Fully local

Everything at DataXion/Cloudaxion. Only justified if a public-sector or defence-adjacent customer
mandates in-country residency, or if EU hosting becomes unavailable commercially. Expect higher ops load
(you own patching, backups, and power/failover testing) and less elastic scaling.

### Recommendation

- T1: **Option A** with backups replicated to a second EU region.
- T2: **Option A**, multi-AZ, managed DB, PITR; prepare the DataXion quote for DR.
- T3: **Option B**, active/active web tier in the EU, DataXion as the in-country read/write replica plus
  DR site, with an annual failover exercise.

### Reference list prices (EU, self-serve)

| Provider / plan | Spec | Monthly | Source |
|---|---|---|---|
| Hetzner CX23 | 2 vCPU, 4 GB, 40 GB SSD, 20 TB traffic | €3.99–5.49 | bitdoze / betterstack, Jun 2026 (price raised 1 Apr 2026, adjusted 15 Jun 2026) |
| Hetzner CPX22 | 2 vCPU AMD, 4 GB, 80 GB | €7.99 | bitdoze / betterstack, Jun 2026 |
| Hetzner CX43 | 8 vCPU, 16 GB, 160 GB | €11.99 | bitdoze / betterstack, Jun 2026 |
| Hetzner CAX31 | 8 vCPU ARM, 16 GB, 160 GB NVMe | $0.0382/h (~$28) on-demand | sparecores.com, observed 2026-09-30 |
| Hetzner IPv4 add-on | primary IPv4 | €0.50 | hetzner.com |
| OVHcloud VPS-1 | 2 vCore, 4 GB, 40 GB NVMe, unlimited traffic | $5.35 | unumpay/bestusavps review, Sep 2026 (US listing; EU differs) |

> Caution: Hetzner raised cloud prices significantly in 2026 (up to 3.1x on some lines, Northflank).
> Budget with the current price API, not with figures in this document.

---

## 4. Sizing per tier

### T1 — pilot (100 concurrent, ~25 API rps)

| Component | Count | Spec each |
|---|---|---|
| Next.js platform | 1 | 4 vCPU, 8 GB |
| API (NestJS) | 1 | 2 vCPU, 4 GB |
| Gateway (Go) | 1 | 1 vCPU, 1 GB (static 20 TB traffic included) |
| WebSocket | 1 | 1 vCPU, 1 GB |
| Notifications + ai-planner | 1 | 2 vCPU, 4 GB shared |
| PostgreSQL | 1 | 4 vCPU, 16 GB, 200 GB SSD |
| Redis | 1 | 1 GB |
| Object storage | — | 100 GB + backups |

### T2 — growth (1,000 concurrent, ~150 API rps)

| Component | Count | Spec each |
|---|---|---|
| Next.js platform | 2 | 4 vCPU, 8 GB |
| API | 3 | 4 vCPU, 8 GB (stateless behind LB) |
| Gateway | 2 | 2 vCPU, 2 GB |
| WebSocket | 2 | 2 vCPU, 4 GB |
| Notifications + ai-planner | 2 | 4 vCPU, 8 GB shared |
| PostgreSQL primary + 1 read replica | 2 | 8 vCPU, 32 GB, 1 TB SSD |
| PgBouncer | 1 | 2 vCPU, 4 GB |
| Redis | 1 | 4 GB |
| Object storage | — | 1 TB + backups |

### T3 — scale (10,000 concurrent, ~1,000 API rps)

| Component | Count | Spec each |
|---|---|---|
| Next.js platform | 6 | 8 vCPU, 16 GB |
| API | 12 | 8 vCPU, 16 GB |
| Gateway | 3 | 4 vCPU, 4 GB |
| WebSocket | 4 | 4 vCPU, 8 GB (≈1,000 conns each with heartbeat) |
| Notifications + ai-planner | 4 | 8 vCPU, 16 GB shared |
| PostgreSQL primary + 2 read replicas | 3 | 16 vCPU, 64 GB, 4 TB NVMe |
| PgBouncer | 2 | 4 vCPU, 8 GB |
| Redis | 1 | 16 GB (clustered at 3 nodes if queues exceed 50k jobs) |
| Object storage | — | 10 TB + cross-region + in-country replica |
| Worker pool | 4 | 8 vCPU, 16 GB (scans, AI jobs, notifications) |

Scaling rules that keep these numbers honest:

- Stateless API and platform tiers scale on p95 latency (>400 ms) and CPU (>70%), not on a timer.
- WebSocket nodes are sticky-session routed; client reconnect with jitter + exponential backoff.
- PostgreSQL read/write split: analytics dashboards, code scans and the ITSM overview go to replicas;
  ticket lifecycle writes stay on the primary. Long analyses run on the worker pool, never inline.
- PgBouncer in transaction mode is mandatory above ~500 connections; Prisma connection limit must match.
- Every tier keeps 30 days of PITR plus 12 monthly snapshots, stored in a different region than the primary.

### Infrastructure cost bands (compute only, before AI, payment fees, and support)

| Tier | Compute + DB + storage | Basis |
|---|---|---|
| T1 | €90–140 / month | Hetzner CX/CPX lines + one managed DB + 100 GB objects |
| T2 | €450–750 / month | ~10 nodes + primary/replica + 1 TB |
| T3 | €2,600–4,200 / month | ~35 nodes + 3 DB servers + storage/egress |

Band, not a quote: it excludes colocation, CDN, DNS, backup storage beyond the included quota, and
DataXion's quote-based pricing. Convert with the **BCT daily reference rate** at invoice time.

---

## 5. DNS, domains and TLS

1. **Primary domain: `.tn`** — registration must go through an ANCEPT-authorised registrar. Availability and
   registrar accreditation must be confirmed before launch; `.tn` has a stricter registration process than
   `.com` and typically requires the registrant to be a business with a local presence. Confirm the exact
   requirement with the registrar.
2. **Secondary domain: `.com`** — defensive registration, and the address used in email/DMARC. Budget for
   both; keep the brand name aligned.
3. **Subdomain layout**
   - `app.<domain>` — authenticated platform
   - `api.<domain>` — REST API (Go gateway in front of NestJS)
   - `ws.<domain>` — WebSocket upgrade endpoint
   - `support.<domain>` — public service-desk portal (must be reachable with no auth and no cookies)
   - `status.<domain>` — public status page
4. **DNS hosting** — use a provider with anycast DNS and a Tunisia/Africa PoP (Cloudflare, OVH, or a local
   provider). Keep DNSSEC on and publish DS at the registry for `.tn` where supported.
5. **Edge** — CDN in front of `app` and `support` only. **Never cache `/api` or the WebSocket upgrade path.**
   Cache rules: hashed static assets immutable 1 year; HTML no-cache; `/support` HTML 60 s with
   `stale-while-revalidate`.
6. **TLS** — Let's Encrypt or provider-managed certificates, HSTS `max-age=31536000; includeSubDomains;
   preload`, TLS 1.2+ only, OCSP stapling. Automate renewal and alert on expiry < 14 days.
7. **Email deliverability** — SPF, DKIM, DMARC (`p=quarantine` then `p=reject`) on the sending domain, plus
   PTR/rDNS on the sending IP. Ticket notifications and password resets depend on this; budget the setup.
8. **Health checks** — `/api/health` (returns `db: ok`) wired to the LB; the gateway should drain nodes that
   fail two consecutive checks.

---

## 6. Payments in Tunisia (TND)

### Market facts (2026)

- ≈70% of e-commerce is still cash-on-delivery; 1.8 bn TND of card/wallet online transactions; 15,000+
  Tunisian merchants accept a digital method (mallatech.tn, 2026-07-14).
- **Société Monétique Tunisie (SMT) / ClicToPay** is the interbank card rail for domestic CIB, Visa and
  Mastercard, settled in TND. This is the default choice for TND card payments.
- **Flouci** is the dominant mobile wallet (online account opening) and its checkout reaches ClicToPay cards,
  **D17** and **e-Dinar** (La Poste Tunisienne) — i.e. it covers the unbanked segment that a card-only
  integration misses.
- **Konnect** accepts local and international cards plus e-Dinar, with payment-link and API integrations.
- **PayTabs / Checkout.com** are the practical route for diaspora and EUR/USD cards.
- **PayPal does not allow Tunisian merchants to receive payments as of 2026** — do not build the plan on it.
- **Paymee: treat with caution.** Reported merchant-account freezes under Banque Centrale de Tunisie measures.
  Keep it only as an optional, switchable adapter — never the sole rail.

### Recommended payment design

- **Adapter pattern, gateway-agnostic.** One `PaymentProvider` interface (`createCharge`, `refund`,
  `verifyWebhook`, `parseWebhook`) with adapters for ClicToPay (primary), Flouci (wallets + D17/e-Dinar),
  and one cross-border provider (PayTabs or Checkout.com) for EUR/USD. Adding Konnect or Paymee later must
  not touch checkout code.
- **In-app ledger is the source of truth.** Every invoice, entitlement and AI usage quota lives in our
  database; the gateway is only a collection rail. This makes a provider ban or a PayPal-style exit a
  config change, not a rewrite.
- **TND as the internal currency.** Store money as integer minor units in TND. Show prices VAT-inclusive
  (Tunisia standard VAT rate is commonly 19% — confirm the current rate and any IT/OSS exemptions with
  the accountant before publishing prices).
- **Webhooks, not polling, for settlement.** Verify signature, make handlers idempotent (unique constraint
  on provider event id), and reconcile daily against provider statements.
- **Feature the three rails at checkout**, most-used first: ClicToPay card, Flouci (D17 / e-Dinar), then
  cross-border card. Also keep bank-transfer + invoice as an offline path for B2B and public-sector clients,
  which is normal in this market.
- **Dunning and offline risk**: retries on `e-Dinar` top-up failures, grace periods for failed charges,
  and a manual "mark paid by transfer" action that only finance roles can use.

### Payment cost inputs to confirm

Get written quotes for: MDR % per rail, fixed fee per transaction, settlement delay, refund fee, chargeback
rate, and whether e-Dinar/D17 settlement is delayed. Budget gross-margin impact **before** choosing a rail;
a 3% MDR in a 19% VAT regime materially changes per-seat pricing.

---

## 7. Data protection and residency (confirm with counsel)

- **INPDP** — Instance Nationale de Protection des Données Personnelles is the Tunisian authority. Certain
  processing requires registration/authorisation with INPDP, and hosting of personal data may be subject to
  localisation obligations. Verify the exact obligations that apply to a B2B SaaS with employee data
  (timesheets, payroll, HR tickets) before choosing Option A as the only region.
- Plan for: INPDP registration, a French/Arabic privacy policy and DPA, cookie consent, data-subject
  access/erasure endpoints, retention schedules per data class, and an audit trail (the platform already
  writes audit logs per organization).
- Because payroll and HR data are the most sensitive class, a defensible compromise is: **EU compute for the
  product, in-country storage for the sensitive class** (or encryption with customer-held keys). This is
  easier to defend than a full in-country deployment and costs far less than Option C.

---

## 8. AI agent architecture and cost model

### What the platform already supports

Provider-agnostic AI layer with OpenAI, Anthropic, Google Gemini, Groq, OpenRouter, Azure OpenAI,
**Ollama (local)** and any OpenAI-compatible self-hosted endpoint. Models are configured per organization
(`ai_use` / `ai_manage` capabilities). `services/ai-planner` (Python) drives planning jobs.

### Target routing — three tiers, cheapest sufficient model

| Tier | Work | Model class | Where it runs | Target $/1M in/out |
|---|---|---|---|---|
| **T0 — local** | ticket classification, P1/P2 prediction, language detection, dedupe, spam/honeypot scoring, RAG retrieval, code-scan heuristics | open weights (Qwen / Llama 3.1 8B / gpt-oss) via Ollama on our worker pool | in-country VMs, no egress, no per-token bill | ~$0.02–0.14 |
| **T1 — cheap API** | draft knowledge articles, first-pass incident summaries, suggested resolution, email drafts | budget frontier tier (Gemini 3.5 Flash Lite / GPT-6 Luna / Claude Haiku class) | cloud API | ~$0.10–0.50 in, ~$0.40–3.75 out |
| **T2 — frontier** | code-debt analysis, root-cause reasoning, incident escalation write-ups, deep refactor plans | Claude Sonnet / Gemini Pro / GPT-5.x class | cloud API, approval-gated | ~$2–5 in, ~$10–30 out |

Reference rates (checked 2026-09-22 → 2026-09-30; verify before budgeting):

| Model | Input $/1M | Output $/1M | Source |
|---|---|---|---|
| Gemini 3.8 Flash (to 2026-12-31, then doubles) | 0.75 | 3.75 | nadir, 2026-09-23 |
| Gemini 3.1 Pro (≤200K prompt) | 2.00 | 12.00 | nadir / morph |
| Gemini 3.1 Pro (≥200K prompt) | 4.00 | 18.00 | nadir, 2026-09-23 |
| GPT-6 Luna | 0.10 | 0.50 | pecollective, 2026-09-22 |
| GPT-5.6 | 5.00 | 30.00 | morph, Jul 2026 |
| Claude Haiku 4.5 | 1.00 | 5.00 | morph, Jul 2026 |
| Claude Sonnet 5 | 2.00 | 10.00 | morph, Jul 2026 |
| Claude Opus 4.8 | 5.00 | 25.00 | morph, Jul 2026 |
| DeepSeek V4 Flash (aggregator) | 0.14 | 0.40 | morph, Jul 2026 |
| gpt-oss-120b (DeepInfra) | 0.037 | 0.17 | morph, Jul 2026 |

Discounts that must be in the design: prompt caching (~10% of input rate on Claude/GPT/Gemini tiers),
batch/off-peak (≈50% off), and long-context cliffs (Gemini doubles above 200K — do not assume a flat rate).

### Token budget assumptions

- T0 handles ~80% of AI calls by count (classification, retrieval) and ~35% of tokens.
- T1 handles ~17% of calls / ~45% of tokens. T2 handles ~3% of calls / ~20% of tokens.
- Per active user per month: 3.5 M input + 1.2 M output tokens **at tier mix**, i.e. ~1,700 requests.

### Monthly AI cost per active user (blended, list price)

| Tier mix | Blended $/user/month | At 100 users | At 1,000 users | At 10,000 users |
|---|---|---|---|---|
| Conservative (more T2, little T0) | ~$6.50 | $650 | $6,500 | $65,000 |
| Balanced (target routing) | ~$2.20 | $220 | $2,200 | $22,000 |
| Optimised (T0-heavy, caching, batch) | ~$0.90 | $90 | $900 | $9,000 |

Use the **Balanced** row as the plan of record; the Optimised row is the target after T0 covers
classification and summarisation. Add a T0 GPU note: a local 8B-class model on 1 dedicated GPU node
(24 GB) covers roughly 1,000 users' T0 traffic and replaces ~$400–600/month of API spend — worth it from
T2 upward.

### Guardrails (non-negotiable in billing code)

1. Per-organization monthly AI budget with hard stop; 80/100% notifications.
2. Per-user fair-use quotas so one tenant cannot consume the whole pool.
3. Request/token accounting stored per call, surfaced in the admin UI next to the invoice.
4. Cache retrieval and identical prompts; use batch/off-peak for scans and article generation.
5. Never let the model decide authorization, ticket status, or money — agents propose, humans dispose.
6. Kill-switch per provider and per tier (`ai_manage`) so a provider outage or price change is a config edit.
7. Redact PII (and especially payroll/HR text) before any T1/T2 call; T0 handles anything that cannot leave
   the country.

---

## 9. Rollout

| Phase | Scope | Exit criteria |
|---|---|---|
| **0 — Legal/commercial** | ANCEPT `.tn` + `.com`, INPDP determination, accountant VAT advice, DataXion + EU quotes, payment-provider contract and MDR sheet | domains registered, legal memo, signed quotes |
| **1 — Pilot (T1)** | EU compute, managed PostgreSQL + PITR, CDN, TLS everywhere, ClicToPay + Flouci live, T0 Ollama worker, budget alerts | 10 design-partner tenants live, 30 days uptime ≥99.5%, AI cost/user within plan |
| **2 — Growth (T2)** | read replica + PgBouncer, queue workers, gateway tiering, status page, DR runbook, first annual failover test | 1,000 concurrent peak sustained, RTO ≤ 2 h / RPO ≤ 15 min |
| **3 — Scale (T3)** | horizontal API/WS pools, DataXion in-country replica for sensitive classes, multi-region backups, capacity plan per quarter | 10,000 concurrent peak, RTO ≤ 30 min / RPO ≤ 5 min, cost per user tracked monthly |

---

## 10. Open questions to resolve (not guessable)

1. Which data classes require Tunisian residency per INPDP, and does payroll/HR data force Option B?
2. ANCEPT registrar requirements and lead time for `.tn`, plus whether the registrant must be a local entity.
3. Current VAT rate applicable to our SaaS, and any reduced rate for IT services.
4. Written MDR and settlement terms per payment rail (ClicToPay, Flouci, PayTabs/Checkout.com).
5. DataXion quote for a rack, cross-connects, and Cloudaxion VM pricing.
6. Current Hetzner/OVHcloud prices for the exact instance types in §4 (2026 has seen repeated increases).
7. Model prices on the contract date, and whether a local GPU node beats API spend at our projected volume.