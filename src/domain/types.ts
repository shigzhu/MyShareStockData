export type TradeStage = "PREMARKET_0830" | "AUCTION_0925";
export type MarketGateStatus = "TRADABLE" | "NO_TRADE";
export type CandidateRole = "PRIMARY" | "CONFIRMED" | "BACKUP" | "REJECTED";
export type DataCompleteness = "FULL" | "PARTIAL" | "MANUAL_AUCTION" | "MISSING";
export type HeatTemperature = "冷门" | "升温" | "热门" | "过热" | "异常刷屏";
export type DeleteReason = "过热" | "不喜欢" | "已买过" | "风险大" | "题材不认可" | "其他";

export interface MarketMood {
  advancingCount: number;
  decliningCount: number;
  limitUpCount: number;
  limitDownCount: number;
  consecutiveLimitHeight: number;
  failedBoardRatioPct: number;
  yesterdayLimitUpAvgReturnPct: number;
}

export interface StockMetrics {
  code: string;
  name: string;
  themeId: string;
  lastClose: number;
  turnoverAmount: number;
  turnoverRatePct: number;
  return5dPct: number;
  return10dPct: number;
  return20dPct: number;
  distanceFromMa5Pct: number;
  distanceFromMa10Pct: number;
  consecutiveLimitUps: number;
  blowOffVolume: boolean;
  weakAcceptanceAfterBlowOff: boolean;
  isSt: boolean;
  isSuspended: boolean;
  listingDays: number;
  severeFinancialRisk: boolean;
  majorNegativeEvent: boolean;
  attentionScore: number;
  discussionHeat: DiscussionHeatMetrics;
}

export interface DiscussionHeatMetrics {
  iwencaiScore: number;
  eastMoneyGubaScore: number;
  weiboFinanceScore: number;
  rankingDays: number;
  suddenRiseDays: number;
  screenDominating: boolean;
}

export interface DiscussionHeatScore {
  rawScore: number;
  weightedScore: number;
  temperature: HeatTemperature;
  reasons: string[];
  risks: string[];
  reject: boolean;
}

export interface ThemeMetrics {
  id: string;
  name: string;
  recentStrengthScore: number;
  moneyMakingScore: number;
  turnoverHeatScore: number;
  continuationScore: number;
  stocks: StockMetrics[];
}

export interface AuctionMetrics {
  code: string;
  gapPct: number;
  auctionTurnoverAmount: number;
  recentAuctionTurnoverAvg: number;
  yesterdayTurnoverAmount: number;
  nearOnePriceLimitUp: boolean;
  weakToStrongFailed: boolean;
}

export interface TradingDayInput {
  tradeDate: string;
  marketMood: MarketMood;
  themes: ThemeMetrics[];
  auctionByCode?: Record<string, AuctionMetrics>;
  dataCompleteness: DataCompleteness;
}

export interface StrategyThresholds {
  market: {
    minAdvancingDecliningRatio: number;
    minLimitUpCount: number;
    maxLimitDownCount: number;
    minConsecutiveLimitHeight: number;
    maxFailedBoardRatioPct: number;
    minYesterdayLimitUpAvgReturnPct: number;
  };
  theme: {
    maxThemes: number;
    minThemeScore: number;
  };
  stock: {
    minTurnoverAmount: number;
    minTurnoverRatePct: number;
    minListingDays: number;
    maxReturn5dPct: number;
    maxReturn10dPct: number;
    maxReturn20dPct: number;
    maxDistanceFromMa5Pct: number;
    maxDistanceFromMa10Pct: number;
    maxConsecutiveLimitUps: number;
  };
  auction: {
    idealGapPctMin: number;
    idealGapPctMax: number;
    minAuctionTurnoverExpansionMultiple: number;
    minAuctionTurnoverToYesterdayPct: number;
  };
  position: {
    hardStopLossPct: number;
  };
}

export interface Rejection {
  code?: string;
  themeId?: string;
  reason: string;
}

export interface CandidatePlan {
  stock: StockMetrics;
  theme: ThemeMetrics;
  role: CandidateRole;
  score: number;
  tradingScore: number;
  heat: DiscussionHeatScore;
  reasons: string[];
  risks: string[];
  entryPlan: string;
  noBuyCondition: string;
  stopLoss: string;
  trendExit: string;
}

export interface RecommendationDeletion {
  code: string;
  name: string;
  tradeDate: string;
  stage: TradeStage;
  role: CandidateRole;
  reason: DeleteReason;
  deletedAt: string;
}

export interface StrategyResult {
  stage: TradeStage;
  tradeDate: string;
  marketStatus: MarketGateStatus;
  summary: string;
  candidates: CandidatePlan[];
  rejections: Rejection[];
  dataCompleteness: DataCompleteness;
}
