import type { DataProvider, DataProviderResult } from "./dataProvider";
import { generateAuctionPlan, generatePreMarketPlan } from "./strategyEngine";
import { formatLocalDate, isAshareTradingDay } from "./tradingCalendar";
import type { IntradayRefreshState, RecommendationJobState, StrategyResult, TradeStage, TradingDayInput } from "./types";

const PRE_MARKET_HOUR = 8;
const PRE_MARKET_MINUTE = 30;
const AUCTION_HOUR = 9;
const AUCTION_MINUTE = 25;

interface RunIntradayRefreshOptions {
  now: Date;
  provider: DataProvider;
  previousState?: IntradayRefreshState;
}

function isAtOrAfter(date: Date, hour: number, minute: number) {
  return date.getHours() > hour || (date.getHours() === hour && date.getMinutes() >= minute);
}

function pendingJob(stage: TradeStage, tradeDate: string, message: string): RecommendationJobState {
  return {
    stage,
    tradeDate,
    status: "PENDING",
    message
  };
}

function providerFailureJob(
  stage: TradeStage,
  tradeDate: string,
  providerResult: Extract<DataProviderResult<TradingDayInput>, { status: "FAILED" | "MISSING_REQUIRED_DATA" }>
): RecommendationJobState {
  return {
    stage,
    tradeDate,
    status: providerResult.status,
    message: providerResult.message
  };
}

function successfulJob(stage: TradeStage, tradeDate: string, result: StrategyResult, updatedAt: string): RecommendationJobState {
  const noCandidates = result.candidates.length === 0;

  return {
    stage,
    tradeDate,
    status: noCandidates ? "NOT_RECOMMENDED" : "SUCCESS",
    message: noCandidates ? `规则过滤后不推荐：${result.summary}` : result.summary,
    result,
    updatedAt
  };
}

function reusableSuccess(job: RecommendationJobState | undefined, tradeDate: string, stage: TradeStage) {
  return job?.tradeDate === tradeDate && job.stage === stage && job.result ? job : undefined;
}

async function runPreMarketJob(
  tradeDate: string,
  provider: DataProvider,
  updatedAt: string,
  previousState?: IntradayRefreshState
): Promise<RecommendationJobState> {
  const reusable = reusableSuccess(previousState?.preMarket, tradeDate, "PREMARKET_0830");

  if (reusable) {
    return reusable;
  }

  const providerResult = await provider.fetchPreMarketInput(tradeDate);

  if (providerResult.status !== "SUCCESS") {
    return providerFailureJob("PREMARKET_0830", tradeDate, providerResult);
  }

  return successfulJob("PREMARKET_0830", tradeDate, generatePreMarketPlan(providerResult.input), updatedAt);
}

async function runAuctionJob(
  tradeDate: string,
  provider: DataProvider,
  preMarket: RecommendationJobState,
  updatedAt: string,
  previousState?: IntradayRefreshState
): Promise<RecommendationJobState> {
  const reusable = reusableSuccess(previousState?.auction, tradeDate, "AUCTION_0925");

  if (reusable) {
    return reusable;
  }

  if (!preMarket.result) {
    return {
      stage: "AUCTION_0925",
      tradeDate,
      status: "FAILED",
      message: "8:30准备名单未生成，9:25无法确认"
    };
  }

  const providerResult = await provider.fetchAuctionInput(tradeDate, preMarket.result);

  if (providerResult.status !== "SUCCESS") {
    return providerFailureJob("AUCTION_0925", tradeDate, providerResult);
  }

  return successfulJob(
    "AUCTION_0925",
    tradeDate,
    generateAuctionPlan(providerResult.input, preMarket.result),
    updatedAt
  );
}

export async function runIntradayRefresh({
  now,
  provider,
  previousState
}: RunIntradayRefreshOptions): Promise<IntradayRefreshState> {
  const tradeDate = formatLocalDate(now);
  const updatedAt = now.toISOString();
  let preMarket = pendingJob("PREMARKET_0830", tradeDate, "等待8:30生成准备名单");
  let auction = pendingJob("AUCTION_0925", tradeDate, "等待9:25集合竞价确认");

  if (!isAshareTradingDay(tradeDate)) {
    return { tradeDate, preMarket, auction };
  }

  if (isAtOrAfter(now, PRE_MARKET_HOUR, PRE_MARKET_MINUTE)) {
    preMarket = await runPreMarketJob(tradeDate, provider, updatedAt, previousState);
  }

  if (isAtOrAfter(now, AUCTION_HOUR, AUCTION_MINUTE)) {
    auction = await runAuctionJob(tradeDate, provider, preMarket, updatedAt, previousState);
  }

  return { tradeDate, preMarket, auction };
}
