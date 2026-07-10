import Papa from "papaparse";
import type { AdapterConfig, AuthStatus, NormalizedMention, RawFetchResult, SourceAdapter } from "./types";

export interface CsvUploadConfig extends AdapterConfig {
  csvContent: string;
  columnMapping: {
    headline: string;
    url: string;
    publishedAt: string;
    author?: string;
    sourceName?: string;
    bodyText?: string;
    language?: string;
  };
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

export const csvUploadAdapter: SourceAdapter<CsvUploadConfig> = {
  id: "csv-upload",
  displayName: "CSV upload",
  sourceTypeHint: "UNKNOWN",
  tier: 1,
  authRequired: false,
  authStatus: (): AuthStatus => "none",
  supportedLanguages: ["en", "fr", "*"],
  pollingFrequencyOptionsMins: [0], // one-shot, not polled
  queryCapabilities: { booleanOperators: false, domainFilter: false, dateRange: false },
  attribution: { requiresAttribution: false },

  async fetch(config) {
    if (!config.csvContent) throw new Error("CSV upload adapter requires csvContent");
    const parsed = Papa.parse<Record<string, string>>(config.csvContent, { header: true, skipEmptyLines: true });
    if (parsed.errors.length > 0) {
      throw new Error(`CSV parse error: ${parsed.errors[0].message} (row ${parsed.errors[0].row})`);
    }
    return { items: parsed.data.map((row) => ({ row, mapping: config.columnMapping })), fetchedAt: new Date() };
  },

  normalize(raw: RawFetchResult): NormalizedMention[] {
    const result: NormalizedMention[] = [];
    for (const rawItem of raw.items) {
      const { row, mapping } = rawItem as { row: Record<string, string>; mapping: CsvUploadConfig["columnMapping"] };
      const url = row[mapping.url]?.trim();
      const headline = row[mapping.headline]?.trim();
      const publishedAtRaw = row[mapping.publishedAt]?.trim();
      if (!url || !headline || !publishedAtRaw) continue;

      const publishedAt = new Date(publishedAtRaw);
      if (Number.isNaN(publishedAt.getTime())) continue;

      const mention: NormalizedMention = {
        canonicalUrl: url,
        originalUrl: url,
        sourceName: (mapping.sourceName && row[mapping.sourceName]) || domainOf(url),
        sourceDomain: domainOf(url),
        headline,
        bodyText: mapping.bodyText ? row[mapping.bodyText] : undefined,
        author: mapping.author ? row[mapping.author] : undefined,
        publishedAt,
        language: (mapping.language && row[mapping.language]) || "en",
        rawProviderMetadata: row,
      };
      result.push(mention);
    }
    return result;
  },
};
