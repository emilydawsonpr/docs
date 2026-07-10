import type { AnalysisOutput } from "./schemas";

export interface MockAnalysisInput {
  headline: string;
  excerpt?: string | null;
  bodyText?: string | null;
  brandName: string;
  brandAliases: string[];
  keyMessages: { id: string; text: string; aliases: string[] }[];
  crisisTerms: string[];
  matchedTermHit: boolean; // whether the mention matched the project's active monitoring query
}

// Small bilingual sentiment lexicons. Deliberately simple and transparent —
// this is a deterministic fallback, not a claim of NLP sophistication.
const POSITIVE_WORDS_EN = [
  "award", "wins", "win", "growth", "success", "successful", "praise", "praised", "innovative", "milestone",
  "record", "expand", "expansion", "partnership", "celebrate", "excellent", "strong", "leading", "best",
  "improve", "improved", "sustainable", "grateful", "proud", "recognized", "achievement",
];
const NEGATIVE_WORDS_EN = [
  "recall", "lawsuit", "sue", "sued", "breach", "layoffs", "layoff", "fired", "scandal", "fraud", "fine",
  "penalty", "investigation", "probe", "complaint", "allegation", "allegations", "misconduct", "decline",
  "loss", "losses", "cut", "cuts", "closure", "closed", "bankrupt", "bankruptcy", "criticized", "backlash",
  "boycott", "unsafe", "danger", "dangerous", "violation", "violates", "controversy",
];
const POSITIVE_WORDS_FR = [
  "prix", "succès", "croissance", "innovant", "record", "expansion", "partenariat", "excellent", "fier",
  "reconnaissance", "amélioré", "durable",
];
const NEGATIVE_WORDS_FR = [
  "rappel", "poursuite", "faillite", "licenciements", "scandale", "fraude", "amende", "enquête", "plainte",
  "controverse", "boycott", "dangereux", "violation",
];

function countMatches(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  return words.reduce((sum, w) => sum + (lower.includes(w) ? 1 : 0), 0);
}

function mentionsBrand(text: string, brandName: string, aliases: string[]): boolean {
  const lower = text.toLowerCase();
  return [brandName, ...aliases].some((name) => name && lower.includes(name.toLowerCase()));
}

const PRESS_RELEASE_PHRASES = [
  "forward-looking statements",
  "for immediate release",
  "media contact",
  "about the company",
  "safe harbor",
];

/**
 * Deterministic, rules-based analyzer used whenever ANTHROPIC_API_KEY is
 * unset (or the real Claude call fails validation twice). Every field is
 * derived from explainable heuristics — no network call, no randomness.
 */
