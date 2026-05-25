export type TradeStage = "PREMARKET_0830" | "AUCTION_0925";
export type MarketGateStatus = "TRADABLE" | "NO_TRADE";
export type CandidateRole = "PRIMARY" | "CONFIRMED" | "BACKUP" | "REJECTED";
export type DataCompleteness = "FULL" | "PARTIAL" | "MANUAL_AUCTION" | "MISSING";
export type DataRefreshStatus = "PENDING" | "SUCCESS" | "FAILED" | "MISSING_REQUIRED_DATA" | "NOT_RECOMMENDED";
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
  quant: QuantMetrics;
  hotMoney: HotMoneyMetrics;
}

export interface QuantMetrics {
  pe?: number;
  pb?: number;
  ps?: number;
  evToEbitda?: number;
  revenueGrowthYoYPct?: number;
  revenueGrowthQoQPct?: number;
  profitGrowthYoYPct?: number;
  epsGrowthPct?: number;
  roePct?: number;
  roaPct?: number;
  grossMarginPct?: number;
  netMarginPct?: number;
  debtAssetRatioPct?: number;
  operatingCashFlowCoverage?: number;
  return1dPct?: number;
  relativeStrengthRank?: number;
  rsi14?: number;
  northboundNetBuyScore?: number;
  marginBalanceTrendScore?: number;
  institutionHoldingScore?: number;
  volatility20dPct?: number;
  maxDrawdown60dPct?: number;
  marketCapRankScore?: number;
}

export interface HotMoneyMetrics {
  themeHotspotScore: number;
  policyCatalystScore: number;
  resonanceScore: number;
  limitBoardScore: number;
  boardContinuityScore: number;
  sealStrengthScore: number;
  turnoverStructureScore: number;
  volumePriceFitScore: number;
  dragonPositionScore: number;
  hasDragonTigerSeat: boolean;
  seatNetBuyScore: number;
  substituteSeatSignalScore: number;
  floatMarketCapScore: number;
  shareholderConcentrationScore: number;
  emotionProfitScore: number;
  limitUpCountInMarketScore: number;
  onePriceLimitUp: boolean;
  shrinkAccelerating: boolean;
  lateRelayRisk: boolean;
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

export interface QuantScore {
  total: number;
  valuation: number;
  growth: number;
  quality: number;
  momentum: number;
  capital: number;
  riskControl: number;
  passed: boolean;
  reasons: string[];
  risks: string[];
  missingRequiredData: string[];
}

export interface HotMoneyScore {
  total: number;
  themeMatch: number;
  limitBoard: number;
  turnoverStructure: number;
  seatSignal: number;
  floatSize: number;
  emotionEffect: number;
  eligibleForPrimary: boolean;
  overheated: boolean;
  reasons: string[];
  risks: string[];
}

export interface ScoreBreakdown {
  trading: number;
  hotMoney: number;
  discussion: number;
  quant: number;
  total: number;
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
  quant: QuantScore;
  hotMoney: HotMoneyScore;
  scoreBreakdown: ScoreBreakdown;
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

export interface RecommendationJobState {
  stage: TradeStage;
  tradeDate: string;
  status: DataRefreshStatus;
  message: string;
  result?: StrategyResult;
  updatedAt?: string;
}

export interface IntradayRefreshState {
  tradeDate: string;
  preMarket: RecommendationJobState;
  auction: RecommendationJobState;
}

export type ReviewPhase = "INTRADAY_OBSERVATION" | "CLOSE_REVIEW" | "THIRD_DAY_FOLLOW_UP";
export type ReviewOutcome = "SUCCESS" | "NEUTRAL" | "FAILED" | "MISSING_MARKET_DATA";
export type TradeExecutionOutcome = "PROFIT" | "LOSS" | "BREAKEVEN" | "NOT_TRADED" | "OPEN";
export type RuleSuggestionStatus = "PENDING" | "APPROVED" | "REJECTED" | "DEFERRED";
export type RuleSuggestionType =
  | "FACTOR_WEIGHT"
  | "FILTER_ADD"
  | "FILTER_TIGHTEN"
  | "FILTER_RELAX"
  | "MARKET_STAGE_SWITCH"
  | "DISCIPLINE";
export type TradeReason =
  | "按计划执行"
  | "追高"
  | "低吸"
  | "打板"
  | "止损"
  | "止盈"
  | "情绪冲动"
  | "临盘放弃"
  | "未达到买点";
export type HomeFocus =
  | "TODAY_RECOMMENDATION"
  | "INTRADAY_REVIEW"
  | "CLOSE_REVIEW"
  | "THIRD_DAY_FOLLOW_UP"
  | "CLOSED";

export interface RecommendationSnapshot {
  id: string;
  tradeDate: string;
  stage: TradeStage;
  generatedAt: string;
  result: StrategyResult;
}

export interface StoredDailyPlan {
  tradeDate: string;
  preMarket?: StrategyResult;
  auction?: StrategyResult;
  snapshots: RecommendationSnapshot[];
}

export interface ReviewMarketData {
  code: string;
  name: string;
  recommendationTradeDate: string;
  reviewTradeDate: string;
  buyPrice?: number;
  closePrice?: number;
  highPrice?: number;
  indexReturnPct?: number;
  sectorReturnPct?: number;
}

export interface CandidateReview {
  id: string;
  recommendationTradeDate: string;
  reviewTradeDate: string;
  stage: TradeStage;
  code: string;
  name: string;
  role: CandidateRole;
  phase: ReviewPhase;
  systemReturnPct?: number;
  outcome: ReviewOutcome;
  beatIndex?: boolean;
  beatSector?: boolean;
  attribution: string[];
  ruleSuggestionIds: string[];
  updatedAt: string;
}

export interface TradeLogEntry {
  id: string;
  recommendationTradeDate: string;
  stage: TradeStage;
  code: string;
  name: string;
  bought: boolean;
  buyPrice?: number;
  sellPrice?: number;
  positionPct?: number;
  buyTime?: string;
  sellTime?: string;
  reasons: TradeReason[];
  note: string;
  outcome: TradeExecutionOutcome;
  createdAt: string;
  updatedAt: string;
}

export interface RuleSuggestion {
  id: string;
  createdAt: string;
  recommendationTradeDate: string;
  code?: string;
  name?: string;
  type: RuleSuggestionType;
  title: string;
  detail: string;
  evidence: string[];
  marketStage: string;
  status: RuleSuggestionStatus;
}
