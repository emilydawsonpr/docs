# Testing guide

## Running tests

```bash
bash scripts/dev-services.sh start   # integration tests hit the real local Postgres
pnpm test                            # Vitest: unit + integration (79 tests as of this build)
pnpm test:watch                      # watch mode
pnpm test:e2e                        # Playwright end-to-end smoke test (needs `pnpm dev` or lets Playwright start it)
pnpm typecheck                       # tsc --noEmit
pnpm build                           # full production build (also type-checks)
```

Integration tests (`tests/integration/*.test.ts`) create and clean up their
own throwaway `Organization`/`Project`/`User` rows against the real local
Postgres database configured by `DATABASE_URL` — they do not use a mocked
database. Run `bash scripts/dev-services.sh start` first.

## What's covered

| Area | File(s) |
|---|---|
| Boolean query parser (grammar, precedence, validator) | `tests/unit/boolean-parser.test.ts` |
| Deduplication (URL canonicalization, title normalization, simhash) | `tests/unit/dedup.test.ts` |
| Spike/anomaly detection (rolling avg/z-score) | `tests/unit/spike-detection.test.ts` |
| Mock AI analysis engine | `tests/unit/mock-engine.test.ts` |
| AI structured-output schema validation | `tests/unit/ai-schema.test.ts` |
| Source-adapter contract (`normalize()` output shape) | `tests/unit/adapter-contract.test.ts` |
| Alert rules engine | `tests/unit/rules-engine.test.ts` |
| Ingestion pipeline (store, idempotency, dedup clustering) | `tests/integration/ingestion.test.ts` |
| RBAC / project access resolution | `tests/integration/authz.test.ts` |
| Report generation (traceable sections, HTML rendering) | `tests/integration/reports.test.ts` |
| Golden-path e2e: register → create project → save/test/activate query → dashboard | `tests/e2e/golden-path.spec.ts` |

## The 10 minimum workflows the spec calls out, and where they're covered

1. **Create a project** — `tests/e2e/golden-path.spec.ts`, `tests/integration/authz.test.ts`
2. **Build and validate a Boolean query** — `tests/unit/boolean-parser.test.ts`, e2e test
3. **Scheduled ingestion retrieves results** — `tests/integration/ingestion.test.ts`; manually verified end-to-end against a local fixture RSS feed (see `scripts/fixture-feed.mjs`) and the BullMQ scheduler/worker, since this sandbox's egress policy blocks public news domains (see `KNOWN_LIMITATIONS.md`)
4. **Results are normalized** — `tests/unit/adapter-contract.test.ts`, `tests/integration/ingestion.test.ts`
5. **Duplicate items are clustered** — `tests/unit/dedup.test.ts`, `tests/integration/ingestion.test.ts`
6. **AI analysis returns valid structured data** — `tests/unit/ai-schema.test.ts`, `tests/unit/mock-engine.test.ts`
7. **User edits an incorrect classification** — manually verified via `PATCH /api/projects/:id/mentions/:id` (audit-logged); covered indirectly by the coverage-feed correction UI
8. **Dashboard metrics update** — manually verified with real ingested/analyzed data (see screenshots referenced in the final report); `lib/analytics/dashboard-metrics.ts` is exercised by the demo seed
9. **A high-risk alert is triggered** — `tests/unit/rules-engine.test.ts`; manually verified end-to-end (CSV-ingested mention with a crisis-term hit → mock analysis → alert rule match → in-app `AlertEvent` delivered)
10. **A report is exported** — `tests/integration/reports.test.ts` (generation); manually verified CSV/XLSX/PDF export produce real, openable files

## Testing an adapter against a live feed without hitting a blocked domain

`scripts/fixture-feed.mjs` runs a tiny local HTTP server serving real RSS 2.0
XML, so the RSS adapter's `fetch()` (real HTTP request + XML parse) can be
exercised genuinely without needing outbound internet access:

```bash
node scripts/fixture-feed.mjs 4001 &
# then connect a SourceConnection with feedUrl http://localhost:4001/feed.xml
```
