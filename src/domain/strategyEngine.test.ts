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

  it("marks the strongest 24:00 candidate as primary", () => {
    const result = generatePreMarketPlan(sampleTradingDay);

    expect(result.candidates[0].role).toBe("PRIMARY");
  });

  it("caps cross-platform discussion heat at 15 percent of the 24:00 stock score", () => {
    const normalHeat = generatePreMarketPlan(sampleTradingDay);
    const coldStock = normalHeat.candidates.find((candidate) => candidate.stock.code === "688256");
    const warmingStock = normalHeat.candidates.find((candidate) => candidate.stock.code === "300750");

    expect(warmingStock?.heat.temperature).toBe("升温");
    expect(warmingStock?.heat.weightedScore).toBeLessThanOrEqual(15);
    expect(warmingStock?.heat.weightedScore).toBeGreaterThan(9);
    expect(coldStock?.heat.temperature).toBe("冷门");
    expect(coldStock?.heat.weightedScore).toBeLessThan(6);
  });

  it("builds an 24:00 score from 25 trading, 20 hot-money, 20 quant, 15 discussion, 10 official, and 10 review points", () => {
    const result = generatePreMarketPlan(sampleTradingDay);
    const candidate = result.candidates[0];

    expect(candidate.scoreBreakdown.trading).toBeLessThanOrEqual(25);
    expect(candidate.scoreBreakdown.hotMoney).toBeLessThanOrEqual(20);
    expect(candidate.scoreBreakdown.quant).toBeLessThanOrEqual(20);
    expect(candidate.scoreBreakdown.discussion).toBeLessThanOrEqual(15);
    expect(candidate.scoreBreakdown.official).toBeLessThanOrEqual(10);
    expect(candidate.scoreBreakdown.review).toBeLessThanOrEqual(10);
    expect(candidate.scoreBreakdown.total).toBe(candidate.score);
    expect(candidate.scoreBreakdown.total).toBe(
      candidate.scoreBreakdown.trading +
        candidate.scoreBreakdown.hotMoney +
        candidate.scoreBreakdown.quant +
        candidate.scoreBreakdown.discussion +
        candidate.scoreBreakdown.official +
        candidate.scoreBreakdown.review
    );
  });

  it("rejects stocks when required quant data is missing", () => {
    const result = generatePreMarketPlan({
      ...sampleTradingDay,
      themes: sampleTradingDay.themes.map((theme) => ({
        ...theme,
        stocks: theme.stocks.map((stock) =>
          stock.code === "300750"
            ? {
                ...stock,
                quant: {
                  ...stock.quant,
                  grossMarginPct: undefined
                }
              }
            : stock
        )
      }))
    });

    expect(result.candidates.some((candidate) => candidate.stock.code === "300750")).toBe(false);
    expect(result.rejections.some((rejection) => rejection.reason.includes("关键量化数据缺失"))).toBe(true);
  });

  it("does not assign primary to candidates without clear hot-money logic", () => {
    const result = generatePreMarketPlan({
      ...sampleTradingDay,
      themes: sampleTradingDay.themes.map((theme) => ({
        ...theme,
        stocks: theme.stocks.map((stock) => ({
          ...stock,
          hotMoney: {
            ...stock.hotMoney,
            themeHotspotScore: 15,
            policyCatalystScore: 15,
            resonanceScore: 15,
            limitBoardScore: 15,
            boardContinuityScore: 15,
            sealStrengthScore: 15,
            turnoverStructureScore: 20,
            volumePriceFitScore: 20,
            hasDragonTigerSeat: false,
            seatNetBuyScore: 0,
            substituteSeatSignalScore: 15,
            emotionProfitScore: 20,
            limitUpCountInMarketScore: 20
          }
        }))
      }))
    });

    expect(result.candidates).not.toHaveLength(0);
    expect(result.candidates[0].role).toBe("BACKUP");
    expect(result.summary).toContain("无清晰游资首推");
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

  it("rejects limit-up leaders with more than two boards in the latest five trading days", () => {
    const result = generatePreMarketPlan({
      ...sampleTradingDay,
      themes: sampleTradingDay.themes.map((theme) => ({
        ...theme,
        stocks: theme.stocks.map((stock) =>
          stock.code === "300750"
            ? {
                ...stock,
                consecutiveLimitUps: 3
              }
            : stock
        )
      }))
    });

    expect(result.candidates.some((candidate) => candidate.stock.code === "300750")).toBe(false);
    expect(result.rejections.some((rejection) => rejection.code === "300750" && rejection.reason.includes("过热"))).toBe(
      true
    );
  });

  it("keeps three premarket observation candidates when the market is tradable but strict filters remove all stocks", () => {
    const result = generatePreMarketPlan({
      ...sampleTradingDay,
      themes: sampleTradingDay.themes.map((theme) => ({
        ...theme,
        stocks: theme.stocks.map((stock) => ({
          ...stock,
          turnoverAmount: 1_000_000,
          turnoverRatePct: 0.1
        }))
      }))
    });

    expect(result.marketStatus).toBe("TRADABLE");
    expect(result.candidates.length).toBeGreaterThanOrEqual(3);
    expect(result.candidates[0].role).toBe("PRIMARY");
    expect(result.summary).toContain("保底");
    expect(result.candidates[0].risks.join(" ")).toContain("风险过滤未完全通过");
  });
});

