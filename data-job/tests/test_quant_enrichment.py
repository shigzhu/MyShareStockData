import unittest
from copy import deepcopy
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from adapters.quant_enrichment import apply_akshare_financials, apply_tushare_daily_basic


BASE_INPUT = {
    "tradeDate": "2026-05-25",
    "themes": [
        {
            "id": "BK1",
            "name": "测试题材",
            "stocks": [
                {
                    "code": "300750",
                    "turnoverRatePct": 1.2,
                    "quant": {
                        "pe": 45,
                        "pb": 6,
                        "roePct": 8,
                        "grossMarginPct": 18,
                    },
                }
            ],
        }
    ],
}


class QuantEnrichmentTest(unittest.TestCase):
    def test_applies_tushare_daily_basic_to_stock_quant_metrics(self):
        trading_day = deepcopy(BASE_INPUT)

        enriched = apply_tushare_daily_basic(
            trading_day,
            {
                "300750": {
                    "turnoverRatePct": 3.5,
                    "pe": 21.2,
                    "pb": 4.1,
                    "marketCapRankScore": 88,
                }
            },
        )

        stock = enriched["themes"][0]["stocks"][0]
        self.assertEqual(stock["turnoverRatePct"], 3.5)
        self.assertEqual(stock["quant"]["pe"], 21.2)
        self.assertEqual(stock["quant"]["pb"], 4.1)
        self.assertEqual(stock["quant"]["marketCapRankScore"], 88)

    def test_applies_akshare_financials_to_stock_quant_metrics(self):
        trading_day = deepcopy(BASE_INPUT)

        enriched = apply_akshare_financials(
            trading_day,
            {
                "300750": {
                    "roePct": 20.5,
                    "grossMarginPct": 31.2,
                    "debtAssetRatioPct": 44.1,
                    "revenueGrowthYoYPct": 18.6,
                    "profitGrowthYoYPct": 22.4,
                }
            },
        )

        quant = enriched["themes"][0]["stocks"][0]["quant"]
        self.assertEqual(quant["roePct"], 20.5)
        self.assertEqual(quant["grossMarginPct"], 31.2)
        self.assertEqual(quant["debtAssetRatioPct"], 44.1)
        self.assertEqual(quant["revenueGrowthYoYPct"], 18.6)
        self.assertEqual(quant["profitGrowthYoYPct"], 22.4)


if __name__ == "__main__":
    unittest.main()
