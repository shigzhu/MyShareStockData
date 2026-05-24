import argparse
import json
from copy import deepcopy
from datetime import date
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the GitHub-hosted A-share recommendation feed.")
    parser.add_argument("--trade-date", default=date.today().isoformat(), help="Trade date in YYYY-MM-DD format.")
    parser.add_argument(
        "--fixture",
        default=str(Path(__file__).with_name("fixtures") / "sample_trading_day.json"),
        help="Bootstrap TradingDayInput JSON fixture.",
    )
    parser.add_argument("--output-dir", default="data", help="Output directory for today.json and history files.")
    return parser.parse_args()


def load_fixture(path: Path, trade_date: str) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["tradeDate"] = trade_date
    return payload


def build_feed(trade_date: str, trading_day_input: dict) -> dict:
    pre_market_input = deepcopy(trading_day_input)
    auction_input = deepcopy(trading_day_input)
    auction_input["dataCompleteness"] = "MANUAL_AUCTION"

    return {
        "schemaVersion": 1,
        "tradeDate": trade_date,
        "generatedAt": date.today().isoformat(),
        "source": {
            "mode": "SAMPLE_BOOTSTRAP",
            "description": "样本启动数据。后续接入 AkShare/Tushare/讨论热度适配器后替换。"
        },
        "preMarketInput": pre_market_input,
        "auctionInput": auction_input
    }


def write_feed(feed: dict, output_dir: Path) -> None:
    history_dir = output_dir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    text = json.dumps(feed, ensure_ascii=False, indent=2)
    (output_dir / "today.json").write_text(text + "\n", encoding="utf-8")
    (history_dir / f"{feed['tradeDate']}.json").write_text(text + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    trading_day_input = load_fixture(Path(args.fixture), args.trade_date)
    feed = build_feed(args.trade_date, trading_day_input)
    write_feed(feed, Path(args.output_dir))


if __name__ == "__main__":
    main()
