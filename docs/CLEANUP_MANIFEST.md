# Cleanup Manifest — 2026-07-28 audit

Run `bash scripts/cleanup-obsolete.sh` to remove everything in the "Remove" list
(~5.5 MB). All entries were verified as unreferenced by `package.json` scripts,
`cloudbuild.yaml`, and `.github/workflows/*` before inclusion.

## Remove (scripted)

| Path | Size | Reason |
|---|---|---|
| `1d (1).docx` | 216 KB | Stray Word doc (download-suffix filename), unreferenced |
| `Kimi_Agent_Book prep for InDesign.zip` | 4.13 MB | InDesign book-prep archive — book asset, not site code |
| `WAW_v7_Standalone_FLAWLESS.jsx` | 394 KB | Adobe InDesign ExtendScript for "We Are Wolf" (not React) |
| `WAW_v7_PRODUCTION_READY_GUIDE.md`, `WAW_v7_READINESS_ASSESSMENT.md`, `WAW_v7_RELEASE_NOTES.md` | 34 KB | Docs for the InDesign script above |
| `We_Are_Wolf_InDesign_Production_Guide.docx` (+ `.docx.pdf`) | 538 KB | Same book-production guide, twice |
| `desktop.ini` | 246 B | Windows Explorer artifact (now gitignored) |
| `RUN_THIS_IN_BOB.txt`, `.bob/`, `.bolt/`, `install_mangu_bob_skills.sh` | 12 KB | Configs for Bob/Bolt agent tools no longer in use |
| `cursorrules` | 2 KB | Dead file — Cursor reads `.cursorrules` or `.cursor/`, never this name |
| `realistic timeline/` | 29 KB | Planning essay (folder name contains a space) |
| `COMPLETE_FILE_LIST.md` | 9.5 KB | Stale generated file inventory |
| `EPUB_TOOL_COMPREHENSIVE_PLAN.md`, `plan.md` | 37 KB | Plans for tooling that isn't in this repo |
| `mangu-repo-janitor.sh`, `cleanup-envs.sh` | 23 KB | One-off cleanup scripts, unwired |
| `scripts/setup.sh`, `scripts/setup.ts` | 66 B | Empty / stub files |
| `app/.env.example` | 882 B | Stray duplicate env example inside `app/` |

## Keep for now — decide deliberately

- `HUMAN_TASKS.md`, `setup-envs.sh`, `setup.sh`, `verify-setup.sh` — operator docs/scripts still referenced in comments; confirm before removing.
- `docs/` — ~1 MB is agent-session output (`MASTER_EXECUTION_CHECKLIST.md` 169 KB, `PROJECT_PHOENIX.md` 113 KB, `phases_0711` 304 KB, `OPERATOR_QA_LOG.md` 69 KB, `docs/AWS_AMPLIFY_*.md` stale — deployment is Cloud Run/Vercel). **Do not** remove `docs/product-gap-ledger.yml` — CI validates it.
- `tools/preflight-dashboard/` — a whole separate Vite app (own 305 KB lockfile); archive to its own repo if still wanted.
- `scripts/nexus_analyzer.py`, `tools/copilot_deep_dive.py`, `scripts/anon-crawl.ps1`, `scripts/role-crawl.ts`, `scripts/mcp-*.sh`, `scripts/cowork-status.sh` — ad-hoc QA tooling, unwired to CI.
- `app/dev/library-preview/` — dev-only pages currently shipped to production; gate or remove.
- `app/api/webhooks/stripe/route.ts` (49 B) — stub duplicating `app/api/webhook/route.ts`; consolidate to one webhook path (Stripe dashboard config must match).
- `components/books/BookUploadForm.tsx` — unused, but it's the only cover/EPUB upload UI; better to *mount it in admin* than delete (see audit report §admin).
- Duplicate migrations `20260619124500_add_content_type_to_books.sql` vs `20260619162409_add_content_type.sql` — idempotent but redundant; don't delete applied migrations, just note.
