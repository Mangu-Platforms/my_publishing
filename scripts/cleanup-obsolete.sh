#!/usr/bin/env bash
# One-shot removal of obsolete/redundant files identified in the 2026-07-28
# repo audit. See docs/CLEANUP_MANIFEST.md for per-file rationale.
# Verified NOT referenced by package.json, cloudbuild.yaml, or .github/workflows.
#
# Usage:  bash scripts/cleanup-obsolete.sh
# Then:   git commit -m "chore: remove obsolete files (2026-07-28 audit)"
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

rm_tracked() {
  if git ls-files --error-unmatch "$1" >/dev/null 2>&1; then
    git rm -r --quiet "$1"
    echo "removed: $1"
  else
    echo "skip (not tracked): $1"
  fi
}

# ── InDesign / "We Are Wolf" book-production artifacts (belong in book asset
#    storage, not the website repo) ─ ~5.3 MB
rm_tracked "1d (1).docx"
rm_tracked "Kimi_Agent_Book prep for InDesign.zip"
rm_tracked "WAW_v7_Standalone_FLAWLESS.jsx"
rm_tracked "WAW_v7_PRODUCTION_READY_GUIDE.md"
rm_tracked "WAW_v7_READINESS_ASSESSMENT.md"
rm_tracked "WAW_v7_RELEASE_NOTES.md"
rm_tracked "We_Are_Wolf_InDesign_Production_Guide.docx"
rm_tracked "We_Are_Wolf_InDesign_Production_Guide.docx.pdf"

# ── OS artifacts ───────────────────────────────────────────────────────────
rm_tracked "desktop.ini"

# ── Agent-tool configs for tools no longer in use ──────────────────────────
rm_tracked "RUN_THIS_IN_BOB.txt"
rm_tracked ".bob"
rm_tracked ".bolt"
rm_tracked "install_mangu_bob_skills.sh"
rm_tracked "cursorrules"          # dead: Cursor reads .cursorrules / .cursor/, not this

# ── Stale planning / generated docs ────────────────────────────────────────
rm_tracked "realistic timeline"
rm_tracked "COMPLETE_FILE_LIST.md"
rm_tracked "EPUB_TOOL_COMPREHENSIVE_PLAN.md"
rm_tracked "plan.md"

# ── One-off operator scripts not wired to npm/CI/cloudbuild ────────────────
rm_tracked "mangu-repo-janitor.sh"
rm_tracked "cleanup-envs.sh"
rm_tracked "scripts/setup.sh"     # 0-byte file
rm_tracked "scripts/setup.ts"     # 66-byte stub

# ── Stray env example inside app/ (root already has 3 env examples) ────────
rm_tracked "app/.env.example"

echo ""
echo "Done. Review with 'git status', then commit."
echo "Deliberately KEPT (decide separately): HUMAN_TASKS.md, setup-envs.sh,"
echo "setup.sh, verify-setup.sh, docs/ (contains live product-gap-ledger.yml),"
echo "tools/preflight-dashboard/, .claude/, .cursor/, app/dev/library-preview/."
