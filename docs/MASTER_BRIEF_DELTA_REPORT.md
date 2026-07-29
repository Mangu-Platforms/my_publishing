# Master Brief Delta Report — Phase 0 Reconnaissance

**Proposed repo path:** `docs/MASTER_BRIEF_DELTA_REPORT.md`
**Repo:** `redinc23/my_publishing` · **HEAD at recon:** `8246424f915968c55cb49dd87daa112adeb831de` (2026-07-29, "A11Y: flip verified skip-link spec, record first e2e run vs production (#364)")
**Input:** Mangu Claude Execution Master Brief (uploaded 2026-07-29)
**Author:** Claude (Phase 0 orchestrator) · **Date:** 2026-07-29
**Classification:** Documentation-only. No code changed, no deploys, no settings touched, nothing merged. Permitted under launch freeze #209 class 1.

Evidence classes follow `docs/NEXT_GO.md` §2: **VERIFIED (repo)** = confirmed against HEAD SHA above; **VERIFIED (live)** = GitHub API / production observation today; **DOC-ONLY** = claim from a repo document, not independently re-tested; **PROPOSED** = not yet executed.

---

## 1. Executive summary

The Master Brief is executable, but as a **gap-closure and sequencing program, not a greenfield build**. Roughly half of its Phases 0–3 scope already exists in the repo in some form; its Phases 4–8 (AI platform, agent roster, autonomous SDLC, command center) are almost entirely missing and are all post-freeze work. Three governing contracts outrank the brief and are all active: `docs/PROJECT_PHOENIX.md` v4.0.3 (migration, IN PROGRESS), `docs/NEXT_GO.md` v1.2.7 (launch authority — **NO-GO**, gates G1–G11 FALSE), and launch freeze issue #209. Eight concrete conflicts between the brief and those contracts are documented in §6 with proposed amendments; per the brief's own rule, none may be improvised around.

The single most important finding: **the brief's delivery sequence is compatible with the existing program if its Phase 1 is read as "finish Phoenix + NEXT_GO P0s," its Phases 2–3 as "close the recorded product gaps behind the existing flag system," and its Phases 4–8 as post-GO workstreams planned now, built behind flags later.** The AI foundation is not zero: a working embeddings/recommendation engine (Resonance), a fail-closed MCP tool server, rate limiting, audit, RBAC middleware, and a dual-run data layer are real seams the brief's AI platform can attach to.

---

## 2. Verified current state

