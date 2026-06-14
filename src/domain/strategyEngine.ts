import { confirmAuction } from "./auctionConfirmation";
import { scoreDiscussionHeat } from "./discussionHeat";
import { scoreHotMoney } from "./hotMoney";
import { evaluateMarketGate } from "./marketGate";
import { scoreQuantFactors } from "./quantFactors";
import { getRiskRejections } from "./riskFilters";
import { defaultThresholds } from "./thresholds";
import { scoreTheme, selectTradableThemes } from "./themeSelection";
import type {
  CandidatePlan,
  DiscussionHeatScore,
  HotMoneyScore,
  QuantScore,
  StockMetrics,
  StrategyResult,
  StrategyThresholds,
  ThemeMetrics,
  TradingDayInput
} from "./types";

function scoreTradingLogic(stock: StockMetrics, themeScore: number): number {
  const liquidityScore = Math.min(6, stock.turnoverAmount / 430_000_000);
  const attention = Math.min(6, stock.attentionScore * 0.06);
  const position = Math.max(0, 6 - stock.return10dPct * 0.09 - stock.distanceFromMa5Pct * 0.13);
  const theme = Math.min(7, themeScore * 0.07);
  return Math.round(liquidityScore + attention + position + theme);
}

function normalizeDiscussionScore(heat: DiscussionHeatScore): number {
  return Math.max(0, Math.min(15, heat.weightedScore));
}

function normalizeQuantScore(quant: QuantScore): number {
  return Math.round((Math.max(0, Math.min(30, quant.total)) / 30) * 20);
}

function scoreOfficialSignals(stock: StockMetrics): number {
  let score = 8;

  if (stock.majorNegativeEvent || stock.severeFinancialRisk || stock.isSt || stock.isSuspended) {
    return 0;
  }

  if (stock.hotMoney.hasDragonTigerSeat && stock.hotMoney.seatNetBuyScore >= 65) {
    score += 2;
  } else if (stock.hotMoney.policyCatalystScore >= 70) {
    score += 1;
  }

  return Math.max(0, Math.min(10, score));
}

function scoreReviewFeedback(stock: StockMetrics): number {
  const stableShape = stock.return10dPct <= 18 && stock.distanceFromMa5Pct <= 6 && stock.hotMoney.lateRelayRisk === false;
  const score = 7 + (stableShape ? 2 : 0) + (stock.weakAcceptanceAfterBlowOff ? -3 : 0);
  return Math.max(0, Math.min(10, score));
}

function emptyAuctionBreakdown() {
  return {
    auction: 0,
    premarket: 0,
    themeOpen: 0,
    orderBook: 0,
    hotMoneyRelay: 0,
    riskRecheck: 0
  };
}

function buildScoreBreakdown(
  tradingScore: number,
  hotMoney: HotMoneyScore,
  heat: DiscussionHeatScore,
  quant: QuantScore,
  stock: StockMetrics
) {
  const trading = Math.max(0, Math.min(25, tradingScore));
  const discussion = normalizeDiscussionScore(heat);
  const quantScore = normalizeQuantScore(quant);
  const official = scoreOfficialSignals(stock);
  const review = scoreReviewFeedback(stock);
  const total = trading + hotMoney.total + quantScore + discussion + official + review;

  return {
    trading,
    hotMoney: hotMoney.total,
    discussion,
    quant: quantScore,
    official,
    review,
    ...emptyAuctionBreakdown(),
    total: Math.min(100, total)
  };
}

