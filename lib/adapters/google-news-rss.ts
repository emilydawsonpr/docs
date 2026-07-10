import Parser from "rss-parser";
import type { AdapterConfig, AuthStatus, NormalizedMention, RawFetchResult, SourceAdapter } from "./types";

export interface GoogleNewsRssConfig extends AdapterConfig {
  query: string;
  language: "en" | "fr";
  country?: string; // ISO country code, defaults to CA
}

interface GoogleNewsItem extends Parser.Item {
  source?: { _: string; $: { url?: string } } | string;
}

const parser: Parser<unknown, GoogleNewsItem> = new Parser({
  timeout: 15000,
  headers: { "User-Agent": "SignalWatchBot/0.1 (+media monitoring; contact: admin@example.com)" },
  customFields: { item: ["source"] },
});

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function buildSearchUrl(config: GoogleNewsRssConfig): string {
  const country = (config.country ?? "CA").toUpperCase();
  const hl = `${config.language}-${country}`;
  const ceid = `${country}:${config.language}`;
  const params = new URLSearchParams({ q: config.query, hl, gl: country, ceid });
  return `https://news.google.com/rss/search?${params.toString()}`;
}

export const googleNewsRssAdapter: SourceAdapter<GoogleNewsRssConfig> = {
  id: "google-news-rss",
  displayName: "Google News (search)",
  sourceTypeHint: "NATIONAL",
  tier: 1,
  authRequired: false,
  authStatus: (): AuthStatus => "none",
  supportedLanguages: ["en", "fr"],
  pollingFrequencyOptionsMins: [30, 60, 120, 360],
  queryCapabilities: { booleanOperators: true, domainFilter: false, dateRange: false },
  rateLimit: { requestsPerMinute: 10 },
  attribution: {
    requiresAttribution: true,
    text: "Results provided by Google News search; article content and rights belong to the originating publisher.",
  },

  async fetch(config, since) {
    if (!config.query) throw new Error("Google News RSS adapter requires a query");
    const url = buildSearchUrl(config);
    const feed = await parser.parseURL(url);
    const items = (feed.items ?? []).filter((item) => {
      if (!since || !item.isoDate) return true;
      return new Date(item.isoDate) > since;
    });
    return { items, fetchedAt: new Date() };
  },

  normalize(raw: RawFetchResult): NormalizedMention[] {
    return raw.items.map((rawItem) => {
      const item = rawItem as GoogleNewsItem;
      const link = item.link ?? "";
      const sourceObj = item.source;
      const sourceName =
        typeof sourceObj === "string" ? sourceObj : sourceObj?._ ?? item.creator ?? domainOf(link);
      const sourceUrl = typeof sourceObj === "object" ? sourceObj?.$?.url : undefined;
      const sourceDomain = sourceUrl ? domainOf(sourceUrl) : domainOf(link);
      const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();

      return {
        providerRecordId: item.guid ?? link,
        canonicalUrl: link,
        originalUrl: link,
        sourceName,
        sourceDomain,
        headline: (item.title ?? "(untitled)").replace(new RegExp(`\\s*-\\s*${sourceName}$`), ""),
        excerpt: item.contentSnippet ?? undefined,
        bodyText: item.content ?? item.contentSnippet ?? undefined,
        publishedAt,
        language: "en",
        rawProviderMetadata: item as unknown as Record<string, unknown>,
      };
    });
  },
};
