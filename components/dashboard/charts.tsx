"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from "recharts";
import { CHART_TEXT, SENTIMENT_COLORS, categoricalColor } from "@/lib/charts/palette";
import { formatDateCA } from "@/lib/utils";

const tooltipStyle = {
  background: "var(--chart-surface)",
  border: `1px solid ${CHART_TEXT.grid}`,
  borderRadius: 8,
  fontSize: 12,
  color: CHART_TEXT.primary,
};
const axisStyle = { fontSize: 11, fill: CHART_TEXT.muted };

function shortDate(d: string) {
  return formatDateCA(d, { month: "short", day: "numeric" });
}

export function MentionsOverTimeChart({ data }: { data: { date: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={CHART_TEXT.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} axisLine={{ stroke: CHART_TEXT.axis }} tickLine={false} minTickGap={24} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={shortDate} />
        <Area
          type="monotone"
          dataKey="count"
          name="Mentions"
          stroke="var(--chart-cat-1)"
          fill="var(--chart-cat-1)"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SentimentOverTimeChart({
  data,
}: {
  data: { date: string; positive: number; neutral: number; mixed: number; negative: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={0} barCategoryGap="20%">
        <CartesianGrid stroke={CHART_TEXT.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} axisLine={{ stroke: CHART_TEXT.axis }} tickLine={false} minTickGap={24} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={shortDate} />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_TEXT.secondary }} />
        <Bar dataKey="positive" name="Positive" stackId="s" fill={SENTIMENT_COLORS.POSITIVE} radius={[2, 2, 0, 0]} />
        <Bar dataKey="neutral" name="Neutral" stackId="s" fill={SENTIMENT_COLORS.NEUTRAL} />
        <Bar dataKey="mixed" name="Mixed" stackId="s" fill={SENTIMENT_COLORS.MIXED} />
        <Bar dataKey="negative" name="Negative" stackId="s" fill={SENTIMENT_COLORS.NEGATIVE} radius={[0, 0, 2, 2]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function RiskTrendChart({ data }: { data: { date: string; avgRisk: number; maxRisk: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke={CHART_TEXT.grid} vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} tick={axisStyle} axisLine={{ stroke: CHART_TEXT.axis }} tickLine={false} minTickGap={24} />
        <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelFormatter={shortDate} />
        <Legend wrapperStyle={{ fontSize: 12, color: CHART_TEXT.secondary }} />
        <Line type="monotone" dataKey="avgRisk" name="Average risk" stroke="var(--chart-cat-1)" strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="maxRisk"
          name="Peak risk"
          stroke="var(--chart-status-critical)"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CategoricalBarChart({
  data,
  dataKey,
  nameKey,
  height = 220,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  nameKey: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={CHART_TEXT.grid} horizontal={false} />
        <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis dataKey={nameKey} type="category" tick={axisStyle} axisLine={false} tickLine={false} width={120} />
        <Tooltip contentStyle={tooltipStyle} />
        <Bar dataKey={dataKey} radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={categoricalColor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ShareOfVoiceChart({ data }: { data: { brandName: string; totalPlacementSharePct: number; isPrimary: boolean }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
        <CartesianGrid stroke={CHART_TEXT.grid} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis dataKey="brandName" type="category" tick={axisStyle} axisLine={false} tickLine={false} width={140} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(1)}%`} />
        <Bar dataKey="totalPlacementSharePct" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.isPrimary ? "var(--chart-status-good)" : categoricalColor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