function buildAuctionScoreBreakdown(candidate: CandidatePlan, hotMoney: HotMoneyScore, auctionScore: number, confirmed: boolean) {
  const auction = Math.max(0, Math.min(40, auctionScore));
  const premarket = Math.round((Math.max(0, Math.min(100, candidate.score)) / 100) * 20);
  const themeOpen = Math.round((Math.max(0, Math.min(25, candidate.scoreBreakdown.trading)) / 25) * 15);
  const orderBook = confirmed ? 10 : Math.round((candidate.scoreBreakdown.trading / 25) * 5);
  const hotMoneyRelay = Math.round((Math.max(0, Math.min(20, hotMoney.total)) / 20) * 10);
  const riskRecheck = candidate.heat.reject || hotMoney.overheated ? 0 : 5;
  const total = auction + premarket + themeOpen + orderBook + hotMoneyRelay + riskRecheck;

  return {
    trading: 0,
    hotMoney: 0,
    discussion: 0,
    quant: 0,
    official: 0,
    review: 0,
    auction,
    premarket,
    themeOpen,
    orderBook,
    hotMoneyRelay,
    riskRecheck,
    total: Math.min(100, total)
  };
}

function buildCandidatePlan(
  stock: StockMetrics,
  theme: ThemeMetrics,
  tradingScore: number,
  heat = scoreDiscussionHeat(stock),
  quant = scoreQuantFactors(stock),
  hotMoney = scoreHotMoney(stock, "PREMARKET_0830")
): CandidatePlan {
  const scoreBreakdown = buildScoreBreakdown(tradingScore, hotMoney, heat, quant, stock);
  return {
    stock,
    theme,
    role: "BACKUP",
    score: scoreBreakdown.total,
    tradingScore,
    heat,
    quant,
    hotMoney,
    scoreBreakdown,
    reasons: [
      `属于${theme.name}主线`,
      "成交额和换手率处于题材核心位置",
      "短期位置未触发过热过滤",
      ...hotMoney.reasons,
      ...heat.reasons,
      ...quant.reasons
    ],
    risks: ["9:25前仍需竞价成交确认", "题材龙头走弱则取消买入", ...hotMoney.risks, ...heat.risks, ...quant.risks],
    entryPlan: "9:25后只在竞价明显放量且高开1%-7%附近时分批参与",
    noBuyCondition: "竞价无量、高开过热、板块龙头跳水或个股放量滞涨时不买",
    stopLoss: "单只股票硬止损约-8%，逻辑走弱时提前退出",
    trendExit: "持有期间跟踪5日/10日线和题材龙头状态，趋势破坏则退出"
  };
}

