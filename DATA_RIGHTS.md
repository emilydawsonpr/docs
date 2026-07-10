# Data rights and compliance notes (Canada)

This document flags where legal review is needed before commercial launch.
It is not legal advice.

## Content retention and copyright

- SignalWatch stores headline, excerpt, and (where the source's terms and
  robots.txt permit) body text for ingested mentions, plus a link back to
  the original source. Storing full article text long-term for commercial
  use may exceed fair-dealing bounds under the *Copyright Act* (Canada)
  depending on volume, retention period, and use — **have counsel review
  retention policy and consider a configurable retention/purge window**
  before storing full body text at scale or for paying customers. The
  `Project`/`Mention` schema supports adding a retention-days field and a
  scheduled purge job; neither is built in this session.
- The RSS/Google News/GDELT/manual-URL adapters do not bypass paywalls,
  authentication, robots.txt, or CAPTCHAs — this is enforced by design (no
  such bypass code exists), not just policy.

## Personal information (PIPEDA / provincial equivalents)

- Mentions may contain personal information about journalists, executives,
  or private individuals quoted in coverage. PIPEDA (and Quebec's Law 25,
  Alberta's PIPA, BC's PIPA where applicable) governs collection, use, and
  disclosure of personal information by commercial organizations.
  **Recommended before commercial launch**: a documented lawful basis for
  collecting third-party personal information appearing in monitored
  coverage, a data-subject access/deletion process, and breach-notification
  procedures.
- `AuditLog` and `Mention.rawProviderMetadata` may retain more raw data than
  is needed for the product's purpose — review what's stored in
  `rawProviderMetadata` per adapter and trim anything not required.
- User account data (name, email, password hash) is standard SaaS PII;
  ensure your privacy policy covers it and that deletion requests cascade
  correctly (Prisma's `onDelete: Cascade` relations handle DB-level cascade,
  but a documented, tested account-deletion *workflow* — as distinct from a
  raw DB delete — is not built in this session).

## AI analysis disclosure

- Every AI-generated field (sentiment, relevance, risk, prominence, topics,
  executive summary) is stored with an explicit `engine` label
  (`"MOCK"` or `"CLAUDE"`) and is never presented as a human judgment. This
  matters both for Canadian AI-transparency expectations (emerging under
  federal/provincial AI governance discussions) and for defensibility if a
  risk classification is later disputed.
- Mentions sent to Claude for analysis (headline, excerpt, body, source
  metadata) leave this application's infrastructure and are processed by
  Anthropic per its API terms. If any monitored content includes
  particularly sensitive personal information, review Anthropic's data
  handling terms against your organization's obligations before enabling
  `ANTHROPIC_API_KEY` in production.

## Reach/value metrics

- No reach, audience, or advertising-value-equivalency figures are
  fabricated anywhere in the codebase. `ManualMetric.confidence`
  (`KNOWN | ESTIMATED | UNAVAILABLE`) and `isLegacyAVE` exist specifically
  so any such figure a user enters is labelled honestly rather than
  presented as a verified fact — this is a product-integrity requirement,
  not just a legal one, but it also reduces misrepresentation risk in
  client-facing reports.

## Data residency

- This build's local dev database has no residency guarantee (it's a local
  process). For a Canadian-market production deployment, choose a Postgres
  region in Canada (e.g. Supabase's `ca-central-1`-equivalent region, or an
  Azure/AWS Canada region for a self-hosted instance) if data-residency
  commitments are made to customers, and confirm the same for any managed
  Redis and the Anthropic API call path (cross-border data transfer implications).

## Bottom line

Nothing in this codebase was built to evade a legal or ethical constraint —
every ingestion adapter respects official APIs/public feeds, every AI
judgment is labelled, and every estimated metric is flagged as such. The
items above are the specific places a privacy/IP lawyer should review before
this product handles real customer data commercially.
