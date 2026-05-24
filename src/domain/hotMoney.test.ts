import { describe, expect, it } from "vitest";
import { sampleTradingDay } from "../data/sampleTradingDay";
import { scoreHotMoney } from "./hotMoney";
import type { StockMetrics } from "./types";

const baseStock = sampleTradingDay.themes[0].stocks[0];

function withHotMoney(overrides: Partial<StockMetrics["hotMoney"]>): StockMetrics {
  return {
    ...baseStock,
    hotMoney: {
      ...baseStock.hotMoney,
      ...overrides
    }
  };
}

describe("scoreHotMoney", () => {
  it("uses 8:30 weights that emphasize theme, boards, and seat signals", () => {
    const result = scoreHotMoney(baseStock, "PREMARKET_0830");

    expect(result.total).toBeGreaterThanOrEqual(14);
    expect(result.themeMatch).toBeGreaterThan(result.turnoverStructure);
    expect(result.seatSignal).toBeGreaterThanOrEqual(3);
    expect(result.eligibleForPrimary).toBe(true);
  });

  it("uses 9:25 weights that emphasize turnover and emotion confirmation", () => {
    const result = scoreHotMoney(baseStock, "AUCTION_0925");

    expect(result.turnoverStructure).toBeGreaterThan(result.themeMatch);
    expect(result.emotionEffect).toBeGreaterThanOrEqual(3);
    expect(result.total).toBeLessThanOrEqual(20);
  });

  it("uses substitute seat signals when explicit dragon-tiger data is unavailable", () => {
    const result = scoreHotMoney(withHotMoney({ hasDragonTigerSeat: false, substituteSeatSignalScore: 82 }), "PREMARKET_0830");

    expect(result.seatSignal).toBeGreaterThanOrEqual(3);
    expect(result.reasons).toContain("龙虎榜缺失，使用替代席位信号");
  });

  it("allows backup but prevents primary when hot-money logic is unclear", () => {
    const result = scoreHotMoney(
      withHotMoney({
        themeHotspotScore: 20,
        policyCatalystScore: 20,
        resonanceScore: 20,
        limitBoardScore: 15,
        boardContinuityScore: 15,
        sealStrengthScore: 15,
        turnoverStructureScore: 30,
        volumePriceFitScore: 30,
        hasDragonTigerSeat: false,
        seatNetBuyScore: 0,
        substituteSeatSignalScore: 15,
        emotionProfitScore: 20,
        limitUpCountInMarketScore: 20
      }),
      "PREMARKET_0830"
    );

    expect(result.overheated).toBe(false);
    expect(result.eligibleForPrimary).toBe(false);
  });

  it("strictly rejects overheated late relay patterns", () => {
    const result = scoreHotMoney(
      withHotMoney({
        onePriceLimitUp: true,
        shrinkAccelerating: true,
        lateRelayRisk: true,
        emotionProfitScore: 96
      }),
      "AUCTION_0925"
    );

    expect(result.overheated).toBe(true);
    expect(result.total).toBe(0);
    expect(result.risks).toContain("游资过热或接力末端，剔除");
  });
});
