import { formatBeijingDate, getBeijingClock, isAshareTradingDay } from "./tradingCalendar";
import type {
  CandidatePlan,
  CandidateReview,
  HomeFocus,
  RecommendationSnapshot,
  ReviewMarketData,
  ReviewOutcome,
  RuleSuggestion,
  StrategyResult
} from "./types";

export interface HomeFocusOptions {
  preferFollowUpBeforeOpen?: boolean;
}

function roundPct(value: number) {
  return Math.round(value * 100) / 100;
}

export function getHomeFocus(
  now: Date,
  tradingDay = isAshareTradingDay(formatBeijingDate(now)),
  options: HomeFocusOptions = {}
): HomeFocus {
  if (!tradingDay) {
    return "CLOSED";
  }

  const clock = getBeijingClock(now);
  const minutes = clock.hours * 60 + clock.minutes;

  if (minutes < 9 * 60 + 30) {
    return options.preferFollowUpBeforeOpen === true ? "THIRD_DAY_FOLLOW_UP" : "TODAY_RECOMMENDATION";
  }

  if (minutes < 15 * 60) {
    return "INTRADAY_REVIEW";
  }

  return "CLOSE_REVIEW";
}

export function buildRecommendationSnapshot(result: StrategyResult, generatedAt: string): RecommendationSnapshot {
  return {
    id: `${result.tradeDate}-${result.stage}`,
    tradeDate: result.tradeDate,
    stage: result.stage,
    generatedAt,
    result
  };
}

export function getPrimaryCandidate(result?: StrategyResult): CandidatePlan | undefined {
  return result?.candidates.find((candidate) => candidate.role === "PRIMARY") ?? result?.candidates[0];
}

export function summarizeReviewOutcome(outcome: ReviewOutcome): string {
  switch (outcome) {
    case "SUCCESS":
      return "成功";
    case "NEUTRAL":
      return "一般";
    case "FAILED":
      return "失败";
    case "MISSING_MARKET_DATA":
      return "缺复盘行情";
  }
}

function outcomeFromReturn(returnPct?: number): ReviewOutcome {
  if (returnPct === undefined) {
    return "MISSING_MARKET_DATA";
  }

  if (returnPct > 2) {
    return "SUCCESS";
  }

  if (returnPct >= 0) {
    return "NEUTRAL";
  }

  return "FAILED";
}

function buildAttribution(candidate: CandidatePlan, outcome: ReviewOutcome, systemReturnPct?: number, dataMatches = true): string[] {
  if (outcome === "MISSING_MARKET_DATA") {
    if (!dataMatches) {
      return ["复盘行情数据不匹配，暂不判断系统推荐成败"];
    }

    return ["缺复盘行情，暂不判断系统推荐成败"];
  }

  if (outcome === "SUCCESS") {
    return [candidate.role === "PRIMARY" ? "首推验证成功，次日收益超过2%" : "备选验证成功，次日收益超过2%"];
  }

  if (outcome === "NEUTRAL") {
    return ["次日收益为正但不足2%，判断为一般，需要继续观察买点质量"];
  }

  const lines = [`次日理论收益${systemReturnPct ?? 0}%，推荐失败，需要检查高分因子是否失真`];

  if (candidate.scoreBreakdown.discussion >= 12) {
    lines.push("讨论热度分较高但收益失败，检查是否热度过热或一致性太强");
  }

  if (candidate.scoreBreakdown.hotMoney >= 16) {
    lines.push("游资逻辑分较高但收益失败，检查接力证据和退潮期风险");
  }

  if (candidate.scoreBreakdown.quant >= 16) {
    lines.push("量化分较高但收益失败，检查短线情绪是否压过量化优势");
  }

  if (candidate.scoreBreakdown.trading >= 20) {
    lines.push("交易主逻辑分较高但收益失败，检查竞价承接和题材延续");
  }

  return lines;
}

