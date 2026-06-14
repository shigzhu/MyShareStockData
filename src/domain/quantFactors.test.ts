import { describe, expect, it } from "vitest";
import { sampleTradingDay } from "../data/sampleTradingDay";
import { scoreQuantFactors } from "./quantFactors";
import type { StockMetrics } from "./types";

const baseStock = sampleTradingDay.themes[0].stocks[0];

function withStock(overrides: Partial<StockMetrics>): StockMetrics {
  return {
    ...baseStock,
    ...overrides,
    quant: {
      ...baseStock.quant,
      ...overrides.quant
    }
  };
}

describe("scoreQuantFactors", () => {
  it("rejects a stock when required quant data is missing", () => {
    const result = scoreQuantFactors(withStock({ quant: { ...baseStock.quant, grossMarginPct: undefined } }));

    expect(result.passed).toBe(false);
    expect(result.total).toBe(0);
    expect(result.missingRequiredData).toContain("grossMarginPct");
    expect(result.risks).toContain("关键量化数据缺失");
  });

  it("strictly rejects poor quality or high drawdown stocks before scoring", () => {
    const result = scoreQuantFactors(
      withStock({
        quant: {
          ...baseStock.quant,
          operatingCashFlowCoverage: 0.55,
          maxDrawdown60dPct: 32
        }
      })
    );

    expect(result.passed).toBe(false);
    expect(result.total).toBe(0);
    expect(result.risks.some((risk) => risk.includes("现金流覆盖不足"))).toBe(true);
    expect(result.risks.some((risk) => risk.includes("回撤过深"))).toBe(true);
  });

  it("scores a qualified stock across six quant dimensions up to 30 points", () => {
    const result = scoreQuantFactors(baseStock);

    expect(result.passed).toBe(true);
    expect(result.total).toBeGreaterThanOrEqual(20);
    expect(result.total).toBeLessThanOrEqual(30);
    expect(result.valuation).toBeLessThanOrEqual(3);
    expect(result.momentum).toBeGreaterThan(result.valuation);
    expect(result.reasons).toContain("量化硬过滤通过");
  });
});
