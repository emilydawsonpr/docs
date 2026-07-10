import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/auth/session";
import { getProjectAccess, NotFoundError } from "@/lib/rbac/permissions";
import { AppShell } from "@/components/app-shell";
import { ProjectNav } from "@/components/project-nav";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  MentionsOverTimeChart,
  SentimentOverTimeChart,
  RiskTrendChart,
  CategoricalBarChart,
  ShareOfVoiceChart,
} from "@/components/dashboard/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeDashboardMetrics } from "@/lib/analytics/dashboard-metrics";
import { computeShareOfVoice } from "@/lib/analytics/share-of-voice";
import { detectLatestSpike } from "@/lib/analytics/spike-detection";
import { formatNumberCA, formatPercentCA } from "@/lib/utils";

export default async function DashboardPage({ params }: { params: { projectId: string } }) {
  const user = await requireUser();
  await getProjectAccess(user.id, params.projectId);
  const project = await prisma.project.findUnique({ where: { id: params.projectId } });
  if (!project) throw new NotFoundError();

  const [metrics, sov] = await Promise.all([
    computeDashboardMetrics(params.projectId, project.isDemo),
    computeShareOfVoice(params.projectId, project.isDemo),
  ]);
  const spike = detectLatestSpike(metrics.mentionsOverTime);

  const primaryShare = sov.entries.find((e) => e.isPrimary);
  const messagePullThroughCount = await prisma.messageMatch.count({
    where: { mention: { projectId: params.projectId, isDemo: project.isDemo }, matchStrength: { in: ["FULL", "PARTIAL"] } },
  });

  return (
    <AppShell title={project.name}>
      <ProjectNav projectId={params.projectId} active="dashboard" />

      {project.isDemo && (
        <div className="mb-4 rounded-md border border-warning/50 bg-warning/10 px-4 py-2 text-sm">
          <Badge variant="warning" className="mr-2">
            Synthetic demo data
          </Badge>
          Every figure on this page is generated demo content for a fictional Canadian brand — never mixed with live data.
        </div>
      )}

      {spike?.isSpike && (
        <Card className="mb-4 border-warning/60 bg-warning/5">
          <CardContent className="pt-4 text-sm">
            <p className="font-medium">Volume spike detected on {spike.date}</p>
            <p className="text-muted-foreground">
              Observed {spike.observed} mentions vs. an expected {spike.expected} (rolling 14-day average), a{" "}
              {spike.percentChange !== null ? `${spike.percentChange > 0 ? "+" : ""}${spike.percentChange}%` : "large"} change
              (z-score {spike.zScore}).
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total mentions" value={formatNumberCA(metrics.totalMentions)} sublabel="last 30 days" />
        <StatCard label="Unique stories" value={formatNumberCA(metrics.uniqueStories)} sublabel="dedup clusters" />
        <StatCard
          label="High-risk mentions"
          value={metrics.highRiskCount}
          tone={metrics.highRiskCount > 0 ? "critical" : "default"}
          sublabel="risk score ≥ 50"
        />
        <StatCard
          label="Share of voice"
          value={primaryShare ? formatPercentCA(primaryShare.totalPlacementSharePct) : "—"}
          sublabel="total-placement, vs. competitive set"
        />
        <StatCard label="Message pull-through" value={messagePullThroughCount} sublabel="mentions with a key message" />
        <StatCard
          label="Reviewed"
          value={`${metrics.reviewedCount}/${metrics.totalMentions}`}
          sublabel={`${metrics.mockAnalysisCount} mock · ${metrics.claudeAnalysisCount} Claude analyzed`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <StatCard
          label="Positive"
          value={metrics.sentimentBreakdown.POSITIVE}
          sublabel={formatPercentCA((metrics.sentimentBreakdown.POSITIVE / Math.max(1, metrics.totalMentions)) * 100)}
        />
        <StatCard
          label="Neutral / Mixed"
          value={metrics.sentimentBreakdown.NEUTRAL + metrics.sentimentBreakdown.MIXED}
          sublabel={formatPercentCA(
            ((metrics.sentimentBreakdown.NEUTRAL + metrics.sentimentBreakdown.MIXED) / Math.max(1, metrics.totalMentions)) * 100
          )}
        />
        <StatCard
          label="Negative"
          value={metrics.sentimentBreakdown.NEGATIVE}
          tone={metrics.sentimentBreakdown.NEGATIVE > 0 ? "warning" : "default"}
          sublabel={formatPercentCA((metrics.sentimentBreakdown.NEGATIVE / Math.max(1, metrics.totalMentions)) * 100)}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mentions over time</CardTitle>
            <CardDescription>Daily volume, last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <MentionsOverTimeChart data={metrics.mentionsOverTime} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sentiment over time</CardTitle>
            <CardDescription>Stacked daily counts by AI/analyst sentiment.</CardDescription>
          </CardHeader>
          <CardContent>
            <SentimentOverTimeChart data={metrics.sentimentOverTime} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk trend</CardTitle>
            <CardDescription>Average and peak daily risk score (0–100).</CardDescription>
          </CardHeader>
          <CardContent>
            <RiskTrendChart data={metrics.riskOverTime} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Share of voice</CardTitle>
            <CardDescription>{sov.methodology}</CardDescription>
          </CardHeader>
          <CardContent>
            {sov.entries.length > 0 ? (
              <ShareOfVoiceChart data={sov.entries} />
            ) : (
              <p className="text-sm text-muted-foreground">Add competitors in project settings to see share of voice.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top sources</CardTitle>
            <CardDescription>By mention count, last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.topSources.length > 0 ? (
              <CategoricalBarChart
                data={metrics.topSources.map((s) => ({ name: s.sourceName || s.sourceDomain, count: s.count }))}
                dataKey="count"
                nameKey="name"
              />
            ) : (
              <p className="text-sm text-muted-foreground">No mentions yet.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source type distribution</CardTitle>
            <CardDescription>Coverage by source category.</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics.sourceTypeDistribution.length > 0 ? (
              <CategoricalBarChart
                data={metrics.sourceTypeDistribution.map((s) => ({ name: s.sourceType, count: s.count }))}
                dataKey="count"
                nameKey="name"
              />
            ) : (
              <p className="text-sm text-muted-foreground">No mentions yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
