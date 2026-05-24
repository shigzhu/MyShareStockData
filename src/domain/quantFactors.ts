import type { QuantMetrics, QuantScore, StockMetrics } from "./types";

const requiredQuantFields: Array<keyof QuantMetrics> = [
  "grossMarginPct",
  "netMarginPct",
  "debtAssetRatioPct",
  "operatingCashFlowCoverage",
  "revenueGrowthYoYPct",
  "profitGrowthYoYPct",
  "roePct",
  "roaPct",
  "return1dPct",
  "relativeStrengthRank",
  "rsi14",
  "volatility20dPct",
  "maxDrawdown60dPct",
  "marketCapRankScore"
];

function scoreByValue(value: number, excellent: number, poor: number) {
  if (excellent === poor) {
    return 0;
  }

  const normalized = (value - poor) / (excellent - poor);
  return Math.max(0, Math.min(1, normalized));
}

function scale(score: number, max: number) {
  return Math.round(score * max);
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

export function scoreQuantFactors(stock: StockMetrics): QuantScore {
  const quant = stock.quant;
  const missingRequiredData = requiredQuantFields.filter((field) => quant[field] === undefined || quant[field] === null);
  const reasons: string[] = [];
  const risks: string[] = [];

  if (missingRequiredData.length > 0) {
    return {
      total: 0,
      valuation: 0,
      growth: 0,
      quality: 0,
      momentum: 0,
      capital: 0,
      riskControl: 0,
      passed: false,
      reasons,
      risks: ["关键量化数据缺失"],
      missingRequiredData
    };
  }

  if ((quant.operatingCashFlowCoverage ?? 0) < 0.8) {
    risks.push("现金流覆盖不足");
  }

  if ((quant.grossMarginPct ?? 0) < 15 || (quant.netMarginPct ?? 0) < 3) {
    risks.push("盈利质量偏弱");
  }

  if ((quant.debtAssetRatioPct ?? 100) > 70) {
    risks.push("资产负债率过高");
  }

  if ((quant.volatility20dPct ?? 100) > 45) {
    risks.push("波动率过高");
  }

  if ((quant.maxDrawdown60dPct ?? 100) > 25) {
    risks.push("回撤过深");
  }

  if ((quant.marketCapRankScore ?? 0) < 35) {
    risks.push("市值或流动性层级不合适");
  }

  if (risks.length > 0) {
    return {
      total: 0,
      valuation: 0,
      growth: 0,
      quality: 0,
      momentum: 0,
      capital: 0,
      riskControl: 0,
      passed: false,
      reasons,
      risks,
      missingRequiredData
    };
  }

  const valuationRaw = average([
    scoreByValue(quant.pe ?? 45, 18, 60),
    scoreByValue(quant.pb ?? 6, 1.8, 8),
    scoreByValue(quant.ps ?? 8, 2, 12),
    scoreByValue(quant.evToEbitda ?? 30, 10, 40)
  ]);
  const valuation = scale(valuationRaw, 3);

  const growthRaw = average([
    scoreByValue(quant.revenueGrowthYoYPct ?? 0, 30, -10),
    scoreByValue(quant.revenueGrowthQoQPct ?? 0, 12, -8),
    scoreByValue(quant.profitGrowthYoYPct ?? 0, 35, -15),
    scoreByValue(quant.epsGrowthPct ?? 0, 30, -10),
    scoreByValue(quant.roePct ?? 0, 18, 5),
    scoreByValue(quant.roaPct ?? 0, 9, 2)
  ]);
  const growth = scale(growthRaw, 5);

  const qualityRaw = average([
    scoreByValue(quant.grossMarginPct ?? 0, 45, 15),
    scoreByValue(quant.netMarginPct ?? 0, 18, 3),
    scoreByValue(70 - (quant.debtAssetRatioPct ?? 70), 45, 0),
    scoreByValue(quant.operatingCashFlowCoverage ?? 0, 1.8, 0.8)
  ]);
  const quality = scale(qualityRaw, 6);

  const lowLaunchBonus =
    stock.return10dPct <= 18 && stock.distanceFromMa5Pct <= 6 && stock.distanceFromMa10Pct <= 12 ? 1 : 0.55;
  const momentumRaw =
    average([
      scoreByValue(quant.return1dPct ?? 0, 6, -3),
      scoreByValue(stock.return5dPct, 12, -5),
      scoreByValue(quant.relativeStrengthRank ?? 0, 90, 45),
      scoreByValue(80 - Math.abs((quant.rsi14 ?? 60) - 62), 80, 35)
    ]) * lowLaunchBonus;
  const momentum = scale(momentumRaw, 7);

  const capitalRaw = average([
    scoreByValue(quant.northboundNetBuyScore ?? 50, 85, 30),
    scoreByValue(quant.marginBalanceTrendScore ?? 50, 80, 25),
    scoreByValue(quant.institutionHoldingScore ?? 50, 85, 25),
    scoreByValue(stock.turnoverRatePct, 18, 3),
    scoreByValue(stock.turnoverAmount / 100_000_000, 35, 8)
  ]);
  const capital = scale(capitalRaw, 5);

  const riskControlRaw = average([
    scoreByValue(45 - (quant.volatility20dPct ?? 45), 35, 0),
    scoreByValue(25 - (quant.maxDrawdown60dPct ?? 25), 20, 0),
    scoreByValue(quant.marketCapRankScore ?? 0, 90, 35)
  ]);
  const riskControl = scale(riskControlRaw, 4);
  const total = Math.min(30, valuation + growth + quality + momentum + capital + riskControl);

  reasons.push("量化硬过滤通过");
  if (growth >= 3) {
    reasons.push("成长趋势改善");
  }
  if (momentum >= 4) {
    reasons.push("低位启动与短线动量匹配");
  }
  if (capital >= 3) {
    reasons.push("机构背景与短线资金共同改善");
  }

  return {
    total,
    valuation,
    growth,
    quality,
    momentum,
    capital,
    riskControl,
    passed: true,
    reasons,
    risks,
    missingRequiredData
  };
}
