import Anthropic from "@anthropic-ai/sdk";
import { AnalysisSchema, type AnalysisOutput } from "./schemas";
import { RECORD_ANALYSIS_TOOL } from "./tool-schema";
import { buildAnalysisSystemPrompt, buildAnalysisUserPrompt, type AnalysisPromptContext } from "./prompts";

export class AiAnalysisError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AiAnalysisError";
  }
}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export function isClaudeConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function extractToolInput(response: Anthropic.Message): unknown {
  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new AiAnalysisError("Model did not call the record_analysis tool");
  }
  return toolUse.input;
}

/**
 * Calls Claude with the record_analysis tool forced, validates the result
 * against AnalysisSchema, and retries once with an error-correction message
 * if validation fails. Throws AiAnalysisError if both attempts fail — the
 * caller (lib/ai/pipeline.ts) is responsible for falling back to the mock
 * engine and logging the parsing failure.
 */
export async function analyzeWithClaude(
  ctx: AnalysisPromptContext
): Promise<{ output: AnalysisOutput; modelName: string; rawResponse: unknown }> {
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  const system = buildAnalysisSystemPrompt();
  const userPrompt = buildAnalysisUserPrompt(ctx);

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];

  for (let attempt = 1; attempt <= 2; attempt++) {
    let response: Anthropic.Message;
    try {
      response = await getClient().messages.create({
        model,
        max_tokens: 1500,
        system,
        messages,
        tools: [RECORD_ANALYSIS_TOOL],
        tool_choice: { type: "tool", name: "record_analysis" },
      });
    } catch (err) {
      throw new AiAnalysisError(`Claude API call failed: ${err instanceof Error ? err.message : String(err)}`, err);
    }

    let candidate: unknown;
    try {
      candidate = extractToolInput(response);
    } catch (err) {
      throw new AiAnalysisError("Claude response did not include a tool_use block", err);
    }

    const parsed = AnalysisSchema.safeParse(candidate);
    if (parsed.success) {
      return { output: parsed.data, modelName: model, rawResponse: response };
    }

    if (attempt === 1) {
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: `Your record_analysis call failed schema validation with these errors:\n${JSON.stringify(
          parsed.error.flatten()
        )}\nPlease call record_analysis again with corrected JSON that satisfies every field.`,
      });
      continue;
    }

    throw new AiAnalysisError(`Claude output failed schema validation twice: ${JSON.stringify(parsed.error.flatten())}`);
  }

  throw new AiAnalysisError("Unreachable: exhausted retry loop without returning or throwing");
}
