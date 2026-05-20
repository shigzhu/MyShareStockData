import { describe, expect, it } from "vitest";
import { defaultThresholds } from "./thresholds";

describe("defaultThresholds", () => {
  it("uses strict auction confirmation defaults", () => {
    expect(defaultThresholds.auction.idealGapPctMin).toBe(3);
    expect(defaultThresholds.auction.idealGapPctMax).toBe(7);
    expect(defaultThresholds.auction.minAuctionTurnoverToYesterdayPct).toBeGreaterThanOrEqual(1);
    expect(defaultThresholds.position.hardStopLossPct).toBe(-8);
  });
});
