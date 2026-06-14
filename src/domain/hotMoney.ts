import type { HotMoneyScore, StockMetrics, TradeStage } from "./types";

function clampScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

function weightedPoint(value: number, max: number) {
  return Math.round((clampScore(value) / 100) * max);
}

function seatSignalScore(stock: StockMetrics) {
  if (stock.hotMoney.hasDragonTigerSeat) {
    return {
      score: Math.max(stock.hotMoney.seatNetBuyScore, stock.hotMoney.substituteSeatSignalScore),
      reason: "龙虎榜席位或净买信号明确"
    };
  }

  return {
    score: stock.hotMoney.substituteSeatSignalScore,
    reason: "龙虎榜缺失，使用替代席位信号"
  };
}

function isOverheated(stock: StockMetrics) {
  return (
    stock.hotMoney.onePriceLimitUp ||
    stock.hotMoney.shrinkAccelerating ||
    stock.hotMoney.lateRelayRisk ||
    stock.hotMoney.emotionProfitScore >= 94 ||
    stock.consecutiveLimitUps > 2 ||
    (stock.return10dPct > 28 && stock.distanceFromMa5Pct > 9)
  );
}

export function scoreHotMoney(stock: StockMetrics, stage: TradeStage): HotMoneyScore {
  const reasons: string[] = [];
  const risks: string[] = [];

  if (isOverheated(stock)) {
    return {
      total: 0,
      themeMatch: 0,
      limitBoard: 0,
      turnoverStructure: 0,
      seatSignal: 0,
      floatSize: 0,
      emotionEffect: 0,
      eligibleForPrimary: false,
      overheated: true,
      reasons,
      risks: ["游资过热或接力末端，剔除"]
    };
  }

  const preMarket = stage === "PREMARKET_0830";
  const seat = seatSignalScore(stock);
  const themeSignal = Math.max(
    stock.hotMoney.themeHotspotScore,
    stock.hotMoney.policyCatalystScore,
    stock.hotMoney.resonanceScore
  );
  const boardSignal = Math.max(
    stock.hotMoney.limitBoardScore,
    stock.hotMoney.boardContinuityScore,
    stock.hotMoney.sealStrengthScore
  );
  const turnoverSignal = Math.max(stock.hotMoney.turnoverStructureScore, stock.hotMoney.volumePriceFitScore);
  const floatSignal = Math.max(stock.hotMoney.floatMarketCapScore, stock.hotMoney.shareholderConcentrationScore);
  const emotionSignal = Math.max(stock.hotMoney.emotionProfitScore, stock.hotMoney.limitUpCountInMarketScore);

  const themeMatch = weightedPoint(themeSignal, preMarket ? 5 : 3);
  const limitBoard = weightedPoint(boardSignal, 4);
  const seatSignal = weightedPoint(seat.score, preMarket ? 4 : 2);
  const turnoverStructure = weightedPoint(turnoverSignal, preMarket ? 3 : 5);
  const floatSize = weightedPoint(floatSignal, 2);
  const emotionEffect = weightedPoint(emotionSignal, preMarket ? 2 : 4);
  const total = Math.min(20, themeMatch + limitBoard + seatSignal + turnoverStructure + floatSize + emotionEffect);
  const clearLogicCount = [themeSignal >= 60, boardSignal >= 55, turnoverSignal >= 60, seat.score >= 55, emotionSignal >= 55].filter(
    Boolean
  ).length;
  const hasCoreRelay = themeSignal >= 60 && turnoverSignal >= 60 && (boardSignal >= 55 || emotionSignal >= 55);
  const eligibleForPrimary = total >= 12 && clearLogicCount >= 3 && hasCoreRelay;

  if (themeSignal >= 60) {
    reasons.push("题材热点与政策催化匹配");
  }

  if (boardSignal >= 55) {
    reasons.push("涨停/连板行为具备游资辨识度");
  }

  if (turnoverSignal >= 60) {
    reasons.push("换手率和量能结构适合短线接力");
  }

  if (seat.score >= 55) {
    reasons.push(seat.reason);
  }

  if (emotionSignal >= 55) {
    reasons.push("市场情绪和赚钱效应支持短线博弈");
  }

  if (!eligibleForPrimary) {
    risks.push("游资逻辑不够清晰，不能作为首推");
  }

  return {
    total,
    themeMatch,
    limitBoard,
    turnoverStructure,
    seatSignal,
    floatSize,
    emotionEffect,
    eligibleForPrimary,
    overheated: false,
    reasons,
    risks
  };
}
