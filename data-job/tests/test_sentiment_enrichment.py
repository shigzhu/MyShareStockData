import json
import tempfile
import unittest
from pathlib import Path
from copy import deepcopy

import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from adapters.sentiment_enrichment import apply_discussion_heat_file


BASE_INPUT = {
    "tradeDate": "2026-05-25",
    "themes": [
        {
            "id": "BK1",
            "name": "测试题材",
            "stocks": [
                {
                    "code": "300750",
                    "discussionHeat": {
                        "iwencaiScore": 10,
                        "eastMoneyGubaScore": 10,
                        "weiboFinanceScore": 10,
                        "rankingDays": 3,
                        "suddenRiseDays": 3,
                        "screenDominating": False,
                    },
                }
            ],
        }
    ],
}


class SentimentEnrichmentTest(unittest.TestCase):
    def test_applies_cross_platform_discussion_heat_from_json_file(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "sentiment.json"
            path.write_text(
                json.dumps(
                    {
                        "tradeDate": "2026-05-25",
                        "stocks": [
                            {
                                "code": "300750",
                                "iwencaiScore": 78,
                                "eastMoneyGubaScore": 83,
                                "weiboFinanceScore": 71,
                                "rankingDays": 1,
                                "suddenRiseDays": 1,
                                "screenDominating": False,
                            }
                        ],
                    },
                    ensure_ascii=False,
                ),
                encoding="utf-8",
            )

            enriched = apply_discussion_heat_file(deepcopy(BASE_INPUT), path)

        heat = enriched["themes"][0]["stocks"][0]["discussionHeat"]
        self.assertEqual(heat["iwencaiScore"], 78)
        self.assertEqual(heat["eastMoneyGubaScore"], 83)
        self.assertEqual(heat["weiboFinanceScore"], 71)
        self.assertEqual(heat["rankingDays"], 1)


if __name__ == "__main__":
    unittest.main()
