# Source adapter guide

Every media source implements the same `SourceAdapter` interface
(`lib/adapters/types.ts`), so providers can be added or removed without
touching ingestion, normalization, dedup, or analysis code.

```ts
interface SourceAdapter<TConfig> {
  id: string;                       // short provider id, e.g. "rss" — the registry key
                                     // (lib/adapters/registry.ts) is what matches the
                                     // Prisma AdapterType enum, not this field
  displayName: string;
  tier: 1 | 2;                      // 1 = real in this build, 2 = registered stub
  authRequired: boolean;
  authStatus(config): "none" | "configured" | "missing";
  supportedLanguages: string[];
  pollingFrequencyOptionsMins: number[];
  queryCapabilities: { booleanOperators; domainFilter; dateRange };
  rateLimit?: { requestsPerMinute };
  attribution: { requiresAttribution; text? };
  fetch(config, since?): Promise<RawFetchResult>;
  normalize(raw): NormalizedMention[];
}
```

`fetch()` does the network/IO call; `normalize()` is a pure function mapping
provider-specific shapes to the common `NormalizedMention` type. Both are
unit-testable in isolation — see `tests/unit/adapter-contract.test.ts`, which
asserts every adapter's `normalize()` output matches a shared zod schema.

## Tier 1 (real, implemented)

| Adapter | File | Auth | Notes |
|---|---|---|---|
| RSS/Atom | `lib/adapters/rss.ts` | None | Generic feed parser (`rss-parser`); works against any public feed URL |
| Google News search | `lib/adapters/google-news-rss.ts` | None | Builds `news.google.com/rss/search` URLs with `en-CA`/`fr-CA` locale support |
| GDELT | `lib/adapters/gdelt.ts` | None | GDELT DOC 2.0 API (`api.gdeltproject.org`) |
| NewsAPI-or-comparable | `lib/adapters/newsapi.ts` | `NEWSAPI_KEY` | `authStatus()` reports `"missing"` without a key — the adapter is hidden/disabled in the UI rather than silently mocked |
| CSV upload | `lib/adapters/csv-upload.ts` | None | Parses user-supplied CSV with a configurable column mapping; no network call |
| Manual URL | `lib/adapters/manual-url.ts` | None | Fetches one URL and extracts article content via `@mozilla/readability` |

## Tier 2 (registered stubs — not implemented)

`lib/adapters/tier2-stubs.ts`: Reddit, YouTube, Bluesky, Mastodon, Slack (as a
source), Microsoft Teams (as a source), Gmail, email-forwarded alerts, Google
Alerts email ingestion, and authorized recurring domain crawling. Each is
registered (`authStatus()` always `"missing"`, `fetch()` throws
`AdapterNotImplementedError`) so the architecture and UI visibly support them
without pretending they work. Implementing one requires:

1. Register an application with the platform's official API (Reddit Data
   API, YouTube Data API v3, Bluesky AT Protocol, a Mastodon app, Slack app
   with `incoming-webhook`/read scopes, Microsoft Graph, Gmail API).
2. Add the resulting OAuth/API-key fields to that adapter's `TConfig` type
   and implement `fetch()`/`normalize()` following the pattern in
   `lib/adapters/rss.ts` (or `newsapi.ts` for an auth-gated example).
3. Flip its `authStatus()` to check for the new credential and promote it out
   of `tier2-stubs.ts` into its own file, then register it in
   `lib/adapters/registry.ts`.
4. Add adapter-contract test fixtures mirroring
   `tests/unit/adapter-contract.test.ts`.

**Never** implement one of these by scraping a platform without its official
API, bypassing authentication, robots.txt, or CAPTCHAs — that's an explicit
constraint of this project, not just a Tier 2 label.

## Adding a brand-new adapter

1. Create `lib/adapters/<name>.ts` implementing `SourceAdapter`.
2. Add its enum value to `AdapterType` in `prisma/schema.prisma` and run a
   migration.
3. Register it in `lib/adapters/registry.ts` (`ADAPTER_REGISTRY`).
4. Add it to `ADAPTER_TYPES` in `lib/validation/source.ts` and, if it needs
   config fields in the UI, to `CONFIG_FIELDS` in
   `components/sources/source-manager.tsx`.
5. Write a contract test with a recorded fixture response.

## Ingestion pipeline (how a `SourceConnection` becomes `Mention`s)

See `ARCHITECTURE.md` § "Data flow: ingestion → dedup → analysis → alerts".
The short version: `lib/ingestion/run-source-connection.ts` calls
`adapter.fetch()` + `adapter.normalize()`, then
`lib/ingestion/normalize-and-store.ts` idempotently stores new mentions
(skipping already-seen canonical URLs) and runs deduplication.
