# Roadmap

Recommended next development priorities, roughly in order.

## Near-term (before commercial pilot)

1. **Provide `ANTHROPIC_API_KEY` and verify real Claude analysis end to end**
   against a handful of real articles — the code path is built and
   schema-validated but has not been exercised against the live API in this
   session.
2. **Upgrade to Next.js 15** (async `params`/`searchParams`, React 19) to
   pick up the security patches unavailable in the 14.x line — see
   `SECURITY.md` for the exact CVE list and risk assessment.
3. ~~**Settings page**~~ Done — see `KNOWN_LIMITATIONS.md`. Remaining
   related follow-up: a project-membership management UI (invite/remove
   users, set project-level role overrides) is still onboarding/API-only.
4. **Wire `APIUsage` tracking** into the real Claude call path and build a
   minimal cost dashboard + a per-project/org spend cap that flips back to
   mock mode automatically (see `COST_CONTROLS.md`).
5. **Legal review** per `DATA_RIGHTS.md` — retention policy, PIPEDA/Law 25
   posture, and an account-deletion *workflow* (not just cascading DB
   deletes) before onboarding real customer data.
6. **Verify live ingestion against real public feeds** on a machine/
   deployment without this sandbox's egress restrictions (RSS, Google News,
   GDELT were built and proven against a local fixture server here, but not
   against the real internet — see `KNOWN_LIMITATIONS.md`).

## Medium-term

7. Implement the remaining report templates (Weekly Coverage, Campaign Wrap,
   Crisis Monitoring Brief, Executive Competitor Report) by following the
   `lib/reports/daily-brief.ts` / `monthly-report.ts` pattern.
8. Add topic-specific and source-type-specific share-of-voice breakdowns.
9. Build the observability admin page (failed-job dashboard, AI parsing-error
   log, alert-delivery-outcome view) on top of the already-real
   `IngestionJob`/`AlertEvent` data.
10. Add an explicit CSRF token to mutating API routes as defense-in-depth
    beyond `SameSite=Lax` cookies.
11. Implement one or two Tier 2 adapters end to end (Reddit and/or YouTube
    are the most self-contained official APIs to start with) following
    `ADAPTER_GUIDE.md`.
12. Email-forwarded alert / Google Alerts ingestion via an inbound-email
    webhook provider (e.g. Postmark/SendGrid inbound parse, or an IMAP
    poller) — needs a real mailbox, which wasn't available in this sandbox.

## Longer-term

13. Row-level security (RLS) at the Postgres level as defense-in-depth for
    multi-tenant isolation, especially if moving to Supabase.
14. Multi-page authorized-domain crawling (beyond single-URL manual
    submission), with an explicit per-domain authorization record.
15. A feedback loop where analyst corrections become project-specific
    few-shot examples fed back into the Claude prompt (flagged in the
    original spec as optional/future).
16. Expand the Canadian source directory (currently a small curated seed set
    via the `Source` model) into a maintained list of national/regional/
    local/trade/community outlets with province tagging.
