# SignalWatch

Media monitoring and PR intelligence for Canadian communications teams: Boolean
search, multi-source ingestion, deduplication, AI-assisted sentiment/risk
analysis, share of voice, anomaly detection, alerting, and reporting. Built
with Next.js, Prisma/PostgreSQL, BullMQ/Redis, and the Anthropic API. Original
platform — no code, branding, or content copied from any existing product.

> This repository also contains an untouched Mintlify documentation starter
> kit (`docs.json`, `*.mdx` files) from before this project was built here. It
> is unrelated to SignalWatch and can be deleted or ignored.

## Quick start (local development)

Requires Node 22+, and a machine where you can run a local PostgreSQL 16
server and Redis (no Docker required — see `scripts/dev-services.sh`).

```bash
pnpm install
cp .env.example .env            # fill in NEXTAUTH_SECRET at minimum; see below
bash scripts/dev-services.sh start   # starts local Postgres (5433) + Redis (6380)
pnpm db:migrate                 # applies the Prisma schema
pnpm dev                        # starts the Next.js app on :3000
```

In a second terminal, start the background worker (ingestion polling, AI
analysis, alert evaluation, digests):

```bash
pnpm worker
```

Open `http://localhost:3000`, register an account — a demo workspace
("Aurora Botanicals") is created automatically for your organization so you
can explore the product with realistic synthetic data immediately.

To (re)seed demo workspaces for any organization that doesn't have one yet:

```bash
pnpm db:seed
```

Stop the local services when done: `bash scripts/dev-services.sh stop`.

## What's genuinely functional vs. scaffolded

Read `KNOWN_LIMITATIONS.md` for the full, honest breakdown. In short: auth,
project/query management, RSS/Google-News/GDELT/CSV/manual-URL ingestion,
deduplication, AI analysis (real Claude integration + a labelled deterministic
mock fallback when no API key is set), dashboards, share of voice, spike
detection, alerts (in-app + Slack/Teams webhooks + email if SMTP is
configured), daily briefs, monthly reports, and CSV/XLSX/PDF export are all
real and tested end to end. Tier-2 social adapters (Reddit, YouTube, Bluesky,
etc.) are registered stubs only, pending official API credentials.

## Documentation

- `ARCHITECTURE.md` — system design and module map
- `DATABASE.md` — entity-relationship diagram and model notes
- `ADAPTER_GUIDE.md` — the source-adapter interface and how to add a provider
- `DEPLOYMENT.md` — local vs. Vercel/Supabase production deployment
- `TESTING.md` — how to run unit, integration, and e2e tests
- `COST_CONTROLS.md` — AI/API usage controls and budget guardrails
- `SECURITY.md` — security posture, dependency audit notes, and residual risks
- `DATA_RIGHTS.md` — Canadian privacy/data-rights considerations and legal-review flags
- `KNOWN_LIMITATIONS.md` — what's real vs. scaffolded, in detail
- `ROADMAP.md` — recommended next steps

## Environment variables

See `.env.example` for the full template with inline documentation. The app
runs with only `DATABASE_URL`, `REDIS_URL`, and `NEXTAUTH_SECRET` set —
`ANTHROPIC_API_KEY` and `NEWSAPI_KEY` are optional and unlock real AI analysis
/ licensed news search when provided; without them the app runs in clearly
labelled deterministic mock mode.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Start the Next.js app (port 3000) |
| `pnpm build` / `pnpm start` | Production build / start |
| `pnpm worker` | Start the background job workers (ingestion, AI analysis, alerts, digests) |
| `pnpm services:start` / `:stop` / `:status` | Manage the local Postgres/Redis dev services |
| `pnpm db:migrate` | Apply Prisma migrations |
| `pnpm db:seed` | Backfill a demo workspace for any org missing one |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm test` | Run the Vitest unit/integration suite |
| `pnpm test:e2e` | Run the Playwright end-to-end smoke test |
| `pnpm typecheck` | `tsc --noEmit` |

## License

See `LICENSE`.
