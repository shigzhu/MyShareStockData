from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

from adapters.retry import retry_call


AUCTION_FIELDS = [
    "code",
    "gapPct",
    "auctionTurnoverAmount",
    "recentAuctionTurnoverAvg",
    "yesterdayTurnoverAmount",
    "nearOnePriceLimitUp",
    "weakToStrongFailed",
]


def apply_auction_file(trading_day_input: dict, path: Path) -> dict:
    payload = json.loads(retry_call(lambda: path.read_text(encoding="utf-8"), sleep_seconds=0.2))
    auction_by_code = {
        str(item.get("code")): {field: item[field] for field in AUCTION_FIELDS if field in item}
        for item in payload.get("stocks", [])
        if item.get("code")
    }
    enriched = deepcopy(trading_day_input)
    enriched["auctionByCode"] = {
        **enriched.get("auctionByCode", {}),
        **auction_by_code,
    }
    return enriched
