import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "data-job" / "generate_daily_feed.py"
FIXTURE = ROOT / "data-job" / "fixtures" / "sample_trading_day.json"


class GenerateDailyFeedTest(unittest.TestCase):
    def test_defaults_to_current_beijing_calendar_date(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "data"

            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--now-utc",
                    "2026-05-24T16:30:00Z",
                    "--stage",
                    "premarket",
                    "--source",
                    "fixture",
                    "--fixture",
                    str(FIXTURE),
                    "--output-dir",
                    str(output_dir),
                ],
                check=True,
            )

            today = json.loads((output_dir / "today.json").read_text(encoding="utf-8"))

        self.assertEqual(today["tradeDate"], "2026-05-25")
        self.assertEqual(today["generatedAt"], "2026-05-25T00:30:00+08:00")
        self.assertEqual(today["preMarketInput"]["tradeDate"], "2026-05-25")

    def test_beijing_calendar_date_moves_with_current_day(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "data"

            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--now-utc",
                    "2026-05-26T16:30:00Z",
                    "--stage",
                    "premarket",
                    "--source",
                    "fixture",
                    "--fixture",
                    str(FIXTURE),
                    "--output-dir",
                    str(output_dir),
                ],
                check=True,
            )

            today = json.loads((output_dir / "today.json").read_text(encoding="utf-8"))

        self.assertEqual(today["tradeDate"], "2026-05-27")
        self.assertEqual(today["generatedAt"], "2026-05-27T00:30:00+08:00")
        self.assertEqual(today["preMarketInput"]["tradeDate"], "2026-05-27")

    def test_writes_today_and_history_feed_files_from_fixture_source(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "data"

            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--trade-date",
                    "2026-05-25",
                    "--stage",
                    "auction",
                    "--source",
                    "fixture",
                    "--fixture",
                    str(FIXTURE),
                    "--output-dir",
                    str(output_dir),
                ],
                check=True,
            )

            today = json.loads((output_dir / "today.json").read_text(encoding="utf-8"))
            history = json.loads((output_dir / "history" / "2026-05-25.json").read_text(encoding="utf-8"))

        self.assertEqual(today["tradeDate"], "2026-05-25")
        self.assertEqual(history["tradeDate"], "2026-05-25")
        self.assertIn("preMarketInput", today)
        self.assertIn("auctionInput", today)
        self.assertEqual(today["source"]["mode"], "SAMPLE_BOOTSTRAP")
        self.assertEqual(today["preMarketInput"]["tradeDate"], "2026-05-25")
        self.assertEqual(today["auctionInput"]["tradeDate"], "2026-05-25")

    def test_marks_fixture_fallback_when_real_source_fails(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "data"

            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--trade-date",
                    "2026-05-25",
                    "--stage",
                    "premarket",
                    "--source",
                    "eastmoney",
                    "--fixture",
                    str(FIXTURE),
                    "--output-dir",
                    str(output_dir),
                    "--eastmoney-theme-count",
                    "0",
                ],
                check=True,
            )

            today = json.loads((output_dir / "today.json").read_text(encoding="utf-8"))
            history_exists = (output_dir / "history" / "2026-05-25.json").exists()

        self.assertEqual(today["source"]["mode"], "SAMPLE_FALLBACK")
        self.assertIn("fallbackReason", today["source"])
        self.assertEqual(today["preMarketInput"]["dataCompleteness"], "MISSING")
        self.assertEqual(today["preMarketInput"]["tradeDate"], "2026-05-25")
        self.assertTrue(history_exists)

    def test_generated_at_records_beijing_timestamp_instead_of_date_only(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "data"

            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--now-utc",
                    "2026-05-24T16:35:20Z",
                    "--stage",
                    "premarket",
                    "--source",
                    "fixture",
                    "--fixture",
                    str(FIXTURE),
                    "--output-dir",
                    str(output_dir),
                ],
                check=True,
            )

            today = json.loads((output_dir / "today.json").read_text(encoding="utf-8"))

        self.assertEqual(today["tradeDate"], "2026-05-25")
        self.assertEqual(today["generatedAt"], "2026-05-25T00:35:20+08:00")

    def test_auction_failure_preserves_existing_premarket_input(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "data"

            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--trade-date",
                    "2026-05-25",
                    "--stage",
                    "premarket",
                    "--source",
                    "fixture",
                    "--fixture",
                    str(FIXTURE),
                    "--output-dir",
                    str(output_dir),
                ],
                check=True,
            )
            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--trade-date",
                    "2026-05-25",
                    "--stage",
                    "auction",
                    "--source",
                    "eastmoney",
                    "--fixture",
                    str(FIXTURE),
                    "--output-dir",
                    str(output_dir),
                    "--eastmoney-theme-count",
                    "0",
                ],
                check=True,
            )

            today = json.loads((output_dir / "today.json").read_text(encoding="utf-8"))

        self.assertEqual(today["source"]["mode"], "REAL_PARTIAL_AUCTION_MISSING")
        self.assertEqual(today["preMarketInput"]["dataCompleteness"], "FULL")
        self.assertNotIn("auctionInput", today)
        self.assertIn("auctionFailureReason", today["source"])

    def test_late_auction_run_preserves_existing_auction_input(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "data"

            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--trade-date",
                    "2026-05-25",
                    "--stage",
                    "auction",
                    "--source",
                    "fixture",
                    "--fixture",
                    str(FIXTURE),
                    "--output-dir",
                    str(output_dir),
                ],
                check=True,
            )
            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--trade-date",
                    "2026-05-25",
                    "--stage",
                    "auction",
                    "--source",
                    "eastmoney",
                    "--fixture",
                    str(FIXTURE),
                    "--output-dir",
                    str(output_dir),
                    "--now-utc",
                    "2026-05-25T07:00:00Z",
                ],
                check=True,
            )

            today = json.loads((output_dir / "today.json").read_text(encoding="utf-8"))

        self.assertEqual(today["auctionInput"]["dataCompleteness"], "MANUAL_AUCTION")
        self.assertEqual(today["source"]["mode"], "REAL_PARTIAL_AUCTION_PRESERVED")

    def test_premarket_stage_does_not_write_auction_input(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "data"

            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--trade-date",
                    "2026-05-25",
                    "--stage",
                    "premarket",
                    "--source",
                    "fixture",
                    "--fixture",
                    str(FIXTURE),
                    "--output-dir",
                    str(output_dir),
                ],
                check=True,
            )

            today = json.loads((output_dir / "today.json").read_text(encoding="utf-8"))

        self.assertIn("preMarketInput", today)
        self.assertNotIn("auctionInput", today)

    def test_premarket_stage_preserves_existing_auction_input(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir) / "data"

            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--trade-date",
                    "2026-05-25",
                    "--stage",
                    "auction",
                    "--source",
                    "fixture",
                    "--fixture",
                    str(FIXTURE),
                    "--output-dir",
                    str(output_dir),
                ],
                check=True,
            )
            subprocess.run(
                [
                    sys.executable,
                    str(SCRIPT),
                    "--trade-date",
                    "2026-05-25",
                    "--stage",
                    "premarket",
                    "--source",
                    "fixture",
                    "--fixture",
                    str(FIXTURE),
                    "--output-dir",
                    str(output_dir),
                ],
                check=True,
            )

            today = json.loads((output_dir / "today.json").read_text(encoding="utf-8"))

        self.assertIn("auctionInput", today)
        self.assertEqual(today["auctionInput"]["dataCompleteness"], "MANUAL_AUCTION")


if __name__ == "__main__":
    unittest.main()
