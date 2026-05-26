import { describe, expect, it } from "vitest";
import { buildRecommendationSnapshot } from "../domain/reviewEngine";
import { generatePreMarketPlan } from "../domain/strategyEngine";
import type { RuleSuggestion, TradeLogEntry } from "../domain/types";
import { createLocalReviewStore } from "./localReviewStore";
import { sampleTradingDay } from "./sampleTradingDay";

describe("localReviewStore", () => {
  it("saves and loads recommendation snapshots by trade date", () => {
    const store = createLocalReviewStore("test-stock-review");
    const result = generatePreMarketPlan(sampleTradingDay);
    const snapshot = buildRecommendationSnapshot(result, "2026-05-21T08:35:00");

    store.saveSnapshot(snapshot);

    const plans = store.loadDailyPlans();
    expect(plans["2026-05-21"].tradeDate).toBe("2026-05-21");
    expect(plans["2026-05-21"].preMarket?.candidates.length).toBeGreaterThan(0);
    expect(plans["2026-05-21"].snapshots[0].id).toBe("2026-05-21-PREMARKET_0830");
  });

  it("persists recommendation deletions", () => {
    const store = createLocalReviewStore("test-stock-review");

    store.saveDeletion({
      code: "300750",
      name: "宁德时代",
      tradeDate: "2026-05-21",
      stage: "PREMARKET_0830",
      role: "PRIMARY",
      reason: "风险大",
      deletedAt: "2026-05-21T09:00:00"
    });

    expect(store.loadDeletions()[0].reason).toBe("风险大");
  });

  it("upserts trade logs by id", () => {
    const store = createLocalReviewStore("test-stock-review");
    const entry: TradeLogEntry = {
      id: "trade-1",
      recommendationTradeDate: "2026-05-21",
      stage: "AUCTION_0925",
      code: "300750",
      name: "宁德时代",
      bought: true,
      buyPrice: 200,
      sellPrice: 206,
      positionPct: 30,
      buyTime: "2026-05-21T09:31",
      sellTime: "2026-05-22T14:30",
      reasons: ["按计划执行"],
      note: "符合计划",
      outcome: "PROFIT",
      createdAt: "2026-05-21T09:31:00",
      updatedAt: "2026-05-22T14:30:00"
    };

    store.upsertTradeLog(entry);
    store.upsertTradeLog({ ...entry, sellPrice: 198, outcome: "LOSS", updatedAt: "2026-05-22T14:40:00" });

    const logs = store.loadTradeLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].sellPrice).toBe(198);
    expect(logs[0].outcome).toBe("LOSS");
  });

  it("updates rule suggestion status", () => {
    const store = createLocalReviewStore("test-stock-review");
    const suggestion: RuleSuggestion = {
      id: "rule-1",
      createdAt: "2026-05-22T15:10:00",
      recommendationTradeDate: "2026-05-21",
      code: "300750",
      name: "宁德时代",
      type: "FILTER_TIGHTEN",
      title: "收紧过滤",
      detail: "提高竞价承接过滤要求。",
      evidence: ["失败样本"],
      marketStage: "震荡期",
      status: "PENDING"
    };

    store.upsertRuleSuggestions([suggestion]);
    store.updateRuleSuggestionStatus("rule-1", "APPROVED");

    expect(store.loadRuleSuggestions()[0].status).toBe("APPROVED");
  });

  it("exports trade logs as CSV with Chinese headers", () => {
    const store = createLocalReviewStore("test-stock-review");

    store.upsertTradeLog({
      id: "trade-1",
      recommendationTradeDate: "2026-05-21",
      stage: "AUCTION_0925",
      code: "300750",
      name: "宁德时代",
      bought: true,
      buyPrice: 200,
      sellPrice: 206,
      positionPct: 30,
      buyTime: "2026-05-21T09:31",
      sellTime: "2026-05-22T14:30",
      reasons: ["按计划执行", "止盈"],
      note: "符合计划",
      outcome: "PROFIT",
      createdAt: "2026-05-21T09:31:00",
      updatedAt: "2026-05-22T14:30:00"
    });

    const csv = store.exportTradeLogsCsv();

    expect(csv.split("\n")[0]).toContain("推荐日期,阶段,代码,名称");
    expect(csv).toContain("300750");
    expect(csv).toContain("按计划执行|止盈");
  });
});
