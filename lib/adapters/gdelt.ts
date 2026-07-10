import type { AdapterConfig, AuthStatus, NormalizedMention, RawFetchResult, SourceAdapter } from "./types";

export interface GdeltConfig extends AdapterConfig {
  query: string;
  maxRecords?: number;
}

interface GdeltArticle {
  url: string;
  title: string;
  seendate: string; // e.g. "20260115T120000Z"
  domain: string;
  language?: string;
  sourcecountry?: string;
  socialimage?: string;
}

function parseGdeltDate(seendate: string): Date {
  // Format: YYYYMMDDTHHMMSSZ
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(seendate);
  if (!match) return new Date();
  const [, y, mo, d, h, mi, s] = match;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
}

export const gdeltAdapter: SourceAdapter<GdeltConfig> = {
  id: "gdelt",
  displayName: "GDELT global news index",
  sourceTypeHint: "UNKNOWN",
  tier: 1,
  authRequired: false,
  authStatus: (): AuthStatus => "none",
  supportedLanguages: ["en", "fr", "*"],
  pollingFrequencyOptionsMins: [60, 120, 360],
  queryCapabilities: { booleanOperators: false, domainFilter: false, dateRange: false },
  rateLimit: { requestsPerMinute: 5 },
  attribution: {
    requiresAttribution: true,
    text: "Indexed via the GDELT Project (gdeltproject.org); article content and rights belong to the originating publisher.",
  },

  async fetch(config) {
    if (!config.query) throw new Error("GDELT adapter requires a query");
    const params = new URLSearchParams({
      query: config.query,
      mode: "artlist",
      maxrecords: String(config.maxRecords ?? 75),
      format: "json",
      sort: "datedesc",
    });
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${params.toString()}`, {
      headers: { "User-Agent": "SignalWatchBot/0.1 (+media monitoring; contact: admin@example.com)" },
    });
    if (!res.ok) throw new Error(`GDELT request failed: HTTP ${res.status}`);
    const data = (await res.json().catch(() => ({ articles: [] }))) as { articles?: GdeltArticle[] };
    return { items: data.articles ?? [], fetchedAt: new Date() };
  },

  normalize(raw: RawFetchResult): NormalizedMention[] {
    return (raw.items as GdeltArticle[]).map((article) => ({
      canonicalUrl: article.url,
      originalUrl: article.url,
      sourceName: article.domain,
      sourceDomain: article.domain,
      headline: article.title ?? "(untitled)",
      publishedAt: parseGdeltDate(article.seendate),
      language: article.language?.slice(0, 2).toLowerCase() ?? "en",
      country: article.sourcecountry,
      imageUrl: article.socialimage,
      rawProviderMetadata: article as unknown as Record<string, unknown>,
    }));
  },
};
