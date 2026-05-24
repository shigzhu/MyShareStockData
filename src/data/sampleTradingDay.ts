import type { StockMetrics, TradingDayInput } from "../domain/types";

function stock(overrides: Partial<StockMetrics>): StockMetrics {
  return {
    code: "300750",
    name: "宁德时代",
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
    quant: {
      pe: 24,
      pb: 4.8,
      ps: 3.6,
      evToEbitda: 18,
      revenueGrowthYoYPct: 18,
      revenueGrowthQoQPct: 7,
      profitGrowthYoYPct: 22,
      epsGrowthPct: 20,
      roePct: 16,
      roaPct: 7,
      grossMarginPct: 32,
      netMarginPct: 11,
      debtAssetRatioPct: 47,
      operatingCashFlowCoverage: 1.25,
      return1dPct: 3.2,
      relativeStrengthRank: 82,
      rsi14: 61,
      northboundNetBuyScore: 72,
      marginBalanceTrendScore: 66,
      institutionHoldingScore: 78,
      volatility20dPct: 24,
      maxDrawdown60dPct: 12,
      marketCapRankScore: 88
    },
    hotMoney: {
      themeHotspotScore: 84,
      policyCatalystScore: 72,
      resonanceScore: 78,
      limitBoardScore: 68,
      boardContinuityScore: 62,
      sealStrengthScore: 64,
      turnoverStructureScore: 76,
      volumePriceFitScore: 74,
      dragonPositionScore: 80,
      hasDragonTigerSeat: false,
      seatNetBuyScore: 0,
      substituteSeatSignalScore: 78,
      floatMarketCapScore: 68,
      shareholderConcentrationScore: 62,
      emotionProfitScore: 70,
      limitUpCountInMarketScore: 76,
      onePriceLimitUp: false,
      shrinkAccelerating: false,
      lateRelayRisk: false
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
        stock({
          code: "300750",
          name: "宁德时代",
          attentionScore: 95,
          turnoverAmount: 2_600_000_000,
          turnoverRatePct: 8.8,
          return5dPct: 6.4,
          return10dPct: 11.5,
          return20dPct: 19.2
        }),
        stock({
          code: "002230",
          name: "科大讯飞",
          attentionScore: 90,
          turnoverAmount: 2_100_000_000,
          discussionHeat: {
            iwencaiScore: 76,
            eastMoneyGubaScore: 73,
            weiboFinanceScore: 70,
            rankingDays: 3,
            suddenRiseDays: 2,
            screenDominating: false
          },
          quant: {
            ...stock({}).quant,
            pe: 36,
            pb: 5.5,
            revenueGrowthYoYPct: 14,
            profitGrowthYoYPct: 18,
            grossMarginPct: 41,
            netMarginPct: 8,
            operatingCashFlowCoverage: 1.05,
            relativeStrengthRank: 78,
            northboundNetBuyScore: 62,
            institutionHoldingScore: 70,
            volatility20dPct: 26,
            maxDrawdown60dPct: 15,
            marketCapRankScore: 80
          },
          hotMoney: {
            ...stock({}).hotMoney,
            themeHotspotScore: 76,
            limitBoardScore: 58,
            turnoverStructureScore: 72,
            hasDragonTigerSeat: true,
            seatNetBuyScore: 72,
            substituteSeatSignalScore: 66,
            emotionProfitScore: 69
          }
        }),
        stock({
          code: "688256",
          name: "寒武纪-U",
          attentionScore: 84,
          turnoverAmount: 1_500_000_000,
          discussionHeat: {
            iwencaiScore: 28,
            eastMoneyGubaScore: 31,
            weiboFinanceScore: 24,
            rankingDays: 0,
            suddenRiseDays: 0,
            screenDominating: false
          },
          quant: {
            ...stock({}).quant,
            pe: 88,
            pb: 9.5,
            revenueGrowthYoYPct: 28,
            profitGrowthYoYPct: 30,
            grossMarginPct: 62,
            netMarginPct: 16,
            operatingCashFlowCoverage: 1.15,
            relativeStrengthRank: 70,
            northboundNetBuyScore: 45,
            institutionHoldingScore: 60,
            volatility20dPct: 30,
            maxDrawdown60dPct: 18,
            marketCapRankScore: 72
          },
          hotMoney: {
            ...stock({}).hotMoney,
            themeHotspotScore: 68,
            limitBoardScore: 42,
            turnoverStructureScore: 58,
            hasDragonTigerSeat: false,
            substituteSeatSignalScore: 45,
            emotionProfitScore: 44
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
          name: "汇川技术",
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
          },
          quant: {
            ...stock({}).quant,
            pe: 30,
            pb: 6.2,
            revenueGrowthYoYPct: 16,
            profitGrowthYoYPct: 20,
            grossMarginPct: 36,
            netMarginPct: 12,
            operatingCashFlowCoverage: 1.2,
            relativeStrengthRank: 84,
            northboundNetBuyScore: 76,
            institutionHoldingScore: 82,
            volatility20dPct: 23,
            maxDrawdown60dPct: 13,
            marketCapRankScore: 86
          },
          hotMoney: {
            ...stock({}).hotMoney,
            themeHotspotScore: 82,
            limitBoardScore: 63,
            turnoverStructureScore: 78,
            hasDragonTigerSeat: false,
            substituteSeatSignalScore: 74,
            emotionProfitScore: 93,
            lateRelayRisk: false
          }
        }),
        stock({
          code: "002527",
          name: "新时达",
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
          },
          quant: {
            ...stock({}).quant,
            pe: 26,
            pb: 3.8,
            revenueGrowthYoYPct: 11,
            profitGrowthYoYPct: 13,
            grossMarginPct: 28,
            netMarginPct: 7,
            operatingCashFlowCoverage: 0.95,
            relativeStrengthRank: 73,
            northboundNetBuyScore: 52,
            institutionHoldingScore: 48,
            volatility20dPct: 29,
            maxDrawdown60dPct: 17,
            marketCapRankScore: 66
          },
          hotMoney: {
            ...stock({}).hotMoney,
            themeHotspotScore: 64,
            limitBoardScore: 56,
            turnoverStructureScore: 66,
            hasDragonTigerSeat: false,
            substituteSeatSignalScore: 58,
            floatMarketCapScore: 74,
            emotionProfitScore: 55
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
