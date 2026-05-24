import { describe, expect, it } from "vitest";
import { sampleTradingDay } from "./sampleTradingDay";
import { sampleDataProvider } from "./sampleDataProvider";
import { createRemoteJsonDataProvider } from "./remoteJsonDataProvider";
import type { DataProvider } from "../domain/dataProvider";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body
  } as Response;
}

function createProviderFromFeed(feed: unknown, fallbackProvider: DataProvider = sampleDataProvider) {
  return createRemoteJsonDataProvider({
    baseUrl: "https://example.test/feed",
    fallbackProvider,
    fetcher: async (url) => {
      expect(url).toBe("https://example.test/feed/data/today.json");
      return jsonResponse(feed);
    }
  });
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

  it("rejects a feed date that does not match the requested trade date", async () => {
    const provider = createProviderFromFeed({
      tradeDate: "2026-05-24",
      preMarketInput: {
        ...sampleTradingDay,
        tradeDate: "2026-05-24"
      }
    });

    const result = await provider.fetchPreMarketInput("2026-05-25");

    expect(result.status).toBe("MISSING_REQUIRED_DATA");
    expect(result.message).toContain("日期不匹配");
  });

  it("falls back to the sample provider when remote fetch fails", async () => {
    const provider = createRemoteJsonDataProvider({
      baseUrl: "https://example.test/feed",
      fallbackProvider: sampleDataProvider,
      fetcher: async () => {
        throw new Error("network down");
      }
    });

    const result = await provider.fetchPreMarketInput("2026-05-25");

    expect(result.status).toBe("SUCCESS");
    expect(result.status === "SUCCESS" ? result.input.tradeDate : "").toBe("2026-05-25");
  });
});