export function runMockAnalysis(input: MockAnalysisInput): AnalysisOutput {
  const fullText = `${input.headline}\n${input.excerpt ?? ""}\n${input.bodyText ?? ""}`;
  const bodyOpening = `${input.headline}\n${(input.bodyText ?? input.excerpt ?? "").slice(0, 300)}`;

  // --- Relevance ---
  const brandMentioned = mentionsBrand(fullText, input.brandName, input.brandAliases);
  let relevanceLabel: AnalysisOutput["relevance"]["label"] = "IRRELEVANT";
  let relevanceScore = 0.1;
  let relevanceReason = `"${input.brandName}" (or a known alias) was not found in the mention text.`;
  if (brandMentioned && input.matchedTermHit) {
    relevanceLabel = "RELEVANT";
    relevanceScore = 0.85;
    relevanceReason = `The mention matches the active monitoring query and directly references ${input.brandName}.`;
  } else if (brandMentioned) {
    relevanceLabel = "POSSIBLY_RELEVANT";
    relevanceScore = 0.5;
    relevanceReason = `${input.brandName} is referenced, but the mention did not match the project's active monitoring query terms.`;
  }

  // --- Sentiment ---
  const posCount =
    countMatches(fullText, POSITIVE_WORDS_EN) + countMatches(fullText, POSITIVE_WORDS_FR);
  const negCount =
    countMatches(fullText, NEGATIVE_WORDS_EN) + countMatches(fullText, NEGATIVE_WORDS_FR);
  let sentimentLabel: AnalysisOutput["sentiment"]["label"] = "NEUTRAL";
  let sentimentConfidence = 0.5;
  if (posCount > 0 && negCount > 0) {
    sentimentLabel = "MIXED";
    sentimentConfidence = 0.55;
  } else if (posCount > negCount) {
    sentimentLabel = "POSITIVE";
    sentimentConfidence = Math.min(0.9, 0.55 + posCount * 0.1);
  } else if (negCount > posCount) {
    sentimentLabel = "NEGATIVE";
    sentimentConfidence = Math.min(0.9, 0.55 + negCount * 0.1);
  }

  // --- Coverage type ---
  const lowerFull = fullText.toLowerCase();
  const isPressRelease = PRESS_RELEASE_PHRASES.some((p) => lowerFull.includes(p));
  const coverageType: AnalysisOutput["coverageType"] = isPressRelease ? "PRESS_RELEASE_REPRODUCTION" : "NEWS_STORY";

  // --- Prominence ---
  const inHeadline = mentionsBrand(input.headline, input.brandName, input.brandAliases);
  const inOpening = mentionsBrand(bodyOpening, input.brandName, input.brandAliases);
  let prominenceLevel: AnalysisOutput["prominence"]["level"] = "BRIEF_MENTION";
  let prominenceExplanation = `${input.brandName} was not clearly identified in the headline or opening paragraphs.`;
  if (inHeadline) {
    prominenceLevel = "LEAD";
    prominenceExplanation = `${input.brandName} appears in the headline, indicating the mention is the central subject.`;
  } else if (inOpening) {
    prominenceLevel = "SIGNIFICANT";
    prominenceExplanation = `${input.brandName} appears in the opening paragraphs, indicating substantive (not passing) coverage.`;
  } else if (brandMentioned) {
    prominenceLevel = "PASSING";
    prominenceExplanation = `${input.brandName} is mentioned later in the piece, alongside other subjects.`;
  }

  // --- Risk ---
  const triggeredCrisisTerms = input.crisisTerms.filter((term) => term && lowerFull.includes(term.toLowerCase()));
  const genericNegativeSignal = countMatches(fullText, NEGATIVE_WORDS_EN) + countMatches(fullText, NEGATIVE_WORDS_FR);
  let riskScore = Math.min(100, triggeredCrisisTerms.length * 30 + genericNegativeSignal * 8);
  if (!brandMentioned) riskScore = 0; // never flag risk for content that isn't about the monitored organization
  const riskReasons = brandMentioned
    ? [
        ...triggeredCrisisTerms.map((t) => `Project-defined crisis term matched: "${t}"`),
        ...(genericNegativeSignal > 0 && triggeredCrisisTerms.length === 0
          ? [`Negative-sentiment language detected near a brand mention (${genericNegativeSignal} indicator word(s))`]
          : []),
      ]
    : [];
  const recommendedUrgency: AnalysisOutput["risk"]["recommendedUrgency"] =
    riskScore >= 75 ? "URGENT" : riskScore >= 50 ? "REVIEW_SOON" : riskScore >= 25 ? "MONITOR" : "NONE";

  // --- Message pull-through ---
  const messagePullThrough = input.keyMessages.map((km) => {
    const terms = [km.text, ...km.aliases].filter(Boolean);
    const overlap = terms.filter((t) => lowerFull.includes(t.toLowerCase())).length;
    const strength: AnalysisOutput["messagePullThrough"][number]["strength"] =
      overlap >= 1 && lowerFull.includes(km.text.toLowerCase())
        ? "FULL"
        : overlap >= 1
          ? "PARTIAL"
          : "ABSENT";
    return {
      keyMessageId: km.id,
      strength,
      supportingExcerpt: strength !== "ABSENT" ? km.text.slice(0, 200) : undefined,
      confidence: strength === "FULL" ? 0.8 : strength === "PARTIAL" ? 0.5 : 0.2,
    };
  });

  // --- Topics (simple keyword-based, not a real topic model) ---
  const topics: string[] = [];
  if (isPressRelease) topics.push("Press release / corporate announcement");
  if (triggeredCrisisTerms.length > 0) topics.push("Reputational risk");
  if (sentimentLabel === "POSITIVE") topics.push("Positive brand coverage");
  if (topics.length === 0) topics.push("General coverage");

  const executiveSummary = brandMentioned
    ? `This ${coverageType.toLowerCase().replace(/_/g, " ")} from ${input.headline.length > 60 ? "the source publication" : "the source"} discusses ${input.brandName} with ${sentimentLabel.toLowerCase()} tone (mock analysis, confidence ${(sentimentConfidence * 100).toFixed(0)}%). ${
        riskReasons.length > 0
          ? `Risk indicators found: ${riskReasons.join("; ")}.`
          : "No reputational risk indicators were detected."
      } Recommended review urgency: ${recommendedUrgency.toLowerCase().replace(/_/g, " ")}.`
    : `This item did not clearly reference ${input.brandName} and is likely irrelevant to this project (mock analysis).`;

  return {
    relevance: { label: relevanceLabel, score: relevanceScore, reason: relevanceReason },
    sentiment: {
      label: sentimentLabel,
      confidence: sentimentConfidence,
      evidence: posCount + negCount > 0 ? `${posCount} positive / ${negCount} negative indicator word(s) detected.` : undefined,
      concernsMonitoredOrg: brandMentioned,
    },
    coverageType,
    prominence: { level: prominenceLevel, explanation: prominenceExplanation },
    risk: { score: riskScore, reasons: riskReasons, recommendedUrgency },
    messagePullThrough,
    topics,
    secondaryTopics: [],
    executiveSummary,
  };
}
