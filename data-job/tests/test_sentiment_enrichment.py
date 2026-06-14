import json
import tempfile
import unittest
from pathlib import Path
from copy import deepcopy
from unittest.mock import patch

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

    def test_retries_discussion_heat_file_read_three_times(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "sentiment.json"
            path.write_text(
                json.dumps(
                    {
                        "stocks": [
                            {
                                "code": "300750",
                                "iwencaiScore": 88,
                            }
                        ]
                    }
                ),
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
                enriched = apply_discussion_heat_file(deepcopy(BASE_INPUT), path)

        self.assertEqual(enriched["themes"][0]["stocks"][0]["discussionHeat"]["iwencaiScore"], 88)
        self.assertEqual(attempts, 3)


if __name__ == "__main__":
    unittest.main()
