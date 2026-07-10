import { describe, it, expect } from "vitest";
import { detectLatestSpike, type DailyCount } from "@/lib/analytics/spike-detection";

function series(counts: number[]): DailyCount[] {
  return counts.map((count, i) => ({ date: `2026-01-${String(i + 1).padStart(2, "0")}`, count }));
}

describe("detectLatestSpike", () => {
  it("does not flag a stable baseline as a spike", () => {
    const s = series([10, 11, 9, 10, 12, 10, 9, 11, 10, 10]);
    const result = detectLatestSpike(s);
    expect(result?.isSpike).toBe(false);
  });

  it("flags a genuine large jump in volume as a spike", () => {
    const s = series([10, 11, 9, 10, 12, 10, 9, 11, 10, 50]);
    const result = detectLatestSpike(s);
    expect(result?.isSpike).toBe(true);
    expect(result?.observed).toBe(50);
  });

  it("does not flag a small absolute increase even with a high z-score (minMentionThreshold guard)", () => {
    // Baseline near-zero with low variance; jump to 3 has a big z-score but tiny absolute volume.
    const s = series([0, 1, 0, 0, 1, 0, 0, 1, 0, 3]);
    const result = detectLatestSpike(s);
    expect(result?.isSpike).toBe(false);
  });

  it("computes percent change relative to the rolling average", () => {
    const s = series([10, 10, 10, 10, 10, 10, 10, 10, 10, 20]);
    const result = detectLatestSpike(s);
    expect(result?.percentChange).toBe(100);
  });

  it("returns null when there is not enough history", () => {
    expect(detectLatestSpike([{ date: "2026-01-01", count: 5 }])).toBeNull();
  });
});