export function buildCandidateReview(
  result: StrategyResult,
  candidate: CandidatePlan,
  marketData: ReviewMarketData,
  updatedAt: string
): CandidateReview {
  const dataMatches = marketData.code === candidate.stock.code && marketData.recommendationTradeDate === result.tradeDate;
  const buyPrice = marketData.buyPrice;
  const closePrice = marketData.closePrice;
  const hasReturnData = dataMatches && buyPrice !== undefined && closePrice !== undefined && buyPrice > 0;
  const systemReturnPct = hasReturnData ? roundPct(((closePrice - buyPrice) / buyPrice) * 100) : undefined;
  const outcome = outcomeFromReturn(systemReturnPct);
  const idSeed = `${result.tradeDate}-${result.stage}-${candidate.stock.code}`;

  return {
    id: `${idSeed}-${marketData.reviewTradeDate}`,
    recommendationTradeDate: result.tradeDate,
    reviewTradeDate: marketData.reviewTradeDate,
    stage: result.stage,
    code: candidate.stock.code,
    name: candidate.stock.name,
    role: candidate.role,
    phase: "CLOSE_REVIEW",
    systemReturnPct,
    outcome,
    beatIndex: systemReturnPct !== undefined && marketData.indexReturnPct !== undefined ? systemReturnPct > marketData.indexReturnPct : undefined,
    beatSector:
      systemReturnPct !== undefined && marketData.sectorReturnPct !== undefined ? systemReturnPct > marketData.sectorReturnPct : undefined,
    attribution: buildAttribution(candidate, outcome, systemReturnPct, dataMatches),
    ruleSuggestionIds: outcome === "FAILED" ? [`rule-${idSeed}`] : [],
    updatedAt
  };
}

export function buildRuleSuggestions(
  result: StrategyResult,
  candidate: CandidatePlan,
  review: CandidateReview,
  marketStage: string
): RuleSuggestion[] {
  if (review.outcome !== "FAILED") {
    return [];
  }

  const idBase = `rule-${result.tradeDate}-${result.stage}-${candidate.stock.code}`;
  const evidence = [
    `${candidate.stock.name}次日复盘失败`,
    `总分${candidate.score}/100`,
    result.stage === "AUCTION_0925"
      ? `竞价${candidate.scoreBreakdown.auction}/40，8:30延续${candidate.scoreBreakdown.premarket}/20，题材${candidate.scoreBreakdown.themeOpen}/15，盘口${candidate.scoreBreakdown.orderBook}/10，接力${candidate.scoreBreakdown.hotMoneyRelay}/10，复核${candidate.scoreBreakdown.riskRecheck}/5`
      : `交易${candidate.scoreBreakdown.trading}/25，游资${candidate.scoreBreakdown.hotMoney}/20，量化${candidate.scoreBreakdown.quant}/20，热度${candidate.scoreBreakdown.discussion}/15，官方${candidate.scoreBreakdown.official}/10，复盘${candidate.scoreBreakdown.review}/10`
  ];

  const suggestions: RuleSuggestion[] = [
    {
      id: idBase,
      createdAt: review.updatedAt,
      recommendationTradeDate: result.tradeDate,
      code: candidate.stock.code,
      name: candidate.stock.name,
      type: "FILTER_TIGHTEN",
      title: "收紧失败形态过滤",
      detail: "在相同市场阶段下，对高分但次日失败的形态提高竞价承接和题材延续过滤要求。",
      evidence,
      marketStage,
      status: "PENDING"
    }
  ];

  if (candidate.scoreBreakdown.discussion >= 12) {
    suggestions.push({
      id: `${idBase}-discussion`,
      createdAt: review.updatedAt,
      recommendationTradeDate: result.tradeDate,
      code: candidate.stock.code,
      name: candidate.stock.name,
      type: "FACTOR_WEIGHT",
      title: "检查讨论热度权重",
      detail: "该票热度分较高但次日失败，建议在退潮或震荡阶段降低过热讨论信号权重。",
      evidence,
      marketStage,
      status: "PENDING"
    });
  }

  return suggestions;
}
