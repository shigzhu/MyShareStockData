import { describe, expect, it } from "vitest";
import { sampleTradingDay } from "./sampleTradingDay";
import { createRemoteJsonDataProvider } from "./remoteJsonDataProvider";
import type { DataProvider } from "../domain/dataProvider";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 404,
    json: async () => body
  } as Response;
}

function createProviderFromFeed(feed: unknown) {
  return createRemoteJsonDataProvider({
    baseUrl: "https://example.test/feed",
    cacheKey: () => "test",
    fetcher: async (url) => {
      expect(url).toBe("https://example.test/feed/data/today.json?v=test");
      return jsonResponse(feed);
    }
  });
}

function createProviderFromFeeds(feeds: Record<string, unknown>) {
  const urls: string[] = [];
  const provider = createRemoteJsonDataProvider({
    baseUrl: "https://example.test/feed",
    cacheKey: () => "test",
    fetcher: async (url) => {
      const requestUrl = String(url);
      urls.push(requestUrl);
      const urlWithoutCache = requestUrl.split("?")[0];
      const feed = feeds[urlWithoutCache];
      if (!feed) {
        return jsonResponse({ message: "not found" }, false);
      }
      return jsonResponse(feed);
    }
  });

  return { provider, urls };
}

describe("createRemoteJsonDataProvider", () => {
  it("returns the premarket input from the GitHub JSON feed", async () => {
    const provider = createProviderFromFeed({
      tradeDate: "2026-05-25",
      preMarketInput: {
        ...sampleTradingDay,
        tradeDate: "2026-05-25",
        dataCompleteness: "FULL"
      },
      auctionInput: {
        ...sampleTradingDay,
        tradeDate: "2026-05-25",
        dataCompleteness: "MANUAL_AUCTION"
      }
    });

    const result = await provider.fetchPreMarketInput("2026-05-25");

    expect(result.status).toBe("SUCCESS");
    expect(result.status === "SUCCESS" ? result.input.tradeDate : "").toBe("2026-05-25");
    expect(result.status === "SUCCESS" ? result.input.dataCompleteness : "").toBe("FULL");
  });

  it("returns the auction input from the GitHub JSON feed", async () => {
    const provider = createProviderFromFeed({
      tradeDate: "2026-05-25",
      preMarketInput: {
        ...sampleTradingDay,
        tradeDate: "2026-05-25"
      },
      auctionInput: {
        ...sampleTradingDay,
        tradeDate: "2026-05-25",
        dataCompleteness: "MANUAL_AUCTION"
      }
    });

    const result = await provider.fetchAuctionInput("2026-05-25", {
      stage: "PREMARKET_0830",
      tradeDate: "2026-05-25",
      marketStatus: "TRADABLE",
      summary: "已生成",
      candidates: [],
      rejections: [],
      dataCompleteness: "FULL"
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.status === "SUCCESS" ? result.input.dataCompleteness : "").toBe("MANUAL_AUCTION");
  });

  it("reports missing key data when the auction section is absent", async () => {
    const provider = createProviderFromFeed({
      tradeDate: "2026-05-25",
      preMarketInput: {
        ...sampleTradingDay,
        tradeDate: "2026-05-25"
      }
    });

    const result = await provider.fetchAuctionInput("2026-05-25", {
      stage: "PREMARKET_0830",
      tradeDate: "2026-05-25",
      marketStatus: "TRADABLE",
      summary: "已生成",
      candidates: [],
      rejections: [],
      dataCompleteness: "FULL"
    });

    expect(result.status).toBe("MISSING_REQUIRED_DATA");
    expect(result.message).toContain("9:25");
  });

  it("loads the requested history file when today.json is still cached on yesterday", async () => {
    const { provider, urls } = createProviderFromFeeds({
      "https://example.test/feed/data/today.json": {
        tradeDate: "2026-05-25",
        preMarketInput: {
          ...sampleTradingDay,
          tradeDate: "2026-05-25"
        }
      },
      "https://example.test/feed/data/history/2026-05-26.json": {
        tradeDate: "2026-05-26",
        preMarketInput: {
          ...sampleTradingDay,
          tradeDate: "2026-05-26",
          dataCompleteness: "FULL"
        }
      }
    });

    const result = await provider.fetchPreMarketInput("2026-05-26");

    expect(urls[0]).toContain("/data/today.json?");
    expect(urls[1]).toContain("/data/history/2026-05-26.json?");
    expect(result.status).toBe("SUCCESS");
    expect(result.status === "SUCCESS" ? result.input.tradeDate : "").toBe("2026-05-26");
  });

  it("uses yesterday's premarket feed as stale observation data when today's history file is not published yet", async () => {
    const { provider, urls } = createProviderFromFeeds({
      "https://example.test/feed/data/today.json": {
        tradeDate: "2026-05-27",
        preMarketInput: {
          ...sampleTradingDay,
          tradeDate: "2026-05-27",
          dataCompleteness: "PARTIAL"
        }
      }
    });

    const result = await provider.fetchPreMarketInput("2026-05-28");

    expect(urls[0]).toContain("/data/today.json?");
    expect(urls[1]).toContain("/data/history/2026-05-28.json?");
    expect(result.status).toBe("SUCCESS");
    expect(result.message).toContain("今日远程数据尚未发布");
    expect(result.status === "SUCCESS" ? result.input.tradeDate : "").toBe("2026-05-28");
    expect(result.status === "SUCCESS" ? result.input.dataCompleteness : "").toBe("MISSING");
  });

  it("does not use stale feed for 9:25 auction confirmation", async () => {
    const { provider } = createProviderFromFeeds({
      "https://example.test/feed/data/today.json": {
        tradeDate: "2026-05-27",
        auctionInput: {
          ...sampleTradingDay,
          tradeDate: "2026-05-27",
          dataCompleteness: "PARTIAL"
        }
      }
    });

    const result = await provider.fetchAuctionInput("2026-05-28", {
      stage: "PREMARKET_0830",
      tradeDate: "2026-05-28",
      marketStatus: "TRADABLE",
      summary: "已生成",
      candidates: [],
      rejections: [],
      dataCompleteness: "MISSING"
    });

    expect(result.status).toBe("MISSING_REQUIRED_DATA");
    expect(result.message).toContain("今日远程数据尚未发布");
  });

  it("reports failure instead of falling back to sample data when remote fetch fails", async () => {
    const provider = createRemoteJsonDataProvider({
      baseUrl: "https://example.test/feed",
      fetcher: async () => {
        throw new Error("network down");
      }
    });

    const result = await provider.fetchPreMarketInput("2026-05-25");

    expect(result.status).toBe("FAILED");
    expect(result.message).toContain("远程数据加载失败");
  });
});
