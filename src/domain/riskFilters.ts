import type { Rejection, StockMetrics, StrategyThresholds } from "./types";
import { isOverheated } from "./themeSelection";

export function getRiskRejections(stock: StockMetrics, thresholds: StrategyThresholds): Rejection[] {
  const rejections: Rejection[] = [];

  if (stock.isSt) {
    rejections.push({ code: stock.code, reason: "ST或退市风险标识" });
  }

  if (stock.isSuspended) {
    rejections.push({ code: stock.code, reason: "停牌或交易状态异常" });
  }

  if (stock.listingDays < thresholds.stock.minListingDays) {
    rejections.push({ code: stock.code, reason: "上市时间过短" });
  }

  if (stock.turnoverAmount < thresholds.stock.minTurnoverAmount) {
    rejections.push({ code: stock.code, reason: "成交额不足" });
  }

  if (stock.turnoverRatePct < thresholds.stock.minTurnoverRatePct) {
    rejections.push({ code: stock.code, reason: "换手率不足" });
  }

  if (stock.severeFinancialRisk) {
    rejections.push({ code: stock.code, reason: "财务风险过高" });
  }

  if (stock.majorNegativeEvent) {
    rejections.push({ code: stock.code, reason: "重大负面事件" });
  }

  if (isOverheated(stock, thresholds)) {
    rejections.push({ code: stock.code, reason: "短期过热或承接转弱" });
  }

  return rejections;
}
