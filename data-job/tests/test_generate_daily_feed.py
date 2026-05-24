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
    def test_writes_today_and_history_feed_files(self):
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
