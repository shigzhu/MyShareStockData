import json
import tempfile
import unittest
from pathlib import Path
from copy import deepcopy
from unittest.mock import patch

import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from adapters.auction_enrichment import apply_auction_file


BASE_INPUT = {
    "tradeDate": "2026-05-25",
    "themes": [
        {
            "id": "BK1",
            "name": "测试题材",
            "stocks": [{"code": "300750", "turnoverAmount": 100_000_000, "lastClose": 200}],
        }
    ],
}


class AuctionEnrichmentTest(unittest.TestCase):
    def test_applies_external_auction_metrics_from_json_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "auction.json"
            path.write_text(
                json.dumps(
                    {
                        "tradeDate": "2026-05-25",
                        "stocks": [
                            {
                                "code": "300750",
                                "gapPct": 4.8,
                                "auctionTurnoverAmount": 18000000,
                                "recentAuctionTurnoverAvg": 3000000,
                                "yesterdayTurnoverAmount": 100000000,
                                "nearOnePriceLimitUp": False,
                                "weakToStrongFailed": False,
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            enriched = apply_auction_file(deepcopy(BASE_INPUT), path)

        auction = enriched["auctionByCode"]["300750"]
        self.assertEqual(auction["gapPct"], 4.8)
        self.assertEqual(auction["auctionTurnoverAmount"], 18000000)
        self.assertEqual(auction["recentAuctionTurnoverAvg"], 3000000)

    def test_retries_auction_file_read_three_times(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "auction.json"
            path.write_text(
                json.dumps({"stocks": [{"code": "300750", "gapPct": 5.1}]}),
                encoding="utf-8",
            )
            original_read_text = Path.read_text
            attempts = 0

            def flaky_read_text(self, *args, **kwargs):
                nonlocal attempts
                if self == path:
                    attempts += 1
                    if attempts < 3:
                        raise OSError("temporary file lock")
                return original_read_text(self, *args, **kwargs)

            with patch.object(Path, "read_text", flaky_read_text):
                enriched = apply_auction_file(deepcopy(BASE_INPUT), path)

        self.assertEqual(enriched["auctionByCode"]["300750"]["gapPct"], 5.1)
        self.assertEqual(attempts, 3)


if __name__ == "__main__":
    unittest.main()
