import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { sampleDataProvider } from "./data/sampleDataProvider";
import { sampleTradingDay } from "./data/sampleTradingDay";
import type { DataProvider } from "./domain/dataProvider";

function providerWith(status: "FAILED" | "MISSING_REQUIRED_DATA", message: string): DataProvider {
  return {
    fetchPreMarketInput: async () => ({ status, message }),
    fetchAuctionInput: async () => ({ status, message })
  };
}

describe("App", () => {
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  async function flushRefresh() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  function renderWithSampleProvider(today?: Date) {
    return render(<App today={today} dataProvider={sampleDataProvider} />);
  }

  it("shows both 8:30 and 9:25 strategy sections after the 9:25 refresh", async () => {
    renderWithSampleProvider(new Date(2026, 4, 21, 9, 26));

    expect((await screen.findAllByText("8:30 准备名单")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("9:25 竞价确认").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("首推").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("8:30 成功")).toBeInTheDocument();
    expect(screen.getByText("9:25 成功")).toBeInTheDocument();
  });

  it("runs the 8:30 compensation refresh when the app is opened at 8:35", async () => {
    renderWithSampleProvider(new Date(2026, 4, 21, 8, 35));

    expect(await screen.findByText("8:30 成功")).toBeInTheDocument();
    expect(screen.getByText("9:25 待更新")).toBeInTheDocument();
    expect(screen.getByText("今日首推")).toBeInTheDocument();
  });

  it("runs both compensation refresh jobs when the app is opened at 9:26", async () => {
    renderWithSampleProvider(new Date(2026, 4, 21, 9, 26));

    expect(await screen.findByText("8:30 成功")).toBeInTheDocument();
    expect(screen.getByText("9:25 成功")).toBeInTheDocument();
    expect(screen.getAllByText("今日首推").length).toBeGreaterThanOrEqual(1);
  });

  it("shows failed, missing-data, and not-recommended data statuses", async () => {
    const failed = render(
      <App today={new Date(2026, 4, 21, 8, 35)} dataProvider={providerWith("FAILED", "行情接口超时")} />
    );

    expect(await screen.findByText("8:30 失败")).toBeInTheDocument();
    expect(screen.getByText("行情接口超时")).toBeInTheDocument();
    failed.unmount();

    const missing = render(
      <App today={new Date(2026, 4, 21, 8, 35)} dataProvider={providerWith("MISSING_REQUIRED_DATA", "缺少量化字段")} />
    );

    expect(await screen.findByText("8:30 缺关键数据")).toBeInTheDocument();
    expect(screen.getByText("缺少量化字段")).toBeInTheDocument();
    missing.unmount();

    const emptyProvider: DataProvider = {
      fetchPreMarketInput: async () => ({
        status: "SUCCESS",
        input: {
          ...sampleTradingDay,
          marketMood: { ...sampleTradingDay.marketMood, limitDownCount: 30 }
        }
      }),
      fetchAuctionInput: async () => ({
        status: "SUCCESS",
        input: sampleTradingDay
      })
    };

    render(<App today={new Date(2026, 4, 21, 8, 35)} dataProvider={emptyProvider} />);

    expect(await screen.findByText("8:30 不推荐")).toBeInTheDocument();
  });

  it("renders data status labels on WebViews without String.replaceAll", async () => {
    const originalReplaceAll = String.prototype.replaceAll;
    // Older Android System WebView versions do not support replaceAll.
    // The app should still render the shell and the failed status.
    // @ts-expect-error simulates the missing WebView API.
    String.prototype.replaceAll = undefined;

    try {
      render(<App today={new Date(2026, 4, 21, 8, 35)} dataProvider={providerWith("FAILED", "网络不可用")} />);

      expect(await screen.findByText("8:30 失败")).toBeInTheDocument();
      expect(screen.getByText("网络不可用")).toBeInTheDocument();
    } finally {
      String.prototype.replaceAll = originalReplaceAll;
    }
  });

  it("puts daily primary recommendations first and groups history by month week and day", async () => {
    renderWithSampleProvider(new Date(2026, 4, 21, 9, 0));

    expect((await screen.findAllByText("今日首推")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2026年05月").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("第4周").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("2026-05-21").length).toBeGreaterThanOrEqual(1);
  });

  it("records a delete reason and hides the recommendation", async () => {
    const user = userEvent.setup();
    renderWithSampleProvider(new Date(2026, 4, 21, 9, 0));

    await screen.findByText("8:30 成功");
    await user.click(screen.getAllByRole("button", { name: /删除/ })[0]);
    await user.click(screen.getByRole("button", { name: "风险大" }));

    expect(screen.getByText(/已删除/)).toBeInTheDocument();
  });

  it("shows a rest message and folds stale recommendations when the phone date is closed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 21, 9, 0));

    const { container } = render(<App dataProvider={sampleDataProvider} />);

    await flushRefresh();
    expect(screen.getByText("8:30 成功")).toBeInTheDocument();

    vi.setSystemTime(new Date(2026, 4, 24, 9, 0));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    await flushRefresh();

    expect(screen.getByText("今日未开市，好好休息！")).toBeInTheDocument();
    expect(screen.queryByText("今日首推")).not.toBeInTheDocument();
    expect(screen.getByText("历史推荐")).toBeInTheDocument();
    expect(screen.getByText("8:30 准备名单")).toBeInTheDocument();
    expect(screen.getAllByText("2026-05-21").length).toBeGreaterThanOrEqual(1);
    expect(Array.from(container.querySelectorAll<HTMLDetailsElement>(".history details")).every((item) => !item.open)).toBe(true);
  });

  it("uses stock names that match their codes", async () => {
    renderWithSampleProvider(new Date(2026, 4, 21, 9, 0));

    expect((await screen.findAllByText("宁德时代")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("300750").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText("云算科技")).not.toBeInTheDocument();
  });

  it("shows the four-part score breakdown on recommendation cards", async () => {
    renderWithSampleProvider(new Date(2026, 4, 21, 9, 0));

    expect((await screen.findAllByText(/总分 \d+\/100/)).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/交易 \d+\/20/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/游资 \d+\/20/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/热度 \d+\/30/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/量化 \d+\/30/).length).toBeGreaterThanOrEqual(1);
  });

  it("includes quant and hot-money explanations in recommendation details", async () => {
    renderWithSampleProvider(new Date(2026, 4, 21, 9, 0));

    expect((await screen.findAllByText("量化硬过滤通过")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("题材热点与政策催化匹配").length).toBeGreaterThanOrEqual(1);
  });

  it("does not show the closed-market rest message on a normal trading day before 8:30", () => {
    renderWithSampleProvider(new Date(2026, 4, 22, 9, 0));

    expect(screen.queryByText("今日未开市，好好休息！")).not.toBeInTheDocument();
  });

  it("keeps the trading date synchronized with the phone date while the app stays open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 21, 23, 59, 30));

    render(<App dataProvider={sampleDataProvider} />);

    expect(screen.getAllByText("2026-05-21").length).toBeGreaterThanOrEqual(1);

    vi.setSystemTime(new Date(2026, 4, 24, 0, 0, 30));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText("2026-05-24")).toBeInTheDocument();
    expect(screen.getByText("今日未开市，好好休息！")).toBeInTheDocument();
    expect(screen.queryByText("今日首推")).not.toBeInTheDocument();
  });

  it("persists generated recommendation snapshots after refresh", async () => {
    localStorage.clear();
    renderWithSampleProvider(new Date(2026, 4, 21, 9, 26));

    expect(await screen.findByText("9:25 成功")).toBeInTheDocument();

    const raw = localStorage.getItem("a-share-review-learning-v1");
    expect(raw).toContain("2026-05-21-PREMARKET_0830");
    expect(raw).toContain("2026-05-21-AUCTION_0925");
  });

  it("reloads locally persisted recommendations before remote refresh completes", async () => {
    localStorage.clear();
    const first = renderWithSampleProvider(new Date(2026, 4, 21, 9, 26));
    expect(await screen.findByText("9:25 成功")).toBeInTheDocument();
    first.unmount();

    render(<App today={new Date(2026, 4, 21, 7, 50)} dataProvider={providerWith("FAILED", "暂时离线")} />);

    expect(screen.getAllByText("2026-05-21").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("今日首推")).toBeInTheDocument();
  });

  it("persists deletion choices locally", async () => {
    localStorage.clear();
    const user = userEvent.setup();
    const first = renderWithSampleProvider(new Date(2026, 4, 21, 9, 0));

    await screen.findByText("8:30 成功");
    await user.click(screen.getAllByRole("button", { name: /删除/ })[0]);
    await user.click(screen.getByRole("button", { name: "风险大" }));
    first.unmount();

    render(<App today={new Date(2026, 4, 21, 9, 0)} dataProvider={sampleDataProvider} />);

    expect(await screen.findByText(/已删除 1 条推荐/)).toBeInTheDocument();
  });
});
