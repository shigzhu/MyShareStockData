import type { AuctionMetrics, CandidatePlan, StrategyThresholds } from "./types";

export interface AuctionCheck {
  confirmed: boolean;
  score: number;
  reasons: string[];
  risks: string[];
}

export function confirmAuction(
  candidate: CandidatePlan,
  auction: AuctionMetrics | undefined,
  thresholds: StrategyThresholds
): AuctionCheck {
  if (!auction) {
    return {
      confirmed: false,
      score: candidate.score,
      reasons: ["缺少9:25竞价数据"],
      risks: ["只能保留为备选观察"]
    };
  }

  const expansion = auction.auctionTurnoverAmount / Math.max(1, auction.recentAuctionTurnoverAvg);
  const turnoverToYesterdayPct =
    (auction.auctionTurnoverAmount / Math.max(1, auction.yesterdayTurnoverAmount)) * 100;
  const reasons: string[] = [];
  const risks: string[] = [];
  let score = candidate.score;

  if (expansion >= thresholds.auction.minAuctionTurnoverExpansionMultiple) {
    score += 18;
    reasons.push("竞价成交显著放量");
  } else {
    risks.push("竞价放量不足");
  }

  if (turnoverToYesterdayPct >= thresholds.auction.minAuctionTurnoverToYesterdayPct) {
    score += 12;
    reasons.push("竞价成交占昨日成交比例达标");
  } else {
    risks.push("竞价成交相对昨日成交偏弱");
  }

  if (
    auction.gapPct >= thresholds.auction.idealGapPctMin &&
    auction.gapPct <= thresholds.auction.idealGapPctMax
  ) {
    score += 10;
    reasons.push("高开幅度处于3%-7%强而不过热区间");
  } else {
    risks.push("高开幅度不在理想区间");
  }

  if (auction.nearOnePriceLimitUp) {
    risks.push("接近一字板，买入性价比不足");
  }

  if (auction.weakToStrongFailed) {
    risks.push("竞价弱转强失败");
  }

  const confirmed =
    risks.length === 0 &&
    expansion >= thresholds.auction.minAuctionTurnoverExpansionMultiple &&
    turnoverToYesterdayPct >= thresholds.auction.minAuctionTurnoverToYesterdayPct;

  return { confirmed, score, reasons, risks };
}
