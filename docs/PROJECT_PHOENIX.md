# PROJECT PHOENIX

## Mangu Publishers — Stack Modernization Master Document

**Document Version:** 4.0.3 (WS2d Catalog Dual-Run Slice)  
**Status:** 🟡 IN PROGRESS — ACTIVE (owner-reactivated 2026-07-20)  
**Classification:** CONFIDENTIAL — For Authorized Personnel Only  
**Last Updated:** July 25, 2026  
**Document Owner:** Project Lead  
**Repository:** `redinc23/my_publishing` · **Migration Branch:** `cursor/mongodb-scaffold-dffa`  
**Production Domain:** `https://www.mangu-publishers.com` (apex `mangu-publishers.com` → 301 → `www`)

> **v4.0 Change Philosophy:** v3.0 was the vision. v4.0 is the contract. Every defect,
> ambiguity, and missing substep identified in the v3.0 audit has been corrected herein.
> If any step in this document cannot be executed exactly as written, STOP and amend
> this document first — do not improvise.

### v4.0.1 amendments (2026-07-20)

| ID  | Amendment                                                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D9  | RBAC roles are `reader \| author \| partner \| admin` (live product). Doc references to `editor` mean `partner` for portal/ARC parity.                                                                            |
| D2  | Mongo helper lives at `lib/mongodb.ts` exporting `getDb()` (not `lib/mongo.ts`).                                                                                                                                  |
| D4  | Prefer `NEXT_PUBLIC_SITE_URL` over inventing `NEXT_PUBLIC_APP_URL`; `BETTER_AUTH_URL` may mirror site URL.                                                                                                        |
| —   | **Public dual-run:** `AUTH_PROVIDER=supabase\|better-auth` (default `supabase`). WS1 lands Better Auth code paths; production stays on Supabase Auth until Phase 11–12 cutover so the site keeps serving readers. |

---

## TABLE OF CONTENTS

