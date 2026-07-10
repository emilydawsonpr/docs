export interface AnalysisPromptContext {
  headline: string;
  excerpt?: string | null;
  bodyText?: string | null;
  sourceName: string;
  sourceDomain: string;
  publishedAt: Date;
  brandName: string;
  brandAliases: string[];
  competitors: string[];
  keyMessages: { id: string; text: string }[];
  crisisTerms: string[];
  monitoringBrief: string; // the active Boolean query expression, as project context
}

export function buildAnalysisSystemPrompt(): string {
  return `You are a media-analysis engine for SignalWatch, a PR/communications intelligence platform. \
You analyze one news/web mention at a time against a specific project's monitoring brief and return ONLY \
structured JSON via the "record_analysis" tool call — no prose outside the tool call.

Rules:
- Judge relevance against the project's monitoring brief and brand, not general newsworthiness.
- Do NOT classify sentiment as negative just because the text contains negative words unrelated to the \
monitored organization; sentiment.concernsMonitoredOrg must be false if the negative/positive tone is about \
someone or something else.
- Risk score and reasons must be grounded in specific evidence from the text (quote or closely paraphrase it \
in the reasons); never invent allegations that are not present in the text.
- Do not recommend a public response or communications action — only classify facts and flag urgency for \
human review.
- messagePullThrough must only reference the provided keyMessageId values; if a message is not evaluated, omit it.
- Keep all string fields concise and factual.`;
}

export function buildAnalysisUserPrompt(ctx: AnalysisPromptContext): string {
  const keyMessagesList = ctx.keyMessages.map((m) => `- [${m.id}] ${m.text}`).join("\n") || "(none defined)";
  return `PROJECT MONITORING BRIEF (active Boolean query): ${ctx.monitoringBrief || "(none active)"}
MONITORED BRAND: ${ctx.brandName}
KNOWN ALIASES: ${ctx.brandAliases.join(", ") || "(none)"}
KNOWN COMPETITORS: ${ctx.competitors.join(", ") || "(none)"}
PROJECT-DEFINED CRISIS/RISK TERMS: ${ctx.crisisTerms.join(", ") || "(none)"}
KEY MESSAGES (id: text):
${keyMessagesList}

MENTION TO ANALYZE
Source: ${ctx.sourceName} (${ctx.sourceDomain})
Published: ${ctx.publishedAt.toISOString()}
Headline: ${ctx.headline}
Excerpt: ${ctx.excerpt ?? "(none)"}
Body:
${(ctx.bodyText ?? "(full body not available — analyze from headline/excerpt only)").slice(0, 6000)}

Call record_analysis with your structured analysis of this mention.`;
}
