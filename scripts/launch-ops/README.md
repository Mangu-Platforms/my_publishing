# Launch Ops — the console lane as one-click code

Every remaining "log into a dashboard and click things" launch task, wrapped as
a dispatchable GitHub Actions workflow: [`.github/workflows/launch-ops.yml`](../../.github/workflows/launch-ops.yml).
The only manual work left is **entering the secrets once** (manifest below).
All scripts are idempotent and safe to re-run; every mutating one honours
`DRY_RUN` (default **true** — nothing changes until you flip it).

## Actions

| Action | Script | Required secrets | What it does |
| --- | --- | --- | --- |
| `all-safe` | (runs the 5 below) | union of theirs | Every non-destructive action: additive governance + hardening + read-only audits. Excludes `stripe-webhook-setup`, the only action that can touch live checkout — run that one explicitly. |
| `protect-branch` | `protect-branch.sh` | `GH_PAT_SECRETS` | Enforces protection on `main`: ≥1 approving review, dismiss stale reviews, required status check `ci`, no force pushes/deletions. GETs first, reports the diff, PUTs only on drift (preserving unrelated existing toggles). The default `GITHUB_TOKEN` can never do this — Actions has no `administration` permission. |
| `create-label` | `create-label.sh` | none (default token) | Ensures label `steward-approved` (color `B91C1C`, "Human-approved for steward auto-merge") exists; fixes drift; tolerates the 422 already-exists race. |
| `stripe-webhook-setup` | `stripe-webhook-setup.sh` | `STRIPE_SECRET_KEY`, `VERCEL_TOKEN`, `VERCEL_PROJECT_MY_PUBLISHING`, (`VERCEL_TEAM_ID`) | Verifies exactly one enabled webhook for `https://www.mangu-publishers.com/api/webhook` with the 4 checkout/refund events. Creates it if missing (reusing `scripts/create-stripe-webhook.sh` when the stripe CLI exists, REST API otherwise), pushes the new `whsec_` into Vercel **production** env `STRIPE_WEBHOOK_SECRET` (masked), and reminds — or triggers with `redeploy=true` — the redeploy that env changes require. Event drift is fixed in place (a second endpoint would double-deliver); duplicate endpoints fail loudly for a human to prune. |
| `vercel-env-audit` | `vercel-env-audit.sh` | `VERCEL_TOKEN`, `VERCEL_PROJECT_MY_PUBLISHING`, (`VERCEL_TEAM_ID`) | Lists env var **names only** (never values) for production + preview and tables the 10 required vars from `scripts/validate-env.ts`. Fails if any is missing in production or if `USE_MOCKS`/`SKIP_EMAILS` exists there (P0-016). Exit code = audit verdict. |
| `supabase-auth-hardening` | `supabase-auth-hardening.sh` | `SUPABASE_ACCESS_TOKEN` | Enables leaked-password (HIBP) protection via the Management API (HUMAN_TASKS H1.4). Verifies the exact field name (`password_hibp_enabled`) against the live GET response before PATCHing; refuses to patch an unverified field. |
| `legacy-key-check` | `legacy-key-check.sh` | `SUPABASE_LEGACY_ANON_KEY` (optional) | Probes the REST endpoint with the OLD anon key: 401/403 = PASS (rotation complete), 200 = FAIL ("legacy key still active — disable in dashboard"). Skips with a notice when the secret is absent. |

Project ref for the two Supabase actions comes from the repo/org **variable**
`SUPABASE_PROJECT_REF` (defaults to `tkzvikozrcynhwsqtkqp` in the scripts).

## Running it

**UI:** GitHub → Actions → *Launch Ops* → *Run workflow* → pick `action`,
untick `dry_run` when ready to apply.

**CLI:**

```bash
# safe audit of everything (default: dry_run=true)
gh workflow run launch-ops.yml -f action=all-safe

# apply for real
gh workflow run launch-ops.yml -f action=all-safe -f dry_run=false

# one action, e.g. the Stripe lane (with redeploy)
gh workflow run launch-ops.yml -f action=stripe-webhook-setup -f dry_run=false -f redeploy=true
```

Scripts also run locally, e.g.
`DRY_RUN=false GH_PAT_SECRETS=… bash scripts/launch-ops/protect-branch.sh`.

## SECRETS MANIFEST — set once at Settings → Secrets and variables → Actions

Reused names, already established by `rotate-supabase-key.yml` / HUMAN_TASKS H0.1-A:

| Secret | Where to obtain |
| --- | --- |
| `VERCEL_TOKEN` | vercel.com/account/tokens → Create |
| `GH_PAT_SECRETS` | github.com/settings/tokens → Fine-grained PAT on this repo. Needs **secrets:write** (for rotation) and **administration:write** (for `protect-branch`). |
| `VERCEL_PROJECT_MY_PUBLISHING` | Vercel → my_publishing → Settings → General → Project ID |
| `VERCEL_PROJECT_MANGUPROJECTZ` | Vercel → manguprojectz → Settings → General → Project ID (used by rotation, not by launch-ops) |
| `VERCEL_TEAM_ID` | Vercel team ID (leave empty for personal accounts) |

Newly introduced by launch-ops:

| Secret | Where to obtain |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe dashboard → Developers → API keys → Secret key (`sk_live_…` for the real webhook) |
| `SUPABASE_ACCESS_TOKEN` | supabase.com/dashboard/account/tokens → Generate new token (`sbp_…`) |
| `SUPABASE_LEGACY_ANON_KEY` | The OLD anon key you rotated away from (rotate-supabase-key.yml run input / Supabase dashboard → API keys → legacy JWT). Optional — enables `legacy-key-check`. |

Variable (not secret): `SUPABASE_PROJECT_REF` — Supabase dashboard project ref;
only needed if it ever differs from the default `tkzvikozrcynhwsqtkqp`.

## Still human-only (by design)

Automation stops where identity, money and judgement start:

- **Identity / OAuth**: creating accounts, OAuth app approvals, granting the
  fine-grained PAT, org-level PAT approval, MFA.
- **Real-card purchase test**: the live checkout with a real card (and its
  refund) must be a human decision.
- **Book selection & content**: which titles launch, catalog curation, copy.
- **Sign-offs**: Data Owner reconciliation sign-off (P11.6), go/no-go calls,
  and rotating `SUPABASE_SERVICE_ROLE_KEY` (a deliberate manual, human-gated
  procedure — see `docs/operations/ENVIRONMENT_MATRIX.md` §3 and the warning
  in `rotate-supabase-key.yml`).
