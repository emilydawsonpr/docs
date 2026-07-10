import { prisma } from "@/lib/db/prisma";
import { subDays, format, startOfDay } from "date-fns";
import { computeDashboardMetrics } from "@/lib/analytics/dashboard-metrics";
import { detectLatestSpike, DEFAULT_SPIKE_CONFIG } from "@/lib/analytics/spike-detection";
import { textMentionsAnyName } from "@/lib/utils";
import { deliverAlert } from "./delivery";

const DAILY_THROTTLE = true; // at most one periodic alert per rule per day

async function alreadyFiredToday(ruleId: string): Promise<boolean> {
  const existing = await prisma.alertEvent.findFirst({
    where: { alertRuleId: ruleId, triggeredAt: { gte: startOfDay(new Date()) } },
  });
  return Boolean(existing);
}

async function fireEvent(rule: { id: string; slackWebhookUrl: string | null; teamsWebhookUrl: string | null; emailRecipients: string[]; deliveryChannels: string[] }, title: string, body: string) {
  const event = await prisma.alertEvent.create({
    data: { alertRuleId: rule.id, payload: { title, body }, deliveryStatus: "PENDING" },
  });
  const outcomes = await deliverAlert(rule as any, { title, body });
  const anyDelivered = outcomes.some((o) => o.status === "DELIVERED");
  await prisma.alertEvent.update({
    where: { id: event.id },
    data: {
      deliveredAt: anyDelivered ? new Date() : undefined,
      deliveryStatus: anyDelivered ? "DELIVERED" : "NOT_CONFIGURED",
      payload: { title, body, deliveryOutcomes: outcomes } as any,
    },
  });
}

async function evaluateVolumeSpike(rule: Awaited<ReturnType<typeof prisma.alertRule.findFirstOrThrow>>): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: rule.projectId } });
  if (!project) return false;
  const metrics = await computeDashboardMetrics(rule.projectId, project.isDemo);
  const spike = detectLatestSpike(metrics.mentionsOverTime, DEFAULT_SPIKE_CONFIG);
  if (!spike?.isSpike) return false;
  if (DAILY_THROTTLE && (await alreadyFiredToday(rule.id))) return false;

  await fireEvent(
    rule,
    `Volume spike detected for ${project.name}`,
    `Observed ${spike.observed} mentions on ${spike.date} vs. an expected ${spike.expected} (rolling 14-day average) — ` +
      `${spike.percentChange !== null ? `${spike.percentChange > 0 ? "+" : ""}${spike.percentChange}%` : "large change"}, z-score ${spike.zScore}.`
  );
  return true;
}

async function evaluateSentimentDeterioration(rule: Awaited<ReturnType<typeof prisma.alertRule.findFirstOrThrow>>): Promise<boolean> {
  const project = await prisma.project.findUnique({ where: { id: rule.projectId } });
  if (!project) return false;
  const metrics = await computeDashboardMetrics(rule.projectId, project.isDemo);
  const recent = metrics.sentimentOverTime.slice(-3);
  const baseline = metrics.sentimentOverTime.slice(-14, -3);
  const ratio = (days: typeof recent) => {
    const total = days.reduce((s, d) => s + d.positive + d.neutral + d.mixed + d.negative, 0);
    const negative = days.reduce((s, d) => s + d.negative, 0);
    return total > 0 ? negative / total : 0;
  };
  const recentRatio = ratio(recent);
  const baselineRatio = ratio(baseline);
  const delta = recentRatio - baselineRatio;
  const minMentions = recent.reduce((s, d) => s + d.positive + d.neutral + d.mixed + d.negative, 0);
  if (delta < 0.15 || minMentions < DEFAULT_SPIKE_CONFIG.minMentionThreshold) return false;
  if (DAILY_THROTTLE && (await alreadyFiredToday(rule.id))) return false;

  await fireEvent(
    rule,
    `Sentiment deterioration detected for ${project.name}`,
    `Negative-sentiment share rose from ${(baselineRatio * 100).toFixed(0)}% (prior 11 days) to ${(recentRatio * 100).toFixed(0)}% (last 3 days).`
  );
  return true;
}

async function evaluateCompetitorSpike(rule: Awaited<ReturnType<typeof prisma.alertRule.findFirstOrThrow>>): Promise<boolean> {
  const competitors = await prisma.competitor.findMany({ where: { projectId: rule.projectId }, include: { brand: true } });
  if (competitors.length === 0) return false;
  const since = subDays(new Date(), 30);

  for (const competitor of competitors) {
    const names = [competitor.brand.name, ...competitor.brand.aliases];
    const mentions = await prisma.mention.findMany({
      where: { projectId: rule.projectId, publishedAt: { gte: since }, isDemo: false },
      select: { headline: true, excerpt: true, bodyText: true, publishedAt: true },
    });
    const matching = mentions.filter((m) => {
      const text = `${m.headline}\n${m.excerpt ?? ""}\n${m.bodyText ?? ""}`;
      return textMentionsAnyName(text, names);
    });

    const byDay = new Map<string, number>();
    for (const m of matching) {
      const day = format(m.publishedAt, "yyyy-MM-dd");
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const days = Array.from({ length: 30 }, (_, i) => format(subDays(new Date(), 29 - i), "yyyy-MM-dd"));
    const series = days.map((date) => ({ date, count: byDay.get(date) ?? 0 }));
    const spike = detectLatestSpike(series, DEFAULT_SPIKE_CONFIG);
    if (!spike?.isSpike) continue;
    if (DAILY_THROTTLE && (await alreadyFiredToday(rule.id))) continue;

    await fireEvent(
      rule,
      `Competitor coverage spike: ${competitor.brand.name}`,
      `${competitor.brand.name} saw ${spike.observed} mentions on ${spike.date} vs. an expected ${spike.expected}.`
    );
    return true;
  }
  return false;
}

/** Runs on the scheduler tick — evaluates all active periodic (non-mention-scoped) alert rules. */
export async function evaluatePeriodicAlerts(): Promise<number> {
  const rules = await prisma.alertRule.findMany({
    where: { isActive: true, triggerType: { in: ["VOLUME_SPIKE", "COMPETITOR_SPIKE", "SENTIMENT_DETERIORATION"] } },
  });

  let fired = 0;
  for (const rule of rules) {
    try {
      let didFire = false;
      if (rule.triggerType === "VOLUME_SPIKE") didFire = await evaluateVolumeSpike(rule);
      else if (rule.triggerType === "SENTIMENT_DETERIORATION") didFire = await evaluateSentimentDeterioration(rule);
      else if (rule.triggerType === "COMPETITOR_SPIKE") didFire = await evaluateCompetitorSpike(rule);
      if (didFire) fired += 1;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Periodic alert evaluation failed for rule ${rule.id}:`, err instanceof Error ? err.message : err);
    }
  }
  return fired;
}
