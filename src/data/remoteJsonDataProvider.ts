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

class FeedHttpError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP ${status}`);
  }
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
    throw new FeedHttpError(response.status);
  }

  return (await response.json()) as RemoteFeed;
}

function cloneAsStaleObservationInput(value: unknown, tradeDate: string): TradingDayInput | undefined {
  if (!isTradingDayInput(value, String((value as { tradeDate?: unknown } | undefined)?.tradeDate ?? ""))) {
    return undefined;
  }

  return {
    ...value,
    tradeDate,
    dataCompleteness: "MISSING",
    themes: value.themes.map((theme) => ({
      ...theme,
      stocks: theme.stocks.map((stock) => ({ ...stock, themeId: stock.themeId }))
    })),
    auctionByCode: undefined
  };
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
    try {
      const historyFeed = await fetchFeed(baseUrl, fetcher, `/data/history/${tradeDate}.json`, cacheKey);
      return inputFromFeed(historyFeed, tradeDate, key, missingMessage);
    } catch (error) {
      if (error instanceof FeedHttpError && error.status === 404) {
        if (key === "preMarketInput") {
          const staleInput = cloneAsStaleObservationInput(todayFeed.preMarketInput, tradeDate);
          if (staleInput) {
            return {
              status: "SUCCESS",
              input: staleInput,
              message: "今日远程数据尚未发布，使用最近一次8:30数据生成非实时观察名单"
            };
          }
        }

        return {
          status: "MISSING_REQUIRED_DATA",
          message: "今日远程数据尚未发布，9:25不做竞价确认"
        };
      }

      throw error;
    }
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
