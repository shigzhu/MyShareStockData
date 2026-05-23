import type { StockMetrics, TradingDayInput } from "../domain/types";

function stock(overrides: Partial<StockMetrics>): StockMetrics {
  return {
    code: "300750",
    name: "样本科技",
    themeId: "ai",
    lastClose: 20,
    turnoverAmount: 1_800_000_000,
    turnoverRatePct: 6,
    return5dPct: 7,
    return10dPct: 13,
    return20dPct: 24,
    distanceFromMa5Pct: 3.8,
    distanceFromMa10Pct: 7.4,
    consecutiveLimitUps: 0,
    blowOffVolume: false,
    weakAcceptanceAfterBlowOff: false,
    isSt: false,
    isSuspended: false,
    listingDays: 900,
    severeFinancialRisk: false,
    majorNegativeEvent: false,
    attentionScore: 88,
    discussionHeat: {
      iwencaiScore: 58,
      eastMoneyGubaScore: 62,
      weiboFinanceScore: 55,
      rankingDays: 2,
      suddenRiseDays: 2,
      screenDominating: false
    },
    ...overrides
  };
}

export const sampleTradingDay: TradingDayInput = {
  tradeDate: "2026-05-21",
  dataCompleteness: "PARTIAL",
  marketMood: {
    advancingCount: 3200,
    decliningCount: 1600,
    limitUpCount: 62,
    limitDownCount: 3,
    consecutiveLimitHeight: 5,
    failedBoardRatioPct: 20,
    yesterdayLimitUpAvgReturnPct: 2.1
  },
  themes: [
    {
      id: "ai",
      name: "人工智能",
      recentStrengthScore: 88,
      moneyMakingScore: 84,
      turnoverHeatScore: 91,
      continuationScore: 79,
      stocks: [
        stock({ code: "300750", name: "云算科技", attentionScore: 95, turnoverAmount: 2_600_000_000 }),
        stock({
          code: "002230",
          name: "智联股份",
          attentionScore: 90,
          turnoverAmount: 2_100_000_000,
          discussionHeat: {
            iwencaiScore: 76,
            eastMoneyGubaScore: 73,
            weiboFinanceScore: 70,
            rankingDays: 3,
            suddenRiseDays: 2,
            screenDominating: false
          }
        }),
        stock({
          code: "688256",
          name: "芯源智能",
          attentionScore: 84,
          turnoverAmount: 1_500_000_000,
          discussionHeat: {
            iwencaiScore: 28,
            eastMoneyGubaScore: 31,
            weiboFinanceScore: 24,
            rankingDays: 0,
            suddenRiseDays: 0,
            screenDominating: false
          }
        })
      ]
    },
    {
      id: "robot",
      name: "机器人",
      recentStrengthScore: 82,
      moneyMakingScore: 80,
      turnoverHeatScore: 85,
      continuationScore: 76,
      stocks: [
        stock({
          code: "300124",
          name: "机电核心",
          themeId: "robot",
          attentionScore: 91,
          turnoverAmount: 2_300_000_000,
          discussionHeat: {
            iwencaiScore: 90,
            eastMoneyGubaScore: 91,
            weiboFinanceScore: 88,
            rankingDays: 2,
            suddenRiseDays: 1,
            screenDominating: false
          }
        }),
        stock({
          code: "002527",
          name: "精密传动",
          themeId: "robot",
          attentionScore: 87,
          turnoverAmount: 1_900_000_000,
          discussionHeat: {
            iwencaiScore: 45,
            eastMoneyGubaScore: 42,
            weiboFinanceScore: 39,
            rankingDays: 1,
            suddenRiseDays: 1,
            screenDominating: false
          }
        })
      ]
    }
  ],
  auctionByCode: {
    "300750": {
      code: "300750",
      gapPct: 4.6,
      auctionTurnoverAmount: 42_000_000,
      recentAuctionTurnoverAvg: 10_000_000,
      yesterdayTurnoverAmount: 2_600_000_000,
      nearOnePriceLimitUp: false,
      weakToStrongFailed: false
    },
    "002230": {
      code: "002230",
      gapPct: 2.2,
      auctionTurnoverAmount: 32_000_000,
      recentAuctionTurnoverAvg: 8_000_000,
      yesterdayTurnoverAmount: 2_100_000_000,
      nearOnePriceLimitUp: false,
      weakToStrongFailed: false
    }
  }
};
