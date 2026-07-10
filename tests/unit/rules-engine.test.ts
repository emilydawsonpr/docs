import { describe, it, expect } from "vitest";
import { evaluateMentionRule } from "@/lib/alerts/rules-engine";
import type { Mention, AnalysisResult, AlertRule } from "@prisma/client";

function mention(overrides: Partial<Mention> = {}): Mention {
  return {
    id: "m1",
    projectId: "p1",
    headline: "Northstar Coffee opens its newest cafe",
    excerpt: null,
    bodyText: "Details about the opening.",
    sourceDomain: "example-press.ca",
    ...overrides,
  } as Mention;
}

function analysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    id: "a1",
    mentionId: "m1",
    relevanceLabel: "RELEVANT",
    relevanceScore: 0.9,
    sentiment: "NEUTRAL",
    sentimentSubjectIsBrand: true,
    riskScore: 10,
    ...overrides,
  } as AnalysisResult;
}

function rule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: "r1",
    projectId: "p1",
    triggerType: "HIGH_RISK",
    config: {},
    ...overrides,
  } as AlertRule;
}

describe("evaluateMentionRule", () => {
  it("HIGH_RISK matches when risk score meets the configured threshold", () => {
    const result = evaluateMentionRule(mention(), analysis({ riskScore: 60 }), rule({ triggerType: "HIGH_RISK", config: { minRiskScore: 50 } }));
    expect(result.matched).toBe(true);
  });

  it("HIGH_RISK does not match below threshold", () => {
    const result = evaluateMentionRule(mention(), analysis({ riskScore: 30 }), rule({ triggerType: "HIGH_RISK", config: { minRiskScore: 50 } }));
    expect(result.matched).toBe(false);
  });

  it("NEGATIVE_SENTIMENT only matches when sentiment concerns the monitored brand", () => {
    const matches = evaluateMentionRule(
      mention(),
      analysis({ sentiment: "NEGATIVE", sentimentSubjectIsBrand: true }),
      rule({ triggerType: "NEGATIVE_SENTIMENT" })
    );
    expect(matches.matched).toBe(true);

    const doesNotMatch = evaluateMentionRule(
      mention(),
      analysis({ sentiment: "NEGATIVE", sentimentSubjectIsBrand: false }),
      rule({ triggerType: "NEGATIVE_SENTIMENT" })
    );
    expect(doesNotMatch.matched).toBe(false);
  });

  it("MAJOR_PUBLICATION matches on configured domain list", () => {
    const result = evaluateMentionRule(
      mention({ sourceDomain: "cbc.ca" }),
      null,
      rule({ triggerType: "MAJOR_PUBLICATION", config: { domains: ["cbc.ca", "theglobeandmail.com"] } })
    );
    expect(result.matched).toBe(true);
  });

  it("EXEC_MENTION matches when a configured name appears in the text", () => {
    const result = evaluateMentionRule(
      mention({ bodyText: "CEO Jane Smith announced the news." }),
      null,
      rule({ triggerType: "EXEC_MENTION", config: { names: ["Jane Smith"] } })
    );
    expect(result.matched).toBe(true);
  });

  it("JOURNALIST_INQUIRY matches built-in phrase list", () => {
    const result = evaluateMentionRule(
      mention({ bodyText: "We are reaching out for a story about your Q3 results." }),
      null,
      rule({ triggerType: "JOURNALIST_INQUIRY" })
    );
    expect(result.matched).toBe(true);
  });

  it("REGULATORY_LANGUAGE matches built-in phrase list", () => {
    const result = evaluateMentionRule(
      mention({ bodyText: "The company is under regulatory investigation by provincial authorities." }),
      null,
      rule({ triggerType: "REGULATORY_LANGUAGE" })
    );
    expect(result.matched).toBe(true);
  });

  it("does not match when analysis is missing for score-based triggers", () => {
    const result = evaluateMentionRule(mention(), null, rule({ triggerType: "HIGH_RISK" }));
    expect(result.matched).toBe(false);
  });
});