| Area | Finding | Evidence |
|---|---|---|
| Router | **App Router only.** `pages/` does not exist at HEAD. CLAUDE.md §1 ("BOTH app/ and pages/") and Brief §1 are stale on this point. | VERIFIED (repo): `find app -name page.tsx` → 62 routes (60 product + 2 `app/dev/` previews); no `pages/` dir |
| Stack | Next.js 14.2.35, React 18.3.1, strict TS, Tailwind, Radix/shadcn-style `components/ui` (21 files) | VERIFIED (repo): `package.json` |
| Dual-run | `lib/auth/provider.ts` (`AUTH_PROVIDER`, default supabase) and `lib/db/provider.ts` (`DATABASE_PROVIDER`); Mongo layer (`lib/mongodb.ts`, `lib/mongo-queries.ts`, `lib/data/*` 13 files); Better Auth code paths landed; Edge middleware cookie-only with fail-closed auth + rate limiting | VERIFIED (repo): `middleware.ts`, `lib/data/`, deps `better-auth@^1.6.23`, `mongodb@^7.5.0`, `@vercel/blob@^0.27.0` |
| Phoenix state | v4.0.3, IN PROGRESS. WS2d catalog dual-run **landed** (PR #349 path per Phoenix §; PR now closed, 0 open PRs). **Remaining:** admin writes (`admin/actions`), manuscripts edit/new, partner portal, engagement APIs; then WS3–WS6, phases 5–14 | VERIFIED (repo) + VERIFIED (live): `docs/PROJECT_PHOENIX.md` line 381; GitHub API open PRs = 0 |
| Launch authority | `docs/NEXT_GO.md` v1.2.7: **NO-GO**. Hard gates: G1–G11 **FALSE**, G12 PARTIAL, G13 TRUE. ADR-001 Option B (Vercel) accepted. 11 open issues: P0-004/008/009/010/011/015/016 (#192,193,191,205,195,199,203), P0-001 (#187), P0-005 (#194), P0-018 (#198), freeze #209 | VERIFIED (repo) §6 gate matrix + VERIFIED (live) issue list |
| Freeze | #209 ACTIVE. Permitted classes: (1) docs, (2) CI/CD truthfulness, (3) PR hygiene, (4) minimal recovery repairs, (5) approved security fixes. Held: release-please 1.0.0 (#145), 7 dependabot majors, #142 | VERIFIED (live): issue #209 |
| Tests | `tests/unit` 62 files, `integration` 2, `e2e` 8 (accessibility, auth-flow, purchase-flow, rate-limit-abuse, rbac-matrix, role-gating, smoke-auth, smoke-stripe), `k6` 1. CI (`ci.yml`): validate:gap-ledger → type-check → lint → test → build. First a11y e2e run **against production** 2026-07-29: 21 pass / 2 fail / 18 skip (fails: A11Y-020 checkout `<h1>`, seed-data cover naming) | VERIFIED (repo) + VERIFIED (live): PR #364 |
| Observability | Sentry client/server/edge configs; structured logger `lib/logger.ts`; fail-closed Upstash limiter `lib/rate-limit.ts`; `/api/health` (env + Supabase + Mongo ping, `?ready=1` readiness) and `/api/live`; single audit writer `lib/audit.ts` | VERIFIED (repo) |
| Commerce | Stripe checkout (`app/checkout`, `app/api/checkout`), **two** webhook route files: `app/api/webhook/route.ts` (constructEvent + `stripe_payment_intent_id` idempotency) and `app/api/webhooks/stripe/route.ts` — exactly-one-live-endpoint must be proven for G8 (P0-010/#205). Entitlements `lib/reading/entitlement.ts`. No cart (buy-now + six retailer links per `lib/books/fields.ts`). Refund path = routing only | VERIFIED (repo) |
| Automation infra | `merge-steward.yml` (PR steward, hourly cron), `rotate-supabase-key.yml`, `.cursor/automations/` (phoenix-next-slice, prod-health-triage prompts), `.claude/skills/` (23 specialist packs incl. mangu-navigator, phoenix-contract, mcp-catalog-*), `.bob`/`.bolt` MCP configs, `AGENTS.md`. Note: the H0.2b CI-fix-loop workflows (`ci-fix-loop.yml`, `auto-merge.yml`) were **deleted** in the CI minimization (`8c8ba3f`, per HUMAN_TASKS H0.4) — only the three workflows above exist | VERIFIED (repo) |
| Production | `https://www.mangu-publishers.com` on Vercel. Recent merged audit fixes (#350, 2026-07-29): auth pages SSR, draft-book leak closed, PDP admin-client fallback, retailer buttons on PDP, callback deep links. #350 body records **unresolved prod env suspicions**: possible missing/rotated `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_PROVIDER` mismatch, Upstash env (fail-closed limiter can blank `/api/books`). `/api/health` fetch today returned an empty body — inconclusive, needs operator curl | VERIFIED (live) PR bodies; health probe UNVERIFIED |

---

## 3. Existing AI surface (Brief §4/§9 baseline)

| Component | State | Evidence |
|---|---|---|
| Embeddings | **EXISTS.** OpenAI `text-embedding-3-small` via `lib/resonance/embeddings.ts` (lazy client, `OPENAI_API_KEY`) | VERIFIED (repo) |
| Vector store | **EXISTS (Supabase).** `resonance_vectors` table with `embedding vector(384)` defined in `20260116000000_initial_schema.sql:119-122`; migration `20260719014349_resonance_engine_phase2.sql` adds the one-vector-per-book unique index and `match_resonance_vector` RPC (nearest published/public books to an arbitrary taste vector) | VERIFIED (repo) |
| Recommendations | **EXISTS.** Fault-tolerant fallback chain `lib/resonance/recommendations.ts`; rails on homepage (`RecommendationsRail`, `BecauseYouReadRail`); APIs `app/api/resonance/{embed,recommend,similar,track}` with rate limits; server cache 1h TTL | VERIFIED (repo) |
| MCP tool server | **EXISTS, disabled by default.** `app/api/mcp/[transport]` via `mcp-handler@1.1.0`, 5 tools (4 catalog + health), dual-run data access `lib/mcp/catalog.ts`, fail-closed guard (`MCP_ENABLED` + bearer `MCP_API_KEY` + shared limiter; 404 otherwise) per P0-017/#200 decision in `docs/MCP_SERVER.md` | VERIFIED (repo) |
| Chat/LLM inference | **MISSING.** Zero chat/completions/messages calls repo-wide; no Anthropic SDK; no conversation store, orchestrator, prompt registry, eval harness, token budgeting, citations, knowledge registry | VERIFIED (repo): greps return 0 |
| Brief §19 docs | **All 11 MISSING** from `docs/` (`MASTER_IMPLEMENTATION_PLAN`, `ARCHITECTURE_AI_PLATFORM`, `AGENT_REGISTRY`, `SKILL_REGISTRY`, `KNOWLEDGE_SOURCE_REGISTRY`, `AI_SAFETY_PRIVACY_POLICY`, `AI_INCIDENT_RESPONSE`, `AI_EVALUATION_PLAN`, `COMMAND_CENTER_SPEC`, `QA_MASTER_MATRIX`, `HUMAN_TASKS`). Near-equivalents: root `HUMAN_TASKS.md` (live, structured), `docs/MCP_SERVER.md`, `docs/AGENT_SKILLS.md`, `docs/OPERATOR_QA_LOG.md`, `docs/SECRET_INVENTORY.md` | VERIFIED (repo) |

**Attachment seams for the brief's AI platform** (reuse, don't reinvent): the dual-run `lib/data/*` read layer (provider-agnostic tools), the MCP guard pattern (fail-closed flags + bearer + limiter) as the tool-gateway seed, `lib/rate-limit.ts` + `lib/flags.ts` + `lib/audit.ts` for budgets/kill-switches/audit events, Resonance vectors as RAG retrieval v0, and Sentry+logger as the observability plane.

---

## 4. Gap matrix vs Brief sections

Status: ✅ EXISTS · 🟡 PARTIAL · ❌ MISSING. All rows VERIFIED (repo) unless noted.

| Brief § | Requirement | Status | Repo reality |
|---|---|---|---|
| §2/E02 | Design system, responsive shell, states | 🟡 | `components/ui` (21) + 18 component dirs, dark theme, skip link landed (#363); a11y audit open items A11Y-004/006/019/020; contrast tokens fixed (A11Y-001/002) |
| §3/E03 | Catalog, search, genres, trailers | 🟡 | `/books`, `/genres/[genre]`, `/authors`, `/discover`, search + `books_search` drift caveat; trailers via `trailer_vimeo_id` on PDP |
| §3/E03 | Comics as real taxonomy | 🟡 | Routes `/comics`, `/comics/[slug]` + `FEATURE_COMICS` flag (default OFF, honest-unavailable); data model rides `books`; no comic-specific panel/issue model |
| §4/E04 | Book detail completeness | 🟡 | Cover, synopsis, retailer buttons (#350), reviews tab (flagged), related titles; audio sample tab behind `FEATURE_AUDIO`; no preview/excerpt surface |
| §5/E05 | Library / portals / RBAC | 🟡 | `/library`, author portal (dashboard/analytics/projects/submit), partner portal (ARC/catalogs/orders), admin (books/orders/users/manuscripts/health/dashboard); RBAC middleware + rbac-matrix e2e; admin **writes** still Supabase-only (Phoenix WS2d remainder) |
| §4.3/E06 | AI foundation (provider abstraction, orchestrator, prompt registry, tool gateway, conversation store, evals, budgets) | ❌ | Only seams in §3 above |
| §9/E07 | RAG + knowledge registry | ❌ | Resonance vectors = book-level only; no document ingestion/chunking/citations/freshness/deletion |
| §4/E08–E09 | Public + authenticated assistant | ❌ | No chat surface at all |
| §5/E10 | 40-agent internal roster | ❌ code / 🟡 concept | `.claude/skills` 23 packs + `.cursor/automations` are a real precursor for ~10 of the 40 roles (ops/CI/content); none are runtime product agents |
| §12/E11 | Command center | 🟡 | `/admin/health` + `/admin/dashboard` + `/api/health` exist; no aggregated GitHub/Vercel/Stripe/AI-quality/approvals panel; `docs/COMMAND_CENTER_SPEC.md` missing |
| §13/E12 | Autonomous SDLC loop | 🟡 | Detect (Sentry, health, CI) + steward (merge-steward hourly) + agent-authored PRs (#350/#363/#364 pattern) exist; no normalized incident events, dedupe/fingerprint, RCA chain, or Sentry→issue automation. Caution: HUMAN_TASKS H0.2b describes a CI fail→agent fix→**auto-merge on green** loop, whose workflows no longer exist in the tree — its auto-merge intent conflicts with Brief §0 "no autonomous production merge" (see C9-adjacent note in §6) |
| §14 | QA matrix layers | 🟡 | Unit/integration/e2e/a11y/k6/RBAC/rate-limit real; missing: AI evals (n/a yet), visual regression, resilience/chaos, data-reconciliation suite (Phoenix WS5 scope) |
| §15 | Security/privacy controls | 🟡 | RBAC server-side, fail-closed limiter, secret inventory, no secrets in repo, MCP fail-closed; **open risks in §7** |
| §16 | Observability metrics | 🟡 | Reliability plane exists; product/AI metric definitions absent |
| §19 | 11 governance docs | ❌ | See §3 |

---

## 5. What the brief got wrong about current state (amend before execution)

1. **"Both app/ and pages/ may exist"** — false at HEAD; App Router only. (Also stale in CLAUDE.md §1 — truthful-docs fix, freeze class 1.)
2. **"No complete production chatbot implementation was found"** — correct, but understates what exists: Resonance + MCP server are production-grade AI assets (§3).
3. **"Supabase is being replaced"** — directionally true per Phoenix, but the operative launch contract is **dual-run**: Supabase = auth/identity/orders/entitlements, MongoDB = catalog reads, until Phase 11–12 cutover readiness. AI work must be provider-agnostic, not Mongo-assuming.
4. **Design intent "carousels, trailers, comics, rich media"** — largely already built and flag-gated; the work is honest-content + gap closure, not construction.

---

## 6. Conflict ledger (brief vs governing contracts) — stop-and-amend items

Per Brief §0, these are documented, not improvised around. Canonical order of authority observed: PROJECT_PHOENIX.md / NEXT_GO.md / CLAUDE.md / HUMAN_TASKS.md > Master Brief.

| ID | Conflict | Governing source | Proposed amendment (owner decision) |
|---|---|---|---|
| C1 | Brief Phase 1 "Complete Project Phoenix" then build on Better Auth/Mongo vs. operative launch architecture: production stays on Supabase Auth until Phase 11–12 cutover readiness; catalog reads dual-run to Mongo | `docs/PROJECT_PHOENIX.md:25` (public dual-run amendment); `CLAUDE.md:5-7`; `docs/architecture/ADR-001-catalog-and-identity-data-ownership.md` + `docs/architecture/DATA_OWNERSHIP_MATRIX.md` | Amend brief: AI/tooling targets `lib/data/*` + provider switches; no feature may require cutover |
| C2 | Brief Phases 2–3 launch surfaces (comics, community, trailers-everywhere, wishlist) vs. freeze #209 + NEXT_GO §7 locked launch scope (those flags default OFF / post-GO) | NEXT_GO §7–8; #209 | Amend brief: E02–E05 items are (a) freeze-permitted gap fixes now, (b) flagged builds merged only post-thaw |
| C3 | Brief §11 "cart/checkout" vs. in-repo locked decisions: six retailer links at launch (`lib/books/fields.ts:16-27` "locked decision C.3"; `docs/launch/DEFINITION_OF_LAUNCH_COMPLETE.md` C9) and no on-site EPUB reader promise. **Cart absence is current design, not a recorded decision** — `docs/BRD.md:145` specifies Buy Now + Add to Wishlist only | `lib/books/fields.ts`; `docs/launch/*`; `docs/BRD.md` | Amend brief §11 to buy-now + retailer model; add "cart yes/no" to owner decisions (§9.11) |
| C4 | Brief §13 daily autonomous automations vs. HUMAN_TASKS C0.1 (disable Cursor storm automations) and one-vehicle-per-failure-signature rule. Additionally, HUMAN_TASKS **H0.2b's loop is auto-merge-on-green** — directly conflicting with Brief §0 "no autonomous production merge" — and its workflows were deleted (`8c8ba3f`) | HUMAN_TASKS C0.1/H0.2b/H0.4; #209 class 4 | Build E12 on merge-steward + agent-PR pattern with **human merge gate** (brief §0 model); owner must explicitly ratify or retire H0.2b's auto-merge intent (§9.12) |
| C5 | Brief expects `docs/HUMAN_TASKS.md` | Root `HUMAN_TASKS.md` is the live ledger | Amend brief path; do not create a second ledger |
| C6 | Brief §4 public AI assistant as site feature vs. NEXT_GO launch scope (AI = Resonance behind flag; assistant absent) | NEXT_GO §7 | Assistant is post-GO (or explicit scope change via change control + same-PR NEXT_GO update); until then E06–E09 are spec/eval/prototype-behind-disabled-flag work |
| C7 | Brief §1 router uncertainty + §3 Phase 2 "depends on stable data/auth contracts" vs. reality (App Router; WS2d admin-writes remainder unstable area) | This recon | Amend brief current-state table per §5 above |
| C8 | Brief §12 command center "aggregate GitHub, Vercel, Atlas, Sentry, Stripe" requires new external credentials/scopes vs. rule that agents never handle new secrets without human gate | CLAUDE.md rule 7; SECRET_INVENTORY | Add human gate: owner provisions read-only tokens per integration before E11 build |
| C9 | **Freeze-vs-Phoenix authority gap.** Owner reactivated Phoenix 2026-07-20 (CLAUDE.md), but NEXT_GO/#209's five permitted change classes (frozen 2026-07-18) do not include "Phoenix migration parity slices" — so WS2d-remainder code work (admin writes, manuscripts, partner, engagement) currently fits **no** permitted class, while CLAUDE.md treats it as the active mission | CLAUDE.md status block vs. NEXT_GO §7–8 / #209 | Owner change-control: amend NEXT_GO §8 (same-PR rule) to add class 6 "Phoenix migration parity + hardening per PROJECT_PHOENIX.md task IDs" — reconciling the later owner decision with the earlier freeze text. Until amended, WS2d-remainder merges are technically out of scope |

**Governance defect (not a brief conflict): two live ADR-001s.** `docs/adr/ADR-001-canonical-platform.md` and `docs/architecture/ADR-001-catalog-and-identity-data-ownership.md` share a number; the latter itself forbids bare "ADR-001" citations. This report uses full paths; recommend renumbering in PR-D1.

**No conflict found** between the brief's permission model (read-only default, human merge gate, no autonomous prod change) and NEXT_GO/Phoenix governance — they align. The one exception is H0.2b's auto-merge intent (see C4).

---

## 7. Security & privacy risk register (current, pre-AI)

| # | Risk | Severity | Source | Disposition |
|---|---|---|---|---|
| R1 | **Unsigned `mangu-role` cookie trusted by middleware for `/admin`,`/author`,`/partner` gates under the Better-Auth path** | High | PR #350 "known issues" | Candidate for freeze class 5 (approved security fix) — recommend next engineering PR; server-side session validation must be authoritative |
| R2 | Production env integrity: possible missing/rotated `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_PROVIDER` mismatch, Upstash vars (fail-closed limiter blanks public APIs when absent) | High | PR #350; P0-011/016 | Console-gated: operator env audit (existing issues #195/#203); do not guess |
| R3 | Schema drift: code references columns/tables in no migration (`books.subtitle`, `epub_url` on books, `logAudit` targets, `books_search` RPC…) | High | Launch-exec contract; #192 | P0-004 reconciliation is the vehicle; **never** add columns via new `supabase/migrations/` until reconciled |
| R4 | Supabase pause/delete failure mode (NXDOMAIN masked by ISR cache) | High | Launch-exec; incident history | Monitoring + `docs/PHOENIX_CUTOVER_RUNBOOK.md`; command center panel later |
| R5 | Two Stripe webhook route files; G8 requires exactly one registered endpoint proven idempotent | Med | Repo + NEXT_GO G8 | P0-010 evidence run decides + removes/guards the other |
| R6 | Public repo: any AI docs must exclude secrets/PII/private manuscripts (brief §0 rule already requires) | Med | Repo visibility | Enforce in doc templates |
| R7 | A11y open items: A11Y-020 (checkout h1), A11Y-004/006 heading levels, 26 blanket eslint-disables killing jsx-a11y | Med | PR #360/#364 audit | Fold into E02 gap-closure under freeze class where truthful-CI applies, else post-thaw |
| R8 | Held dependency majors incl. Next 14→16 chain with 17 npm-audit vulns flagged post-GO | Med | #209 held list | Post-GO per freeze; revisit severity if a critical CVE lands (class 5) |

Privacy note for E06+: brief §4.4 data classes map cleanly onto existing classes (user-private = orders/library/progress already RBAC'd). No conversation data exists yet, so retention design starts clean — an advantage.

---

## 8. Epic decomposition mapped to reality (brief §18 → program of record)

Safest execution order under current governance. "Now" = permitted during freeze; "Thaw" = after controlled thaw (Phase 16); "Post-GO" = after G1–G13 TRUE.

| Epic | Brief name | Reality mapping | When | Blocking dependency |
|---|---|---|---|---|
| E00 | Recon & reconciliation | **This report** + conflict amendments C1–C8 into brief/CLAUDE.md | Now (docs PR) | — |
| E01 | Phoenix completion | WS2d remainder (admin writes, manuscripts, partner, engagement) → WS3 storage → WS4 supabase-code removal → WS5 tests → WS6 hardening; in parallel NEXT_GO P0 ladder (#187→#194/#195→#191/#193→#205→#198) — most are operator/console evidence tasks. In-repo NEXT_GO table already marks P0-004 DONE / P0-005 agent-DONE / P0-015 schema-DONE pending operator confirm, though the GitHub issues remain open | P0 evidence now; WS2d-remainder code **after C9 amendment** (else out of freeze scope) | C9; C0/H0 human gates |
| E02 | Design system | Gap-closure: a11y open items, heading levels, eslint-disable cleanup, empty/error state audit vs `docs/PRODUCT_GAP_LEDGER.md` | Now (truthful-CI/docs) / Thaw (feature) | E01 stability |
| E03–E04 | Catalog/detail/media | Content-truth work (real covers/books per launch scope 3–6 books), preview/excerpt decision, comics real model spec | Thaw | Owner content + E01 |
| E05 | Identity & portals | Finish WS2d admin writes; partner portal parity; role-cookie fix R1 | R1 now (class 5); rest with WS2d | Phoenix order |
| E06 | AI platform foundation | Provider abstraction + orchestrator + prompt registry + tool gateway (extend MCP guard) + conversation store + budgets; **spec now, build behind disabled flag** | Spec now; build Thaw; enable Post-GO | C6 amendment; model decision (Appendix B) |
| E07 | Knowledge platform | Source registry + ingestion + citations; v0 retrieval = Resonance vectors + catalog API | Spec now; build Thaw | E06 |
| E08–E09 | Public/authenticated assistant | UX + skills per brief §4.2 modes; eval harness gates release | Post-GO (or scope change) | E06/E07, evals |
| E10 | Internal agents | Formalize existing 23 skill packs into `docs/AGENT_REGISTRY.md` roles A29–A40 first (ops-facing), then editorial/marketing A09–A28 | Registry now (docs); runtime Post-GO | E06 gateway |
| E11 | Command center | Spec + dashboard schema now; wire read-only integrations after owner provisions tokens (C8 gate) | Spec now; build Thaw | C8 human gate |
| E12 | Autonomous SDLC | Normalize incident events → Sentry/health → issue creation → steward-verified agent PRs; keep human merge | Spec now; wire with H0.2b | C4 resolution |
| E13 | Governance | The 11 docs of brief §19 — start with AGENT_REGISTRY, AI_SAFETY_PRIVACY_POLICY, AI_EVALUATION_PLAN, COMMAND_CENTER_SPEC, QA_MASTER_MATRIX skeletons | Now (docs PRs) | E00 merged |

---

## 9. Human gates (decisions required — nothing proceeds past them)

**Existing, still open (root HUMAN_TASKS.md + issues):** C0.1 disable Cursor storm automations; H0.1 legacy anon key migration; H0.3/H0.4 console/deploy hardening; H1.1 branch protection confirm; H1.3 Vercel env audit (feeds R2); H1.4 leaked-password protection; P0 operator-evidence ladder (§8 E01). C0.0 (merge #349) appears complete — PR closed, WS2d recorded landed; operator should confirm and tick.

**New, from the brief (Appendix B — owner: Faith/Renee):**
1. AI assistant name/brand (config placeholder until then).
2. Primary + fallback model providers (abstraction first; note: only `openai` SDK present today).
3. Unpublished-manuscript use in AI — recommend default NO (opt-in, staff-scoped, no training).
4. Conversation retention policy — recommend minimal + user delete.
5. Personalization boundaries — explicit controls, no sensitive inference.
6. Agent autonomy ceiling — recommend ratifying current model: agents draft/verify, humans merge/approve.
7. Refund/account actions — human-routed until policy-backed workflows exist.
8. Internal knowledge sources for staff agents — register + classify before any ingestion.
9. **(New, C6)** Is the AI assistant in launch scope or post-GO? Determines E08 sequencing; requires change-control + NEXT_GO update if pulled forward.
10. **(New, C8)** Provision read-only tokens (GitHub, Vercel, Atlas, Sentry, Stripe) for command center — per-integration approval.
11. **(New, C3)** Cart: adopt one (buy-now only stays the model) or defer formally — currently undecided in any repo doc.
12. **(New, C4)** Ratify or retire H0.2b's auto-merge-on-green intent; recommend retire in favor of brief §0's human-merge model.
13. **(New, C9)** Approve NEXT_GO amendment adding "Phoenix migration parity" as permitted freeze class 6 — unblocks WS2d-remainder code work.

---

## 10. PR plan (one PR per workstream; human merges; every PR carries task IDs, evidence, rollback, security notes, screenshots for UI)

| PR | Branch | Content | Freeze class |
|---|---|---|---|
| PR-D0 | `docs/master-brief-delta-report` | This report at `docs/MASTER_BRIEF_DELTA_REPORT.md`. (CLAUDE.md §1 truth fix per §5.1 deliberately excluded — governing contract; amended only with owner approval as a follow-up) | 1 |
| PR-D1 | `docs/governance-skeletons` | `AGENT_REGISTRY.md` (mapping existing 23 packs + A-roster), `AI_SAFETY_PRIVACY_POLICY.md`, `AI_EVALUATION_PLAN.md`, `COMMAND_CENTER_SPEC.md`, `QA_MASTER_MATRIX.md` skeletons with owners + acceptance criteria | 1 |
| PR-S1 | `fix/role-cookie-authority` | R1: middleware stops trusting unsigned `mangu-role` for portal gates; server session authoritative; RBAC e2e extended | 5 (needs owner approval as security fix) |
| PR-P* | per Phoenix WS task | WS2d remainder onward, per `phoenix-contract` conventions | 4 / Phoenix scope |
| PR-A0 | `spec/ai-platform` | `docs/ARCHITECTURE_AI_PLATFORM.md` + `docs/MASTER_IMPLEMENTATION_PLAN.md` (task IDs, estimates, dependencies) — spec only, no runtime | 1 |

Verification for PR-D0 (this deliverable): every claim above carries an evidence class; file paths spot-checked against HEAD `8246424`; no code, config, secret, or deploy touched; rollback = revert the docs commit.

---

## 11. Immediate next actions (7 days)

1. Owner: approve PR-D0 + the nine C-amendments (§6) and answer §9 decisions 1–2, 6, 9, 13.
2. Owner console: R2 env audit (#195/#203 click-paths already in HUMAN_TASKS) — this likely explains the live PDP/API blank-body symptoms recorded in #350.
3. Agent (on approval): PR-S1 role-cookie fix; PR-D1 skeletons; Phoenix WS2d remainder once C9 amendment lands.
4. Operator: P0 evidence ladder rows (auth 7A, Stripe P0-010) — these, not code, are the launch bottleneck.
