import { describe, it, expect } from "vitest";
import { z } from "zod";
import { rssAdapter } from "@/lib/adapters/rss";
import { csvUploadAdapter } from "@/lib/adapters/csv-upload";
import { googleNewsRssAdapter } from "@/lib/adapters/google-news-rss";
import { gdeltAdapter } from "@/lib/adapters/gdelt";
import { redditAdapter } from "@/lib/adapters/tier2-stubs";
import { AdapterNotImplementedError } from "@/lib/adapters/types";

// Every adapter's normalize() output must satisfy this shape, regardless of provider.
const normalizedMentionSchema = z.object({
  providerRecordId: z.string().optional(),
  canonicalUrl: z.string().min(1),
  originalUrl: z.string().min(1),
  sourceName: z.string().min(1),
  sourceDomain: z.string().min(1),
  headline: z.string().min(1),
  excerpt: z.string().optional(),
  bodyText: z.string().optional(),
  author: z.string().optional(),
  publishedAt: z.instanceof(Date),
  language: z.string().min(1),
  country: z.string().optional(),
  imageUrl: z.string().optional(),
  rawProviderMetadata: z.record(z.unknown()).optional(),
});

describe("adapter contract: RSS", () => {
  it("normalize() output matches the common NormalizedMention shape", () => {
    const raw = {
      items: [
        {
          title: "Test headline",
          link: "https://example.ca/story",
          guid: "guid-1",
          isoDate: "2026-01-01T00:00:00.000Z",
          contentSnippet: "Excerpt text.",
          creator: "A. Writer",
          __feedTitle: "Example Feed",
        },
      ],
      fetchedAt: new Date(),
    };
    const normalized = rssAdapter.normalize(raw);
    expect(normalized).toHaveLength(1);
    for (const m of normalized) expect(() => normalizedMentionSchema.parse(m)).not.toThrow();
  });

  it("declares itself Tier 1, keyless, and real (no auth required)", () => {
    expect(rssAdapter.tier).toBe(1);
    expect(rssAdapter.authRequired).toBe(false);
    expect(rssAdapter.authStatus({ feedUrl: "https://example.ca/feed" })).toBe("none");
  });
});

describe("adapter contract: Google News RSS", () => {
  it("normalize() output matches the common NormalizedMention shape", () => {
    const raw = {
      items: [
        {
          title: "Test headline - Example Source",
          link: "https://news.google.com/rss/articles/abc",
          guid: "guid-2",
          isoDate: "2026-01-01T00:00:00.000Z",
          contentSnippet: "Excerpt.",
          source: { _: "Example Source", $: { url: "https://example-source.ca" } },
        },
      ],
      fetchedAt: new Date(),
    };
    const normalized = googleNewsRssAdapter.normalize(raw);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].sourceDomain).toBe("example-source.ca");
    for (const m of normalized) expect(() => normalizedMentionSchema.parse(m)).not.toThrow();
  });
});

describe("adapter contract: CSV upload", () => {
  it("normalize() output matches the common NormalizedMention shape and skips incomplete rows", () => {
    const raw = {
      items: [
        {
          row: { Title: "Headline one", URL: "https://example.ca/1", Date: "2026-01-01", Source: "Example" },
          mapping: { headline: "Title", url: "URL", publishedAt: "Date", sourceName: "Source" },
        },
        {
          // Missing URL -> should be skipped, not throw.
          row: { Title: "Incomplete row", URL: "", Date: "2026-01-01" },
          mapping: { headline: "Title", url: "URL", publishedAt: "Date" },
        },
      ],
      fetchedAt: new Date(),
    };
    const normalized = csvUploadAdapter.normalize(raw);
    expect(normalized).toHaveLength(1);
    for (const m of normalized) expect(() => normalizedMentionSchema.parse(m)).not.toThrow();
  });
});

describe("adapter contract: GDELT", () => {
  it("normalize() parses GDELT date format and matches the common shape", () => {
    const raw = {
      items: [{ url: "https://example.ca/story", title: "Headline", seendate: "20260115T120000Z", domain: "example.ca", language: "eng", sourcecountry: "Canada" }],
      fetchedAt: new Date(),
    };
    const normalized = gdeltAdapter.normalize(raw);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].publishedAt.toISOString()).toBe("2026-01-15T12:00:00.000Z");
    for (const m of normalized) expect(() => normalizedMentionSchema.parse(m)).not.toThrow();
  });
});

describe("adapter contract: Tier 2 stubs", () => {
  it("reports authStatus missing and throws AdapterNotImplementedError on fetch, never silently mocking data", async () => {
    expect(redditAdapter.authStatus({})).toBe("missing");
    expect(redditAdapter.tier).toBe(2);
    await expect(redditAdapter.fetch({})).rejects.toThrow(AdapterNotImplementedError);
  });
});
