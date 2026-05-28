import unittest
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from adapters.tushare import TushareAdapter


class TushareAdapterTest(unittest.TestCase):
    def test_fetches_trade_calendar_status(self):
        calls = []

        def client(payload):
            calls.append(payload)
            return {
                "code": 0,
                "data": {
                    "fields": ["cal_date", "is_open"],
                    "items": [["20260525", 1]],
                },
            }

        adapter = TushareAdapter(token="token", http_post_json=client)

        self.assertEqual(adapter.fetch_trading_status("2026-05-25"), {"isTradingDay": True, "message": "Tushare交易日历"})
        self.assertEqual(calls[0]["api_name"], "trade_cal")
        self.assertEqual(calls[0]["params"]["cal_date"], "20260525")

    def test_fetches_daily_basic_by_code(self):
        def client(payload):
            self.assertEqual(payload["api_name"], "daily_basic")
            return {
                "code": 0,
                "data": {
                    "fields": ["ts_code", "turnover_rate", "pe", "pb", "total_mv", "circ_mv"],
                    "items": [["300750.SZ", 2.7, 21.5, 4.2, 9000000, 7600000]],
                },
            }

        adapter = TushareAdapter(token="token", http_post_json=client)

        daily_basic = adapter.fetch_daily_basic("2026-05-25", ["300750"])

        self.assertEqual(daily_basic["300750"]["pe"], 21.5)
        self.assertEqual(daily_basic["300750"]["pb"], 4.2)
        self.assertEqual(daily_basic["300750"]["turnoverRatePct"], 2.7)
        self.assertEqual(daily_basic["300750"]["marketCapRankScore"], 100)


if __name__ == "__main__":
    unittest.main()
