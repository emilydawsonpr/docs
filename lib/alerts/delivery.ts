import nodemailer from "nodemailer";
import type { AlertRule } from "@prisma/client";

export interface DeliveryOutcome {
  channel: string;
  status: "DELIVERED" | "FAILED" | "NOT_CONFIGURED";
  detail?: string;
}

/**
 * Delivers one alert to every channel configured on the rule. In-app is
 * always "delivered" (the AlertEvent row itself is the in-app notification —
 * the UI reads AlertEvent directly). Slack/Teams post to the webhook URL the
 * user supplied (no platform credential of ours required). Email sends via
 * SMTP if configured; otherwise it is explicitly logged as not delivered
 * rather than silently dropped or faked.
 */
export async function deliverAlert(
  rule: AlertRule,
  payload: { title: string; body: string; url?: string }
): Promise<DeliveryOutcome[]> {
  const outcomes: DeliveryOutcome[] = [];

  for (const channel of rule.deliveryChannels) {
    if (channel === "IN_APP") {
      outcomes.push({ channel, status: "DELIVERED" });
      continue;
    }

    if (channel === "SLACK") {
      if (!rule.slackWebhookUrl) {
        outcomes.push({ channel, status: "NOT_CONFIGURED", detail: "No Slack webhook URL configured on this rule" });
        continue;
      }
      try {
        const res = await fetch(rule.slackWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: `*${payload.title}*\n${payload.body}${payload.url ? `\n${payload.url}` : ""}` }),
        });
        outcomes.push(res.ok ? { channel, status: "DELIVERED" } : { channel, status: "FAILED", detail: `HTTP ${res.status}` });
      } catch (err) {
        outcomes.push({ channel, status: "FAILED", detail: err instanceof Error ? err.message : "Unknown error" });
      }
      continue;
    }

    if (channel === "TEAMS") {
      if (!rule.teamsWebhookUrl) {
        outcomes.push({ channel, status: "NOT_CONFIGURED", detail: "No Teams webhook URL configured on this rule" });
        continue;
      }
      try {
        const res = await fetch(rule.teamsWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            "@type": "MessageCard",
            "@context": "http://schema.org/extensions",
            summary: payload.title,
            title: payload.title,
            text: `${payload.body}${payload.url ? `\n\n[View mention](${payload.url})` : ""}`,
          }),
        });
        outcomes.push(res.ok ? { channel, status: "DELIVERED" } : { channel, status: "FAILED", detail: `HTTP ${res.status}` });
      } catch (err) {
        outcomes.push({ channel, status: "FAILED", detail: err instanceof Error ? err.message : "Unknown error" });
      }
      continue;
    }

    if (channel === "EMAIL") {
      if (!rule.emailRecipients.length) {
        outcomes.push({ channel, status: "NOT_CONFIGURED", detail: "No recipients configured on this rule" });
        continue;
      }
      if (!process.env.SMTP_HOST) {
        outcomes.push({ channel, status: "NOT_CONFIGURED", detail: "No SMTP server configured — email not sent" });
        continue;
      }
      try {
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
        });
        await transport.sendMail({
          from: process.env.SMTP_FROM ?? "SignalWatch Alerts <alerts@example.com>",
          to: rule.emailRecipients.join(", "),
          subject: payload.title,
          text: `${payload.body}${payload.url ? `\n\n${payload.url}` : ""}`,
        });
        outcomes.push({ channel, status: "DELIVERED" });
      } catch (err) {
        outcomes.push({ channel, status: "FAILED", detail: err instanceof Error ? err.message : "Unknown error" });
      }
    }
  }

  return outcomes;
}
