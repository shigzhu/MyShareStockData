import unittest
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from adapters.eastmoney import EastMoneyAdapter


def fake_response(diff):
    return {"rc": 0, "data": {"diff": diff}}


class EastMoneyAdapterTest(unittest.TestCase):
    def test_builds_partial_trading_day_input_from_public_market_data(self):
        calls = []

        def client(url):
            calls.append(url)
            if "fs=m%3A90%2Bt%3A3" in url:
                return fake_response(
                    [
                        {
                            "f12": "BK0890",
                            "f14": "MLCC",
                            "f3": 11.22,
                            "f6": 48_406_935_009,
                            "f8": 8.45,
                            "f128": "风华高科",
                            "f140": "000636",
                            "f136": 10,
                        }
                    ]
                )
            if "fs=b%3ABK0890" in url:
                return fake_response(
                    [
                        {
                            "f12": "688260",
                            "f14": "昀冢科技",
                            "f2": 72.71,
                            "f3": 20.0,
                            "f6": 1_047_150_482,
                            "f8": 12.29,
                            "f9": -41.23,
                            "f15": 72.71,
                            "f16": 63.94,
                            "f18": 60.59,
                            "f20": 8_725_200_000,
                            "f21": 8_725_200_000,
                            "f23": 54.03,
                            "f24": 144.32,
                            "f25": 152.47,
                            "f100": "消费电子",
                            "f115": -45.74,
                        }
                    ]
                )
            if "fs=m%3A0%2Bt%3A6" in url:
                return fake_response(
                    [
                        {"f3": 20.0},
                        {"f3": 10.0},
                        {"f3": -3.0},
                    ]
                )
            raise AssertionError(f"unexpected url: {url}")

        adapter = EastMoneyAdapter(http_get_json=client)
        trading_day = adapter.fetch_pre_market_input("2026-05-25")

        self.assertEqual(trading_day["tradeDate"], "2026-05-25")
        self.assertEqual(trading_day["dataCompleteness"], "PARTIAL")
        self.assertEqual(trading_day["marketMood"]["advancingCount"], 2)
        self.assertEqual(trading_day["marketMood"]["decliningCount"], 1)
        self.assertEqual(trading_day["themes"][0]["id"], "BK0890")
        self.assertEqual(trading_day["themes"][0]["name"], "MLCC")
        stock = trading_day["themes"][0]["stocks"][0]
        self.assertEqual(stock["code"], "688260")
        self.assertEqual(stock["name"], "昀冢科技")
        self.assertEqual(stock["themeId"], "BK0890")
        self.assertEqual(stock["lastClose"], 60.59)
        self.assertEqual(stock["turnoverAmount"], 1_047_150_482)
        self.assertGreater(stock["attentionScore"], 0)
        self.assertGreaterEqual(len(calls), 3)

    def test_builds_auction_input_only_for_premarket_pool(self):
        def client(url):
            if "api/qt/ulist.np/get" in url:
                return fake_response(
                    [
                        {
                            "f12": "688260",
                            "f14": "昀冢科技",
                            "f2": 63.8,
                            "f6": 42_000_000,
                            "f18": 60.59,
                            "f15": 66.65,
                        }
                    ]
                )
            raise AssertionError(f"unexpected url: {url}")

        adapter = EastMoneyAdapter(http_get_json=client)
        pre_market_input = {
            "tradeDate": "2026-05-25",
            "dataCompleteness": "PARTIAL",
            "marketMood": {},
            "themes": [
                {
                    "id": "BK0890",
                    "name": "MLCC",
                    "stocks": [
                        {
                            "code": "688260",
                            "name": "昀冢科技",
                            "turnoverAmount": 1_047_150_482,
                            "lastClose": 60.59,
                        }
                    ],
                }
            ],
        }

        auction_input = adapter.fetch_auction_input("2026-05-25", pre_market_input)

        self.assertEqual(auction_input["dataCompleteness"], "PARTIAL")
        auction = auction_input["auctionByCode"]["688260"]
        self.assertEqual(auction["code"], "688260")
        self.assertAlmostEqual(auction["gapPct"], 5.3, places=1)
        self.assertEqual(auction["auctionTurnoverAmount"], 42_000_000)
        self.assertEqual(auction["yesterdayTurnoverAmount"], 1_047_150_482)


if __name__ == "__main__":
    unittest.main()
