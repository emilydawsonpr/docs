# Architecture

## Stack

- **Frontend/backend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, a
  small internal shadcn/ui-style component kit (`components/ui/`) built on
  Radix primitives, Recharts for charts. API routes (`app/api/**/route.ts`)
  serve as the backend — no separate API server.
- **Database**: PostgreSQL 16 via Prisma ORM (`prisma/schema.prisma`). Runs as
  a native local process in dev (`scripts/dev-services.sh`, no Docker); points
  at a hosted Postgres (e.g. Supabase) in production via `DATABASE_URL`.
- **Auth**: NextAuth.js v4, Credentials provider (bcrypt-hashed passwords),
  Prisma adapter, JWT sessions. `middleware.ts` protects `/dashboard`,
  `/projects`, `/onboarding`, `/admin`.
- **Background jobs**: BullMQ + Redis (native local process in dev). Queues:
  `signalwatch-ingestion`, `signalwatch-analysis`, `signalwatch-alerts`,
  `signalwatch-digests`. Workers live in `jobs/workers/*` and are started
  together by `jobs/run-workers.ts` (`pnpm worker`), which also runs a
  1-minute scheduler tick for due source polling, periodic (spike/sentiment)
  alert evaluation, and digest sends.
- **AI analysis**: `@anthropic-ai/sdk` with a tool-use ("record_analysis")
  call enforcing structured JSON output, validated against a zod schema
  (`lib/ai/schemas.ts`). Falls back to a deterministic, transparent
  rules-based mock engine (`lib/ai/mock-engine.ts`) whenever
  `ANTHROPIC_API_KEY` is unset or the model's output fails validation twice —
  every stored result is labelled `engine: "MOCK" | "CLAUDE"`.

## Request flow

```
Browser → Next.js page/route handler → lib/rbac (authz) → Prisma → PostgreSQL
                                       ↘ lib/* business logic (dedup, ai, alerts, reports)
Background: jobs/run-workers.ts → BullMQ queues → lib/ingestion, lib/ai, lib/alerts, lib/reports
```

## Module map

```
app/                        Next.js App Router pages + API routes
  (api routes mirror the page tree under /api/projects/[projectId]/...)
components/                 React components (ui/ primitives + feature folders)
lib/
  adapters/                 SourceAdapter implementations + registry (see ADAPTER_GUIDE.md)
  ai/                       Claude client, mock engine, prompts, pipeline orchestration, zod schemas
  alerts/                   Rule evaluation, delivery (in-app/Slack/Teams/email), spike-based periodic alerts
  analytics/                Dashboard metrics, share-of-voice, spike detection (pure functions, unit-tested)
  auth/                     NextAuth config, session helpers
  db/                       Prisma client singleton
  dedup/                    URL/title canonicalization, simhash fingerprinting, clustering
  demo/                     Synthetic demo-workspace seeding
  ingestion/                Adapter fetch → normalize → dedup → store pipeline
  org/                      Organization/membership helpers
  query/                    Boolean query parser/evaluator/validator, visual↔expert compiler
  rbac/                     Role resolution and authorization checks
  reports/                  Daily brief / monthly report builders, HTML/CSV/XLSX/PDF renderers, digests
  validation/                zod input schemas for API routes
jobs/                        BullMQ queue definitions, workers, scheduler
prisma/                      schema.prisma, migrations, seed.ts
tests/                       unit/, integration/ (Vitest), e2e/ (Playwright)
scripts/                      dev-services.sh, fixture-feed.mjs (local test fixture), screenshot helper
```

## Data flow: ingestion → dedup → analysis → alerts

1. A `SourceConnection` (RSS/Google News/GDELT/CSV/manual URL/…) is polled —
   either on-demand (`POST .../sources/:id/poll`, synchronous) or by the
   scheduler enqueuing a BullMQ ingestion job for connections whose
   `pollingFrequencyMins` interval has elapsed.
2. `lib/ingestion/run-source-connection.ts` calls the adapter's `fetch()` +
   `normalize()`, then `lib/ingestion/normalize-and-store.ts`:
   - Skips items whose canonicalized URL was already ingested for the project
     (idempotent polling).
   - Creates the `Mention` row, then runs `lib/dedup/cluster.ts` (canonical
     URL → normalized title → simhash Hamming distance ≤ 12 within a ±72h
     window) to assign/create a `DuplicateCluster`.
   - Enqueues an AI analysis job per new mention.
3. The analysis worker calls `lib/ai/pipeline.ts`: short-circuits duplicates
   of an already-analyzed cluster canonical mention, otherwise calls Claude
   (if configured) or the mock engine, validates the result, stores an
   `AnalysisResult`, then enqueues alert evaluation.
4. The alert worker (`lib/alerts/evaluate-and-deliver.ts`) evaluates every
   active mention-scoped `AlertRule` against the mention, applying duplicate
   throttling and quiet-hours suppression, and delivers to configured
   channels. Volume/competitor/sentiment spike rules are evaluated separately
   on the scheduler tick (`lib/alerts/spike-alerts.ts`), since they depend on
   aggregate trends rather than a single mention.

## Why this stack for this environment

Built and verified inside a sandboxed session with a policy-restricted
outbound proxy (only package registries reachable, not arbitrary news
domains) and no Docker daemon. Every infra choice has a "runs as a plain
process, no signup, no daemon" path in dev while remaining what a real
production deployment would use: Postgres/Prisma/BullMQ are unchanged between
dev and prod, only the connection strings differ (see `DEPLOYMENT.md`).
