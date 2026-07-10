import Papa from "papaparse";

export interface MentionCsvRow {
  headline: string;
  sourceName: string;
  sourceDomain: string;
  originalUrl: string;
  publishedAt: string;
  language: string;
  sentiment?: string;
  relevanceLabel?: string;
  riskScore?: number;
  coverageType?: string;
  reviewStatus: string;
  placementType?: string | null;
  isDemo: boolean;
}

/** Plain CSV export of a mention list — no external service, works offline. */
export function mentionsToCsv(rows: MentionCsvRow[]): string {
  return Papa.unparse(
    rows.map((r) => ({
      Headline: r.headline,
      Source: r.sourceName,
      Domain: r.sourceDomain,
      URL: r.originalUrl,
      "Published (UTC)": r.publishedAt,
      Language: r.language,
      Sentiment: r.sentiment ?? "",
      Relevance: r.relevanceLabel ?? "",
      "Risk score": r.riskScore ?? "",
      "Coverage type": r.coverageType ?? "",
      "Review status": r.reviewStatus,
      Placement: r.placementType ?? "",
      "Synthetic demo data": r.isDemo ? "YES" : "NO",
    })),
    { header: true }
  );
}
