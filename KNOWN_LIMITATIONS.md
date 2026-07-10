# Known limitations

Honest accounting of what's genuinely functional vs. scaffolded, as of this
build. Nothing below is hidden from the product itself either — mock AI
output is always labelled, demo data is always banner-flagged, and unbuilt
adapters are visibly disabled in the UI rather than silently absent.

## Genuinely functional (built, run, and verified in this session)

- Registration, login, RBAC (Owner/Administrator/Analyst/Viewer/Client
  Viewer, with project-level overrides), full audit trail on corrections.
- Project creation, onboarding wizard proposing an initial Boolean query
  (never auto-activated), visual + expert Boolean query builder with a
  hand-written parser/validator and "test against recent results."
- Real ingestion: RSS/Atom (verified against a local fixture feed — see
  below), Google News RSS, GDELT, CSV upload, manual URL submission — all
  keyless, all going through the same fetch→normalize→dedup→analyze
  pipeline. BullMQ + Redis background jobs (ingestion, analysis, alerts,
  digests) with a real scheduler tick, verified end to end including
  idempotent re-polling.
- Deduplication: canonical URL normalization, title normalization, 64-bit
  simhash clustering (empirically calibrated threshold — see
  `tests/unit/dedup.test.ts`), analyst merge/unmerge.
- AI analysis pipeline: real Claude integration code (tool-use forced JSON,
  zod-validated, one retry then mock fallback) — **run only in mock mode
  this session, since no `ANTHROPIC_API_KEY` was available in this sandbox**.
  The mock engine is a real deterministic rules engine (bilingual sentiment
  lexicon, term-overlap relevance, crisis-term risk scoring), not a
  placeholder — every row is labelled `engine: "MOCK"`.
- Human review/correction with audit trail; coverage feed with
  search/filter/sort/bulk actions/expandable detail.
- Dashboards (6 charts + summary cards) computed live from stored data,
  share of voice (total-placement + unique-story + positive variants),
  rolling-average/z-score spike detection — verified visually via
  Playwright screenshots against real ingested and demo data.
- Alerts: rule configuration, mention-scoped triggers (9 types) and
  periodic spike/sentiment-deterioration triggers, in-app delivery (always
  real), Slack/Teams webhook delivery (real HTTP POST to a user-supplied
  URL), email via SMTP if configured, duplicate throttling, quiet hours.
  Verified end to end (crisis-term mention → risk score → alert fired →
  delivered).
- Reporting: daily brief and monthly PR report generation (every claim
  traces to a real `mentionId`), CSV/XLSX/PDF export (PDF via real headless
  Chromium rendering, verified by reading the generated PDF's text/table
  content), shareable read-only public report links.
- A fully synthetic, clearly-labelled demo workspace ("Aurora Botanicals"),
  auto-provisioned per organization at registration, structurally isolated
  via `Project.isDemo`/`Mention.isDemo` — verified to include Canadian and
  international-flavoured coverage, English and French mentions, all four
  sentiment classes, a syndicated duplicate cluster, competitor coverage, a
  real detected volume spike, a high-risk mention, one corrected AI
  classification with an audit-log entry, and a generated daily brief and
  monthly report.
- 79 Vitest unit/integration tests + 1 Playwright e2e smoke test, all
  passing; `pnpm build`/`tsc --noEmit` clean.

## Scaffolded / partial (documented trade-offs, not oversights)

- **NewsAPI adapter**: code-complete, contract-tested with a fixture, but
  never called against the live API — no `NEWSAPI_KEY` in this sandbox.
- **Tier 2 adapters** (Reddit, YouTube, Bluesky, Mastodon, Slack/Teams as
  *sources*, Gmail, email-forwarded alerts, Google Alerts email ingestion,
  recurring authorized domain crawling beyond single-URL submission):
  registered stubs with a documented path to real implementation in
  `ADAPTER_GUIDE.md`. None scrape or bypass authentication.
