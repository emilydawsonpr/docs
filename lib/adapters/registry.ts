import type { AdapterConfig, SourceAdapter } from "./types";
import { rssAdapter } from "./rss";
import { googleNewsRssAdapter } from "./google-news-rss";
import { gdeltAdapter } from "./gdelt";
import { newsApiAdapter } from "./newsapi";
import { csvUploadAdapter } from "./csv-upload";
import { manualUrlAdapter } from "./manual-url";
import {
  redditAdapter,
  youtubeAdapter,
  blueskyAdapter,
  mastodonAdapter,
  slackSourceAdapter,
  teamsSourceAdapter,
  gmailAdapter,
  emailForwardAdapter,
  googleAlertsEmailAdapter,
  manualCrawlAdapter,
} from "./tier2-stubs";

// Keys match the Prisma `AdapterType` enum.
export const ADAPTER_REGISTRY: Record<string, SourceAdapter<AdapterConfig>> = {
  RSS: rssAdapter,
  GOOGLE_NEWS_RSS: googleNewsRssAdapter,
  GDELT: gdeltAdapter,
  NEWSAPI: newsApiAdapter,
  CSV_UPLOAD: csvUploadAdapter,
  MANUAL_URL: manualUrlAdapter,
  MANUAL_CRAWL: manualCrawlAdapter,
  EMAIL_FORWARD: emailForwardAdapter,
  GOOGLE_ALERTS_EMAIL: googleAlertsEmailAdapter,
  REDDIT: redditAdapter,
  YOUTUBE: youtubeAdapter,
  BLUESKY: blueskyAdapter,
  MASTODON: mastodonAdapter,
  SLACK: slackSourceAdapter,
  TEAMS: teamsSourceAdapter,
  GMAIL: gmailAdapter,
};

export function getAdapter(adapterType: string): SourceAdapter<AdapterConfig> {
  const adapter = ADAPTER_REGISTRY[adapterType];
  if (!adapter) throw new Error(`Unknown adapter type: ${adapterType}`);
  return adapter;
}

export function listAvailableAdapters(): Array<{
  id: string;
  adapterType: string;
  displayName: string;
  tier: 1 | 2;
  authStatus: string;
}> {
  return Object.entries(ADAPTER_REGISTRY).map(([adapterType, adapter]) => ({
    id: adapter.id,
    adapterType,
    displayName: adapter.displayName,
    tier: adapter.tier,
    authStatus: adapter.authStatus({}),
  }));
}
