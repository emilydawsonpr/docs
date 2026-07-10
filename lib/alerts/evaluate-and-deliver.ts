import { prisma } from "@/lib/db/prisma";
import { toZonedTime } from "date-fns-tz";
import { evaluateMentionRule } from "./rules-engine";
import { deliverAlert } from "./delivery";

const THROTTLE_WINDOW_MS = 60 * 60 * 1000; // suppress duplicate fires of the same rule within 1 hour

function isWithinQuietHours(timezone: string, startHour: number | null, endHour: number | null): boolean {
  if (startHour === null || endHour === null) return false;
  const local = toZonedTime(new Date(), timezone);
  const hour = local.getHours();
  if (startHour <= endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour; // wraps past midnight
}

/**
 * Evaluates every mention-scoped active AlertRule for one project against a
 * single mention, creating (and, unless throttled/quiet-hours-suppressed,
 * delivering) an AlertEvent per match.
 */
export async function evaluateAlertsForMention(mentionId: string): Promise<{ fired: number; suppressed: number }> {
  const mention = await prisma.mention.findUnique({
    where: { id: mentionId },
    include: { analysisResult: true },
  });
  if (!mention) return { fired: 0, suppressed: 0 };

  const rules = await prisma.alertRule.findMany({
    where: { projectId: mention.projectId, isActive: true },
  });

  let fired = 0;
  let suppressed = 0;

  for (const rule of rules) {
    const evaluation = evaluateMentionRule(mention, mention.analysisResult, rule);
    if (!evaluation.matched) continue;

    const recentDuplicate = await prisma.alertEvent.findFirst({
      where: {
        alertRuleId: rule.id,
        triggeredAt: { gte: new Date(Date.now() - THROTTLE_WINDOW_MS) },
      },
      orderBy: { triggeredAt: "desc" },
    });

    const payload = {
      title: `${rule.triggerType.replace(/_/g, " ")}: ${mention.headline}`,
      body: evaluation.reason,
      mentionId: mention.id,
      sourceDomain: mention.sourceDomain,
    };

    if (recentDuplicate) {
      await prisma.alertEvent.create({
        data: {
          alertRuleId: rule.id,
          mentionId: mention.id,
          payload,
          deliveryStatus: "SUPPRESSED",
          suppressedDuplicateOfId: recentDuplicate.id,
        },
      });
      suppressed += 1;
      continue;
    }

    const quiet = rule.cadence === "IMMEDIATE" && isWithinQuietHours(rule.timezone, rule.quietHoursStart, rule.quietHoursEnd);

    if (rule.cadence !== "IMMEDIATE") {
      // Non-immediate cadences aren't delivered per-mention at all — there is
      // no later job that revisits a PENDING row, so record it as suppressed
      // (with a reason) rather than leaving a row that will never resolve.
      await prisma.alertEvent.create({
        data: {
          alertRuleId: rule.id,
          mentionId: mention.id,
          payload: { ...payload, suppressedReason: `Cadence is ${rule.cadence}, not IMMEDIATE — not delivered per-mention.` },
          deliveryStatus: "SUPPRESSED",
        },
      });
      suppressed += 1;
      continue;
    }

    if (quiet) {
      await prisma.alertEvent.create({
        data: {
          alertRuleId: rule.id,
          mentionId: mention.id,
          payload: { ...payload, suppressedReason: "Suppressed: within the rule's configured quiet hours." },
          deliveryStatus: "SUPPRESSED",
        },
      });
      suppressed += 1;
      continue;
    }

    const event = await prisma.alertEvent.create({
      data: { alertRuleId: rule.id, mentionId: mention.id, payload, deliveryStatus: "PENDING" },
    });

    const outcomes = await deliverAlert(rule, {
      title: payload.title,
      body: payload.body,
      url: mention.originalUrl,
    });
    const anyDelivered = outcomes.some((o) => o.status === "DELIVERED");
    const anyFailed = outcomes.some((o) => o.status === "FAILED");
    await prisma.alertEvent.update({
      where: { id: event.id },
      data: {
        deliveredAt: anyDelivered ? new Date() : undefined,
        deliveryStatus: anyDelivered ? "DELIVERED" : anyFailed ? "FAILED" : "NOT_CONFIGURED",
        payload: { ...payload, deliveryOutcomes: outcomes } as any,
      },
    });
    fired += 1;
  }

  return { fired, suppressed };
}
