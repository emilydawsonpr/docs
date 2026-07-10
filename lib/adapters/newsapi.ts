import type { AdapterConfig, AuthStatus, NormalizedMention, RawFetchResult, SourceAdapter } from "./types";
import { AdapterAuthMissingError } from "./types";

export interface NewsApiConfig extends AdapterConfig {
  query: string;
  language?: string;
}

interface NewsApiArticle {
  url: string;
  title: string;
  description?: string;
  content?: string;
  author?: string;
  publishedAt: string;
  source: { name: string };
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/**
 * NewsAPI-or-comparable licensed news adapter. Ships code-complete but is
 * only ever active when NEWSAPI_KEY is configured — with no key it reports
 * authStatus "missing" and the ingestion worker/UI hide it, rather than
 * silently mocking results.
 */
export const newsApiAdapter: SourceAdapter<NewsApiConfig> = {
  id: "newsapi",
  displayName: "NewsAPI (licensed)",
  sourceTypeHint: "UNKNOWN",
  tier: 1,
  authRequired: true,
  authStatus: (): AuthStatus => (process.env.NEWSAPI_KEY ? "configured" : "missing"),
  supportedLanguages: ["en", "fr"],
  pollingFrequencyOptionsMins: [60, 120, 360],
  queryCapabilities: { booleanOperators: true, domainFilter: true, dateRange: true },
  rateLimit: { requestsPerMinute: 5 },
  attribution: { requiresAttribution: true, text: "Powered by NewsAPI.org." },

  async fetch(config) {
    const key = process.env.NEWSAPI_KEY;
    if (!key) throw new AdapterAuthMissingError("newsapi");
    const params = new URLSearchParams({
      q: config.query,
      language: config.language ?? "en",
      sortBy: "publishedAt",
      apiKey: key,
    });
    const res = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`);
    if (!res.ok) throw new Error(`NewsAPI request failed: HTTP ${res.status}`);
    const data = (await res.json()) as { articles?: NewsApiArticle[] };
    return { items: data.articles ?? [], fetchedAt: new Date() };
  },

  normalize(raw: RawFetchResult): NormalizedMention[] {
    return (raw.items as NewsApiArticle[]).map((article) => ({
      canonicalUrl: article.url,
      originalUrl: article.url,
      sourceName: article.source?.name ?? domainOf(article.url),
      sourceDomain: domainOf(article.url),
      headline: article.title,
      excerpt: article.description,
      bodyText: article.content,
      author: article.author,
      publishedAt: new Date(article.publishedAt),
      language: "en",
      rawProviderMetadata: article as unknown as Record<string, unknown>,
    }));
  },
};