1. [Executive Vision](#1-executive-vision)
2. [Strategic Product Case (BRD)](#2-strategic-product-case-brd)
3. [Functional Requirements (FRD)](#3-functional-requirements-frd)
4. [Technical Architecture (Tech Spec)](#4-technical-architecture-tech-spec)
5. [Implementation Playbook](#5-implementation-playbook)
6. [Quality Assurance Matrix](#6-quality-assurance-matrix)
7. [Risk Registry & Mitigation](#7-risk-registry--mitigation)
8. [Communications & Rollback Plan](#8-communications--rollback-plan)
9. [Appendix](#9-appendix)
10. [Sign-Off](#10-sign-off)

---

## 1. EXECUTIVE VISION

### 1.1 The Manifesto

Mangu Publishers is undergoing a **strategic platform evolution** — a deliberate, architecturally-significant shift from a fragmented, third-party-dependent ecosystem to a modern, unified, and fully-owned technology stack. Codenamed **Project Phoenix**, this is not a migration. This is a **rebirth**.

We are transitioning from **Supabase** — a tightly-coupled, opinionated platform — to a sovereign, best-in-class self-managed stack:

| Legacy                      | Phoenix                                           |
| --------------------------- | ------------------------------------------------- |
| Supabase Auth               | **Better Auth** — dedicated, self-hosted auth     |
| Supabase Postgres (RLS)     | **MongoDB Atlas** — purpose-fit document database |
| Supabase Storage            | **Vercel Blob** — global CDN-adjacent storage     |
| Supabase SSR Client         | **Better Auth React** — lean, modern auth client  |
| _(none — unprotected APIs)_ | **Upstash Redis** — edge rate limiting            |
| _(none — ad-hoc logs)_      | **Structured JSON logging → Log Drain + Sentry**  |

**Hosting cutover:** GCP Cloud Run → **Vercel** (Edge Network + Serverless Functions).

**This new architecture delivers:**

- **🧠 Unprecedented Agility** — Freedom from vendor lock-in enables rapid, customized feature development without platform constraints.
- **⚡ Superior Performance** — A data layer purpose-built for content delivery, with optimized indexing and global CDN integration.
- **🔒 Enhanced Security & Control** — Complete ownership of authentication flows, data schemas, and access patterns, enforced in application code rather than opaque database policies.
- **📈 Long-term Cost Efficiency** — A predictable, pay-for-what-you-use model that scales horizontally with our success.

### 1.2 The North Star: Definition of Done

Project Phoenix is considered **irrefutably complete** only when **every** condition below is met:

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   ☐  1.  BUILD INTEGRITY                                           │
│          └─ `npm run build` exits with code 0, zero warnings       │
│                                                                     │
│   ☐  2.  OPERATIONAL HEALTH                                        │
│          └─ `GET /api/health?ready=1` → 200 OK → {"ready":true}    │
│                                                                     │
│   ☐  3.  USER CONFIDENCE                                           │
│          └─ Full 22-point QA regression suite passes in prod       │
│                                                                     │
│   ☐  4.  PROCESS COMPLETION                                        │
│          └─ All PRs merged → main deployed → Vercel prod green     │
│                                                                     │
│   ☐  5.  DATA SOVEREIGNTY                                          │
│          └─ Verified `mongodump` backup stored to secure location  │
│                                                                     │
│   ☐  6.  CLEAN CODEBASE                                            │
│          └─ Zero remaining `@supabase` imports in codebase         │
│                                                                     │
│   ☐  7.  USER TRANSITION                                           │
│          └─ Forced-password-reset email delivered to all legacy    │
│             users; reset completion telemetry flowing              │
│                                                                     │
│   ☐  8.  PLATFORM HARDENING                                        │
│          └─ Rate limiting live (429s verified), Sentry receiving   │
│             events, structured logs flowing to log drain           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Guiding Principles

> **"We build what we own. We own what we build."**

| Principle                            | Meaning                                                       |
| ------------------------------------ | ------------------------------------------------------------- |
| **Own Your Stack**                   | Every dependency is a deliberate choice, not a default.       |
| **Test in Production**               | But verify in staging first. The QA matrix is our safety net. |
| **No Data Left Behind**              | Every row, every file, every account migrates with integrity. |
| **Observability is a Feature**       | If it isn't monitored, it doesn't exist.                      |
| **Document Once, Reference Forever** | This document is the single source of truth.                  |

### 1.4 Project Scope & Exclusions

**In Scope:**

- Complete removal of `@supabase/ssr` and `@supabase/supabase-js` dependencies.
- Migration of relational data models to NoSQL document equivalents.
- **Migration of all stored files (covers, manuscripts) from Supabase Storage to Vercel Blob.**
- Cutover of DNS from legacy GCP Cloud Run to Vercel Edge Network.
- Implementation of application-level Role-Based Access Control (RBAC).
- Forced password-reset transition for all legacy user accounts.
- Edge rate limiting, structured logging, and error tracking hardening.

**Out of Scope:**

- Rewrite of the core Next.js App Router UI components (only data-fetching logic changes).
- Changes to the Stripe payment gateway provider.
- Migration of historical analytics events (only trailing 30 days retained).
- New feature development not required for parity (feature freeze is in effect, §5.2 P1.7).

---

## 2. STRATEGIC PRODUCT CASE (BRD)

### 2.1 Strategic Objectives

The shift from Supabase is driven by **four strategic imperatives**:

1. **Liberation from Vendor Lock-In:** Decoupling Auth, DB, and Storage eliminates single-point-of-failure platform risk.
2. **Optimized for Content Delivery:** MongoDB's document model excels at complex queries for nested content (books, chapters, reviews).
3. **Future-Proofing the Auth Layer:** Complex creator/partner workflows require dedicated RBAC that Better Auth provides natively.
4. **Cost Predictability:** Pay-for-use self-managed infrastructure offers superior cost control compared to monolithic platform pricing.

### 2.2 Key Stakeholders & Benefit Map

| Stakeholder Group    | Pain Point (Legacy)                             | Delight (Phoenix)                               | KPI                                    |
| -------------------- | ----------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| **Content Creators** | Unreliable uploads, slow saves                  | Instant manuscript submission, real-time save   | P95 save latency < 500ms               |
| **Readers**          | Page load latency, search lag                   | Blazing-fast catalog browsing, instant search   | P95 page load < 1.5s                   |
| **Internal Team**    | Complex RLS policies, slow admin queries        | Simple, powerful admin panel with granular RBAC | Admin page load < 800ms                |
| **Developers**       | Opaque Supabase internals, debugging difficulty | Full stack visibility, tailored abstractions    | Mean time to debug < 30min             |
| **Legacy Users**     | _(transition risk)_                             | Seamless re-entry via branded password reset    | Reset completion rate > 60% in 14 days |

### 2.3 Business Impact Projections

| Metric                       | Baseline (Legacy)       | Target (Phoenix)     | Measurement                    |
| ---------------------------- | ----------------------- | -------------------- | ------------------------------ |
| API Response Time (p95)      | ~450ms                  | < 150ms              | Synthetic monitoring           |
| Auth Flow Completion Rate    | 91%                     | > 98%                | Auth pipeline telemetry        |
| Password Reset Delivery Rate | n/a (new flow)          | > 99% delivered      | Resend dashboard               |
| Storage Upload Success Rate  | 97.2%                   | > 99.9%              | Vercel Blob upload metrics     |
| Deployment Confidence        | Manual testing required | Green CI/CD pipeline | PR merge → prod deploy < 10min |

---

## 3. FUNCTIONAL REQUIREMENTS (FRD)

### 3.1 User Journeys: Preserved & Enhanced

#### Journey A: Onboarding & Authentication

- **R-AUTH-01:** Users can sign up with email + password.
- **R-AUTH-02:** Email verification is required before first sign-in (`requireEmailVerification: true`).
- **R-AUTH-03:** Password reset flow works end-to-end with branded email (Resend).
- **R-AUTH-04:** Session persists across page refreshes and browser restarts.
- **R-AUTH-05:** Session expires after configured TTL and redirects to login gracefully.
- **R-AUTH-06:** OAuth integration (Google/GitHub) prepared for future phase (schema ready — `account` collection supports additional `providerId` values without migration).
- **R-AUTH-07:** All legacy users receive a forced password-reset email at cutover and can re-establish access without support intervention.

#### Journey B: Content Discovery & Consumption

- **R-CONTENT-01:** Catalog displays all published books with cover images.
- **R-CONTENT-02:** Full-text search across title, author, description, and genre.
- **R-CONTENT-03:** Book detail page loads full metadata, content preview, and purchase CTA.
- **R-CONTENT-04:** Paginated results with configurable page size (default 20).
- **R-CONTENT-05:** Users can leave ratings and reviews on purchased books; book `avg_rating` and `review_count` update atomically.

#### Journey C: Creator & Author Tools

- **R-CREATOR-01:** Author dashboard shows published works, drafts, and revenue.
- **R-CREATOR-02:** Authors can submit new manuscripts with title, description, genre, and cover.
- **R-CREATOR-03:** Manuscript files (PDF/ePub) upload to Vercel Blob with progress indication.
- **R-CREATOR-04:** Authors can edit metadata post-publication.
- **R-CREATOR-05:** Revenue tracking shows per-book and aggregate earnings.

#### Journey D: Administrative Controls

- **R-ADMIN-01:** Role-based access control with four tiers: `reader`, `author`, `partner`, `admin`.
- **R-ADMIN-02:** Admin dashboard shows platform-wide statistics.
- **R-ADMIN-03:** Admins can manage user roles, suspend accounts, and approve content.
- **R-ADMIN-04:** Audit log of sensitive actions preserved in MongoDB `audit_logs` collection (actor, action, target, metadata, timestamp).

#### Journey E: Platform Protection & Observability _(new in v4.0)_

- **R-SEC-01:** All `/api/*` endpoints are rate-limited per-IP via Upstash Redis (100 req/60s default; stricter on auth endpoints: 10 req/60s). Exceeded limits return HTTP 429 with `Retry-After`.
- **R-OBS-01:** All API errors emit structured JSON logs (level, route, requestId, message, stack) shipped to a Vercel Log Drain.
- **R-OBS-02:** Client, server, and edge errors are captured in Sentry with release tagging.

### 3.2 Non-Functional Requirements (NFRs)

| Category             | Requirement                                        | Verification                  |
| -------------------- | -------------------------------------------------- | ----------------------------- |
| **Performance**      | P95 API latency < 150ms                            | Vercel Analytics              |
| **Security**         | All endpoints protected via app-level RBAC         | Penetration testing checklist |
| **Availability**     | 99.9% uptime post-cutover                          | Vercel/Atlas status pages     |
| **Scalability**      | Horizontal scaling via Vercel serverless functions | Load testing via k6           |
| **Observability**    | Structured JSON logging for all API errors         | Log Drain integration         |
| **Abuse Protection** | Per-IP rate limiting on all API routes             | k6 burst test → 429 responses |

### 3.3 Data Flow & Integrity Guarantees

| Guarantee                    | Mechanism                                                                              | Verification                                           |
| ---------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Atomic Writes**            | MongoDB document-level atomicity                                                       | No partial updates observed                            |
| **User Identity Continuity** | `profiles.auth_user_id` references `user.id`                                           | Every profile has a valid user reference               |
| **Session Consistency**      | Better Auth manages sessions → app reads via `getAuth()`                               | Session data always matches `user` collection          |
| **Order Integrity**          | `orders.order_items` embedded array                                                    | No orphaned order items                                |
| **Payment Idempotency**      | Unique index on `orders.stripe_payment_intent_id`; webhook handler upserts by that key | Duplicate webhook delivery creates no duplicate order  |
| **File-Content Linkage**     | `books.cover_url` / `books.manuscript_url` store Vercel Blob URLs                      | Every URL resolves (HTTP 200 HEAD) to an existing blob |
| **Rating Consistency**       | Review insert triggers atomic recompute of `books.avg_rating` / `review_count`         | Spot-check 5 books: stored avg matches computed avg    |

### 3.4 File Storage & Delivery

- **R-STORAGE-01:** Book cover images stored in Vercel Blob with `public` access.
- **R-STORAGE-02:** Manuscript files (PDF, ePub) stored in Vercel Blob; delivery via authorized proxy only (see R-STORAGE-04).
- **R-STORAGE-03:** Upload path format: `{user_id}/{type}/{uuid}-{original_filename}` where `type ∈ {covers, manuscripts}`.
- **R-STORAGE-04:** GET requests to `/api/files/{id}` proxy blob content after verifying the requester purchased the book (or is admin/author-owner).
- **R-STORAGE-05:** All legacy Supabase Storage objects are copied to Vercel Blob and all Mongo references rewritten before DNS cutover (see WS3, Task 3.4). Zero `*.supabase.co/storage` URLs may remain in production data.

---

## 4. TECHNICAL ARCHITECTURE (TECH SPEC)

### 4.1 High-Level Architecture Diagram

```
                          ┌──────────────────────────────────────┐
                          │          CLIENT (Browser)             │
                          │  better-auth/react  ◄──►  Next.js    │
                          └──────────┬───────────────────────────┘
                                     │
                           HTTP/HTTPS │
                                     ▼
                    ┌──────────────────────────────────────────────┐
                    │              NEXT.JS APPLICATION             │
                    │  ┌────────────┐    ┌──────────────────────┐  │
                    │  │ Middleware  │    │   Server Components  │  │
                    │  │ (session + │    │   (RSC / SSR Pages)  │  │
                    │  │  rate limit│    └──────────┬───────────┘  │
                    │  │  check)    │               │              │
                    │  └────────────┘               ▼              │
                    │  ┌─────────────────────────────────────┐     │
                    │  │        API Routes / Actions          │     │
                    │  │  ┌────────┐ ┌───────┐ ┌─────────┐  │     │
                    │  │  │ Auth   │ │ Data  │ │ Upload  │  │     │
                    │  │  │ Routes │ │Routes │ │ Actions │  │     │
                    │  │  └───┬────┘ └───┬───┘ └────┬────┘  │     │
                    │  └──────┼──────────┼───────────┼───────┘     │
                    └─────────┼──────────┼───────────┼─────────────┘
                              │          │           │
              ┌───────────────┘          │           └───────────────┐
              ▼                          ▼                           ▼
    ┌──────────────────┐    ┌────────────────────┐    ┌──────────────────┐
    │   BETTER AUTH    │    │   MONGODB ATLAS    │    │   VERCEL BLOB    │
    │ (Auth & Sessions)│    │  (Primary Data)    │    │  (File Storage)  │
    └──────────────────┘    └────────────────────┘    └──────────────────┘

    Supporting services:
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │    STRIPE    │  │    RESEND    │  │UPSTASH REDIS │  │ SENTRY + LOG │
    │  (payments + │  │ (transaction-│  │ (rate limit) │  │ DRAIN (obs.) │
    │   webhooks)  │  │  ial email)  │  │              │  │              │
    └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

### 4.2 Data Model & Collection Mapping

#### Entity Relationship Diagram

```
 ┌───────────────┐     ┌──────────────────┐     ┌──────────────────┐
 │     user      │     │    profiles      │     │     authors      │
 │  (Better Auth)│────►│                  │────►│                  │
 │ id (PK, str)  │ 1:1 │ auth_user_id: id │ 1:1 │ profile_id: _id  │
 └──────┬────────┘     └──────────────────┘     └────────┬─────────┘
        │                                                │ 1:N
        │ 1:N (Better Auth managed)                      ▼
        ▼                                     ┌──────────────────┐
 ┌───────────────┐  ┌──────────────────┐      │      books       │────► book_content
 │    session    │  │     account      │      │ author_id → _id  │      (book_id: _id)
 │  (Better Auth)│  │ (Better Auth;    │      │ slug (unique)    │
 └───────────────┘  │  credential +    │      │ cover_url        │
 ┌───────────────┐  │  future OAuth)   │      │ manuscript_url   │
 │  verification │  └──────────────────┘      │ avg_rating       │
 │  (Better Auth)│                            │ review_count     │
 └───────────────┘                            └────────┬─────────┘
                                                        │ 1:N
        ┌──────────────────┐                            ▼
        │     orders       │                  ┌──────────────────┐  ┌──────────────────┐
        │ user_id → user   │                  │ reading_progress │  │     reviews      │
        │ order_items[]    │                  │ user_id, book_id │  │ book_id, user_id │
        │ stripe_payment_  │                  └──────────────────┘  └──────────────────┘
        │  intent_id (uniq)│
        └──────────────────┘                  ┌──────────────────┐
                                              │   audit_logs     │
                                              │ actor_id, action │
                                              │ target, metadata │
                                              └──────────────────┘
```

#### Collection Source Map & Transformations

| Supabase Table →         | MongoDB Collection | Managed By  | Key Field(s)                                | Transform Rule                                                                                                                                                                                                                                                    |
| ------------------------ | ------------------ | ----------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth.users`             | `user`             | Better Auth | `id`                                        | UUID preserved as string `id`. `emailVerified` ← `email_confirmed_at IS NOT NULL`. **Passwords are NOT portable** (Supabase bcrypt ≠ Better Auth scrypt) — see §5.5 Task 2.6: every imported user gets a locked credential `account` and a forced password reset. |
| `auth.identities`        | `account`          | Better Auth | `userId` + `providerId`                     | One `account` doc per user: `providerId: "credential"`, `password: "!locked:<uuid>"` (unusable placeholder that can never verify).                                                                                                                                |
| `auth.sessions`          | `session`          | Better Auth | `userId`                                    | **Not migrated — intentionally wiped.** All users re-authenticate via the forced reset flow (communicated per §8.1).                                                                                                                                              |
| `password reset tokens`  | `verification`     | Better Auth | `identifier` + `value`                      | Not migrated. New tokens generated by Better Auth on demand.                                                                                                                                                                                                      |
| `profiles`               | `profiles`         | Application | `auth_user_id`                              | Map `auth_user_id` → `user.id` (string). Convert own `_id` to ObjectId.                                                                                                                                                                                           |
| `authors`                | `authors`          | Application | `profile_id`                                | Convert `profile_id` to ObjectId referencing `profiles._id`.                                                                                                                                                                                                      |
| `books`                  | `books`            | Application | `author_id`, `slug`                         | Convert `author_id` to ObjectId. Generate URL-safe unique `slug` from title. Initialize `avg_rating: 0`, `review_count: 0` if absent. Rewrite `cover_url`/`manuscript_url` to Vercel Blob (WS3 Task 3.4).                                                         |
| `orders` + `order_items` | `orders`           | Application | `order_items[]`, `stripe_payment_intent_id` | Flatten join table into embedded `order_items[]` array. Preserve `stripe_payment_intent_id` (unique index).                                                                                                                                                       |
| _(new)_                  | `reviews`          | Application | `book_id`, `user_id`                        | Migrated from legacy `reviews` table if present; otherwise created empty.                                                                                                                                                                                         |
| _(new)_                  | `reading_progress` | Application | `user_id`, `book_id`                        | Migrated from legacy table if present; otherwise created empty.                                                                                                                                                                                                   |
| _(new)_                  | `audit_logs`       | Application | `actor_id`, `created_at`                    | Created empty at bootstrap; written by `lib/audit.ts`.                                                                                                                                                                                                            |

> **Better Auth adapter note:** the MongoDB adapter exposes `id` as a string field and maps it to the document key. The Phase 11 **dry run (P11.3)** must confirm imported documents round-trip correctly through Better Auth `signIn`/`getSession` before production import.

### 4.3 Detailed Workstreams & Pull Request Strategy

This section is the **primary handoff guide for engineering**. Each workstream corresponds to one or more PRs, merged in strict sequential order (§5.6). Every PR must pass CI and staging verification before merge.

---

#### WORKSTREAM 1 — Authentication & Core Libraries

**PR #1** — Auth Layer Replacement  
**Risk Level:** 🔴 HIGH

| Task #  | Action                           | Subtasks                                                                                                                                                                                                                                                                                                                         | Files                                                          | Verification                                                 |
| ------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| **1.1** | **Setup Better Auth Server**     | 1.1.1 Install `better-auth` <br> 1.1.2 Configure MongoDB adapter <br> 1.1.3 Enable `emailAndPassword` with `requireEmailVerification: true` <br> 1.1.4 Configure Resend for `sendVerificationEmail` / `sendResetPassword` <br> 1.1.5 Define `user.additionalFields.role` (`reader`/`author`/`partner`/`admin`, default `reader`) | `lib/auth.ts`                                                  | `getAuth()` returns configured instance                      |
| **1.2** | **Setup Better Auth Client**     | 1.2.1 Install `better-auth/react` <br> 1.2.2 Create client instance <br> 1.2.3 Export typed hooks (`useSession`)                                                                                                                                                                                                                 | `lib/auth-client.ts`                                           | Client imports resolve correctly                             |
| **1.3** | **Create Auth API Route**        | 1.3.1 Implement catch-all route <br> 1.3.2 Export GET/POST handlers <br> 1.3.3 Configure CORS & headers                                                                                                                                                                                                                          | `app/api/auth/[...all]/route.ts`                               | `/api/auth/ok` returns 200                                   |
| **1.4** | **Rewrite Middleware**           | 1.4.1 Parse Better Auth session cookie <br> 1.4.2 Define public vs protected route matcher <br> 1.4.3 Implement role-based redirects (`/admin` → admin only; `/dashboard/author` → author+) <br> 1.4.4 Graceful redirect to `/login?next=<path>` with return URL                                                                 | `middleware.ts`                                                | Unauthenticated `/dashboard` redirects to `/login`           |
| **1.5** | **Migrate Auth Actions**         | 1.5.1 Rewrite `signIn` server action <br> 1.5.2 Rewrite `signUp` + auto-create `profiles` doc <br> 1.5.3 Rewrite `resetPassword` action <br> 1.5.4 Rewrite `verifyEmail` action                                                                                                                                                  | `app/(auth)/actions.ts`                                        | End-to-end auth flows pass locally                           |
| **1.6** | **Profile Sync Hook**            | 1.6.1 Create Better Auth `databaseHooks.user.create.after` hook <br> 1.6.2 Auto-insert document into `profiles` collection                                                                                                                                                                                                       | `lib/auth.ts`                                                  | Signup results in both `user` and `profiles` docs            |
| **1.7** | **Forced Reset Transition Flow** | 1.7.1 Add `requestPasswordReset` wrapper callable from migration script <br> 1.7.2 Build branded "Welcome to the new Mangu" reset email template (Resend) <br> 1.7.3 Add `/login` banner copy: "Legacy user? Check your inbox to set a new password." <br> 1.7.4 Instrument reset-requested / reset-completed events             | `lib/auth.ts`, `emails/reset.tsx`, `app/(auth)/login/page.tsx` | Test legacy-import user completes reset + sign-in on staging |

---

#### WORKSTREAM 2 — Data Access Rewrite

**PRs #2a through #2d** — Incremental Data Layer Replacement  
**Risk Level:** 🟡 MEDIUM

| Task #   | Action                      | Subtasks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Files                                                                                      | Verification                                                                             |
| -------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| **2a.1** | **MongoDB Connection**      | 2a.1.1 Install `mongodb` driver <br> 2a.1.2 Create global singleton cached client <br> 2a.1.3 Implement connection error handling                                                                                                                                                                                                                                                                                                                                                            | `lib/mongodb.ts` (+ `lib/mongo.ts` re-export; recon D2)                                    | `getDb()` returns valid `Db` instance                                                    |
| **2a.2** | **Type Definitions**        | 2a.2.1 Define `Profile`, `Book`, `Author` interfaces <br> 2a.2.2 Define embedded `OrderItem` type <br> 2a.2.3 Define `Review`, `ReadingProgress`, `AuditLog` types <br> 2a.2.4 Export from central types index                                                                                                                                                                                                                                                                               | `types/mongo.ts`                                                                           | `tsc --noEmit` passes                                                                    |
| **2a.3** | **Query Library**           | 2a.3.1 Implement `getBooks` (aggregation w/ author lookup) <br> 2a.3.2 Implement `getBookBySlug` <br> 2a.3.3 Implement `getUserOrders` <br> 2a.3.4 Implement full-text search query (`$text` w/ score sort)                                                                                                                                                                                                                                                                                  | `lib/mongo-queries.ts`                                                                     | Mock tests pass                                                                          |
| **2b.1** | **API Routes Refactor**     | 2b.1.1 `app/api/books/route.ts` (GET list, POST create) <br> 2b.1.2 `app/api/books/[id]/route.ts` (GET, PATCH) <br> 2b.1.3 `app/api/checkout/route.ts` (Create Stripe session) <br> 2b.1.4 `app/api/webhook/route.ts` — verify Stripe signature; **upsert order by `stripe_payment_intent_id` (idempotent; unique index)**; return 200 on duplicates                                                                                                                                         | `app/api/**/*.ts`                                                                          | API endpoints return correct JSON; replayed webhook creates no duplicate order           |
| **2c.1** | **Server Actions Refactor** | 2c.1.1 `lib/actions/books.ts` → `insertOne` / `updateOne` <br> 2c.1.2 `lib/actions/reviews.ts` → `insertOne` + **atomic recompute of `books.avg_rating`/`review_count`** <br> 2c.1.3 `lib/actions/profiles.ts` → `updateOne` <br> 2c.1.4 Call `revalidatePath`/`revalidateTag` after every mutation                                                                                                                                                                                          | `lib/actions/*.ts`                                                                         | Form submissions succeed; caches invalidate                                              |
| **2c.2** | **Audit Log Writer**        | 2c.2.1 Create `lib/audit.ts` (`recordAudit(actorId, action, target, metadata)`) <br> 2c.2.2 Wire into admin actions: role change, suspend, content approve <br> 2c.2.3 Index `audit_logs(actor_id, created_at)`                                                                                                                                                                                                                                                                              | `lib/audit.ts`, `lib/actions/admin.ts`                                                     | Admin action produces `audit_logs` document                                              |
| **2d.1** | **Pages & Components**      | Progressive dual-run via `lib/data/*` (default Supabase; Mongo when `DATABASE_PROVIDER=mongodb`). **Slices A–D:** home rails, genres, checkout, `/books` q/sort, Author Spotlight, enriched PDP `fetchBookForApi`, dual-run entitlement (A-6 auth `user_id`), `/reading` + `/library`, author PDP, recommendations baseline. **Remaining:** reviews bundle on PDP, admin/dashboard portals, engagement APIs. Doc paths `app/(shop)/…` do not exist — live tree is `app/(consumer)/…` (A-16). | `lib/data/*`, `lib/reading/entitlement.ts`, `app/(consumer)/**/*.tsx`, `components/home/*` | `tsc --noEmit` clean; dual-run + entitlement unit tests; default provider still Supabase |

---

#### WORKSTREAM 3 — Storage Migration

**PR #3** — File Storage Overhaul  
**Risk Level:** 🟡 MEDIUM

| Task #  | Action                     | Subtasks                                                                                                                                                                                                                                                                                                                                                                                                            | Files                         | Verification                                                                                                         |
| ------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **3.1** | **Vercel Blob Setup**      | 3.1.1 Install `@vercel/blob` <br> 3.1.2 Add `BLOB_READ_WRITE_TOKEN` to env <br> 3.1.3 Update `next.config.js` `images.remotePatterns` for `*.public.blob.vercel-storage.com`                                                                                                                                                                                                                                        | `next.config.js`, `.env`      | Image domains whitelisted                                                                                            |
| **3.2** | **Upload Action Refactor** | 3.2.1 Replace `supabase.storage.upload` with `put` <br> 3.2.2 Implement path generation: `{userId}/{covers\|manuscripts}/{uuid}-{file}` <br> 3.2.3 Return `blob.url` to client                                                                                                                                                                                                                                      | `lib/actions/upload.ts`       | Upload succeeds, returns valid URL                                                                                   |
| **3.3** | **Download Proxy Route**   | 3.3.1 Create `/api/files/[id]/route.ts` <br> 3.3.2 Fetch book to get `manuscript_url` <br> 3.3.3 Verify user purchased book (or is admin/author-owner) <br> 3.3.4 Stream blob to response                                                                                                                                                                                                                           | `app/api/files/[id]/route.ts` | Unpurchased user gets 403; purchaser gets file                                                                       |
| **3.4** | **Legacy File Migration**  | 3.4.1 Write `scripts/migrate-storage.ts`: list all Supabase Storage objects (service-role key), download each, `put` to Vercel Blob preserving relative path <br> 3.4.2 Rewrite `books.cover_url` / `books.manuscript_url` in MongoDB to new Blob URLs <br> 3.4.3 Produce migration report (migrated / failed / skipped counts) <br> 3.4.4 Re-run for failures (script is idempotent — skips already-migrated URLs) | `scripts/migrate-storage.ts`  | Report shows 0 failures; `grep` of Mongo dump for `supabase.co/storage` returns 0 hits; HEAD on 10 random URLs → 200 |

---

#### WORKSTREAM 4 — Health, Environment & Cleanup

**PR #4** — Finalization & Housekeeping  
**Risk Level:** 🟢 LOW

| Task #  | Action                  | Subtasks                                                                                                                                                                                                              | Files                            | Verification                                                      |
| ------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------- |
| **4.1** | **Update Health Check** | 4.1.1 Ping MongoDB (`db.command({ ping: 1 })`) <br> 4.1.2 Check Better Auth config presence <br> 4.1.3 Verify Stripe key format <br> 4.1.4 Verify Upstash + Blob env presence <br> 4.1.5 Return composite JSON status | `app/api/health/route.ts`        | `/api/health?ready=1` returns true                                |
| **4.2** | **Env Validation**      | 4.2.1 Remove Supabase vars from Zod schema <br> 4.2.2 Add MongoDB, Better Auth, Blob, Upstash, Resend, Sentry vars to schema                                                                                          | `lib/utils/env-validation.ts`    | App fails fast if Mongo URI missing                               |
| **4.3** | **Codebase Purge**      | 4.3.1 Delete `lib/supabase/` directory <br> 4.3.2 Delete `types/database.ts` <br> 4.3.3 Uninstall `@supabase/ssr` & `@supabase/supabase-js` <br> 4.3.4 Remove Supabase DNS prefetch from `app/layout.tsx`             | `package.json`, `app/layout.tsx` | `grep -ri "supabase" app/ lib/ components/ types/` returns 0 hits |
| **4.4** | **CI/CD Updates**       | 4.4.1 Remove Supabase GitHub Actions <br> 4.4.2 Add MongoDB index synchronization script to CI                                                                                                                        | `.github/workflows/*.yml`        | CI pipeline passes                                                |

---

#### WORKSTREAM 5 — Test Suite Rehabilitation _(defined in v4.0 — closes v3.0 gap)_

**PR #5** — Test Suite Refactor  
**Risk Level:** 🟢 LOW

| Task #  | Action                  | Subtasks                                                                                                                                                                                                                                          | Files                     | Verification                           |
| ------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------- |
| **5.1** | **Unit Test Rewrite**   | 5.1.1 Replace Supabase mocks with MongoDB/Better Auth mocks <br> 5.1.2 Add tests for `mongo-queries.ts` (books, search, orders) <br> 5.1.3 Add tests for webhook idempotency (duplicate delivery) <br> 5.1.4 Add tests for `avg_rating` recompute | `tests/unit/**`           | `npm test` green                       |
| **5.2** | **E2E Test Rewrite**    | 5.2.1 Rewrite Playwright auth specs against Better Auth flows <br> 5.2.2 Add spec: legacy user forced-reset journey <br> 5.2.3 Add spec: purchase → webhook → download                                                                            | `tests/e2e/**`            | `npx playwright test` green on staging |
| **5.3** | **CI Gate Enforcement** | 5.3.1 Require unit + e2e jobs before merge <br> 5.3.2 Publish test report artifact                                                                                                                                                                | `.github/workflows/*.yml` | Failing test blocks merge              |

---

#### WORKSTREAM 6 — Observability & Edge Protection _(defined in v4.0 — closes v3.0 gap)_

**PR #6** — Hardening Layer  
**Risk Level:** 🟡 MEDIUM

| Task #  | Action                  | Subtasks                                                                                                                                                                                                                                                                                      | Files                               | Verification                                           |
| ------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------ |
| **6.1** | **Structured Logging**  | 6.1.1 Create `lib/logger.ts` (JSON: level, route, requestId, message, stack) <br> 6.1.2 Wrap all API route handlers with error-logging middleware <br> 6.1.3 Attach Vercel Log Drain; verify entries arrive                                                                                   | `lib/logger.ts`, `app/api/**`       | Forced 500 in staging appears in log drain as JSON     |
| **6.2** | **Sentry Verification** | 6.2.1 Confirm `sentry.client/server/edge.config.ts` DSN wiring <br> 6.2.2 Add release tagging (`SENTRY_RELEASE`) in CI <br> 6.2.3 Verify source maps upload                                                                                                                                   | `sentry.*.config.ts`, CI            | Staging test error appears in Sentry with stack trace  |
| **6.3** | **Rate Limiting**       | 6.3.1 Install `@upstash/ratelimit` + `@upstash/redis` <br> 6.3.2 Create `lib/ratelimit.ts`: sliding window — 100 req/60s per IP on `/api/*`; 10 req/60s on `/api/auth/*` <br> 6.3.3 Enforce in `middleware.ts`; return 429 + `Retry-After` <br> 6.3.4 Whitelist health endpoint `/api/health` | `lib/ratelimit.ts`, `middleware.ts` | k6 burst (200 req/10s) yields 429s; QA test #18 passes |
| **6.4** | **Alerting**            | 6.4.1 Vercel alert: error rate > 2% for 5 min → Slack <br> 6.4.2 Atlas alert: connections > 80% → email <br> 6.4.3 Upstash alert: daily command budget 80% → email                                                                                                                            | Vercel/Atlas/Upstash consoles       | Test alert fires in staging                            |

---

## 5. IMPLEMENTATION PLAYBOOK

### 5.1 Phase Map (Timeline)

```
PHASE    1–4        5–7        8–10       11         12         13        14–15
         │          │          │          │          │          │          │
         ▼          ▼          ▼          ▼          ▼          ▼          ▼
      ┌───────┐ ┌───────┐ ┌───────┐ ┌────────┐ ┌────────┐ ┌───────┐ ┌────────┐
      │Prepare│ │Boot-  │ │Final- │ │ Data   │ │ Code   │ │ DNS   │ │Valid-  │
      │ & Plan│ │strap  │ │ize    │ │ Migr.  │ │ Cutover│ │ Cut-  │ │ate &   │
      │       │ │Atlas+ │ │ Prod  │ │ (dry-  │ │ (PR    │ │ over  │ │Close   │
      │       │ │Vercel │ │ Env   │ │ run →  │ │ #1→#6) │ │       │ │        │
      └───────┘ └───────┘ └───────┘ │ prod)  │ └────────┘ └───────┘ └────────┘
Owner   Ops/Arch  Agent/Ops  Ops    Agent    Agent     Ops       All
Est.    30m       15m        15m    1h+dry   ~3h       30m       2h
```

**Cutover window:** Execute Phases 11–13 in a single scheduled maintenance window (recommended: Tue/Wed 09:00–14:00 ET). Announce per §8.1.

---

### 5.2 Phase 1-4: Orchestration & Preparation

**Owner:** Operator / Architect

| Step     | Action                          | Subtasks                                                                                                                                                        | Verification                              |
| -------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **P1.1** | **Verify toolchain**            | Check Node v22.x, npm 10.x+, git 2.x+                                                                                                                           | `node --version` matches                  |
| **P1.2** | **Checkout migration branch**   | `git fetch && git checkout cursor/mongodb-scaffold-dffa`                                                                                                        | Branch is active                          |
| **P1.3** | **Install dependencies**        | `npm install`                                                                                                                                                   | No lockfile conflicts                     |
| **P1.4** | **Create Atlas API Key**        | MongoDB Atlas → Access Manager → API Keys (Org Owner)                                                                                                           | Key saved to password manager             |
| **P1.5** | **Create Vercel Token**         | Vercel → Settings → Tokens (`mangu-mongo-sync`, full scope)                                                                                                     | Token saved to password manager           |
| **P1.6** | **Architect Sign-off**          | Formal Go/No-Go meeting                                                                                                                                         | Sign-off recorded in Slack                |
| **P1.7** | **Feature Freeze & Comms T-7d** | 1. Announce code freeze on `main` (only Phoenix PRs merge) <br> 2. Send T-7 day user notice per §8.1 <br> 3. Post maintenance window to status page             | Freeze + notice confirmed in Slack        |
| **P1.8** | **Full Legacy Backup**          | 1. `pg_dump` of entire Supabase DB → encrypted archive <br> 2. Full Supabase Storage bucket snapshot (all objects) <br> 3. Store both in GCS/S3 with versioning | Backup restore-tested on scratch instance |

---

### 5.3 Phase 5-7: Database Bootstrap & Verification

**Owner:** Agent / Operator

| Step     | Action                  | Subtasks                                                                                                                                                                                                                                                                                                                                            | Verification                                        |
| -------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **P5.1** | **Set environment**     | Export `ATLAS_PUBLIC_KEY`, `ATLAS_PRIVATE_KEY`, `VERCEL_TOKEN` to shell                                                                                                                                                                                                                                                                             | `echo $ATLAS_PUBLIC_KEY` returns value              |
| **P5.2** | **Bootstrap database**  | Run `npm run db:mongo:up` <br> - Creates M10 cluster in GCP us-central1 <br> - Creates `mangu_admin` user <br> - Sets IP access to `0.0.0.0/0` (Vercel dynamic IPs) <br> - Writes `MONGODB_URI` to `.env.local` <br> - Syncs env vars to Vercel project                                                                                             | Script exits code 0                                 |
| **P5.3** | **Ping database**       | Run `npm run db:mongo:ping`                                                                                                                                                                                                                                                                                                                         | Returns "MongoDB connection OK"                     |
| **P5.4** | **Create indexes**      | Run `npm run db:mongo:indexes` <br> - `text` index on `books(title, description, genre)` <br> - unique index on `books.slug` <br> - unique index on `orders.stripe_payment_intent_id` (sparse) <br> - compound indexes on `orders(user_id, created_at)` <br> - index on `profiles(auth_user_id)` <br> - index on `audit_logs(actor_id, created_at)` | Index creation summary logged                       |
| **P5.5** | **Verify local health** | `npm run dev` → `curl http://localhost:3000/api/health?ready=1`                                                                                                                                                                                                                                                                                     | JSON returns `{"ready":true,"mongodb":"connected"}` |
| **P5.6** | **Deploy to Vercel**    | `git push origin main` (or via CLI)                                                                                                                                                                                                                                                                                                                 | Vercel deployment green                             |
| **P5.7** | **Verify prod health**  | `curl https://www.mangu-publishers.com/api/health?ready=1`                                                                                                                                                                                                                                                                                          | JSON returns `{"ready":true}`                       |

---

### 5.4 Phase 8-10: Finalize Production Environment

**Owner:** Operator

| Step     | Action                       | Subtasks                                                                                | Verification                             |
| -------- | ---------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| **P8.1** | **Add Stripe keys**          | Add `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET` to Vercel                             | Stripe API test call succeeds            |
| **P8.2** | **Add Upstash Redis**        | Add `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`                               | `/ping` returns PONG                     |
| **P8.3** | **Add Resend API Key**       | Add `RESEND_API_KEY`; verify sending domain `mail.mangu-publishers.com` DKIM/SPF green  | Test email delivered to inbox (not spam) |
| **P8.4** | **Configure Stripe Webhook** | Stripe Dashboard → Webhooks → Set URL to `https://www.mangu-publishers.com/api/webhook` | Test webhook signing passes              |
| **P8.5** | **Add Observability Vars**   | Add `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`; attach Vercel Log Drain                    | Test event visible in Sentry + drain     |
| **P8.6** | **Redeploy Vercel**          | Trigger prod deploy to pick up all new env vars                                         | `{"ready":true, "stripe":"configured"}`  |

---

### 5.5 Phase 11: Data Migration

**Owner:** Agent  
**Gate:** No step proceeds until the previous step's verification passes. A failed verification → halt, fix, re-run from that step.

#### P11.1 — EXPORT (from Supabase via `psql`)

> **v4.0.2:** implemented as `scripts/export-supabase.sh` (`npm run phoenix:export`).
> The v4.0 snippet below was corrected in three ways after being checked against
> `supabase/migrations/` — see the v4.0.2 amendment table in §DOCUMENT CONTROL.

```bash
export SUPABASE_DB_URL='postgresql://postgres:<pw>@db.<ref>.supabase.co:5432/postgres'
npm run phoenix:export
```

**Corrections applied (do not revert to the v4.0 form):**

1. **`\copy` cannot be used.** `\copy … TO file` writes PostgreSQL COPY _text
   format_, which escapes backslashes and embedded newlines. Applied to
   `json_agg` output that produces a file which is **not valid JSON**. The script
   uses `psql -X -A -t -c "SELECT …"` instead, which writes the raw scalar.
2. **`json_agg` returns SQL NULL for an empty table**, landing in the file as an
   empty string that fails to parse. Every query is wrapped in
   `coalesce(json_agg(row_to_json(t)), '[]'::json)`.
3. **The orders join referenced columns that do not exist.** v4.0 selected
   `oi.quantity` and `oi.price_cents`; `public.order_items` is
   `(id, order_id, book_id, unit_price, license_key, created_at)`. Quantity is
   implicit — one row per licensed copy — and the money column is `unit_price`
   (a `DECIMAL`, in major units). Likewise `public.orders` has
   `payment_intent_id`, **not** `stripe_payment_intent_id`, and `total_amount`,
   **not** `amount`. Run as written, the v4.0 command fails with
   `ERROR: column oi.quantity does not exist`.

The script also exports `reading_progress` and `book_content`, which v4.0 omitted:
`book_content` is where `epub_url` / `pdf_url` / `audio_url` live (there is no
`books.manuscript_url` in Supabase), and WS3.4 needs it.

**Verification:** every `export/*.json` file parses and reports its row count —
the script does this itself with `jq` and exits non-zero on any failure.

#### P11.2 — TRANSFORM (`scripts/transform-data.ts`)

- **Task 2.1:** Parse all export JSON files; fail loudly on malformed input.
- **Task 2.2:** Map `auth.users.id` (UUID string) → `user.id`; set `emailVerified = (email_confirmed_at != null)`; set `name` from `raw_user_meta_data`.
- **Task 2.3:** For each user, emit one `account` doc: `{ providerId: "credential", accountId: <user.id>, userId: <user.id>, password: "!locked:<uuid>" }`.
- **Task 2.4:** Map `profiles.user_id` → `user.id`; convert `profiles.id` UUID → new ObjectId `_id`; keep a UUID→ObjectId lookup table (written to `export/_id_map.json`).
  > **v4.0.2:** v4.0 called the source column `profiles.auth_user_id`. That is the
  > **Mongo** field name; the Supabase column is `profiles.user_id`
  > (`user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id)`). The transform reads
  > `user_id` and writes `auth_user_id`.
- **Task 2.5:** Convert `authors.profile_id` and `books.author_id` via `_id_map.json` to ObjectIds; generate unique `slug` for each book (lowercase, hyphenated, numeric suffix on collision); initialize `avg_rating: 0`, `review_count: 0`.
  > **v4.0.2:** `books.author_id` is nullable in Supabase (`ON DELETE SET NULL`), so
  > an unmappable author is valid input, not a transform failure. Such books are
  > imported with `author_id: null`, counted in the report, and surfaced by P11.5 as
  > a distinct WARN rather than failing referential integrity.
  >
  > `avg_rating` / `review_count` are initialised to 0 and then **recomputed from
  > the migrated reviews in the same pass**, using the same aggregation WS2c.1.2
  > runs after a review mutation. Leaving them at 0 while importing reviews would
  > render every book as unrated immediately after cutover.
- **Task 2.6:** Flatten `orders_raw.json` into `orders.json` with embedded `order_items[]`; preserve `stripe_payment_intent_id`.
  > **v4.0.2 — three details v4.0 left undefined:**
  >
  > 1. `orders.user_id` in Supabase is a **`profiles.id`**, but `Order.user_id` in
  >    Mongo is the **auth user id** (see `app/api/webhook/route.ts`, which writes
  >    `metadata.user_id`). The transform remaps through `_id_map`.
  > 2. Legacy orders predating Stripe have `payment_intent_id IS NULL`. Since the
  >    unique sparse index on `orders.stripe_payment_intent_id` is what enforces
  >    webhook idempotency, those rows get a stable synthetic key
  >    `legacy:<order_number>` and are counted in the report.
  > 3. Repeat lines for the same book within one order collapse into a single
  >    `order_items[]` entry with `quantity` summed.
- **Task 2.9 _(v4.0.2, new)_ — narrow the enums.** Postgres CHECK constraints are
  wider than the Mongo unions in `types/mongo.ts`, so unmapped values would break
  `tsc` consumers and leak unpublished content:
  - `books.status`: `draft|submitted|review|accepted|published|archived` → Mongo
    `draft|published|archived`. The three in-flight editorial states collapse to
    `draft` so nothing unpublished reaches the public catalog.
  - `orders.status`: `pending|processing|completed|cancelled|refunded` → Mongo
    `pending|completed|failed|refunded` (`processing`→`pending`,
    `cancelled`→`failed`).
  - `profiles.role`: any legacy `editor` degrades to `reader` (v4.0.1 removed the
    role).
    Every remap is counted in the transform report.
- **Task 2.7:** Convert all ISO date strings to native `Date` (`$date`) objects.
- **Task 2.8:** Emit transform report: per-collection counts in/out, orphans detected, slug collisions resolved.

**Verification:** transform report shows zero unmapped foreign keys.

#### P11.3 — DRY RUN (to staging database) _(new in v4.0)_

1. Import transformed files into a **staging** Atlas cluster/database (`mangu_staging`).
2. Point a Vercel **preview deployment** at staging.
3. Execute smoke suite: sign-up, forced-reset for one imported test user, catalog render, checkout (Stripe test mode), webhook insert, file proxy.
4. Confirm imported user documents round-trip through Better Auth (adapter `id` mapping check).

**Verification:** staging smoke suite 6/6 green. **No production import without this gate.**

#### P11.4 — IMPORT (to production MongoDB Atlas)

```bash
# Better Auth collections first
mongoimport --uri "$MONGODB_URI" --db mangu --collection user      --file export/user_transformed.json      --jsonArray
mongoimport --uri "$MONGODB_URI" --db mangu --collection account   --file export/account_transformed.json   --jsonArray

# Application data
mongoimport --uri "$MONGODB_URI" --db mangu --collection profiles  --file export/profiles_transformed.json  --jsonArray
mongoimport --uri "$MONGODB_URI" --db mangu --collection authors   --file export/authors_transformed.json   --jsonArray
mongoimport --uri "$MONGODB_URI" --db mangu --collection books     --file export/books_transformed.json     --jsonArray
mongoimport --uri "$MONGODB_URI" --db mangu --collection orders    --file export/orders_transformed.json    --jsonArray
```

_(Intentionally NOT imported: `session` — wiped by design; `verification` — Better Auth generates fresh tokens.)_

#### P11.5 — VERIFY (via `mongosh`)

> **v4.0.2:** implemented as `scripts/verify-migration.mongo.js`, which prints
> `PASS` / `WARN` / `FAIL` per check and exits non-zero if anything fails, so it
> can gate P11.6 in a pipeline.

```bash
EXPECTED_COUNTS="$(jq -c '[.counts|to_entries[]|{(.key):.value.out}]|add' export/transform-report.json)" \
  mongosh "$MONGODB_URI" --quiet --file scripts/verify-migration.mongo.js
```

**⚠️ The v4.0 snippet below must NOT be used — it reports a false failure on
every row.** Retained only so the defect is not reintroduced:

```javascript
// BROKEN — db.user has no `id` field at the collection level.
db.profiles.countDocuments({ auth_user_id: { $nin: db.user.distinct('id') } });
```

The Better Auth MongoDB adapter stores the primary key as **`_id`** and only
projects it as `id` through `customTransformOutput`. At the raw collection level
`db.user.distinct('id')` returns `[]`, and `{$nin: []}` matches **every**
document — so the check reports 100% of profiles as orphans. Verified against a
real `mongod` with the imported fixture: 3 profiles in the database,
`distinct('id')` → `[]`, documented check → 3 orphans, corrected check → 0.

The shipped script therefore:

1. uses `_id` for all Better Auth key comparisons;
2. replaces `$nin: <full distinct array>` with `$lookup` anti-joins, which
   `$nin` cannot do at production row counts;
3. adds the credential-safety check v4.0 omitted, which North Star #4 requires —
   **no `account` document may contain a bcrypt hash** (`/^\$2[aby]?\$/` must
   return 0), every credential account must carry the `!locked:` sentinel, and
   every `user` must have an `account` (a user without one can never sign in);
4. asserts the unique indexes themselves exist, since duplicate-free data is not
   the same as a database that will _reject_ a duplicate;
5. treats `books.author_id: null` as a WARN, not a FAIL (see Task 2.5).

#### P11.6 — RECONCILE & SIGN-OFF

1. Produce reconciliation report (counts, integrity, storage URLs) → attach to PR/Slack.
2. Data Owner sign-off recorded.
3. Only then proceed to Phase 12.

---

### 5.6 Phase 12: Code Cutover

**Owner:** Agent

**Merge Waterfall Sequence** (strict order; each gate must pass before the next merge):

1. **PR #1 (Auth) Merge:**
   - _Entry Criteria:_ Staging deployment passes auth smoke tests (sign-up, verify email, sign-in, reset).
   - _Action:_ Merge to main. Vercel auto-deploys.
   - _Verification:_ Sign up, Sign in, Sign out pass in prod.

2. **PR #2a–2d (Data) Merge:**
   - _Entry Criteria:_ PR #1 stable **and** Phase 11 migration signed off (P11.6).
   - _Action:_ Merge all data layer PRs.
   - _Verification:_ Catalog pages load, user dashboard populates, webhook idempotency test replayed → no duplicate order.

3. **PR #3 (Storage) Merge:**
   - _Entry Criteria:_ PR #2 stable; WS3 Task 3.4 legacy file migration report shows 0 failures.
   - _Action:_ Merge storage refactor.
   - _Verification:_ Upload a test book cover; verify it renders via Vercel Blob CDN; purchased manuscript downloads via proxy.

4. **PR #4 (Cleanup) Merge:**
   - _Entry Criteria:_ PR #3 stable.
   - _Action:_ Merge env and cleanup PR.
   - _Verification:_ `grep -ri "supabase" app/ lib/ components/ types/` returns 0 results.

5. **PR #5 (Tests) Merge:**
   - _Entry Criteria:_ PR #4 stable.
   - _Action:_ Merge refactored test suite.
   - _Verification:_ GitHub Actions CI pipeline is fully green.

6. **PR #6 (Observability & Rate Limiting) Merge:**
   - _Entry Criteria:_ PR #5 stable.
   - _Action:_ Merge hardening layer.
   - _Verification:_ k6 burst returns 429s; staging error appears in Sentry and log drain.

---

### 5.7 Phase 13: DNS Cutover

**Owner:** Operator

| Step      | Action                                    | Subtasks                                                                                                                                                                    | Verification                                                                     |
| --------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **P13.0** | **Pre-cutover TTL** (24h before)          | Lower Cloudflare TTL on A/AAAA/CNAME to 60s                                                                                                                                 | `dig` shows TTL ≤ 60                                                             |
| **P13.1** | **Backup DNS**                            | Export Cloudflare Zone File                                                                                                                                                 | `.txt` backup saved locally                                                      |
| **P13.2** | **Update DNS Records**                    | 13.2.1 Cloudflare → DNS <br> 13.2.2 Change A Record to `76.76.21.21` <br> 13.2.3 Change AAAA Record to Vercel IPv6 <br> 13.2.4 Change `www` CNAME to `cname.vercel-dns.com` | `dig mangu-publishers.com` returns Vercel IPs                                    |
| **P13.3** | **Verify TLS**                            | Wait 1–5 mins for Vercel to auto-provision cert                                                                                                                             | `curl -I https://www.mangu-publishers.com` returns HTTP 200 with valid TLS chain |
| **P13.4** | **Cloud Run Standby** _(revised in v4.0)_ | Scale Cloud Run to **min-instances 0** but keep the service, env, and image intact for a **48-hour rollback window**. Do NOT delete.                                        | Service status: idle but restorable                                              |
| **P13.5** | **Final Prod Verification**               | Execute full QA Matrix (§6)                                                                                                                                                 | All tests pass                                                                   |

---

### 5.8 Phase 14-15: Validation & Closeout

**Owner:** All Stakeholders

| Step      | Action                       | Subtasks                                                                                                   | Verification                                   |
| --------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **P14.1** | **Execute QA Matrix**        | Run all 22 regression tests                                                                                | Documented pass/fail report                    |
| **P14.2** | **Database Backup**          | `mongodump --uri "$MONGODB_URI" --out ./phoenix-backup-$(date +%Y%m%d)`                                    | Backup directory populated                     |
| **P14.3** | **Store Backup**             | Upload to GCS/S3 with encryption                                                                           | Backup verified in cloud storage               |
| **P14.4** | **Revoke Temp Tokens**       | Delete Atlas API Key, delete Vercel Token                                                                  | Access revoked confirmation                    |
| **P14.5** | **Decommission Supabase**    | Pause Supabase project (keep 30 days for fallback). After 48h stable + QA green, also tear down Cloud Run. | Supabase dashboard shows paused state          |
| **P14.6** | **Post-Mortem**              | Document lessons learned in `POST_MORTEM.md`                                                               | Document circulated to stakeholders            |
| **P15.1** | **Watch Period**             | 7-day elevated monitoring: error rate, p95, reset completion, webhook lag                                  | Daily health summary in Slack                  |
| **P15.2** | **North Star Certification** | Walk all 8 Definition-of-Done boxes (§1.2) with evidence links                                             | Signed DoD checklist appended to this document |

---

## 6. QUALITY ASSURANCE MATRIX

### 6.1 The 22-Point Regression Suite

Each test must be executed in the **production environment** after DNS cutover. Every test maps to the requirement(s) it proves (traceability).

| #   | Test Name          | Action                                                 | Pass Criteria                                                                                | Requirement(s)             |
| --- | ------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------- |
| 1   | Homepage Load      | Navigate to `/`                                        | Renders < 2s, no console errors                                                              | NFR Performance            |
| 2   | Book Catalog       | Navigate to `/books`                                   | Books populated, covers load, pagination works                                               | R-CONTENT-01, R-CONTENT-04 |
| 3   | Book Detail        | Click book from catalog                                | Full detail page: title, author, description, price                                          | R-CONTENT-03               |
| 4   | User Sign-Up       | Complete registration                                  | User in Better Auth, profile in Mongo, email sent                                            | R-AUTH-01, R-AUTH-02       |
| 5   | User Sign-In       | Sign in with new creds                                 | Session cookie set, redirect to dashboard                                                    | R-AUTH-04                  |
| 6   | User Sign-Out      | Click sign out                                         | Session cleared, protected routes blocked                                                    | R-AUTH-05                  |
| 7   | Access Control     | Non-admin visits `/admin`                              | 403 or redirect to `/login`                                                                  | R-ADMIN-01                 |
| 8   | Admin Dashboard    | Admin visits `/admin`                                  | Dashboard renders with user/book/order stats                                                 | R-ADMIN-02                 |
| 9   | Author Create Book | Author creates book                                    | Book doc in Mongo (status: 'draft'), shows on dashboard                                      | R-CREATOR-02               |
| 10  | Checkout Flow      | Complete Stripe purchase                               | Stripe checkout succeeds, redirect to success page                                           | R-CONTENT-03               |
| 11  | Webhook Processing | Check DB post-purchase                                 | Order status: 'completed', `stripe_payment_intent_id` present; replay webhook → no duplicate | §3.3 Payment Idempotency   |
| 12  | File Upload        | Upload book cover                                      | File in Vercel Blob, URL saved to Mongo, image renders                                       | R-STORAGE-01, R-STORAGE-03 |
| 13  | Health Endpoint    | `GET /api/health?ready=1`                              | HTTP 200, `{"ready":true}` + sub-statuses                                                    | §1.2 DoD-2                 |
| 14  | Full-Text Search   | Search "mystery" in catalog                            | Returns relevant books via MongoDB `$text` index                                             | R-CONTENT-02               |
| 15  | Profile Update     | Update display name                                    | Mongo `profiles` doc updated, UI reflects change                                             | R-CREATOR-04               |
| 16  | Password Reset     | Request reset, click link, change password             | Password updated, user can sign in with new pass                                             | R-AUTH-03                  |
| 17  | Review Submission  | Leave a 5-star review on purchased book                | Review doc inserted, book `avg_rating`/`review_count` recalculated                           | R-CONTENT-05               |
| 18  | Rate Limiting      | Hit API endpoint 200x in 10s                           | Upstash Redis blocks requests (HTTP 429 + `Retry-After`)                                     | R-SEC-01                   |
| 19  | File Download      | Download purchased manuscript                          | `/api/files/[id]` proxies blob, file downloads; unpurchased → 403                            | R-STORAGE-02, R-STORAGE-04 |
| 20  | 404 Handling       | Navigate to `/fake-route`                              | Custom 404 page renders cleanly                                                              | —                          |
| 21  | Legacy User Reset  | Imported legacy user completes forced reset & signs in | Reset email delivered; new password works; profile intact                                    | R-AUTH-07                  |
| 22  | Audit Trail        | Admin changes a user role                              | `audit_logs` doc written with actor, action, target, timestamp                               | R-ADMIN-04                 |

---

## 7. RISK REGISTRY & MITIGATION

_Scoring: Probability (1–5) × Impact (1–5) = RPN. RPN ≥ 12 requires a named contingency owner._

| ID   | Risk                                   | Prob    | Impact       | RPN | Mitigation                                                                                                                       | Contingency                                                       |
| ---- | -------------------------------------- | ------- | ------------ | --- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| R-01 | **Data Loss During Migration**         | Low (2) | Critical (5) | 10  | Full Supabase pg_dump + storage snapshot pre-migration (P1.8); dry run gate (P11.3); count reconciliation                        | Restore from backup; re-run transform                             |
| R-02 | **Auth Outage During Cutover**         | Med (3) | Critical (5) | 15  | Stage auth PR first; test in Vercel preview; dry-run round-trip check                                                            | Revert middleware; re-enable Supabase auth env vars               |
| R-03 | **Vercel Blob Upload Failure**         | Low (2) | High (4)     | 8   | Test endpoint pre-deploy; verify token scope                                                                                     | Fallback to direct Supabase Storage URLs temporarily              |
| R-04 | **DNS Cutover Delay**                  | Med (3) | Med (3)      | 9   | TTL 60s pre-cutover (P13.0); verify with `dig`                                                                                   | Add 30min buffer; communicate delay per §8.1                      |
| R-05 | **MongoDB Performance**                | Low (2) | High (4)     | 8   | Create indexes pre-migration; monitor Atlas metrics                                                                              | Add read replicas; tune indexes; increase cluster tier            |
| R-06 | **Next.js Cache Invalidation**         | Med (3) | Med (3)      | 9   | `revalidateTag`/`revalidatePath` post-mutations (2c.1.4)                                                                         | Disable caching temporarily; manually purge                       |
| R-07 | **Stripe Webhook Race/Duplication**    | Low (2) | High (4)     | 8   | Unique index + idempotent upsert (2b.1.4)                                                                                        | Manual reconciliation via Stripe dashboard                        |
| R-08 | **Reset Email Deliverability** _(new)_ | Med (3) | High (4)     | 12  | Verify Resend domain DKIM/SPF (P8.3); seed-list test before mass send; stagger batches                                           | Resend via alternate domain; in-app banner + support runbook      |
| R-09 | **Broken Legacy File URLs** _(new)_    | Med (3) | High (4)     | 12  | WS3 Task 3.4 idempotent migration + URL rewrite; P11.5 storage check                                                             | Re-run migrate-storage; temporary redirect proxy to Supabase URLs |
| R-10 | **Rollback Data Divergence** _(new)_   | Low (2) | High (4)     | 8   | Supabase kept live 30 days; Phoenix window writes exported via delta script (`scripts/export-delta.ts` — new docs since cutover) | Replay delta export into Supabase before DNS revert               |
| R-11 | **Rate-Limit False Positives** _(new)_ | Low (2) | Med (3)      | 6   | Generous defaults (100/60s); health endpoint whitelisted                                                                         | Raise window; whitelist affected IPs                              |

**Escalation Path:** Operator → Engineering Lead → Project Lead → Executive Sponsor.

---

## 8. COMMUNICATIONS & ROLLBACK PLAN

### 8.1 Communications Plan _(added in v4.0 — v3.0 had rollback only)_

**Channels:** Transactional email (Resend), in-app banner, status page, Slack `#phoenix-war-room`.

| When              | Audience                | Message                                                                                                                                             | Owner          |
| ----------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **T-7 days**      | All users               | Pre-Migration Notice: platform upgrade on `<date>`, brief maintenance window, **you will be signed out and must set a new password via email link** | Product Owner  |
| **T-24h**         | All users               | Reminder + maintenance window times                                                                                                                 | Product Owner  |
| **T-1h**          | Stakeholders            | War-room opens; freeze confirmed                                                                                                                    | Project Lead   |
| **Cutover start** | Users                   | Status page: "Maintenance in progress"                                                                                                              | Operator       |
| **Cutover done**  | Legacy users            | **Forced password reset email** ("Welcome to the new Mangu — set your password") with direct reset link                                             | Agent (script) |
| **T+24h**         | Users who haven't reset | One reminder email                                                                                                                                  | Product Owner  |
| **T+7d**          | Stakeholders            | Success summary + watch-period metrics                                                                                                              | Project Lead   |

**Incident comms:** any rollback trigger (§8.2) → post to status page within 15 minutes, then updates every 30 minutes until resolved.

### 8.2 Rollback Triggers

Execute rollback if **any** of the following occur:

1. **Critical Auth Failure:** > 5% of sign-in attempts fail within 30 mins.
2. **Data Integrity Violation:** Orders created without user records.
3. **Payment Failure:** Stripe webhooks not processed within 60s.
4. **Catastrophic Performance Degradation:** p95 response time > 5 seconds.

### 8.3 Rollback Procedure

```
  ┌─────────────────────────────────────────────────────────────────────┐
  │                       ROLLBACK PROCEDURE                           │
  │                                                                     │
  │  DNS ROLLBACK:                                                      │
  │  1. Revert Cloudflare DNS: A/AAAA → GCP Cloud Run IPs              │
  │  2. Wait for DNS propagation (1-5 min)                              │
  │  3. Verify: curl → Cloud Run app (kept on standby 48h, P13.4)      │
  │  4. Scale Cloud Run min-instances back to 1                         │
  │                                                                     │
  │  CODE ROLLBACK:                                                     │
  │  1. git revert HEAD~1 (or specific PR merge commits)               │
  │  2. Push to main → Vercel auto-deploys legacy code                 │
  │  3. Re-enable Supabase env vars on Vercel if deleted               │
  │                                                                     │
  │  DATA ROLLBACK (divergence handling, v4.0):                         │
  │  1. MongoDB: keep running — do NOT delete.                          │
  │  2. Run scripts/export-delta.ts to capture all Phoenix-window       │
  │     writes (orders, profiles, reviews, books) since cutover.        │
  │  3. Supabase remains source of truth; replay delta export into      │
  │     Supabase where feasible; anything not replayable is archived    │
  │     with the P14.2 mongodump for manual reconciliation.             │
  │                                                                     │
  └─────────────────────────────────────────────────────────────────────┘
```

_Decision Time Limit:_ No more than **60 minutes** between trigger and Go/No-Go decision.

---

## 9. APPENDIX

### 9.1 Environment Variables Reference

| Variable                    | Source            | Required | Notes                                                                 |
| --------------------------- | ----------------- | -------- | --------------------------------------------------------------------- |
| `MONGODB_URI`               | MongoDB Atlas     | ✅       | `mongodb+srv://...`                                                   |
| `DATABASE_PROVIDER`         | Set by script     | ✅       | Value: `mongodb`                                                      |
| `BETTER_AUTH_SECRET`        | Generated         | ✅       | Random 32-char hex string                                             |
| `BETTER_AUTH_URL`           | App URL           | ✅       | `https://www.mangu-publishers.com`                                    |
| `STRIPE_SECRET_KEY`         | Stripe Dashboard  | ✅       | `sk_live_...`                                                         |
| `STRIPE_WEBHOOK_SECRET`     | Stripe Dashboard  | ✅       | `whsec_...`                                                           |
| `BLOB_READ_WRITE_TOKEN`     | Vercel Storage    | ✅       | Generated by Vercel                                                   |
| `UPSTASH_REDIS_REST_URL`    | Upstash Console   | ✅       | `https://xxxx.upstash.io`                                             |
| `UPSTASH_REDIS_REST_TOKEN`  | Upstash Console   | ✅       | Base64 string                                                         |
| `RESEND_API_KEY`            | Resend Dashboard  | ✅       | `re_...`                                                              |
| `SENTRY_DSN`                | Sentry            | ✅       | Server/edge error capture                                             |
| `NEXT_PUBLIC_SENTRY_DSN`    | Sentry            | ✅       | Client error capture                                                  |
| `NEXT_PUBLIC_APP_URL`       | App URL           | ✅       | `https://www.mangu-publishers.com`                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase (legacy) | ⚠️ Temp  | Only for WS3 Task 3.4 file migration + delta export; deleted at P14.4 |

### 9.2 Key Files & Their Ownership

| File                         | Purpose                           | Workstream | Status                                             |
| ---------------------------- | --------------------------------- | ---------- | -------------------------------------------------- |
| `lib/auth.ts`                | Better Auth server config         | WS1        | ✅ New                                             |
| `lib/auth-client.ts`         | Better Auth React client          | WS1        | ✅ New                                             |
| `emails/reset.tsx`           | Branded reset email template      | WS1        | ✅ New                                             |
| `lib/mongodb.ts`             | MongoDB connection singleton      | WS2a       | ✅ New (canonical; `lib/mongo.ts` re-exports — D2) |
| `lib/mongo-queries.ts`       | Centralized query functions       | WS2a       | ✅ New                                             |
| `types/mongo.ts`             | Mongo document types              | WS2a       | ✅ New                                             |
| `lib/audit.ts`               | Audit log writer                  | WS2c       | ✅ New                                             |
| `lib/actions/upload.ts`      | Server actions (rewritten)        | WS3        | ✅ Migrated                                        |
| `scripts/migrate-storage.ts` | Supabase→Blob bulk file migration | WS3        | ✅ New                                             |
| `scripts/transform-data.ts`  | Export→Mongo transform pipeline   | P11        | ✅ New                                             |
| `scripts/export-delta.ts`    | Rollback divergence capture       | §8.3       | ✅ New                                             |
| `lib/logger.ts`              | Structured JSON logger            | WS6        | ✅ New                                             |
| `lib/ratelimit.ts`           | Upstash rate limiter              | WS6        | ✅ New                                             |
| `lib/supabase/*.ts`          | Supabase client/query files       | WS4        | ❌ Delete                                          |
| `types/database.ts`          | Supabase types                    | WS4        | ❌ Delete                                          |
| `middleware.ts`              | Session + rate-limit middleware   | WS1/WS6    | ✅ Migrated                                        |

### 9.3 Troubleshooting Quick Reference

- **MongoServerSelectionError:** Cluster is paused or IP not whitelisted. Verify `0.0.0.0/0` in Atlas.
- **Session not persisting:** `BETTER_AUTH_URL` mismatch or cookie domain misconfigured.
- **Legacy user can't sign in:** expected — credential account is locked by design; use "Forgot password" (R-AUTH-07).
- **Reset email missing:** check Resend domain verification + spam folder; re-trigger via `/forgot-password`.
- **Vercel Blob 401:** `BLOB_READ_WRITE_TOKEN` missing or incorrect scope.
- **Image not loading:** `remotePatterns` missing `*.public.blob.vercel-storage.com` in `next.config.js`.
- **mongoimport duplicate key:** re-running an import; collections are not idempotent — drop the target collection before re-import, or use `--mode upsert --upsertFields id`.
- **429s on legitimate traffic:** rate limit window too tight — adjust `lib/ratelimit.ts` constants and redeploy.

### 9.4 MASTER IMPLEMENTATION CHECKLIST

_The complete step/substep inventory. Print this. Check every box. This is the go-live contract._

**Phase 1–4 — Preparation**

- [ ] P1.1 Toolchain verified (Node 22 / npm 10 / git 2)
- [ ] P1.2 Migration branch checked out
- [ ] P1.3 Dependencies installed clean
- [ ] P1.4 Atlas API key created & stored
- [ ] P1.5 Vercel token created & stored
- [ ] P1.6 Architect sign-off recorded
- [ ] P1.7 Feature freeze announced + T-7d notice sent
- [ ] P1.8 Full pg_dump + storage snapshot, restore-tested

**Phase 5–7 — Bootstrap**

- [ ] P5.1 Env exported
- [ ] P5.2 `db:mongo:up` exit 0 (cluster, user, IP, URI, Vercel sync)
- [ ] P5.3 Ping OK
- [ ] P5.4 Indexes created (text, slug, payment-intent, orders, profiles, audit)
- [ ] P5.5 Local health `ready:true`
- [ ] P5.6 Vercel deploy green
- [ ] P5.7 Prod health `ready:true`

**Phase 8–10 — Prod Env**

- [ ] P8.1 Stripe keys
- [ ] P8.2 Upstash keys (PONG)
- [ ] P8.3 Resend key + DKIM/SPF green
- [ ] P8.4 Stripe webhook endpoint + signing verified
- [ ] P8.5 Sentry DSNs + log drain attached
- [ ] P8.6 Redeployed, composite health green

**Phase 11 — Data Migration**

- [ ] P11.1 Exports complete, all JSON parses
- [ ] P11.2 Transform: zero unmapped FKs; slugs unique; dates native
- [ ] P11.3 Dry run on staging: smoke 6/6, Better Auth round-trip OK
- [ ] P11.4 Production import (`user`, `account`, `profiles`, `authors`, `books`, `orders`)
- [ ] P11.5 Verify: counts reconcile; integrity checks all 0; no supabase storage URLs
- [ ] P11.6 Reconciliation report signed off

**Phase 12 — Code Cutover**

- [ ] PR #1 Auth merged & prod auth smoke pass
- [ ] PR #2a–d Data merged; catalog + dashboard live; webhook idempotent
- [ ] PR #3 Storage merged; cover upload + manuscript download pass; legacy files migrated (0 failures)
- [ ] PR #4 Cleanup merged; zero `supabase` code references
- [ ] PR #5 Tests merged; CI fully green
- [ ] PR #6 Hardening merged; 429s verified; Sentry + drain live

**Phase 13 — DNS**

- [ ] P13.0 TTL 60s (T-24h)
- [ ] P13.1 Zone file backed up
- [ ] P13.2 A/AAAA/CNAME → Vercel
- [ ] P13.3 TLS valid, HTTP 200
- [ ] P13.4 Cloud Run on standby (48h, not deleted)
- [ ] P13.5 QA matrix executed

**Phase 14–15 — Closeout**

- [ ] P14.1 22/22 QA pass
- [ ] P14.2 mongodump taken
- [ ] P14.3 Backup in encrypted cloud storage
- [ ] P14.4 Temp tokens revoked (incl. Supabase service-role key)
- [ ] P14.5 Supabase paused (30-day fallback); Cloud Run torn down after 48h stable
- [ ] P14.6 Post-mortem circulated
- [ ] P15.1 7-day watch metrics healthy
- [ ] P15.2 All 8 North Star boxes certified with evidence

---

## 10. SIGN-OFF

By signing below, each stakeholder confirms they have reviewed this document and agree to the plan, timeline, and their responsibilities.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FORMAL SIGN-OFF                            │
│                                                                     │
│  Role                  Name                  Date        Signature  │
│  ───────────────────────────────────────────────────────────────    │
│                                                                     │
│  Project Lead          ___________________  _________  ___________  │
│                                                                     │
│  Engineering Lead      ___________________  _________  ___________  │
│                                                                     │
│  Product Owner         ___________________  _________  ___________  │
│                                                                     │
│  Quality Assurance     ___________________  _________  ___________  │
│                                                                     │
│  Operations Lead       ___________________  _________  ___________  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## DOCUMENT CONTROL

| Version | Date       | Author       | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------- | ---------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-07-18 | Project Lead | Initial master document                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2.0     | 2026-07-18 | Project Lead | Complete rewrite — comprehensive architecture, BRD/FRD/Tech Spec unification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 3.0     | 2026-07-18 | Project Lead | All-Encompassing Edition: granular task breakdown, 20-point QA, NFRs, rollback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 4.0     | 2026-07-19 | Project Lead | **Implementation-Locked Edition:** Fixed invalid SQL export syntax and Better Auth collection naming (`user`/`account`/`session`/`verification`); replaced incorrect password re-hash assumption with forced-password-reset flow (WS1.7, R-AUTH-07); defined missing WS5 (Tests) and WS6 (Observability & Rate Limiting) closing the PR #5/#6 gap; added legacy file migration (WS3.4), audit log (2c.2), avg_rating recompute (2c.1.2), webhook idempotency (2b.1.4); added migration dry-run gate (P11.3), reconciliation sign-off (P11.6), rollback divergence handling, full communications plan (§8.1), expanded QA to 22 points with requirement traceability, 4 new risks (R-08–R-11), master implementation checklist (§9.4); corrected typos and Cloud Run standby policy. |
| 4.0.2   | 2026-07-25 | Agent        | **Phase 11 Executable Edition** — §5.5 reconciled against `supabase/migrations/` and a real `mongod`. See the amendment table below. Phase 11 moves from prose to six runnable scripts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

### v4.0.2 amendments (2026-07-25)

Every item below was found while implementing §5.5 and would have halted the
cutover if executed as written in v4.0. Each is verified against the schema in
`supabase/migrations/` or against a real `mongod`.

| ID   | Section    | Defect in v4.0                                                                                                                                         | Resolution                                                                                                                 |
| ---- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| A-1  | P11.1      | `\copy … TO file` applies COPY text escaping to `json_agg` output, producing invalid JSON                                                              | Export via `psql -X -A -t -c`; `scripts/export-supabase.sh`                                                                |
| A-2  | P11.1      | `json_agg` yields SQL NULL for an empty table, writing an unparseable file                                                                             | `coalesce(json_agg(...), '[]'::json)`                                                                                      |
| A-3  | P11.1      | Orders join selects `oi.quantity` and `oi.price_cents`, neither of which exists → `ERROR: column oi.quantity does not exist`                           | Select `oi.unit_price`; quantity is implicit per row; `orders.payment_intent_id` / `total_amount` named correctly          |
| A-4  | P11.1      | `reading_progress` and `book_content` never exported, but WS3.4 needs `book_content` for manuscript URLs                                               | Both added to the export set                                                                                               |
| A-5  | P11.2 T2.4 | Source column named `profiles.auth_user_id`; the Supabase column is `profiles.user_id` (`auth_user_id` is the Mongo field)                             | Transform reads `user_id`, writes `auth_user_id`                                                                           |
| A-6  | P11.2 T2.6 | `orders.user_id` is a `profiles.id`, but `Order.user_id` in Mongo is the auth user id — undocumented, and silently breaks entitlements                 | Remapped through `_id_map`; asserted by unit test                                                                          |
| A-7  | P11.2 T2.6 | Pre-Stripe orders have a NULL payment intent, defeating the idempotency index                                                                          | Synthetic `legacy:<order_number>` key, counted in the report                                                               |
| A-8  | P11.2      | Postgres CHECK enums are wider than the Mongo unions, so `submitted`/`review`/`accepted` books would leak as non-draft                                 | New Task 2.9 defines every narrowing; all remaps counted                                                                   |
| A-9  | P11.2 T2.5 | `books.author_id` is nullable (`ON DELETE SET NULL`), so v4.0 would fail the gate on valid data                                                        | Imported as `author_id: null`; P11.5 reports it as WARN                                                                    |
| A-10 | P11.2 T2.5 | Initialising `avg_rating`/`review_count` to 0 while importing reviews renders every book unrated post-cutover                                          | Recomputed in-pass with the WS2c.1.2 aggregation                                                                           |
| A-11 | P11.5      | `db.user.distinct('id')` returns `[]` (the adapter stores `_id`), so `$nin: []` matches everything and every row reports as an orphan                  | Use `_id`; proven against a real `mongod` (3 profiles → documented check 3 orphans, corrected 0)                           |
| A-12 | P11.5      | `$nin: <full distinct array>` does not scale to production row counts                                                                                  | `$lookup` anti-joins                                                                                                       |
| A-13 | P11.5      | No check that password hashes were actually left behind, though North Star #4 depends on it                                                            | Added: 0 bcrypt hashes, all credentials `!locked:`, every user has an account                                              |
| A-14 | P11.5      | Verified data but not the indexes that _enforce_ the invariants at write time                                                                          | Assert `orders_stripe_payment_intent_uq` and `books_slug_uq` exist                                                         |
| A-15 | §11        | Four of the six agent-owned migration scripts did not exist, so Phase 11 was not executable                                                            | `export-supabase.sh`, `transform-data.ts`, `verify-migration.mongo.js`, `send-forced-resets.ts`, `export-delta.ts` shipped |
| A-16 | §5 WS2d    | Task 2d.1 cited `app/(shop)/books/page.tsx` and `components/BookCard.tsx`; live App Router uses `app/(consumer)/…` and `components/cards/BookCard.tsx` | 2d.1 rewritten as progressive dual-run slices through `lib/data/*`; Slice A = home/genres/checkout                         |

**Better Auth `_id` finding (informs the P11.3 gate).** `@better-auth/mongo-adapter`
coerces id fields with `new ObjectId(value)` and falls back to the raw string when
that throws — which it always does for a 36-character UUID. Importing `user` docs
with `_id` set to the legacy UUID therefore round-trips correctly, and legacy UUID
ids coexist with the 24-hex ids new signups receive. Confirmed against a real
`mongod`: a locked legacy account rejects sign-in (including when the sentinel
itself is supplied as the password), and `requestPasswordReset` resolves the
imported user and writes a verification token.

---

_This document is the single source of truth for **Project Phoenix: Mangu Publishers Stack Modernization**. All decisions, requirements, and technical specifications are captured herein. Adherence to this plan is critical for a successful, on-time, and high-quality delivery._

**© 2026 Mangu Publishers — Confidential**
