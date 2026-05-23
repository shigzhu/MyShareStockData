import { describe, expect, it } from "vitest";
import { selectTradableThemes } from "./themeSelection";
import { defaultThresholds } from "./thresholds";
import type { StockMetrics, ThemeMetrics } from "./types";

function stock(overrides: Partial<StockMetrics>): StockMetrics {
  return {
    code: "000001",
    name: "核心股份",
    themeId: "ai",
    lastClose: 10,
    turnoverAmount: 1_500_000_000,
    turnoverRatePct: 6,
    return5dPct: 8,
    return10dPct: 15,
    return20dPct: 25,
    distanceFromMa5Pct: 4,
    distanceFromMa10Pct: 8,
    consecutiveLimitUps: 0,
    blowOffVolume: false,
    weakAcceptanceAfterBlowOff: false,
    isSt: false,
    isSuspended: false,
    listingDays: 600,
    severeFinancialRisk: false,
    majorNegativeEvent: false,
    attentionScore: 92,
    discussionHeat: {
      iwencaiScore: 55,
      eastMoneyGubaScore: 58,
      weiboFinanceScore: 52,
      rankingDays: 2,
      suddenRiseDays: 2,
      screenDominating: false
    },
    ...overrides
  };
}

function theme(overrides: Partial<ThemeMetrics>): ThemeMetrics {
  return {
    id: "ai",
    name: "人工智能",
    recentStrengthScore: 85,
    moneyMakingScore: 82,
    turnoverHeatScore: 90,
    continuationScore: 78,
    stocks: [stock({})],
    ...overrides
  };
}

describe("selectTradableThemes", () => {
  it("selects strongest one or two themes with non-overheated attention leaders", () => {
    const result = selectTradableThemes(
      [
        theme({ id: "ai", name: "人工智能" }),
        theme({ id: "robot", name: "机器人", recentStrengthScore: 80 }),
        theme({ id: "weak", name: "弱题材", recentStrengthScore: 45, moneyMakingScore: 40 })
      ],
      defaultThresholds
    );

    expect(result.selected).toHaveLength(2);
    expect(result.selected[0].theme.name).toBe("人工智能");
  });

  it("rejects the whole theme when the attention leader is overheated", () => {
    const result = selectTradableThemes(
      [
        theme({
          stocks: [
            stock({
              code: "300001",
              return10dPct: 45,
              distanceFromMa5Pct: 16,
              attentionScore: 98
            })
          ]
        })
      ],
      defaultThresholds
    );

    expect(result.selected).toHaveLength(0);
    expect(result.rejections[0].reason).toContain("人气龙头过热");
  });
});
