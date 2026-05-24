import type { DataProvider, DataProviderResult } from "../domain/dataProvider";
import type { StrategyResult, TradingDayInput } from "../domain/types";

interface RemoteFeed {
  tradeDate?: unknown;
  preMarketInput?: unknown;
  auctionInput?: unknown;
}

interface RemoteJsonDataProviderOptions {
  baseUrl: string;
  fallbackProvider: DataProvider;
  fetcher?: typeof fetch;
}

function joinFeedUrl(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/data/today.json`;
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

async function fetchFeed(baseUrl: string, fetcher: typeof fetch): Promise<RemoteFeed> {
  const response = await fetcher(joinFeedUrl(baseUrl));

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

export function createRemoteJsonDataProvider({
  baseUrl,
  fallbackProvider,
  fetcher = fetch
}: RemoteJsonDataProviderOptions): DataProvider {
  return {
    async fetchPreMarketInput(tradeDate) {
      try {
        const feed = await fetchFeed(baseUrl, fetcher);
        return inputFromFeed(feed, tradeDate, "preMarketInput", "8:30关键数据缺失");
      } catch {
        return fallbackProvider.fetchPreMarketInput(tradeDate);
      }
    },
    async fetchAuctionInput(tradeDate, preMarketResult: StrategyResult) {
      try {
        const feed = await fetchFeed(baseUrl, fetcher);
        return inputFromFeed(feed, tradeDate, "auctionInput", "9:25集合竞价关键数据缺失");
      } catch {
        return fallbackProvider.fetchAuctionInput(tradeDate, preMarketResult);
      }
    }
  };
}
