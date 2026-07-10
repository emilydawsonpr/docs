import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import type { AdapterConfig, AuthStatus, NormalizedMention, RawFetchResult, SourceAdapter } from "./types";

export interface ManualUrlConfig extends AdapterConfig {
  url: string;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export const manualUrlAdapter: SourceAdapter<ManualUrlConfig> = {
  id: "manual-url",
  displayName: "Manual URL submission",
  sourceTypeHint: "UNKNOWN",
  tier: 1,
  authRequired: false,
  authStatus: (): AuthStatus => "none",
  supportedLanguages: ["en", "fr", "*"],
  pollingFrequencyOptionsMins: [0], // one-shot
  queryCapabilities: { booleanOperators: false, domainFilter: false, dateRange: false },
  attribution: { requiresAttribution: true, text: "Content extracted from the analyst-submitted public URL." },

  async fetch(config) {
    if (!config.url) throw new Error("Manual URL adapter requires a url");
    const res = await fetch(config.url, {
      headers: { "User-Agent": "SignalWatchBot/0.1 (+media monitoring; contact: admin@example.com)" },
      redirect: "follow",
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch ${config.url}: HTTP ${res.status}`);
    }
    const html = await res.text();
    return { items: [{ html, url: res.url || config.url }], fetchedAt: new Date() };
  },

  normalize(raw: RawFetchResult): NormalizedMention[] {
    const { html, url } = raw.items[0] as { html: string; url: string };
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    const title = article?.title ?? dom.window.document.title ?? "(untitled)";
    return [
      {
        canonicalUrl: url,
        originalUrl: url,
        sourceName: article?.siteName ?? domainOf(url),
        sourceDomain: domainOf(url),
        headline: title,
        excerpt: article?.excerpt ?? undefined,
        bodyText: article?.textContent?.slice(0, 20000) ?? undefined,
        author: article?.byline ?? undefined,
        publishedAt: new Date(),
        language: article?.lang ?? "en",
        rawProviderMetadata: { extractedLength: article?.length },
      },
    ];
  },
};
