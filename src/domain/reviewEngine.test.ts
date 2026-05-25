import { describe, expect, it } from "vitest";
import { sampleTradingDay } from "../data/sampleTradingDay";
import { generatePreMarketPlan } from "./strategyEngine";
import {
  buildCandidateReview,
  buildRecommendationSnapshot,
  buildRuleSuggestions,
  getHomeFocus,
  getPrimaryCandidate,
  summarizeReviewOutcome
} from "./reviewEngine";
import type { ReviewMarketData, StrategyResult } from "./types";

function resultWithPrimary(): StrategyResult {
  return generatePreMarketPlan(sampleTradingDay);
}

describe("reviewEngine", () => {
  it("uses phone local time to choose the home focus", () => {
    expect(getHomeFocus(new Date(2026, 4, 25, 8, 31), true)).toBe("TODAY_RECOMMENDATION");
    expect(getHomeFocus(new Date(2026, 4, 25, 10, 15), true)).toBe("INTRADAY_REVIEW");
    expect(getHomeFocus(new Date(2026, 4, 25, 15, 10), true)).toBe("CLOSE_REVIEW");
    expect(getHomeFocus(new Date(2026, 4, 26, 8, 10), true, { hasReviewTarget: true })).toBe("THIRD_DAY_FOLLOW_UP");
    expect(getHomeFocus(new Date(2026, 4, 24, 10, 0), false)).toBe("CLOSED");
  });

  it("creates stable recommendation snapshot ids and preserves the result", () => {
    const result = resultWithPrimary();
    const snapshot = buildRecommendationSnapshot(result, "2026-05-25T09:26:00");

    expect(snapshot.id).toBe("2026-05-21-PREMARKET_0830");
    expect(snapshot.tradeDate).toBe(result.tradeDate);
    expect(snapshot.result).toBe(result);
  });

  it("selects the role primary first and falls back to the first candidate", () => {
    const result = resultWithPrimary();
    const primary = getPrimaryCandidate(result);
    const fallback = getPrimaryCandidate({
      ...result,
      candidates: result.candidates.map((candidate) => ({ ...candidate, role: "BACKUP" }))
    });

    expect(primary?.role).toBe("PRIMARY");
    expect(fallback).toBeDefined();
    expect(fallback?.stock.code).toBe(result.candidates[0]?.stock.code);
  });

  it("labels a candidate review as success when next-day return is above two percent", () => {
    const result = resultWithPrimary();
    const candidate = getPrimaryCandidate(result);
    if (!candidate) {
      throw new Error("sample should contain a primary candidate");
    }

    const marketData: ReviewMarketData = {
      code: candidate.stock.code,
      name: candidate.stock.name,
      recommendationTradeDate: result.tradeDate,
      reviewTradeDate: "2026-05-22",
      buyPrice: 10,
      closePrice: 10.35,
      highPrice: 10.8,
      indexReturnPct: 0.5,
      sectorReturnPct: 1.2
    };

    const review = buildCandidateReview(result, candidate, marketData, "2026-05-22T15:10:00");

    expect(review.outcome).toBe("SUCCESS");
    expect(review.systemReturnPct).toBe(3.5);
    expect(review.beatIndex).toBe(true);
    expect(review.beatSector).toBe(true);
    expect(review.attribution.join(" ")).toContain("首推验证成功");
  });

  it("labels a candidate review as neutral for zero to two percent returns", () => {
    const result = resultWithPrimary();
    const candidate = getPrimaryCandidate(result);
    if (!candidate) {
      throw new Error("sample should contain a primary candidate");
    }

    const review = buildCandidateReview(
      result,
      candidate,
      {
        code: candidate.stock.code,
        name: candidate.stock.name,
        recommendationTradeDate: result.tradeDate,
        reviewTradeDate: "2026-05-22",
        buyPrice: 20,
        closePrice: 20.2
      },
      "2026-05-22T15:10:00"
    );

    expect(review.outcome).toBe("NEUTRAL");
    expect(review.systemReturnPct).toBe(1);
  });

  it("labels missing review data without inventing a return", () => {
    const result = resultWithPrimary();
    const candidate = getPrimaryCandidate(result);
    if (!candidate) {
      throw new Error("sample should contain a primary candidate");
    }

    const review = buildCandidateReview(
      result,
      candidate,
      {
        code: candidate.stock.code,
        name: candidate.stock.name,
        recommendationTradeDate: result.tradeDate,
        reviewTradeDate: "2026-05-22"
      },
      "2026-05-22T15:10:00"
    );

    expect(review.outcome).toBe("MISSING_MARKET_DATA");
    expect(review.systemReturnPct).toBeUndefined();
    expect(review.attribution.join(" ")).toContain("缺复盘行情");
  });

  it("generates pending rule suggestions for failed candidates with filtering language", () => {
    const result = resultWithPrimary();
    const candidate = getPrimaryCandidate(result);
    if (!candidate) {
      throw new Error("sample should contain a primary candidate");
    }

    const review = buildCandidateReview(
      result,
      candidate,
      {
        code: candidate.stock.code,
        name: candidate.stock.name,
        recommendationTradeDate: result.tradeDate,
        reviewTradeDate: "2026-05-22",
        buyPrice: 10,
        closePrice: 9.6
      },
      "2026-05-22T15:10:00"
    );
    const suggestions = buildRuleSuggestions(result, candidate, review, "退潮期");

    expect(review.outcome).toBe("FAILED");
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0].status).toBe("PENDING");
    expect(suggestions.map((item) => item.detail).join(" ")).toContain("过滤");
  });

  it("summarizes review outcomes for display", () => {
    expect(summarizeReviewOutcome("SUCCESS")).toBe("成功");
    expect(summarizeReviewOutcome("NEUTRAL")).toBe("一般");
    expect(summarizeReviewOutcome("FAILED")).toBe("失败");
    expect(summarizeReviewOutcome("MISSING_MARKET_DATA")).toBe("缺复盘行情");
  });
});
