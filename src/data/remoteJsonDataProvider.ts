import type { DataProvider, DataProviderResult } from "../domain/dataProvider";
import type { StrategyResult, TradingDayInput } from "../domain/types";

interface RemoteFeed {
  tradeDate?: unknown;
  preMarketInput?: unknown;
  auctionInput?: unknown;
}

interface RemoteJsonDataProviderOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
  cacheKey?: () => string;
}

function joinFeedUrl(baseUrl: string, path: string, cacheKey: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}?v=${encodeURIComponent(cacheKey)}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTradingDayInput(value: unknown, tradeDate: string): value is TradingDayInput {
  if (!isObject(value)) {
    return false;
  }

  return value.tradeDate === tradeDate && isObject(value.marketMood) && Array.isArray(value.themes);
}

async function fetchFeed(baseUrl: string, fetcher: typeof fetch, path: string, cacheKey: string): Promise<RemoteFeed> {
  const response = await fetcher(joinFeedUrl(baseUrl, path, cacheKey), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as RemoteFeed;
}

function inputFromFeed(
  feed: RemoteFeed,
  tradeDate: string,
  key: "preMarketInput" | "auctionInput",
  missingMessage: string
): DataProviderResult<TradingDayInput> {
  if (feed.tradeDate !== tradeDate) {
    return {
      status: "MISSING_REQUIRED_DATA",
      message: `远程数据日期不匹配：需要${tradeDate}，实际${String(feed.tradeDate ?? "空")}`
    };
  }

  if (!isTradingDayInput(feed[key], tradeDate)) {
    return {
      status: "MISSING_REQUIRED_DATA",
      message: missingMessage
    };
  }

  return {
    status: "SUCCESS",
    input: feed[key],
    message: "GitHub数据已加载"
  };
}

async function fetchInputFromRemote(
  baseUrl: string,
  fetcher: typeof fetch,
  tradeDate: string,
  key: "preMarketInput" | "auctionInput",
  missingMessage: string,
  cacheKey: string
): Promise<DataProviderResult<TradingDayInput>> {
  const todayFeed = await fetchFeed(baseUrl, fetcher, "/data/today.json", cacheKey);
  const todayResult = inputFromFeed(todayFeed, tradeDate, key, missingMessage);

  if (todayResult.status === "SUCCESS") {
    return todayResult;
  }

  if (todayFeed.tradeDate !== tradeDate) {
    const historyFeed = await fetchFeed(baseUrl, fetcher, `/data/history/${tradeDate}.json`, cacheKey);
    return inputFromFeed(historyFeed, tradeDate, key, missingMessage);
  }

  return todayResult;
}

export function createRemoteJsonDataProvider({
  baseUrl,
  fetcher = fetch,
  cacheKey = () => String(Date.now())
}: RemoteJsonDataProviderOptions): DataProvider {
  return {
    async fetchPreMarketInput(tradeDate) {
      try {
        return await fetchInputFromRemote(
          baseUrl,
          fetcher,
          tradeDate,
          "preMarketInput",
          "8:30关键数据缺失",
          cacheKey()
        );
      } catch (error) {
        return {
          status: "FAILED",
          message: `远程数据加载失败：${error instanceof Error ? error.message : "未知错误"}`
        };
      }
    },
    async fetchAuctionInput(tradeDate, preMarketResult: StrategyResult) {
      try {
        return await fetchInputFromRemote(
          baseUrl,
          fetcher,
          tradeDate,
          "auctionInput",
          "9:25集合竞价关键数据缺失",
          cacheKey()
        );
      } catch (error) {
        return {
          status: "FAILED",
          message: `远程数据加载失败：${error instanceof Error ? error.message : "未知错误"}`
        };
      }
    }
  };
}