- **Live public-internet ingestion** (real CBC/Google News/GDELT/etc.
  domains): this sandbox's outbound egress policy returns HTTP 403 for
  every general news domain tested (only package registries and
  `*.anthropic.com` are allow-listed) — confirmed via the proxy's own
  status endpoint, not assumed. The adapter *code* is real and would fetch
  live data in any normal deployment or local dev machine; in this session,
  live ingestion was proven instead against a local fixture HTTP server
  (`scripts/fixture-feed.mjs`) serving real RSS XML, which exercises the
  exact same fetch/parse/normalize/dedup code path. This is a sandbox
  network-policy constraint, not a code limitation — worth re-verifying
  against real feeds on a normal machine or in the deployed environment.
- **Report template library**: Daily Brief and Monthly PR are fully built;
  Weekly Coverage, Campaign Wrap, Crisis Monitoring Brief, and Executive
  Competitor Report exist as `ReportTemplateType` enum values and share the
  same renderer/export pipeline, but don't yet have their own
  content-assembly function (`lib/reports/daily-brief.ts` and
  `monthly-report.ts` are the two implemented builders — a third template
  is a copy-and-adjust of either).
- **Share-of-voice variants**: total-placement, unique-story, and positive
  share are computed and shown; topic-specific and source-type-specific
  breakdowns are structurally supported (the `Mention` fields exist) but no
  dedicated UI/query slices them that way yet.
- **Cost-control admin UI**: `APIUsage` model exists; nothing writes to it
  yet (no real Claude calls were made to measure), and there's no dashboard
  reading it. See `COST_CONTROLS.md`.
- **Observability admin page**: ingestion job status, AI/adapter errors,
  and alert delivery outcomes are all real, queryable rows
  (`IngestionJob`, `AlertEvent.deliveryStatus`, worker `console.error`
  logs) — there is no dedicated "failed-job dashboard" UI surfacing them
  yet; querying via `pnpm db:studio` works today.
- ~~**Settings/admin pages**~~ **Resolved**: a post-onboarding Settings page
  (`/projects/[projectId]/settings`) now exists for editing project
  details (timezone/languages/regions/focus cities/crisis terms), the
  primary brand, competitors (add/edit/remove), and key messages
  (add/remove) — `lib/validation/brand.ts`, `lib/validation/key-message.ts`,
  `app/api/projects/[projectId]/brands/**`,
  `app/api/projects/[projectId]/key-messages/**`. RBAC-gated at ANALYST+
  (`canEditMonitoringLogic`), full audit-log trail, primary brand cannot be
  deleted. Verified end to end against the running dev server (create/edit/
  delete competitor, add/remove key message, viewer correctly blocked with
  403, audit log rows confirmed via direct query).
- **CSRF token on JSON API routes**: relies on `SameSite=Lax` session
  cookies rather than an explicit anti-CSRF token; see `SECURITY.md`.
- **Dependency vulnerabilities**: 17 remain after this session's cleanup
  (down from 34), all traced to Next.js 14.x lacking a backported patch for
  several CVEs (fixed only in 15.5.16+) plus two low-risk transitive
  packages. Full assessment and recommended fix in `SECURITY.md`.
- **`DuplicateCluster.isSyndicated`**: computed by comparing member
  `coverageType` values, which are only populated by the AI analysis step
  that runs *after* clustering — so the flag can under-report syndication
  immediately after ingestion, before analysis completes, or when clustering
  happens synchronously ahead of analysis (as in the demo seed). The cluster
  itself (and its member count) is always correct; only this specific
  boolean can lag.

## Explicitly not attempted (out of scope by design, not by oversight)

- Bypassing paywalls, robots.txt, authentication, or CAPTCHAs anywhere.
- Fabricating reach, audience, or advertising-value figures.
- Presenting mock AI output as if it were a real model's judgment.
- Scraping any social platform without its official API.
