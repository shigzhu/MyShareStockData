import { confirmAuction } from "./auctionConfirmation";
import { scoreDiscussionHeat } from "./discussionHeat";
import { scoreHotMoney } from "./hotMoney";
import { evaluateMarketGate } from "./marketGate";
import { scoreQuantFactors } from "./quantFactors";
import { getRiskRejections } from "./riskFilters";
import { defaultThresholds } from "./thresholds";
import { selectTradableThemes } from "./themeSelection";
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
  const liquidityScore = Math.min(5, stock.turnoverAmount / 500_000_000);
  const attention = Math.min(5, stock.attentionScore * 0.05);
  const position = Math.max(0, 5 - stock.return10dPct * 0.08 - stock.distanceFromMa5Pct * 0.12);
  const theme = Math.min(5, themeScore * 0.05);
  return Math.round(liquidityScore + attention + position + theme);
}

function normalizeDiscussionScore(heat: DiscussionHeatScore): number {
  return Math.max(0, Math.min(30, heat.weightedScore));
}

function buildScoreBreakdown(
  tradingScore: number,
  hotMoney: HotMoneyScore,
  heat: DiscussionHeatScore,
  quant: QuantScore
) {
  const trading = Math.max(0, Math.min(20, tradingScore));
  const discussion = normalizeDiscussionScore(heat);
  const total = trading + hotMoney.total + discussion + quant.total;

  return {
    trading,
    hotMoney: hotMoney.total,
    discussion,
    quant: quant.total,
    total
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
  const scoreBreakdown = buildScoreBreakdown(tradingScore, hotMoney, heat, quant);
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
    entryPlan: "9:25后只在竞价明显放量且高开3%-7%附近时分批参与",
    noBuyCondition: "竞价无量、高开过热、板块龙头跳水或个股放量滞涨时不买",
    stopLoss: "单只股票硬止损约-8%，逻辑走弱时提前退出",
    trendExit: "持有期间跟踪5日/10日线和题材龙头状态，趋势破坏则退出"
  };
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

  const ranked = candidates.sort((a, b) => b.score - a.score).slice(0, 5);
  const primaryIndex = ranked.findIndex((candidate) => candidate.hotMoney.eligibleForPrimary);

  if (primaryIndex > 0) {
    const [primary] = ranked.splice(primaryIndex, 1);
    ranked.unshift({ ...primary, role: "PRIMARY" });
  } else if (primaryIndex === 0) {
    ranked[0] = { ...ranked[0], role: "PRIMARY" };
  }
  const hasPrimary = ranked[0]?.role === "PRIMARY";

  return {
    stage: "PREMARKET_0830",
    tradeDate: input.tradeDate,
    marketStatus: "TRADABLE",
    summary:
      ranked.length === 0
        ? "市场合格，但没有通过风险过滤的候选"
        : hasPrimary
          ? "市场赚钱效应合格，生成8:30准备名单"
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

  const checked: CandidatePlan[] = preMarketResult.candidates.map((candidate) => {
    const auction = input.auctionByCode?.[candidate.stock.code];
    const check = confirmAuction(candidate, auction, thresholds);
    const hotMoney = scoreHotMoney(candidate.stock, "AUCTION_0925");
    const tradingScore = Math.min(20, candidate.scoreBreakdown.trading + (check.confirmed ? 3 : 0));
    const scoreBreakdown = buildScoreBreakdown(tradingScore, hotMoney, candidate.heat, candidate.quant);
    const confirmed = check.confirmed && hotMoney.eligibleForPrimary && !hotMoney.overheated;
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
    .sort((a, b) => b.score - a.score);
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
