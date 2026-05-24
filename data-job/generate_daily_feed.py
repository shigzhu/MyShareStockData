import argparse
import json
from copy import deepcopy
from datetime import date
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate the GitHub-hosted A-share recommendation feed.")
    parser.add_argument("--trade-date", default=date.today().isoformat(), help="Trade date in YYYY-MM-DD format.")
    parser.add_argument(
        "--stage",
        choices=["premarket", "auction"],
        default="auction",
        help="premarket writes only 8:30 data; auction also writes 9:25 data.",
    )
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


def load_existing_feed(output_dir: Path, trade_date: str) -> dict:
    today_path = output_dir / "today.json"

    if not today_path.exists():
        return {}

    try:
        existing = json.loads(today_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}

    if existing.get("tradeDate") != trade_date:
        return {}

    return existing


def build_feed(trade_date: str, trading_day_input: dict, stage: str, existing_feed: dict | None = None) -> dict:
    pre_market_input = deepcopy(trading_day_input)
    auction_input = deepcopy(trading_day_input)
    auction_input["dataCompleteness"] = "MANUAL_AUCTION"
    existing_feed = existing_feed or {}

    feed = {
        "schemaVersion": 1,
        "tradeDate": trade_date,
        "generatedAt": date.today().isoformat(),
        "source": {
            "mode": "SAMPLE_BOOTSTRAP",
            "description": "样本启动数据。后续接入 AkShare/Tushare/讨论热度适配器后替换。"
        },
        "preMarketInput": pre_market_input
    }

    if stage == "auction":
        feed["auctionInput"] = auction_input
    elif "auctionInput" in existing_feed:
        feed["auctionInput"] = existing_feed["auctionInput"]

    return feed


def write_feed(feed: dict, output_dir: Path) -> None:
    history_dir = output_dir / "history"
    history_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)

    text = json.dumps(feed, ensure_ascii=False, indent=2)
    (output_dir / "today.json").write_text(text + "\n", encoding="utf-8")
    (history_dir / f"{feed['tradeDate']}.json").write_text(text + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    output_dir = Path(args.output_dir)
    trading_day_input = load_fixture(Path(args.fixture), args.trade_date)
    existing_feed = load_existing_feed(output_dir, args.trade_date)
    feed = build_feed(args.trade_date, trading_day_input, args.stage, existing_feed)
    write_feed(feed, output_dir)


if __name__ == "__main__":
    main()
