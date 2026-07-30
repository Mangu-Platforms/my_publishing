# END-TO-END PROGRAMME — from 2026-07-30 to LAUNCH COMPLETE

**Authority:** owner-directed, 2026-07-30. **Freeze:** #209 rules apply until the GO tag.
**Baseline:** everything asserted in `docs/launch/EVIDENCE_2026-07-30_SWARM_VERIFICATION.md`
(hosted DB verified in sync, production probes green, rollback target recorded, EPUB
bucket private, truthful JSON-LD deployed at `0e38287`).
**Definition of done:** `npm run gates:compile` prints **GO** for G1–G13 per
`DEFINITION_OF_LAUNCH_COMPLETE.md`, real titles are live, seed content is gone, and the
launch comms are sent. Epilogue items (§5) close within 14 days after.

---

## 1. Agent roster (6 agents + the human lane)

| ID | Agent | Executor | Charter | Activation | Freeze authority |
| --- | --- | --- | --- | --- | --- |
| A1 | **PROBE** | Claude (this session type) | After every production deploy: probe battery — org/website JSON-LD truthfulness, `/api/books`, one PDP, apex 308, legacy-webhook 410, sitemap host purity. Append deltas to the evidence doc. | Every prod deploy; on demand | Read-only + class-1 docs |
| A2 | **LEDGER** | Claude | Keep hosted↔repo migration history at **zero drift**. Today: mirrored the 3 `mcp_vault`/`mcp_stack` entries verbatim from `supabase_migrations.schema_migrations` (this PR). Future: any hosted apply is mirrored same-day. | Any schema change | History-sync files only |
| A3 | **SCRIBE** | Claude | Governance upkeep: evidence packet, HUMAN_ACTIONS deltas, machine-evidence rows in `LAUNCH_GATE_EVIDENCE.md` (approver cells stay human), branch-audit execution support. | Continuous | Class-1 docs |
| A4 | **KEYS** | Claude + Claude-in-Chrome / Drive | Content entry: the moment book assets exist (Drive folder or chat upload) and an admin session is available in Chrome, enter each title via `/admin/books/new`, owner taps approve per publish, verify PDP, then seed flip via admin UI in HA-C8 order (real in → seed out). | **Blocked on H0-4** (assets) | Admin UI only; no DB writes |
| A5 | **SWEEP** | Claude (direct) — Copilot dispatch attempted 2026-07-30, rejected 401 (account lacks coding-agent access) | Canonical-host alignment: the known apex reference in `scripts/create-stripe-webhook.sh` is **fixed in this PR** (apex-registered Stripe endpoints fail every delivery — Stripe does not follow the 308). Full repo-wide sweep for further `manguprojectz.vercel.app`/apex-as-endpoint references queued for when code-search access is approved or post-launch. | Known ref: DONE. Full sweep: queued | Truthfulness/config alignment |
| A6 | **HARDEN** | Claude (direct) — same Copilot 401 | **DRAFT, post-launch, DO-NOT-MERGE during freeze:** migration converting `author_manuscript_status_history` + `author_manuscript_feedback` views to `security_invoker`, clearing the 2 advisor ERRORs. Test against a branch DB before applying to hosted. | Draft PR opened 2026-07-30 | Draft only |

**Anti-PR-storm rule:** max **2** open agent PRs at any time. Merge-on-green only, owner-authorized trail in every merge body. No feature work until the freeze lifts.

## 2. Human lane H0 (Renee) — the actual critical path

Each item is here because no agent can lawfully or physically do it.

