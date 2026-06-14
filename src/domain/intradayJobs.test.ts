import { describe, expect, it } from "vitest";
import { sampleTradingDay } from "../data/sampleTradingDay";
import type { DataProvider, DataProviderResult } from "./dataProvider";
import { runIntradayRefresh } from "./intradayJobs";
import type { TradingDayInput } from "./types";

function providerWith(result: DataProviderResult<TradingDayInput>): DataProvider {
  return {
    fetchPreMarketInput: async () => result,
    fetchAuctionInput: async () => result
  };
}

describe("runIntradayRefresh", () => {
  it("does not generate the next trade date plan before the Beijing date rolls over to 24:00", async () => {
    const state = await runIntradayRefresh({
      now: new Date("2026-05-20T15:50:00.000Z"),
      provider: {
        fetchPreMarketInput: async (tradeDate) => ({
          status: "SUCCESS",
          input: { ...sampleTradingDay, tradeDate }
        }),
        fetchAuctionInput: async (tradeDate) => ({
          status: "SUCCESS",
          input: { ...sampleTradingDay, tradeDate }
        })
      }
    });

    expect(state.tradeDate).toBe("2026-05-20");
    expect(state.preMarket.status).toBe("SUCCESS");
    expect(state.preMarket.result?.tradeDate).toBe("2026-05-20");
    expect(state.preMarket.result?.tradeDate).not.toBe("2026-05-21");
  });

  it("runs the 24:00 preparation job when the app is opened after midnight", async () => {
    const state = await runIntradayRefresh({
      now: new Date(2026, 4, 21, 0, 5),
      provider: providerWith({ status: "SUCCESS", input: sampleTradingDay })
    });

    expect(state.preMarket.status).toBe("SUCCESS");
    expect(state.preMarket.result?.stage).toBe("PREMARKET_0830");
    expect(state.preMarket.result?.candidates.length).toBeGreaterThan(0);
    expect(state.auction.status).toBe("PENDING");
  });

  it("runs the 9:25 auction job after creating or reusing the 24:00 pool", async () => {
    const calls: string[] = [];
    const provider: DataProvider = {
      fetchPreMarketInput: async () => {
        calls.push("pre");
        return { status: "SUCCESS", input: sampleTradingDay };
      },
      fetchAuctionInput: async (_tradeDate, preMarketResult) => {
        calls.push(`auction:${preMarketResult.candidates.length}`);
        return { status: "SUCCESS", input: sampleTradingDay };
      }
    };

    const state = await runIntradayRefresh({
      now: new Date(2026, 4, 21, 9, 26),
      provider
    });

    expect(calls[0]).toBe("pre");
    expect(calls[1]).toMatch(/^auction:[1-9]/);
    expect(state.preMarket.status).toBe("SUCCESS");
    expect(state.auction.status).toBe("SUCCESS");
    expect(state.auction.result?.stage).toBe("AUCTION_0925");
  });

  it("records update timestamps in the phone local timezone", async () => {
    const state = await runIntradayRefresh({
      now: new Date(2026, 4, 25, 9, 29, 35),
      provider: providerWith({ status: "SUCCESS", input: sampleTradingDay })
    });

    expect(state.preMarket.updatedAt).toBe("2026-05-25T09:29:35");
    expect(state.auction.updatedAt).toBe("2026-05-25T09:29:35");
  });

  it("uses the current Beijing calendar date for the requested trading day", async () => {
    const calls: string[] = [];
    const provider: DataProvider = {
      fetchPreMarketInput: async (tradeDate) => {
        calls.push(tradeDate);
        return { status: "SUCCESS", input: { ...sampleTradingDay, tradeDate } };
      },
      fetchAuctionInput: async () => ({ status: "SUCCESS", input: sampleTradingDay })
    };

    const state = await runIntradayRefresh({
      now: new Date("2026-05-25T00:35:00.000Z"),
      provider
    });

    expect(state.tradeDate).toBe("2026-05-25");
    expect(calls[0]).toBe("2026-05-25");
  });

  it("marks provider failures as failed data status", async () => {
    const state = await runIntradayRefresh({
      now: new Date(2026, 4, 21, 8, 35),
      provider: providerWith({ status: "FAILED", message: "行情接口超时" })
    });

    expect(state.preMarket.status).toBe("FAILED");
    expect(state.preMarket.message).toBe("行情接口超时");
    expect(state.preMarket.result).toBeUndefined();
  });

  it("marks missing key data separately from generic failures", async () => {
    const state = await runIntradayRefresh({
      now: new Date(2026, 4, 21, 8, 35),
      provider: providerWith({ status: "MISSING_REQUIRED_DATA", message: "缺少量化字段" })
    });

    expect(state.preMarket.status).toBe("MISSING_REQUIRED_DATA");
    expect(state.preMarket.message).toBe("缺少量化字段");
  });

  it("keeps 9:25 as not recommended instead of failed when the 24:00 pool is unavailable", async () => {
    const state = await runIntradayRefresh({
      now: new Date(2026, 4, 21, 9, 35),
      provider: providerWith({ status: "MISSING_REQUIRED_DATA", message: "当天24:00数据尚未发布" })
    });

    expect(state.preMarket.status).toBe("MISSING_REQUIRED_DATA");
    expect(state.auction.status).toBe("NOT_RECOMMENDED");
    expect(state.auction.message).toContain("保持空仓");
    expect(state.auction.result?.candidates).toHaveLength(0);
  });

  it("marks a successful run with no candidates as not recommended", async () => {
    const state = await runIntradayRefresh({
      now: new Date(2026, 4, 21, 8, 35),
      provider: providerWith({
        status: "SUCCESS",
        input: {
          ...sampleTradingDay,
          marketMood: { ...sampleTradingDay.marketMood, limitDownCount: 30 }
        }
      })
    });

    expect(state.preMarket.status).toBe("NOT_RECOMMENDED");
    expect(state.preMarket.result?.candidates).toHaveLength(0);
    expect(state.preMarket.message).toContain("不推荐");
  });
});
