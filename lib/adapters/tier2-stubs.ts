import type { AdapterConfig, AuthStatus, SourceAdapter } from "./types";
import { AdapterNotImplementedError } from "./types";

/**
 * Tier 2 adapters: registered so the architecture visibly supports them and
 * the UI can show "coming soon / requires OAuth" — but fetch() is
 * intentionally unimplemented. No scraping or auth-bypass is performed for
 * any of these. Implementing each requires the platform's official API and
 * an approved developer application (documented in ADAPTER_GUIDE.md).
 */
function stub(id: string, displayName: string, languages: string[] = ["en", "fr"]): SourceAdapter<AdapterConfig> {
  return {
    id,
    displayName,
    sourceTypeHint: "SOCIAL",
    tier: 2,
    authRequired: true,
    authStatus: (): AuthStatus => "missing",
    supportedLanguages: languages,
    pollingFrequencyOptionsMins: [60],
    queryCapabilities: { booleanOperators: false, domainFilter: false, dateRange: false },
    attribution: { requiresAttribution: true },
    async fetch() {
      throw new AdapterNotImplementedError(id);
    },
    normalize() {
      return [];
    },
  };
}

export const redditAdapter = stub("reddit", "Reddit (official Data API)");
export const youtubeAdapter = stub("youtube", "YouTube Data API");
export const blueskyAdapter = stub("bluesky", "Bluesky");
export const mastodonAdapter = stub("mastodon", "Mastodon-compatible servers");
export const slackSourceAdapter = stub("slack-source", "Slack (as a source)");
export const teamsSourceAdapter = stub("teams-source", "Microsoft Teams (as a source)");
export const gmailAdapter = stub("gmail", "Gmail-forwarded mentions");
export const emailForwardAdapter = stub("email-forward", "Email-forwarded alerts");
export const googleAlertsEmailAdapter = stub("google-alerts-email", "Google Alerts (email ingestion)");
export const manualCrawlAdapter = stub("manual-crawl", "Authorized recurring domain crawl");
