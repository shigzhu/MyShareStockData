import type { MarketGateStatus, MarketMood, StrategyThresholds } from "./types";

export interface MarketGateResult {
  status: MarketGateStatus;
  score: number;
  reasons: string[];
}

export function evaluateMarketGate(
  mood: MarketMood,
  thresholds: StrategyThresholds
): MarketGateResult {
  const reasons: string[] = [];
  const advancingDecliningRatio = mood.advancingCount / Math.max(1, mood.decliningCount);
  let score = 0;

  if (advancingDecliningRatio >= thresholds.market.minAdvancingDecliningRatio) {
    score += 20;
  } else {
    reasons.push("上涨家数不足");
  }

  if (mood.limitUpCount >= thresholds.market.minLimitUpCount) {
    score += 20;
  } else {
    reasons.push("涨停数量不足");
  }

  if (mood.limitDownCount <= thresholds.market.maxLimitDownCount) {
    score += 20;
  } else {
    reasons.push("跌停数量过多");
  }

  if (mood.consecutiveLimitHeight >= thresholds.market.minConsecutiveLimitHeight) {
    score += 15;
  } else {
    reasons.push("连板高度不足");
  }

  if (mood.failedBoardRatioPct <= thresholds.market.maxFailedBoardRatioPct) {
    score += 15;
  } else {
    reasons.push("炸板率过高");
  }

  if (mood.yesterdayLimitUpAvgReturnPct >= thresholds.market.minYesterdayLimitUpAvgReturnPct) {
    score += 10;
  } else {
    reasons.push("昨日涨停反馈偏弱");
  }

  const status: MarketGateStatus = reasons.length === 0 ? "TRADABLE" : "NO_TRADE";

  return {
    status,
    score,
    reasons: status === "TRADABLE" ? ["赚钱效应合格"] : reasons
  };
}
