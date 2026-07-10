/**
 * Chart color tokens (see dataviz skill / app/globals.css `--chart-*` custom
 * properties, which provide the light/dark values). Sentiment and risk are
 * STATUS encodings (state, not identity) — good/warning/serious/critical —
 * never reused for competitor/source identity. Competitor and source-type
 * series use the fixed-order categorical ramp; never reassign a hue when the
 * filtered series set changes.
 */
export const CHART_TEXT = {
  primary: "var(--chart-text-primary)",
  secondary: "var(--chart-text-secondary)",
  muted: "var(--chart-text-muted)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
};

export const SENTIMENT_COLORS: Record<"POSITIVE" | "NEUTRAL" | "MIXED" | "NEGATIVE", string> = {
  POSITIVE: "var(--chart-status-good)",
  NEUTRAL: "var(--chart-status-neutral)",
  MIXED: "var(--chart-status-warning)",
  NEGATIVE: "var(--chart-status-critical)",
};

export const RISK_LEVEL_COLORS: Record<"LOW" | "MODERATE" | "HIGH" | "CRITICAL", string> = {
  LOW: "var(--chart-status-good)",
  MODERATE: "var(--chart-status-warning)",
  HIGH: "var(--chart-status-serious)",
  CRITICAL: "var(--chart-status-critical)",
};

// Fixed-order categorical ramp — assign by first-seen entity order, never by rank/value.
export const CATEGORICAL_SERIES = [
  "var(--chart-cat-1)",
  "var(--chart-cat-2)",
  "var(--chart-cat-3)",
  "var(--chart-cat-4)",
  "var(--chart-cat-5)",
  "var(--chart-cat-6)",
  "var(--chart-cat-7)",
  "var(--chart-cat-8)",
];

export function categoricalColor(index: number): string {
  return CATEGORICAL_SERIES[index % CATEGORICAL_SERIES.length];
}

export const SEQUENTIAL_BLUE = { light: "var(--chart-seq-100)", mid: "var(--chart-seq-400)", dark: "var(--chart-seq-700)" };
