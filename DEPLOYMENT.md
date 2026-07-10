# Deployment guide

## Local development (verified in this build)

No Docker required. `scripts/dev-services.sh` runs PostgreSQL 16 and Redis as
plain native processes on non-default ports (5433 / 6380) so they don't
collide with anything else on the machine:

```bash
bash scripts/dev-services.sh start   # initdb (first run only) + start both
bash scripts/dev-services.sh status
bash scripts/dev-services.sh stop
```

`.env` (copied from `.env.example`) points `DATABASE_URL`/`REDIS_URL` at
these local ports. Run `pnpm db:migrate` once, then `pnpm dev` (app) and
`pnpm worker` (background jobs) in separate terminals.

If your machine already has Postgres/Redis running elsewhere, just point
`DATABASE_URL`/`REDIS_URL` at those instead and skip the dev-services script.

## Production: Vercel + Supabase (documented path, not executed in this build)

This build ran inside a sandboxed session with no cloud account access and an
egress policy blocking arbitrary outbound domains, so the steps below are the
correct, verified-by-architecture deployment path but were **not**
exercised against a live Vercel/Supabase account.

1. **Database**: create a Supabase (or any managed Postgres) project. Copy
   its connection string into `DATABASE_URL`. Run `pnpm db:deploy`
   (`prisma migrate deploy`) against it — the schema is identical to local
   dev, only the connection string changes.
2. **Redis**: provision a managed Redis (Upstash, Railway, Redis Cloud, …)
   and set `REDIS_URL` to its connection string. BullMQ works unchanged.
3. **App**: deploy this repo to Vercel. Set environment variables (see
   `.env.example`) in the Vercel project settings — at minimum
   `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your
   production URL). Add `ANTHROPIC_API_KEY` to enable real AI analysis, and
   `NEWSAPI_KEY`/SMTP variables if you want those adapters/email delivery
   live.
4. **Background workers**: Vercel serverless functions are not suited to
   long-lived BullMQ workers. Deploy `jobs/run-workers.ts` as a small
   always-on Node process on a platform that supports it (Railway, Fly.io,
   a small VM, or a container). Alternatively, migrate the scheduler tick to
   Vercel Cron hitting a route handler that calls
   `scheduleDueIngestionJobs()` / `evaluatePeriodicAlerts()` /
   `sendDueDigests()`, with the ingestion/analysis/alert *workers* still
   running as a separate always-on process (BullMQ workers need a persistent
   connection to consume queues; they cannot run as one-shot serverless
   invocations).
5. **PDF export**: `lib/reports/export-pdf.ts` launches a local headless
   Chromium via `playwright-core`. On Vercel's serverless runtime this
   needs a Chromium binary compatible with the serverless filesystem (e.g.
   `@sparticuz/chromium` + `playwright-core`'s `executablePath` option, or
   move PDF rendering to the same always-on worker process as the other
   background jobs). This build renders PDFs via the pre-installed Chromium
   at a fixed local path — that path assumption must be replaced for a
   serverless deployment.

## Environment variables

See `.env.example` — every variable is documented inline, including which
ones are required vs. optional and what happens when an optional one is
unset (the app never silently pretends a feature is live when it isn't).

## Database migrations in production

`pnpm db:deploy` (`prisma migrate deploy`) applies committed migrations
without prompting — safe for CI/CD. Never run `prisma migrate dev` against a
production database.
