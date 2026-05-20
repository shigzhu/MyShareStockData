import { describe, expect, it } from "vitest";
import { sampleTradingDay } from "../data/sampleTradingDay";
import { generateAuctionPlan, generatePreMarketPlan } from "./strategyEngine";

describe("generatePreMarketPlan", () => {
  it("returns 3 to 5 preparation candidates when market is tradable", () => {
    const result = generatePreMarketPlan(sampleTradingDay);

    expect(result.stage).toBe("PREMARKET_0830");
    expect(result.marketStatus).toBe("TRADABLE");
    expect(result.candidates.length).toBeGreaterThanOrEqual(3);
    expect(result.candidates.length).toBeLessThanOrEqual(5);
    expect(result.candidates[0].entryPlan).toContain("9:25");
  });

  it("returns no candidates when market gate fails", () => {
    const result = generatePreMarketPlan({
      ...sampleTradingDay,
      marketMood: { ...sampleTradingDay.marketMood, limitDownCount: 25 }
    });

    expect(result.marketStatus).toBe("NO_TRADE");
    expect(result.candidates).toHaveLength(0);
  });
});

describe("generateAuctionPlan", () => {
  it("ranks the only fully confirmed stock first and fills backups from premarket candidates", () => {
    const premarket = generatePreMarketPlan(sampleTradingDay);
    const result = generateAuctionPlan(sampleTradingDay, premarket);

    expect(result.stage).toBe("AUCTION_0925");
    expect(result.candidates[0].role).toBe("PRIMARY");
    expect(result.candidates[0].stock.code).toBe("300750");
    expect(result.candidates.length).toBeGreaterThanOrEqual(3);
    expect(result.candidates[1].role).toBe("BACKUP");
  });
});
