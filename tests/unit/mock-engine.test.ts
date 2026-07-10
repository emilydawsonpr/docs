import { describe, it, expect } from "vitest";
import { runMockAnalysis } from "@/lib/ai/mock-engine";
import { AnalysisSchema } from "@/lib/ai/schemas";

const baseInput = {
  brandName: "Northstar Coffee",
  brandAliases: ["North Star Coffee"],
  keyMessages: [{ id: "km1", text: "Northstar Coffee is 100% Canadian-owned and ethically sourced.", aliases: [] }],
  crisisTerms: ["recall", "lawsuit", "data breach"],
  matchedTermHit: true,
};

describe("runMockAnalysis", () => {
  it("always produces output conforming to AnalysisSchema", () => {
    const output = runMockAnalysis({
      ...baseInput,
      headline: "Northstar Coffee opens its newest cafe in downtown Toronto",
      bodyText: "The Canadian-owned chain says the new location will create forty jobs.",
    });
    expect(() => AnalysisSchema.parse(output)).not.toThrow();
  });

  it("marks brand-irrelevant content as IRRELEVANT with no risk", () => {
    const output = runMockAnalysis({
      ...baseInput,
      headline: "City council approves new zoning bylaw",
      bodyText: "The city council voted Tuesday on a zoning matter unrelated to any coffee company.",
    });
    expect(output.relevance.label).toBe("IRRELEVANT");
    expect(output.risk.score).toBe(0);
    expect(output.sentiment.concernsMonitoredOrg).toBe(false);
  });

  it("detects positive sentiment from award/growth language", () => {
    const output = runMockAnalysis({
      ...baseInput,
      headline: "Northstar Coffee wins local business excellence award",
      bodyText: "The award recognizes Northstar Coffee's strong growth and successful expansion this year.",
    });
    expect(output.sentiment.label).toBe("POSITIVE");
  });

  it("flags risk when a project-defined crisis term co-occurs with the brand", () => {
    const output = runMockAnalysis({
      ...baseInput,
      headline: "Northstar Coffee faces lawsuit over supplier contract",
      bodyText: "A lawsuit has been filed alleging breach of contract with a former supplier.",
    });
    expect(output.risk.score).toBeGreaterThan(0);
    expect(output.risk.reasons.some((r) => r.toLowerCase().includes("lawsuit"))).toBe(true);
    expect(["REVIEW_SOON", "URGENT", "MONITOR"]).toContain(output.risk.recommendedUrgency);
  });

  it("does not flag risk for negative language about an unrelated entity", () => {
    const output = runMockAnalysis({
      ...baseInput,
      headline: "Rival chain announces layoffs amid scandal",
      bodyText: "A competing coffee chain announced layoffs following a scandal involving its former CEO.",
    });
    // Brand not mentioned at all -> risk must stay at 0 regardless of negative words present.
    expect(output.risk.score).toBe(0);
  });

  it("detects LEAD prominence when the brand is in the headline", () => {
    const output = runMockAnalysis({
      ...baseInput,
      headline: "Northstar Coffee announces national expansion",
      bodyText: "Details of the expansion plan follow.",
    });
    expect(output.prominence.level).toBe("LEAD");
  });

  it("matches key messages present in the text as FULL pull-through", () => {
    const output = runMockAnalysis({
      ...baseInput,
      headline: "Northstar Coffee profile",
      bodyText: "The company describes itself: Northstar Coffee is 100% Canadian-owned and ethically sourced.",
    });
    const match = output.messagePullThrough.find((m) => m.keyMessageId === "km1");
    expect(match?.strength).toBe("FULL");
  });

  it("classifies press-release boilerplate as PRESS_RELEASE_REPRODUCTION", () => {
    const output = runMockAnalysis({
      ...baseInput,
      headline: "Northstar Coffee Announces Q3 Results",
      bodyText: "FOR IMMEDIATE RELEASE. This release contains forward-looking statements. Media Contact: pr@example.com",
    });
    expect(output.coverageType).toBe("PRESS_RELEASE_REPRODUCTION");
  });
});