function hasHardBlock(stock: StockMetrics, thresholds: StrategyThresholds): boolean {
  return (
    stock.isSt ||
    stock.isSuspended ||
    stock.severeFinancialRisk ||
    stock.majorNegativeEvent ||
    stock.listingDays < thresholds.stock.minListingDays
  );
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function buildObservationCandidate(
  stock: StockMetrics,
  theme: ThemeMetrics,
  themeScore: number,
  thresholds: StrategyThresholds,
  role: CandidatePlan["role"] = "BACKUP"
): CandidatePlan {
  const riskReasons = getRiskRejections(stock, thresholds).map((rejection) => rejection.reason);
  const heat = scoreDiscussionHeat(stock);
  const quant = scoreQuantFactors(stock);
  const hotMoney = scoreHotMoney(stock, "PREMARKET_0830");
  const candidate = buildCandidatePlan(stock, theme, scoreTradingLogic(stock, themeScore), heat, quant, hotMoney);
  const failedFilters = [
    ...riskReasons,
    heat.reject ? "讨论热度过热" : undefined,
    quant.passed ? undefined : quant.missingRequiredData.length > 0 ? "量化关键数据缺失" : "量化硬过滤失败",
    hotMoney.overheated ? "游资过热或接力末端" : undefined
  ].filter((reason): reason is string => Boolean(reason));

  return {
    ...candidate,
    role,
    reasons: unique(["市场合格但严格过滤后无候选，保底保留观察票", ...candidate.reasons]),
    risks: unique([
      "保底观察：风险过滤未完全通过",
      ...failedFilters.map((reason) => `风险过滤未完全通过：${reason}`),
      ...candidate.risks
    ]),
    entryPlan: "仅作24:00首推观察，9:25必须出现竞价明显放量和价格确认，否则保持空仓",
    noBuyCondition: "竞价无明显放量、风险项未改善、题材龙头走弱或个股高开过热时不买"
  };
}

function buildFallbackObservationCandidates(
  input: TradingDayInput,
  thresholds: StrategyThresholds,
  selectedThemes: Array<{ theme: ThemeMetrics; score: number }>
): CandidatePlan[] {
  const rankedThemes =
    selectedThemes.length > 0
      ? selectedThemes
      : [...input.themes]
          .map((theme) => ({ theme, score: scoreTheme(theme) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, thresholds.theme.maxThemes);

  return rankedThemes
    .flatMap(({ theme, score }) =>
      theme.stocks
        .filter((stock) => !hasHardBlock(stock, thresholds))
        .map((stock) => buildObservationCandidate(stock, theme, score, thresholds))
    )
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((candidate, index) => ({ ...candidate, role: index === 0 ? "PRIMARY" : "BACKUP" }));
}

export function generatePreMarketPlan(
  input: TradingDayInput,
  thresholds: StrategyThresholds = defaultThresholds
): StrategyResult {
  const marketGate = evaluateMarketGate(input.marketMood, thresholds);

  if (marketGate.status === "NO_TRADE") {
    return {
      stage: "PREMARKET_0830",
      tradeDate: input.tradeDate,
      marketStatus: "NO_TRADE",
      summary: `市场环境不合格：${marketGate.reasons.join("、")}`,
      candidates: [],
      rejections: marketGate.reasons.map((reason) => ({ reason })),
      dataCompleteness: input.dataCompleteness
    };
  }

  const themeSelection = selectTradableThemes(input.themes, thresholds);
  const rejections = [...themeSelection.rejections];
  const candidates: CandidatePlan[] = [];

  for (const selected of themeSelection.selected) {
    for (const stock of selected.theme.stocks) {
      const riskRejections = getRiskRejections(stock, thresholds);
      if (riskRejections.length > 0) {
        rejections.push(...riskRejections);
        continue;
      }

      const heat = scoreDiscussionHeat(stock);
      if (heat.reject) {
        rejections.push({ code: stock.code, themeId: stock.themeId, reason: "高位舆情过热，剔除候选" });
        continue;
      }

      const quant = scoreQuantFactors(stock);
      if (!quant.passed) {
        rejections.push({
          code: stock.code,
          themeId: stock.themeId,
          reason:
            quant.missingRequiredData.length > 0
              ? `关键量化数据缺失：${quant.missingRequiredData.join("、")}`
              : `量化硬过滤失败：${quant.risks.join("、")}`
        });
        continue;
      }

      const hotMoney = scoreHotMoney(stock, "PREMARKET_0830");
      if (hotMoney.overheated) {
        rejections.push({ code: stock.code, themeId: stock.themeId, reason: "游资过热或接力末端，剔除候选" });
        continue;
      }

      candidates.push(buildCandidatePlan(stock, selected.theme, scoreTradingLogic(stock, selected.score), heat, quant, hotMoney));
    }
  }

  const ranked =
    candidates.length > 0
      ? candidates.sort((a, b) => b.score - a.score).slice(0, 5)
      : buildFallbackObservationCandidates(input, thresholds, themeSelection.selected);
  const primaryIndex = ranked.findIndex((candidate) => candidate.hotMoney.eligibleForPrimary);

  if (!ranked[0]?.risks.some((risk) => risk.includes("风险过滤未完全通过"))) {
    if (primaryIndex > 0) {
      const [primary] = ranked.splice(primaryIndex, 1);
      ranked.unshift({ ...primary, role: "PRIMARY" });
    } else if (primaryIndex === 0) {
      ranked[0] = { ...ranked[0], role: "PRIMARY" };
    }
  }
  const hasPrimary = ranked[0]?.role === "PRIMARY";

  return {
    stage: "PREMARKET_0830",
    tradeDate: input.tradeDate,
    marketStatus: "TRADABLE",
    summary:
      ranked.length === 0
        ? "市场合格，但没有通过风险过滤的候选"
        : ranked[0].risks.some((risk) => risk.includes("风险过滤未完全通过"))
          ? "市场合格但严格过滤后无候选，生成24:00保底观察票，9:25未确认则空仓"
        : hasPrimary
          ? "市场赚钱效应合格，生成24:00准备名单"
          : "市场合格但无清晰游资首推，仅保留备选观察",
    candidates: ranked,
    rejections,
    dataCompleteness: input.dataCompleteness
  };
}

export function generateAuctionPlan(
  input: TradingDayInput,
  preMarketResult: StrategyResult,
  thresholds: StrategyThresholds = defaultThresholds
): StrategyResult {
  if (preMarketResult.marketStatus === "NO_TRADE") {
    return {
      ...preMarketResult,
      stage: "AUCTION_0925",
      summary: "市场环境不合格，9:25不生成交易名单"
    };
  }

  if (input.dataCompleteness === "MISSING" || !input.auctionByCode || Object.keys(input.auctionByCode).length === 0) {
    return {
      stage: "AUCTION_0925",
      tradeDate: input.tradeDate,
      marketStatus: "TRADABLE",
      summary: "9:25竞价数据缺失，不做竞价确认，保持空仓",
      candidates: [],
      rejections: [{ reason: "缺少9:25集合竞价数据" }],
      dataCompleteness: input.dataCompleteness
    };
  }

  const checked: CandidatePlan[] = preMarketResult.candidates.map((candidate) => {
    const auction = input.auctionByCode?.[candidate.stock.code];
    const check = confirmAuction(candidate, auction, thresholds);
    const hotMoney = scoreHotMoney(candidate.stock, "AUCTION_0925");
    const confirmed = check.confirmed && hotMoney.eligibleForPrimary && !hotMoney.overheated;
    const scoreBreakdown = buildAuctionScoreBreakdown(candidate, hotMoney, check.score, confirmed);
    const tradingScore = scoreBreakdown.themeOpen + scoreBreakdown.orderBook;
    return {
      ...candidate,
      role: confirmed ? ("CONFIRMED" as const) : ("BACKUP" as const),
      tradingScore,
      hotMoney,
      scoreBreakdown,
      score: scoreBreakdown.total,
      reasons: [...candidate.reasons, ...hotMoney.reasons, ...check.reasons],
      risks: [...candidate.risks, ...hotMoney.risks, ...check.risks]
    };
  });

  const confirmed = checked
    .filter((candidate) => candidate.role === "CONFIRMED")
    .sort((a, b) => b.score - a.score);
  const backups = checked
    .filter((candidate) => candidate.role !== "CONFIRMED")
    .sort((a, b) => Number(b.hotMoney.eligibleForPrimary) - Number(a.hotMoney.eligibleForPrimary) || b.score - a.score);
  const ranked = [...confirmed, ...backups].slice(0, confirmed.length <= 2 ? 3 : 5);

  if (ranked[0] && ranked[0].role === "CONFIRMED" && ranked[0].hotMoney.eligibleForPrimary) {
    ranked[0] = { ...ranked[0], role: confirmed.length > 0 ? "PRIMARY" : "BACKUP" };
  }

  return {
    stage: "AUCTION_0925",
    tradeDate: input.tradeDate,
    marketStatus: "TRADABLE",
    summary: confirmed.length > 0 ? "9:25竞价确认完成，首推票排在最前" : "9:25无完全确认票，仅保留备选观察",
    candidates: ranked,
    rejections: preMarketResult.rejections,
    dataCompleteness: input.dataCompleteness
  };
}
