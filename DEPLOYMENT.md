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

## Production: Railway (all-in-one, recommended)

Railway can host the whole system from this one repo — the web app *and* the
always-on background worker — and provision managed Postgres and Redis
alongside them. This avoids splitting across four vendors.

The repo is pre-configured for this:
- `railway.json` builds with Nixpacks and starts the web service with
  `pnpm db:deploy && pnpm start` (runs migrations, then boots Next.js).
- `postinstall` runs `prisma generate` so the Prisma client is built on every
  install (web build and worker alike).
- `.nvmrc` / `engines.node` pin Node 22.
- `prisma`, `tsx`, and `dotenv` are runtime `dependencies` (the worker runs
  `tsx jobs/run-workers.ts`; the deploy step runs the `prisma` CLI).
- `lib/… getRedisConnection()` sets `family: 0` so BullMQ can reach Redis over
  Railway's IPv6-only private network.

Setup (one Railway project, two services + two databases):

1. **Create the project** from this GitHub repo → this becomes the **web
   service**. Railway auto-detects Next.js via `railway.json`.
2. **Add a Postgres database** (New → Database → PostgreSQL) and a **Redis
   database** (New → Database → Redis) to the same project.
3. **Add a second service** from the same repo for the **worker**, and set its
   start command to `pnpm worker` (Settings → Deploy → Custom Start Command).
   Everything else (build, install, `prisma generate`) is shared.
4. **Environment variables** — set on *both* services:
   - `DATABASE_URL` → reference the Postgres plugin's `DATABASE_URL`
   - `REDIS_URL` → reference the Redis plugin's `REDIS_URL`
   - `NEXTAUTH_SECRET` → a random 32+ char string (`openssl rand -base64 32`)
   - `NEXTAUTH_URL` → the web service's public URL (web service only)
   - `ANTHROPIC_API_KEY` (optional) → enables real Claude analysis; without it
     the app runs in labelled MOCK mode
   - `NEWSAPI_KEY` / `SMTP_*` (optional) → licensed news search / email alerts
5. **Deploy.** The web service runs `prisma migrate deploy` on boot, applying
   both migrations to the fresh database, then serves on the generated public
   URL. Register an account there and a demo workspace is seeded automatically.

**Known caveat — PDF export:** `lib/reports/export-pdf.ts` launches headless
Chromium from a fixed local path used in the original build sandbox. That path
does not exist on Railway, so PDF export (only) will fail until it's pointed at
a Chromium the container actually has (install Playwright's browser in the
build, or bundle `@sparticuz/chromium`). Everything else — ingestion, dedup, AI
analysis, dashboards, alerts, CSV/XLSX export, reports viewed in-app — works.

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
