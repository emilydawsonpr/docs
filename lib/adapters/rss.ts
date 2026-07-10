import Parser from "rss-parser";
import type { AdapterConfig, AuthStatus, NormalizedMention, RawFetchResult, SourceAdapter } from "./types";

export interface RssAdapterConfig extends AdapterConfig {
  feedUrl: string;
  language?: string;
  sourceNameOverride?: string;
}

const parser = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "SignalWatchBot/0.1 (+media monitoring; contact: admin@example.com)" },
});

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export const rssAdapter: SourceAdapter<RssAdapterConfig> = {
  id: "rss",
  displayName: "RSS / Atom feed",
  sourceTypeHint: "UNKNOWN",
  tier: 1,
  authRequired: false,
  authStatus: (): AuthStatus => "none",
  supportedLanguages: ["en", "fr", "*"],
  pollingFrequencyOptionsMins: [15, 30, 60, 120, 360],
  queryCapabilities: { booleanOperators: false, domainFilter: false, dateRange: false },
  rateLimit: { requestsPerMinute: 30 },
  attribution: { requiresAttribution: true, text: "Content sourced from the publisher's public RSS/Atom feed." },

  async fetch(config, since) {
    if (!config.feedUrl) throw new Error("RSS adapter requires a feedUrl");
    const feed = await parser.parseURL(config.feedUrl);
    const items = (feed.items ?? []).filter((item) => {
      if (!since || !item.isoDate) return true;
      return new Date(item.isoDate) > since;
    });
    return { items: items.map((item) => ({ ...item, __feedTitle: feed.title })), fetchedAt: new Date() };
  },

  normalize(raw: RawFetchResult): NormalizedMention[] {
    return raw.items.map((rawItem) => {
      const item = rawItem as Parser.Item & { __feedTitle?: string };
      const link = item.link ?? "";
      const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();
      return {
        providerRecordId: item.guid ?? link,
        canonicalUrl: link,
        originalUrl: link,
        sourceName: item.__feedTitle ?? domainOf(link),
        sourceDomain: domainOf(link),
        headline: item.title ?? "(untitled)",
        excerpt: item.contentSnippet ?? undefined,
        bodyText: item.content ?? (item as Record<string, unknown>)["content:encoded"] as string | undefined ?? item.contentSnippet ?? undefined,
        author: item.creator ?? undefined,
        publishedAt,
        language: "en",
        rawProviderMetadata: item as Record<string, unknown>,
      };
    });
  },
};
