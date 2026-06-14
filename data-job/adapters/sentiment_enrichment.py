from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from adapters.retry import retry_call


def _iter_stocks(trading_day_input: dict):
    for theme in trading_day_input.get("themes", []):
        for stock in theme.get("stocks", []):
            yield stock


def apply_discussion_heat_file(trading_day_input: dict, path: Path) -> dict:
    payload = json.loads(retry_call(lambda: path.read_text(encoding="utf-8"), sleep_seconds=0.2))
    by_code = {str(item.get("code")): item for item in payload.get("stocks", []) if item.get("code")}
    enriched = deepcopy(trading_day_input)

    for stock in _iter_stocks(enriched):
        metrics = by_code.get(str(stock.get("code")))
        if not metrics:
            continue

        heat = stock.setdefault("discussionHeat", {})
        for key in [
            "iwencaiScore",
            "eastMoneyGubaScore",
            "weiboFinanceScore",
            "rankingDays",
            "suddenRiseDays",
            "screenDominating",
        ]:
            if key in metrics:
                heat[key] = metrics[key]

    return enriched
