import { confirmAuction } from "./auctionConfirmation";
import { evaluateMarketGate } from "./marketGate";
import { getRiskRejections } from "./riskFilters";
import { defaultThresholds } from "./thresholds";
import { selectTradableThemes } from "./themeSelection";
import type {
  CandidatePlan,
  StockMetrics,
  StrategyResult,
  StrategyThresholds,
  ThemeMetrics,
  TradingDayInput
} from "./types";

function scoreStock(stock: StockMetrics, themeScore: number): number {
  const liquidityScore = Math.min(30, stock.turnoverAmount / 100_000_000);
  const attention = Math.min(35, stock.attentionScore * 0.35);
  const position = Math.max(0, 20 - stock.return10dPct * 0.4 - stock.distanceFromMa5Pct * 0.6);
  const theme = Math.min(15, themeScore * 0.15);
  return Math.round(liquidityScore + attention + position + theme);
}

function buildCandidatePlan(stock: StockMetrics, theme: ThemeMetrics, score: number): CandidatePlan {
  return {
    stock,
    theme,
    role: "BACKUP",
    score,
    reasons: [
      `属于${theme.name}主线`,
      "成交额和换手率处于题材核心位置",
      "短期位置未触发过热过滤"
    ],
    risks: ["9:25前仍需竞价成交确认", "题材龙头走弱则取消买入"],
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

      candidates.push(buildCandidatePlan(stock, selected.theme, scoreStock(stock, selected.score)));
    }
  }

  const ranked = candidates.sort((a, b) => b.score - a.score).slice(0, 5);

  return {
    stage: "PREMARKET_0830",
    tradeDate: input.tradeDate,
    marketStatus: "TRADABLE",
    summary: ranked.length > 0 ? "市场赚钱效应合格，生成8:30准备名单" : "市场合格，但没有通过风险过滤的候选",
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

  const checked = preMarketResult.candidates.map((candidate) => {
    const auction = input.auctionByCode?.[candidate.stock.code];
    const check = confirmAuction(candidate, auction, thresholds);
    return {
      ...candidate,
      role: check.confirmed ? ("CONFIRMED" as const) : ("BACKUP" as const),
      score: check.score,
      reasons: [...candidate.reasons, ...check.reasons],
      risks: [...candidate.risks, ...check.risks]
    };
  });

  const confirmed = checked
    .filter((candidate) => candidate.role === "CONFIRMED")
    .sort((a, b) => b.score - a.score);
  const backups = checked
    .filter((candidate) => candidate.role !== "CONFIRMED")
    .sort((a, b) => b.score - a.score);
  const ranked = [...confirmed, ...backups].slice(0, confirmed.length <= 2 ? 3 : 5);

  if (ranked[0]) {
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
