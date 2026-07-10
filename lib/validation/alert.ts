import { z } from "zod";

export const alertRuleSchema = z.object({
  name: z.string().min(1).max(200),
  triggerType: z.enum([
    "HIGH_RELEVANCE",
    "HIGH_RISK",
    "NEGATIVE_SENTIMENT",
    "MAJOR_PUBLICATION",
    "EXEC_MENTION",
    "COMPETITOR_SPIKE",
    "VOLUME_SPIKE",
    "SENTIMENT_DETERIORATION",
    "TOPIC_PHRASE",
    "JOURNALIST_INQUIRY",
    "REGULATORY_LANGUAGE",
    "MISINFORMATION_INDICATOR",
  ]),
  config: z.record(z.any()).default({}),
  deliveryChannels: z.array(z.enum(["IN_APP", "EMAIL", "SLACK", "TEAMS"])).min(1),
  slackWebhookUrl: z.string().url().optional().or(z.literal("")),
  teamsWebhookUrl: z.string().url().optional().or(z.literal("")),
  emailRecipients: z.array(z.string().email()).default([]),
  cadence: z.enum(["IMMEDIATE", "HOURLY", "DAILY", "WEEKLY"]).default("IMMEDIATE"),
  quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
  timezone: z.string().default("America/Toronto"),
  isActive: z.boolean().default(true),
});

export const updateAlertRuleSchema = alertRuleSchema.partial();
