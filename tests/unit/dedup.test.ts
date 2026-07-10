import { describe, it, expect } from "vitest";
import { canonicalizeUrl, normalizeTitle } from "@/lib/dedup/canonicalize";
import { simhash64, hammingDistance, fingerprintToHex, hexToFingerprint } from "@/lib/dedup/fingerprint";

describe("canonicalizeUrl", () => {
  it("strips www, tracking params, and trailing slash", () => {
    const a = canonicalizeUrl("https://www.example.com/news/story/?utm_source=twitter&fbclid=abc123");
    const b = canonicalizeUrl("https://example.com/news/story?utm_campaign=x");
    expect(a).toBe(b);
  });

  it("sorts remaining query params for stable comparison", () => {
    const a = canonicalizeUrl("https://example.com/story?b=2&a=1");
    const b = canonicalizeUrl("https://example.com/story?a=1&b=2");
    expect(a).toBe(b);
  });

  it("strips the fragment", () => {
    const a = canonicalizeUrl("https://example.com/story#section-2");
    const b = canonicalizeUrl("https://example.com/story");
    expect(a).toBe(b);
  });

  it("falls back gracefully for unparseable input", () => {
    expect(canonicalizeUrl("not a url")).toBe("not a url");
  });
});

describe("normalizeTitle", () => {
  it("lowercases and strips punctuation/boilerplate prefixes", () => {
    expect(normalizeTitle("BREAKING: Northstar Coffee Opens New Café!")).toBe("northstar coffee opens new café");
  });

  it("collapses whitespace", () => {
    expect(normalizeTitle("Too    many   spaces")).toBe("too many spaces");
  });
});

describe("simhash64 / hammingDistance", () => {
  it("produces identical fingerprints for identical text", () => {
    const text = "Northstar Coffee opens its newest cafe in downtown Toronto this week";
    expect(simhash64(text)).toBe(simhash64(text));
  });

  it("produces a small Hamming distance for near-duplicate (lightly edited) text", () => {
    // Simhash is designed for document-length text (the dedup pipeline feeds
    // it title + first ~500 chars of body); a full paragraph, not a single
    // short sentence, is the realistic case for syndicated wire copy.
    const original =
      "Northstar Coffee opens its newest cafe in downtown Toronto this week, the company announced Monday. " +
      "The Canadian-owned chain says the new location will create forty jobs and source beans exclusively " +
      "from fair-trade cooperatives in Latin America. The opening comes as the company continues its " +
      "national expansion plan announced earlier this year.";
    const syndicated =
      "Northstar Coffee opens its newest cafe in downtown Toronto this week, the company said Monday. " +
      "The Canadian-owned chain says the new location will create forty jobs and source beans exclusively " +
      "from fair-trade cooperatives across Latin America. The opening comes as the company continues its " +
      "national expansion plan unveiled earlier this year.";
    const distance = hammingDistance(simhash64(original), simhash64(syndicated));
    expect(distance).toBeLessThanOrEqual(10);
  });

  it("produces a large Hamming distance for unrelated text", () => {
    const a = "Northstar Coffee opens its newest cafe in downtown Toronto this week";
    const b = "The city council voted Tuesday to approve a new zoning bylaw for suburban development";
    const distance = hammingDistance(simhash64(a), simhash64(b));
    expect(distance).toBeGreaterThan(10);
  });

  it("round-trips through hex encoding", () => {
    const fp = simhash64("some sample article text about coffee shops");
    expect(hexToFingerprint(fingerprintToHex(fp))).toBe(fp);
  });
});
