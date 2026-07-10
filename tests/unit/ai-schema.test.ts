import { describe, it, expect } from "vitest";
import { AnalysisSchema } from "@/lib/ai/schemas";

const validFixture = {
  relevance: { label: "RELEVANT", score: 0.9, reason: "Directly discusses the monitored brand." },
  sentiment: { label: "POSITIVE", confidence: 0.8, evidence: "Praised for strong growth.", concernsMonitoredOrg: true },
  coverageType: "NEWS_STORY",
  prominence: { level: "LEAD", explanation: "Brand named in the headline." },
  risk: { score: 5, reasons: [], recommendedUrgency: "NONE" },
  messagePullThrough: [{ keyMessageId: "km1", strength: "FULL", confidence: 0.7 }],
  topics: ["Product launch"],
  secondaryTopics: [],
  executiveSummary: "The brand announced a new product to positive reception.",
};

describe("AnalysisSchema (structured AI output validation)", () => {
  it("accepts a well-formed analysis payload", () => {
    expect(() => AnalysisSchema.parse(validFixture)).not.toThrow();
  });

  it("rejects an out-of-range relevance score", () => {
    const bad = { ...validFixture, relevance: { ...validFixture.relevance, score: 1.5 } };
    expect(() => AnalysisSchema.parse(bad)).toThrow();
  });

  it("rejects an invalid sentiment label", () => {
    const bad = { ...validFixture, sentiment: { ...validFixture.sentiment, label: "VERY_HAPPY" } };
    expect(() => AnalysisSchema.parse(bad)).toThrow();
  });

  it("rejects a risk score above 100", () => {
    const bad = { ...validFixture, risk: { ...validFixture.risk, score: 150 } };
    expect(() => AnalysisSchema.parse(bad)).toThrow();
  });

  it("rejects a missing required field", () => {
    const { executiveSummary, ...bad } = validFixture;
    expect(() => AnalysisSchema.parse(bad)).toThrow();
  });

  it("rejects an invalid coverage type enum value", () => {
    const bad = { ...validFixture, coverageType: "BLOG_POST_XYZ" };
    expect(() => AnalysisSchema.parse(bad)).toThrow();
  });

  it("caps topics at 5 entries", () => {
    const bad = { ...validFixture, topics: ["a", "b", "c", "d", "e", "f"] };
    expect(() => AnalysisSchema.parse(bad)).toThrow();
  });

  it("allows a null keyMessageId in message pull-through (unmatched slot)", () => {
    const ok = { ...validFixture, messagePullThrough: [{ keyMessageId: null, strength: "ABSENT", confidence: 0.1 }] };
    expect(() => AnalysisSchema.parse(ok)).not.toThrow();
  });
});
