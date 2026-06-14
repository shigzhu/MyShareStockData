import { describe, expect, it } from "vitest";
import { evaluateMarketGate } from "./marketGate";
import { defaultThresholds } from "./thresholds";
import type { MarketMood } from "./types";

const strongMood: MarketMood = {
  advancingCount: 3100,
  decliningCount: 1800,
  limitUpCount: 58,
  limitDownCount: 4,
  consecutiveLimitHeight: 5,
  failedBoardRatioPct: 22,
  yesterdayLimitUpAvgReturnPct: 1.8
};

describe("evaluateMarketGate", () => {
  it("allows trading when money-making effect is strong", () => {
    const result = evaluateMarketGate(strongMood, defaultThresholds);

    expect(result.status).toBe("TRADABLE");
    expect(result.reasons).toContain("赚钱效应合格");
  });

  it("blocks trading when limit-down risk is too high", () => {
    const result = evaluateMarketGate(
      { ...strongMood, limitDownCount: 18 },
      defaultThresholds
    );

    expect(result.status).toBe("NO_TRADE");
    expect(result.reasons).toContain("跌停数量过多");
  });
});
