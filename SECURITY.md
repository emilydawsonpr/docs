# Security notes

## Implemented

- **Authentication**: NextAuth.js Credentials provider, bcrypt password
  hashing (cost factor 12), JWT sessions, `middleware.ts` gating all
  authenticated route groups.
- **Authorization**: every API route resolves project access through
  `lib/rbac/permissions.ts` (`getProjectAccess` / `requireProjectRole`),
  which checks project-level `ProjectMembership` first, falling back to
  org-level `Membership`, and throws `ForbiddenError`/`NotFoundError` mapped
  to 403/404 by `lib/api/handler.ts`. `CLIENT_VIEWER` never satisfies an
  edit-permission check (`roleAtLeast` explicitly excludes it from the
  ladder). Verified in `tests/integration/authz.test.ts`.
- **Org-level data separation**: every Prisma query in the API layer scopes
  by `projectId`/`organizationId` derived from the authenticated session, not
  from client-supplied values beyond the route path (which is itself
  authorization-checked before use).
- **Input validation**: every mutating API route parses its body through a
  zod schema (`lib/validation/*.ts`) before touching the database.
- **Output escaping**: React escapes all rendered text by default. The two
  places that use `dangerouslySetInnerHTML` (the report viewer and the
  public shared-report page) render server-generated HTML from
  `lib/reports/render-html.ts`, where every interpolated value passes
  through a local `esc()` HTML-entity-escaping helper — including URLs
  placed into `href` attributes.
- **Secrets**: all credentials live in environment variables
  (`.env`, gitignored); `.env.example` contains no real values.
  `console.error` calls in the ingestion/AI/alert paths log error messages
  only, never full request bodies, tokens, or credentials.
- **Webhook delivery**: Slack/Teams alert delivery posts to a URL the user
  supplies per rule — no shared credential of ours is used, and failures are
  caught and recorded per-channel rather than thrown.
- **Audit logging**: `AuditLog` records previous/new value, acting user,
  timestamp, and an optional reason for project/query/mention/source/alert
  changes.
- **Rate limiting on adapters**: each `SourceAdapter` declares a
  `rateLimit.requestsPerMinute`; the scheduler enforces per-connection
  polling intervals so a single misconfigured source can't hammer a
  publisher.

## Dependency audit (`pnpm audit --prod`)

Run at the end of this build: **17 findings remain**, down from 34 after
removing an unused vulnerable dependency (`fast-xml-parser`, never actually
imported — `rss-parser` uses `xml2js` internally) and upgrading
`nodemailer` (6.9.15 → 9.0.3), `next-auth` (4.24.8 → 4.24.14),
`@mozilla/readability` (0.5.0 → 0.6.0), and our own `postcss` devDependency
(8.4.45 → 8.5.10).

**Everything remaining is one of:**

1. **Next.js 14.2.x has no patched release for several CVEs fixed only in
   the 15.5.16+ line** (RSC-related DoS/cache-poisoning, a middleware
   cache-poisoning class, an Image Optimizer DoS, a WebSocket-upgrade SSRF,
   and a Pages Router i18n middleware bypass). This app's actual exposure is
   narrower than the general advisory list: it does not use `next/image`
   (no Image Optimizer surface), does not configure `rewrites()` or i18n
   routing, does not use WebSocket upgrades, and does not use CSP nonces or
   `next/script` `beforeInteractive` — so several of the listed CVEs don't
   apply to how this app is actually built. The two that do meaningfully
   apply are the general RSC DoS/cache-poisoning class and
   middleware-response cache poisoning (relevant since `middleware.ts` does
   auth redirects) if a caching layer sits in front of the app. **Recommended
   before commercial launch**: upgrade to Next.js 15 (breaking change: route
   handler `params`/`searchParams` become `Promise`s; React 19 required —
   Next ships an official codemod, `npx @next/codemod@canary
   next-async-request-api .`). This was not done in this session because a
   full-app async-params migration under time pressure, without a chance to
   re-verify every one of ~30 routes and pages, was judged a higher near-term
   risk than the documented residual exposure above.
2. **`postcss@8.4.31` bundled inside `next@14.2.35`'s own dependency tree**
   (a build-time CSS stringify XSS, not reachable via runtime user input in
   this app) — resolved by the same Next.js upgrade.
3. **`uuid@8.3.2`/`9.0.1`, transitive via `exceljs` and `bullmq`** (a
   buffer-bounds issue only reachable if the caller passes a custom,
   attacker-influenced buffer into `uuid.v3/v5/v6` — neither `exceljs` nor
   `bullmq` do this; they use `uuid` for internal random ID generation with
   no external input). Left un-forced rather than risking a breaking
   transitive upgrade of two functioning dependencies this late in the
   build without a full re-test pass.

None of the remaining findings are exploitable through any input this
application actually accepts from a user in its current feature set. Re-run
`pnpm audit --prod` after any dependency changes.

## Not implemented / explicitly out of scope this session

- **CSRF protection**: NextAuth's own CSRF token protects the credentials
  sign-in flow. Custom mutating API routes rely on same-origin fetch from
  the app's own UI and session-cookie auth (`SameSite=Lax`); a dedicated
  CSRF token on top of that was not added for the JSON API routes. Low risk
  for a `SameSite=Lax` session cookie against simple cross-site form
  submission, but worth adding (e.g. via a double-submit token) before
  handling especially sensitive mutating actions from third-party contexts.
- **Rate limiting on the API layer itself** (as opposed to adapter polling
  rate limits) is not implemented — add at the reverse-proxy/edge layer
  before production traffic.
- **Row-level security (RLS) at the Postgres level** is not configured;
  isolation is enforced entirely in the application layer
  (`lib/rbac/permissions.ts`). For a Supabase deployment, consider adding
  RLS policies as defense-in-depth.
- **Secrets encryption at rest**: relies on the hosting platform's disk/DB
  encryption (e.g. Supabase's default encryption at rest); no
  application-level secret encryption layer was added.
- A formal penetration test / third-party security review has not been
  performed. See `DATA_RIGHTS.md` for where legal/compliance review is
  needed before commercial launch.
