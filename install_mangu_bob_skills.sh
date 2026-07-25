#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
BOB_DIR="$ROOT/.bob"
SKILLS_DIR="$BOB_DIR/skills"
RULES_DIR="$BOB_DIR/rules"
mkdir -p "$SKILLS_DIR" "$RULES_DIR"

write_skill() {
  local name="$1"
  local display="$2"
  local desc="$3"
  local body="$4"
  local dir="$SKILLS_DIR/$name"
  mkdir -p "$dir/agents" "$dir/references"
  {
    printf '%s\n' '---'
    printf 'name: %s\n' "$name"
    printf 'description: %s\n' "$desc"
    printf '%s\n\n' '---'
    printf '# %s\n\n' "$display"
    printf '%s\n' "$body"
  } > "$dir/SKILL.md"
  cat > "$dir/agents/openai.yaml" <<EOF_AGENT
interface:
  display_name: "$display"
EOF_AGENT
}

COMMON='## Governing constraints
- Treat the approved MANGU CEO Finish-Line Blueprint and current repository evidence as authoritative.
- Pin and report the current repository SHA before analysis or mutation.
- Preserve Supabase as production authority, one verified Vercel production project, private manuscript and paid-content storage, and the Phoenix pause unless a newer accepted decision record supersedes them.
- Never invent files, routes, tables, APIs, tests, or completed behavior. Mark each item as confirmed, inferred, missing, contradictory, or externally unverifiable.
- Do not mutate production, secrets, payments, roles, legal policy, retained data, or release flags without an explicit human approval gate.
- Attach traceability, commands executed, evidence, failures, and rollback instructions to every deliverable.'

write_skill "blueprint-ingestor" "Blueprint Ingestor" \
"Normalize a long product blueprint, PDF, DOCX, plan, or operating document into a complete requirements and decision register. Use when Bob must deeply read the MANGU CEO Finish-Line Blueprint or a replacement source before repository analysis, technical specification, mockups, planning, or implementation." \
"$COMMON

## Workflow
1. Read the entire supplied document, including tables, diagrams, appendices, captions, and page-level notes.
2. Extract decisions, observations, required controls, recommendations, verification items, roles, user journeys, state machines, release slices, exit gates, risks, deferred items, and named artifacts.
3. Assign stable requirement IDs and preserve source page, section, label, and exact terminology.
4. Produce 'docs/technical-spec/requirements-register.yaml', 'decision-register.md', 'verification-register.md', and 'source-traceability.csv'.
5. Detect contradictions and unresolved questions. Do not silently reconcile them.
6. End with coverage statistics and a list of document areas that could not be parsed or verified."

write_skill "repository-cartographer" "Repository Cartographer" \
"Map a software repository against an approved blueprint or requirements register. Use when Bob must inventory exact files, routes, APIs, database objects, migrations, workflows, tests, dependencies, feature flags, deployment configuration, dead code, ownership, and contradictions before creating a technical specification or writing code." \
"$COMMON

## Workflow
1. Traverse the complete repository, including hidden configuration, workflows, migrations, tests, scripts, package manifests, and documentation.
2. Create exact inventories for files, routes, APIs, schemas, storage, auth, payments, tests, workflows, flags, environment-variable usage, and dependencies.
3. Crosswalk every requirement to repository evidence and likely affected files.
4. Produce 'docs/technical-spec/repository-baseline.md', 'file-inventory.csv', 'route-manifest.yaml', 'api-manifest.yaml', 'schema-manifest.yaml', 'workflow-manifest.yaml', 'dependency-map.md', and 'contradiction-register.md'.
5. For every conclusion, record evidence path and line or symbol when available.
6. Never propose implementation until the baseline and contradictions are complete."

write_skill "technical-spec-architect" "Technical Spec Architect" \
"Convert an approved blueprint and repository map into implementation-ready technical specifications that enumerate every exact file change, database change, API contract, UI state, test, dependency, migration, rollback, and acceptance criterion. Use when Bob is asked to turn product or operating documents into a complete engineering spec." \
"$COMMON

## Required output per release slice
Create 'docs/technical-spec/slices/<slice-id>/' with:
- '00-scope.md'
- '01-current-state.md'
- '02-target-architecture.md'
- '03-file-change-manifest.csv'
- '04-database-spec.md'
- '05-api-contracts.md'
- '06-ui-state-spec.md'
- '07-security-rls.md'
- '08-test-specification.md'
- '09-observability.md'
- '10-migration-rollback.md'
- '11-acceptance-matrix.md'
- '12-implementation-order.md'

## File manifest contract
Every row must include exact path, action, current responsibility, required change, affected symbols, dependencies, tests, risk tier, rollback, and blueprint requirement IDs. Reject vague entries such as improve backend, update security, or add tests."

write_skill "experience-mockup-builder" "Experience Mockup Builder" \
"Create implementable product mockups, user-flow maps, wireframes, component contracts, and Figma-ready specifications from approved technical requirements. Use when Bob must design complete MANGU reader, author, editor, administrator, partner, commerce, library, or support experiences rather than only happy-path screens." \
"$COMMON

