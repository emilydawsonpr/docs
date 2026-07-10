export interface DailyCount {
  date: string;
  count: number;
}

export interface SpikeDetectionConfig {
  historicalWindowDays: number;
  minMentionThreshold: number; // ignore spikes below this absolute observed volume
  zScoreThreshold: number;
}

export interface SpikeResult {
  date: string;
  observed: number;
  expected: number;
  stdDev: number;
  zScore: number;
  percentChange: number | null;
  isSpike: boolean;
}

export const DEFAULT_SPIKE_CONFIG: SpikeDetectionConfig = {
  historicalWindowDays: 14,
  minMentionThreshold: 5,
  zScoreThreshold: 2,
};

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Explainable rolling-average/z-score spike detection: the most recent day
 * in `series` is evaluated against a rolling average + standard deviation of
 * the preceding `historicalWindowDays`. A spike requires BOTH an
 * above-threshold z-score AND a minimum absolute mention count, so a jump
 * from 1 to 3 mentions never gets called a crisis.
 */
export function detectLatestSpike(series: DailyCount[], config: SpikeDetectionConfig = DEFAULT_SPIKE_CONFIG): SpikeResult | null {
  if (series.length < 2) return null;
  const latest = series[series.length - 1];
  const history = series.slice(Math.max(0, series.length - 1 - config.historicalWindowDays), series.length - 1).map((d) => d.count);
  if (history.length === 0) return null;

  const expected = mean(history);
  const sd = stdDev(history, expected);
  const zScore = sd > 0 ? (latest.count - expected) / sd : latest.count > expected ? Infinity : 0;
  const percentChange = expected > 0 ? ((latest.count - expected) / expected) * 100 : null;

  const isSpike = latest.count >= config.minMentionThreshold && zScore >= config.zScoreThreshold;

  return {
    date: latest.date,
    observed: latest.count,
    expected: Math.round(expected * 10) / 10,
    stdDev: Math.round(sd * 10) / 10,
    zScore: Number.isFinite(zScore) ? Math.round(zScore * 100) / 100 : 99,
    percentChange: percentChange === null ? null : Math.round(percentChange),
    isSpike,
  };
}

/** Evaluates every day in the series (once enough history exists) — used for a risk/volume trend view. */
export function detectSpikesOverSeries(series: DailyCount[], config: SpikeDetectionConfig = DEFAULT_SPIKE_CONFIG): SpikeResult[] {
  const results: SpikeResult[] = [];
  for (let i = config.historicalWindowDays; i < series.length; i++) {
    const window = series.slice(0, i + 1);
    const result = detectLatestSpike(window, config);
    if (result) results.push(result);
  }
  return results;
}