| # | Action | Why human | Est. |
| --- | --- | --- | --- |
| H0-1 | **Stripe dashboard:** exactly one endpoint `https://www.mangu-publishers.com/api/webhook`, secret matches Vercel `STRIPE_WEBHOOK_SECRET`, 4 events (`checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `payment_intent.payment_failed`). **Urgent: the legacy path already 410s in production.** If using `scripts/create-stripe-webhook.sh`, pull this PR first — the pre-fix version registered the apex and every delivery would fail. | Dashboard login | 5 min |
| H0-2 | One **real purchase + refund** with a real card (G4/G8). | Moves money | 15 min |
| H0-3 | Real **signup, failed logins, password reset**; reset-email links must point at www (G3). | Real inbox | 15 min |
| H0-4 | **Name the 3–6 launch titles**, confirm rights, hand assets (title, author, description, price, genre, cover, retailer links) to A4 via Drive or chat. | Only the owner knows the books | the wildcard |
| H0-5 | **Admin publish round trip** on one title (create → draft invisible → publish → visible → unpublish) — the critical-path acceptance test. A4 can drive; owner approves each step. | Admin credentials | 20 min |
| H0-6 | Manual QA rows MQ-01…MQ-10 at the RC SHA (G10); full `npm run qa:crawl` against RC; rollback rehearsal against the recorded target; browser matrix. | Human eyes/devices | 2–3 h |
| H0-7 | Sign-offs: ADR-001 · marketing copy · refund policy for /terms · A11Y token colours (retroactive, they are live) · socials HA-B14 · owners/recipients HA-B5/B17 · launch facts + comms HA-D8/D9. | Owner authority | 1–2 h |
| H0-8 | Dashboard toggles: Supabase leaked-password protection ON; plan/auto-pause confirmation (HA-B21); full Vercel env walk of `ENVIRONMENT_MATRIX.md` (the two known symptom classes are already clear). | Dashboard login | 30 min |
| H0-9 | **GO:** `npm run gates:compile` → GO → tag → send comms. | The owner presses the button | 15 min |

## 3. Dependency map

`NOW ─▶ [A1–A3 baseline: DONE today] ─▶ H0-1..3 (any order, tonight-able)`
`H0-4 ─▶ unlocks A4 ─▶ titles live ─▶ seed flip (HA-C8 order) ─▶ A1 full re-probe + qa:crawl`
`─▶ H0-5/6 on the RC SHA ─▶ H0-7/8 sign-offs+toggles ─▶ H0-9 gates:compile GO ─▶ LAUNCH`
`LAUNCH ─▶ epilogue (§5)`

Parallelism: H0-1/2/3/7/8 have **no dependency on the books** — they can all finish before
H0-4 lands. The programme's total duration is therefore ≈ the book-assets duration.

## 4. Status ledger (living — SCRIBE maintains)

| Item | Status | Artifact |
| --- | --- | --- |
| Baseline verification | DONE 2026-07-30 | Evidence doc §1–§7 |
| Bucket privacy (HA-C2) | DONE, db-enforced | migration 20260730173947, PR #379 |
| Truthful JSON-LD deployed | DONE @ `0e38287` (dpl_21D4znjD… READY); live re-probe pending (fetch tool rate-limit) | PR #379; A1 next pass |
| Migration drift | **ZERO** once this PR merges | 3 mirrors in this PR |
| A5 SWEEP | Known apex ref in create-stripe-webhook.sh **fixed in this PR**; Copilot dispatch 401; full sweep queued | this PR |
| A6 HARDEN | Draft PR opened, DO NOT MERGE during freeze | draft PR |
| H0-1 Stripe endpoint | OPEN — most urgent | — |
| H0-2/3 money + auth proofs | OPEN | — |
| H0-4 book assets | OPEN — programme-length driver | — |
| H0-5–9 | OPEN, sequenced above | — |
| Branch deletions | list ready, awaiting one-glance approvals | BRANCH_AUDIT_2026-07-30.md |
| Dependabot | 3 majors closed, 7 minors parked | audit doc |

## 5. Post-launch epilogue (within 14 days of GO)

1. Merge A6 HARDEN (advisor ERRORs → zero) after branch-DB testing. 2. Decide
`mcp_vault`/`mcp_stack` keep-or-drop (now a normal repo-tracked decision; both schemas
empty of secrets today). 3. Reopen and batch the 3 dependabot majors behind green CI.
4. Execute branch deletions per the audit. 5. Submit sitemap to Search Console (site
currently has zero index presence — expected pre-launch). 6. Supply a real support
mailbox and pass it to `OrganizationJsonLd`. 7. Complete A5's full repo-wide sweep.
8. Lift Freeze #209 by owner comment.
