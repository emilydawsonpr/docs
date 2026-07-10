# Cost controls

## What's implemented

- **Rules-before-LLM**: `lib/ai/pipeline.ts` runs cheap deterministic checks
  before any Claude call: if a mention is a member of a `DuplicateCluster`
  whose canonical mention already has an `AnalysisResult`, the result is
  copied rather than re-analyzed (no LLM call, no re-analysis of unchanged
  syndicated content).
- **No API key, no spend**: without `ANTHROPIC_API_KEY`, every analysis runs
  through the deterministic mock engine — zero external API cost, and every
  row is labelled `engine: "MOCK"` so cost and provenance are always visible
  together.
- **Bounded retries**: the Claude call path retries at most once on schema
  validation failure, then falls back to the mock engine rather than looping
  (`lib/ai/client.ts`). Ingestion jobs cap retries via `MAX_ATTEMPTS` in
  `lib/ingestion/run-source-connection.ts`.
- **Idempotent ingestion**: polling the same feed repeatedly never
  re-analyzes already-stored mentions — `storeNormalizedMentions` skips any
  canonical URL already ingested for the project before it ever reaches the
  AI queue.
- **Per-source polling frequency**: each `SourceConnection` has its own
  `pollingFrequencyMins`; one-shot adapters (CSV upload, manual URL) are
  never auto-polled (`pollingFrequencyMins: 0`).
- **Usage tracking model**: `APIUsage` (per organization, provider, project,
  day) exists in the schema for call/token/cost rollups.

## What's scaffolded, not built

Per the honest scope ledger in `KNOWN_LIMITATIONS.md`, a polished in-app cost
dashboard (charts over `APIUsage`, budget alerts, a manual pause toggle, and
provider-fallback rules beyond the built-in Claude→mock fallback) is not
built in this session. The `APIUsage` model is ready to populate — the
missing piece is (a) writing to it from `lib/ai/client.ts` on every real
Claude call using the response's token usage, and (b) an admin UI reading it.
This is called out as a near-term roadmap item.

## Recommended before enabling real AI analysis at scale

1. Set a conservative `ANTHROPIC_MODEL` (a smaller/cheaper model) for initial
   rollout; the pipeline is model-agnostic via the env var.
2. Wire `APIUsage` writes into `analyzeWithClaude()` and add a daily-spend
   guard that flips the project (or org) back to mock mode if a threshold is
   exceeded.
3. Consider batching mentions ingested in the same tick into fewer, larger
   Claude calls if per-mention call volume becomes the dominant cost driver.
