from __future__ import annotations

from copy import deepcopy


def _iter_stocks(trading_day_input: dict):
    for theme in trading_day_input.get("themes", []):
        for stock in theme.get("stocks", []):
            yield stock


def apply_tushare_daily_basic(trading_day_input: dict, daily_basic_by_code: dict) -> dict:
    enriched = deepcopy(trading_day_input)
    for stock in _iter_stocks(enriched):
        metrics = daily_basic_by_code.get(stock.get("code"))
        if not metrics:
            continue

        if "turnoverRatePct" in metrics:
            stock["turnoverRatePct"] = metrics["turnoverRatePct"]

        quant = stock.setdefault("quant", {})
        for key in ["pe", "pb", "marketCapRankScore"]:
            if key in metrics:
                quant[key] = metrics[key]
    return enriched


def apply_akshare_financials(trading_day_input: dict, financials_by_code: dict) -> dict:
    enriched = deepcopy(trading_day_input)
    for stock in _iter_stocks(enriched):
        metrics = financials_by_code.get(stock.get("code"))
        if not metrics:
            continue

        quant = stock.setdefault("quant", {})
        for key in [
            "roePct",
            "grossMarginPct",
            "debtAssetRatioPct",
            "revenueGrowthYoYPct",
            "profitGrowthYoYPct",
        ]:
            if key in metrics:
                quant[key] = metrics[key]
    return enriched
