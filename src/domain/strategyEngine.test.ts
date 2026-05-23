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

  it("marks the strongest 8:30 candidate as primary", () => {
    const result = generatePreMarketPlan(sampleTradingDay);

    expect(result.candidates[0].role).toBe("PRIMARY");
  });

  it("uses cross-platform discussion heat as 30 percent of the stock score", () => {
    const normalHeat = generatePreMarketPlan(sampleTradingDay);
    const coldStock = normalHeat.candidates.find((candidate) => candidate.stock.code === "688256");
    const warmingStock = normalHeat.candidates.find((candidate) => candidate.stock.code === "300750");

    expect(warmingStock?.heat.temperature).toBe("升温");
    expect(warmingStock?.heat.weightedScore).toBeGreaterThan(20);
    expect(coldStock?.heat.temperature).toBe("冷门");
    expect(coldStock?.heat.weightedScore).toBeLessThan(12);
  });

  it("rejects high-position stocks with extreme discussion heat", () => {
    const result = generatePreMarketPlan({
      ...sampleTradingDay,
      themes: sampleTradingDay.themes.map((theme) => ({
        ...theme,
        stocks: theme.stocks.map((stock) =>
          stock.code === "300750"
            ? {
                ...stock,
                return10dPct: 27,
                distanceFromMa5Pct: 8.8,
                discussionHeat: {
                  iwencaiScore: 98,
                  eastMoneyGubaScore: 97,
                  weiboFinanceScore: 99,
                  rankingDays: 9,
                  suddenRiseDays: 1,
                  screenDominating: true
                }
              }
            : stock
        )
      }))
    });

    expect(result.candidates.some((candidate) => candidate.stock.code === "300750")).toBe(false);
    expect(result.rejections.some((rejection) => rejection.reason.includes("高位舆情过热"))).toBe(true);
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