describe("generateAuctionPlan", () => {
  it("rebuilds the 9:25 score around 40 percent auction confirmation weight", () => {
    const premarket = generatePreMarketPlan(sampleTradingDay);
    const result = generateAuctionPlan(sampleTradingDay, premarket);
    const candidate = result.candidates[0];

    expect(candidate.scoreBreakdown.auction).toBeLessThanOrEqual(40);
    expect(candidate.scoreBreakdown.premarket).toBeLessThanOrEqual(20);
    expect(candidate.scoreBreakdown.themeOpen).toBeLessThanOrEqual(15);
    expect(candidate.scoreBreakdown.orderBook).toBeLessThanOrEqual(10);
    expect(candidate.scoreBreakdown.hotMoneyRelay).toBeLessThanOrEqual(10);
    expect(candidate.scoreBreakdown.riskRecheck).toBeLessThanOrEqual(5);
    expect(candidate.scoreBreakdown.total).toBe(
      candidate.scoreBreakdown.auction +
        candidate.scoreBreakdown.premarket +
        candidate.scoreBreakdown.themeOpen +
        candidate.scoreBreakdown.orderBook +
        candidate.scoreBreakdown.hotMoneyRelay +
        candidate.scoreBreakdown.riskRecheck
    );
  });

  it("ranks the only fully confirmed stock first and fills backups from premarket candidates", () => {
    const premarket = generatePreMarketPlan(sampleTradingDay);
    const result = generateAuctionPlan(sampleTradingDay, premarket);

    expect(result.stage).toBe("AUCTION_0925");
    expect(result.candidates[0].role).toBe("PRIMARY");
    expect(result.candidates[0].stock.code).toBe("300750");
    expect(result.candidates.length).toBeGreaterThanOrEqual(3);
    expect(result.candidates[1].role).toBe("CONFIRMED");
  });

  it("keeps 9:25 primary limited to confirmed candidates with hot-money eligibility", () => {
    const input = {
      ...sampleTradingDay,
      themes: sampleTradingDay.themes.map((theme) => ({
        ...theme,
        stocks: theme.stocks.map((stock) =>
          stock.code === "300750"
            ? {
                ...stock,
                hotMoney: {
                  ...stock.hotMoney,
                  themeHotspotScore: 15,
                  policyCatalystScore: 15,
                  resonanceScore: 15,
                  limitBoardScore: 15,
                  boardContinuityScore: 15,
                  sealStrengthScore: 15,
                  turnoverStructureScore: 20,
                  volumePriceFitScore: 20,
                  hasDragonTigerSeat: false,
                  seatNetBuyScore: 0,
                  substituteSeatSignalScore: 15,
                  emotionProfitScore: 20,
                  limitUpCountInMarketScore: 20
                }
              }
            : stock
        )
      }))
    };
    const premarket = generatePreMarketPlan(input);
    const result = generateAuctionPlan(input, premarket);

    expect(result.candidates[0].stock.code).not.toBe("300750");
    expect(result.candidates[0].hotMoney.eligibleForPrimary).toBe(true);
  });
});

