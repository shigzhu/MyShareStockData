import type { DiscussionHeatMetrics, DiscussionHeatScore, StockMetrics } from "./types";

function averageHeat(heat: DiscussionHeatMetrics): number {
  return (heat.iwencaiScore + heat.eastMoneyGubaScore + heat.weiboFinanceScore) / 3;
}

function isLowPositionLaunch(stock: StockMetrics): boolean {
  return (
    stock.return10dPct <= 20 &&
    stock.distanceFromMa5Pct <= 7 &&
    stock.distanceFromMa10Pct <= 12 &&
    stock.discussionHeat.suddenRiseDays >= 1 &&
    stock.discussionHeat.suddenRiseDays <= 3 &&
    stock.discussionHeat.rankingDays <= 3 &&
    !stock.discussionHeat.screenDominating &&
    stock.turnoverAmount > 0 &&
    stock.consecutiveLimitUps <= 1 &&
    !stock.blowOffVolume &&
    !stock.weakAcceptanceAfterBlowOff
  );
}

export function scoreDiscussionHeat(stock: StockMetrics): DiscussionHeatScore {
  const rawScore = Math.round(averageHeat(stock.discussionHeat));
  const reasons: string[] = [];
  const risks: string[] = [];
  let weightedScore = 0;
  let temperature: DiscussionHeatScore["temperature"] = "冷门";
  let reject = false;

  if (rawScore < 35) {
    temperature = "冷门";
    weightedScore = Math.round(rawScore * 0.2);
    risks.push("跨平台讨论热度不足");
  } else if (rawScore < 70) {
    temperature = "升温";
    weightedScore = Math.round(18 + (rawScore - 35) * 0.25);
    reasons.push("问财、股吧、微博讨论热度正在升温");
  } else if (rawScore < 88) {
    temperature = "热门";
    weightedScore = Math.round(24 + (rawScore - 70) * 0.2);
    reasons.push("跨平台讨论热度较高");
  } else if (isLowPositionLaunch(stock)) {
    temperature = "过热";
    weightedScore = 22;
    reasons.push("低位刚启动但舆情快速升温");
    risks.push("舆情升温较快，需防止一致性追高");
  } else {
    temperature = stock.discussionHeat.screenDominating ? "异常刷屏" : "过热";
    weightedScore = 4;
    reject = true;
    risks.push("高位舆情过热");
  }

  return { rawScore, weightedScore, temperature, reasons, risks, reject };
}
