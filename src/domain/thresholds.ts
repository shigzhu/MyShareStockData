import type { StrategyThresholds } from "./types";

export const defaultThresholds: StrategyThresholds = {
  market: {
    minAdvancingDecliningRatio: 1.15,
    minLimitUpCount: 35,
    maxLimitDownCount: 10,
    minConsecutiveLimitHeight: 3,
    maxFailedBoardRatioPct: 35,
    minYesterdayLimitUpAvgReturnPct: 0
  },
  theme: {
    maxThemes: 2,
    minThemeScore: 68
  },
  stock: {
    minTurnoverAmount: 800_000_000,
    minTurnoverRatePct: 3,
    minListingDays: 120,
    maxReturn5dPct: 18,
    maxReturn10dPct: 28,
    maxReturn20dPct: 45,
    maxDistanceFromMa5Pct: 9,
    maxDistanceFromMa10Pct: 15,
    maxConsecutiveLimitUps: 1
  },
  auction: {
    idealGapPctMin: 3,
    idealGapPctMax: 7,
    minAuctionTurnoverExpansionMultiple: 3,
    minAuctionTurnoverToYesterdayPct: 1
  },
  position: {
    hardStopLossPct: -8
  }
};