## Workflow
1. Build the information architecture, navigation map, screen inventory, and role-based journey map.
2. For every screen and component define authorization, purpose, data source, primary action, loading, empty, partial, success, denial, error, offline, conflict, recovery, and feature-disabled states.
3. Define mobile, desktop, keyboard, screen-reader, reduced-motion, analytics, performance, and support behavior.
4. Create text wireframes and, when Figma tools are available, editable frames and components.
5. Produce 'docs/mockups/information-architecture.md', 'navigation-map.md', 'screen-inventory.yaml', 'user-flows/', 'wireframes/', 'component-contracts/', and 'figma-handoff/'.
6. Link every frame and state to requirement IDs and implementation files."

write_skill "implementation-engineer" "Implementation Engineer" \
"Implement an approved MANGU technical-spec slice as bounded production-ready code with exact repository changes, tests, evidence, and rollback. Use only after the blueprint, repository baseline, and slice specification exist and Bob is authorized to create a branch or pull request." \
"$COMMON

## Workflow
1. Read the governing requirements, current repository baseline, and selected slice specification.
2. Verify the current SHA and planned paths. Stop on material drift and update the spec before coding.
3. Create a dedicated branch. Implement only the selected slice and do not combine architecture migration, dependency upgrades, workflow permissions, and feature work.
4. Add negative authorization cases, failure states, accessibility, observability, and rollback support as specified.
5. Run all affected checks and preserve command output.
6. Create a pull request with a change receipt listing created, modified, renamed, and deleted files; schema and API changes; tests; commands; failures; security impact; rollback; and requirement coverage.
7. Never claim success for commands not executed or checks not passed."

write_skill "verification-governor" "Verification Governor" \
"Independently verify whether a MANGU technical specification, mockup set, branch, or pull request satisfies the governing blueprint and repository controls. Use for release-gate review, implementation audit, security review, acceptance testing, and GO or NO-GO evidence." \
"$COMMON

## Workflow
1. Re-pin the candidate SHA and compare it to the reviewed diff digest.
2. Verify requirement-to-code traceability, exact changed-file completeness, clean migrations, generated type parity, RLS actor matrices, API integration, browser journeys, accessibility, product truth, secrets, dependencies, logging redaction, rollback, and evidence artifacts.
3. Attempt negative cases and intentionally broken fixtures where required.
4. Return exactly one disposition: 'PASS', 'PASS WITH ACCEPTED EXCEPTIONS', 'FAIL', or 'BLOCKED BY MISSING EVIDENCE'.
5. For every failure, provide requirement ID, exact evidence, affected path, severity, remediation, owner, and re-test command.
6. Never approve based on prose, screenshots alone, or green checks that do not prove the protected behavior."

cat > "$RULES_DIR/mangu-authority.md" <<'EOF_RULE'
# MANGU Repository Authority Rule

Apply this rule to all MANGU work.

1. Read the approved CEO Finish-Line Blueprint or its repository-native controlled counterpart before major analysis or implementation.
2. Use this authority order: signed CEO decisions and later accepted ADRs; current SHA-pinned 'docs/NEXT_GO.md'; accepted ADRs; live reproducible production evidence; migrations, code, and automated tests; product-gap ledger; feature stories; historical plans.
3. Keep Supabase as authentication, Postgres, RLS, and private storage authority through launch.
4. Use exactly one verified Vercel production project.
5. Keep MongoDB, Better Auth, public Vercel Blob for protected content, dual writes, and Project Phoenix paused unless a new accepted ADR explicitly reactivates them.
6. Product truth is mandatory: no visible claim, route, CTA, checkout, metadata, sitemap entry, or feature flag may imply a journey that users cannot complete.
7. Evidence outranks confidence. Record exact SHA, file paths, commands, tests, screenshots, logs, and rollback.
8. Agents may create analysis, documentation, branches, tests, mockups, and pull requests. Production, secrets, payments, roles, legal acceptance, destructive data actions, and release promotion require explicit human approval.
9. Never silently expand scope. Stop and report contradictions, missing evidence, or repository drift.
EOF_RULE

cat > "$BOB_DIR/README-MANGU-SKILLS.md" <<'EOF_README'
# MANGU Bob Skills

Installed skills:
- blueprint-ingestor
- repository-cartographer
- technical-spec-architect
- experience-mockup-builder
- implementation-engineer
- verification-governor

Recommended first prompt:

> Use Blueprint Ingestor on the MANGU CEO Finish-Line Blueprint, then Repository Cartographer on this repository, then Technical Spec Architect to produce the complete implementation-ready specification for S00 through S18. Do not write code until the repository baseline, contradiction register, and exact file-change manifests are complete.
EOF_README

printf 'Installed MANGU Bob skills into %s\n' "$BOB_DIR"
printf 'Skills: %s\n' "$SKILLS_DIR"
printf 'Rule: %s\n' "$RULES_DIR/mangu-authority.md"
