import type { Rejection, StockMetrics, StrategyThresholds, ThemeMetrics } from "./types";

export interface SelectedTheme {
  theme: ThemeMetrics;
  leader: StockMetrics;
  score: number;
}

export interface ThemeSelectionResult {
  selected: SelectedTheme[];
  rejections: Rejection[];
}

export function scoreTheme(theme: ThemeMetrics): number {
  return Math.round(
    theme.recentStrengthScore * 0.3 +
      theme.moneyMakingScore * 0.25 +
      theme.turnoverHeatScore * 0.25 +
      theme.continuationScore * 0.2
  );
}

export function findAttentionLeader(stocks: StockMetrics[]): StockMetrics | undefined {
  return [...stocks].sort((a, b) => {
    const bScore =
      b.attentionScore * 0.55 + (b.turnoverAmount / 100_000_000) * 0.3 + b.turnoverRatePct * 0.15;
    const aScore =
      a.attentionScore * 0.55 + (a.turnoverAmount / 100_000_000) * 0.3 + a.turnoverRatePct * 0.15;
    return bScore - aScore;
  })[0];
}

export function isOverheated(stock: StockMetrics, thresholds: StrategyThresholds): boolean {
  return (
    stock.return5dPct > thresholds.stock.maxReturn5dPct ||
    stock.return10dPct > thresholds.stock.maxReturn10dPct ||
    stock.return20dPct > thresholds.stock.maxReturn20dPct ||
    stock.distanceFromMa5Pct > thresholds.stock.maxDistanceFromMa5Pct ||
    stock.distanceFromMa10Pct > thresholds.stock.maxDistanceFromMa10Pct ||
    stock.consecutiveLimitUps > thresholds.stock.maxConsecutiveLimitUps ||
    (stock.blowOffVolume && stock.weakAcceptanceAfterBlowOff)
  );
}

export function selectTradableThemes(
  themes: ThemeMetrics[],
  thresholds: StrategyThresholds
): ThemeSelectionResult {
  const rejections: Rejection[] = [];
  const selected: SelectedTheme[] = [];

  const ranked = [...themes]
    .map((theme) => ({
      theme,
      score: scoreTheme(theme),
      leader: findAttentionLeader(theme.stocks)
    }))
    .sort((a, b) => b.score - a.score);

  for (const item of ranked) {
    if (selected.length >= thresholds.theme.maxThemes) {
      break;
    }

    if (item.score < thresholds.theme.minThemeScore) {
      rejections.push({ themeId: item.theme.id, reason: "题材综合强度不足" });
      continue;
    }

    if (!item.leader) {
      rejections.push({ themeId: item.theme.id, reason: "题材缺少可识别人气龙头" });
      continue;
    }

    if (isOverheated(item.leader, thresholds)) {
      rejections.push({
        themeId: item.theme.id,
        code: item.leader.code,
        reason: "人气龙头过热，放弃整个题材"
      });
      continue;
    }

    selected.push({ theme: item.theme, leader: item.leader, score: item.score });
  }

  return { selected, rejections };
}
